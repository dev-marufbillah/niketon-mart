import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import type { Product } from "@/lib/types/domain";
import { getStorefrontCatalogue } from "@/lib/catalogue/repository";
import { catalogueDisplayPrice } from "@/lib/catalogue/display-price";

/**
 * Wishlists
 * ---------
 * Account wishlists belong to the authenticated customer id. A distinct random
 * token permits read-only sharing. Old token-only guest records remain stored,
 * but are never silently attached by email or by whoever uses the browser next.
 */

export type WishlistItem = {
  productId: string;
  /** Optional variation the shopper had selected when saving. */
  variantLabel?: string;
  addedAt: string;
};

export type Wishlist = Row & {
  /** Private write capability; never put this in a share URL. */
  token: string;
  /** Separate read-only capability suitable for a public share link. */
  shareToken?: string;
  items: WishlistItem[];
  /** Server-bound identity; older guest records do not have one. */
  ownerCustomerId?: string;
  ownerEmail?: string;
  createdAt: string;
  updatedAt: string;
};

export const MAX_WISHLIST_ITEMS = 100;

const now = () => new Date().toISOString();

function newToken() {
  return randomBytes(20).toString("hex");
}

/** Accept only products currently visible on the storefront. */
async function liveProductIds(): Promise<Set<string>> {
  const { products } = await getStorefrontCatalogue();
  return new Set(products.map((product) => product.id));
}

/**
 * Cleans whatever the browser sent: strings only, no duplicates, no products
 * that have been deleted, at most `MAX_WISHLIST_ITEMS`, oldest first so the
 * "date added" the shopper sees never jumps around.
 */
export async function normaliseItems(input: unknown): Promise<WishlistItem[]> {
  if (!Array.isArray(input)) return [];
  const live = await liveProductIds();
  const seen = new Set<string>();
  const items: WishlistItem[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Partial<WishlistItem>;
    if (typeof entry.productId !== "string" || !live.has(entry.productId)) continue;
    if (seen.has(entry.productId)) continue;
    seen.add(entry.productId);
    const addedAt =
      typeof entry.addedAt === "string" && !Number.isNaN(Date.parse(entry.addedAt))
        ? new Date(entry.addedAt).toISOString()
        : now();
    items.push({
      productId: entry.productId,
      variantLabel: typeof entry.variantLabel === "string" ? entry.variantLabel.slice(0, 60) : undefined,
      addedAt,
    });
    if (items.length >= MAX_WISHLIST_ITEMS) break;
  }

  return items;
}

const accountWishlistId = (customerId: string) => `account_wishlist_${createHash("sha256").update(customerId).digest("hex")}`;

/** The caller must supply an id derived from an authenticated server session. */
export async function getAccountWishlist(customerId: string): Promise<Wishlist | null> {
  const db = await ensureDatabase();
  const wishlist = await db.get<Wishlist>("wishlists", accountWishlistId(customerId));
  if (wishlist && wishlist.ownerCustomerId !== customerId) throw new Error("Wishlist ownership requires review.");
  return wishlist;
}

async function getWishlistByShareToken(token: string | undefined | null): Promise<Wishlist | null> {
  if (!token || !/^[a-f0-9]{16,40}$/i.test(token)) return null;
  const db = await ensureDatabase();
  const rows = await db.list<Wishlist>("wishlists", { where: { shareToken: token } });
  return rows.find((row) => row.shareToken !== row.token) ?? null;
}

/** Write only the authenticated account's list. A deterministic id makes
 * first creation unique in Mongo and within one file-driver process. */
export async function saveAccountWishlist(customerId: string, items: unknown): Promise<Wishlist | null> {
  const db = await ensureDatabase();
  const clean = await normaliseItems(items);
  let existing = await getAccountWishlist(customerId);
  if (!existing && !clean.length) return null;
  if (!existing) {
    try {
      return await db.insert<Wishlist>("wishlists", {
        id: accountWishlistId(customerId), ownerCustomerId: customerId,
        token: newToken(), shareToken: newToken(), items: clean, createdAt: now(), updatedAt: now(),
      });
    } catch (error) {
      existing = await getAccountWishlist(customerId);
      if (!existing) throw error;
    }
  }
  const updated = await db.compareAndUpdate<Wishlist>("wishlists", existing.id, { ownerCustomerId: customerId }, {
    items: clean, shareToken: existing.shareToken && existing.shareToken !== existing.token ? existing.shareToken : newToken(), updatedAt: now(),
  });
  if (!updated) throw new Error("Wishlist changed while saving.");
  return updated;
}

/* -------------------------------------------------------------------------- */
/* Admin analytics                                                             */
/* -------------------------------------------------------------------------- */

export type WishlistStats = {
  lists: number;
  items: number;
  averageItems: number;
  /** Most saved products, newest catalogue data attached. */
  mostWishlisted: {
    productId: string;
    name: string;
    slug: string;
    image: string;
    price: number;
    stock: number;
    saved: number;
  }[];
  /** Products people want but cannot buy right now — a restock signal. */
  outOfStockDemand: { productId: string; name: string; saved: number; stock: number }[];
  lastUpdatedAt?: string;
};

/**
 * Demand summary for the admin.
 * Deliberately aggregate: no customer identifiers, no per-list contents, so the
 * marketing team can see what is wanted without seeing anyone's private list.
 */
export async function wishlistStats(limit = 8): Promise<WishlistStats> {
  const db = await ensureDatabase();
  const [lists, products] = await Promise.all([
    db.list<Wishlist>("wishlists"),
    db.list<Product>("products"),
  ]);

  const counts = new Map<string, number>();
  let itemCount = 0;
  let lastUpdatedAt: string | undefined;

  for (const list of lists) {
    for (const item of list.items ?? []) {
      counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1);
      itemCount += 1;
    }
    if (list.updatedAt && (!lastUpdatedAt || list.updatedAt > lastUpdatedAt)) lastUpdatedAt = list.updatedAt;
  }

  const index = new Map(products.map((product) => [product.id, product]));
  const ranked = [...counts.entries()]
    .map(([productId, saved]) => {
      const product = index.get(productId);
      if (!product) return null;
      return {
        productId,
        name: product.name,
        slug: product.slug,
        image: product.image,
        price: product.price,
        stock: product.stock ?? 0,
        saved,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.saved - a.saved || a.name.localeCompare(b.name));

  return {
    lists: lists.length,
    items: itemCount,
    averageItems: lists.length ? Math.round((itemCount / lists.length) * 10) / 10 : 0,
    mostWishlisted: ranked.slice(0, limit),
    outOfStockDemand: ranked.filter((entry) => entry.stock <= 0).slice(0, 5),
    lastUpdatedAt,
  };
}

/** Read-only view of a shared list, for the `/wishlist?list=<token>` page. */
export async function getSharedWishlistProducts(token: string | undefined | null) {
  const list = await getWishlistByShareToken(token);
  if (!list) return null;
  const { products } = await getStorefrontCatalogue();
  const index = new Map(products.map((product) => [product.id, product]));

  return {
    items: (list.items ?? [])
      .map((item) => {
        const product = index.get(item.productId);
        if (!product) return null;
        if (product.visibility === "hidden") return null;
        return {
          productId: product.id,
          name: product.name,
          slug: product.slug,
          image: product.image,
          unit: product.unit,
          priceLabel: catalogueDisplayPrice(product).label,
          rating: product.rating,
          reviewCount: product.reviewCount,
          categoryLabel: product.categoryLabel,
          stock: product.stock ?? 0,
          addedAt: item.addedAt,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
  };
}

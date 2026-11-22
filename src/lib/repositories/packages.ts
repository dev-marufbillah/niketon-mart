import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import type { Product } from "@/lib/types/domain";
import { getProductsByIds } from "@/lib/catalogue/repository";

/**
 * Product bundles: the daily / weekly grocery baskets a household can order in
 * one go. They are real catalogue entities with their own pricing, availability
 * and admin module. Historical business records remain in the owner’s archive.
 */

export type Basket = Row & {
  slug: string;
  name: string;
  cadence: "daily" | "weekly" | "monthly";
  description: string;
  price: number;
  compareAtPrice?: number;
  items: { productId: string; quantity: number }[];
  image: string;
  visible: boolean;
  available: boolean;
  order: number;
};

export async function getBaskets(includeHidden = false): Promise<Basket[]> {
  const db = await ensureDatabase();
  const rows = await db.list<Basket>("baskets");
  return rows
    .filter((row) => includeHidden || (row.visible && row.available))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getBasketBySlug(slug: string) {
  const db = await ensureDatabase();
  const rows = await db.list<Basket>("baskets", { where: { slug } });
  const basket = rows[0];
  if (!basket || !basket.visible) return null;
  const items = await resolveBasketItems(basket);
  return { basket, items };
}

export async function resolveBasketItems(basket: Basket) {
  const products = await getProductsByIds(basket.items.map((item) => item.productId));
  const index = new Map(products.map((product) => [product.id, product]));
  return basket.items
    .map((item) => {
      const product = index.get(item.productId);
      if (!product) return null;
      return { product, quantity: item.quantity };
    })
    .filter((entry): entry is { product: Product; quantity: number } => Boolean(entry));
}


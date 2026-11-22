import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { categories as categorySeed } from "@/lib/data/categories";
import { brandSeed, productTypeSeed } from "@/lib/data/brands";
import { products as productSeed } from "@/lib/data/products";
import type { Product } from "@/lib/types/domain";
import type { CatalogueDocument } from "@/lib/catalogue/types";

/**
 * Catalogue store
 * ---------------
 * Products, categories, brands and product types live in one document so an
 * admin edit is a single atomic write. The seed modules are only used to
 * materialise the document the first time the app runs.
 *
 * Storage is isolated in `readDocument` / `writeDocument`: swap this file for a
 * Postgres or KV adapter and every caller keeps working.
 */

const STORE_DIR = process.env.CONTENT_STORE_DIR ?? path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "catalogue.json");
const DOCUMENT_VERSION = 1;
const LOW_STOCK_THRESHOLD = 10;

type CacheEntry = { mtimeMs: number; document: CatalogueDocument };
let cache: CacheEntry | null = null;
let memoryFallback: CatalogueDocument | null = null;

export function availabilityForStock(stock: number): Product["availability"] {
  if (stock <= 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

function seedDocument(): CatalogueDocument {
  return {
    version: DOCUMENT_VERSION,
    updatedAt: new Date(0).toISOString(),
    products: productSeed.map((product) => ({
      ...product,
      status: product.status ?? "active",
      visibility: product.visibility ?? "visible",
      stock: product.stock ?? 0,
      attributes: product.attributes ?? [],
      availability: availabilityForStock(product.stock ?? 0),
    })),
    categories: categorySeed.map((category) => ({ ...category, visible: category.visible ?? true })),
    brands: brandSeed.map((brand) => ({ ...brand, visible: brand.visible ?? true })),
    productTypes: productTypeSeed.map((type) => ({ ...type, visible: type.visible ?? true })),
  };
}

/** Repairs partially written/legacy documents without dropping admin edits. */
function normaliseDocument(raw: unknown): CatalogueDocument {
  const fallback = seedDocument();
  const source = (raw ?? {}) as Partial<CatalogueDocument>;

  const products = Array.isArray(source.products)
    ? source.products
        .filter((product): product is Product => Boolean(product) && typeof product.id === "string")
        .map((product) => {
          const stock = Number.isFinite(product.stock) ? Number(product.stock) : 0;
          return {
            ...product,
            stock,
            status: product.status ?? "active",
            visibility: product.visibility ?? "visible",
            attributes: Array.isArray(product.attributes) ? product.attributes : [],
            availability: availabilityForStock(stock),
          } as Product;
        })
    : fallback.products;

  return {
    version: DOCUMENT_VERSION,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : fallback.updatedAt,
    products,
    categories: Array.isArray(source.categories) && source.categories.length ? source.categories : fallback.categories,
    brands: Array.isArray(source.brands) && source.brands.length ? source.brands : fallback.brands,
    productTypes: Array.isArray(source.productTypes) && source.productTypes.length ? source.productTypes : fallback.productTypes,
  };
}

async function writeDocument(document: CatalogueDocument): Promise<void> {
  await fs.mkdir(STORE_DIR, { recursive: true });
  const temp = `${STORE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(document, null, 2), "utf8");
  await fs.rename(temp, STORE_FILE);
  const stat = await fs.stat(STORE_FILE);
  cache = { mtimeMs: stat.mtimeMs, document };
  memoryFallback = document;
}

async function readDocument(): Promise<CatalogueDocument> {
  try {
    const stat = await fs.stat(STORE_FILE);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.document;

    const raw = await fs.readFile(STORE_FILE, "utf8");
    const document = normaliseDocument(JSON.parse(raw) as unknown);
    cache = { mtimeMs: stat.mtimeMs, document };
    memoryFallback = document;
    return document;
  } catch {
    // No document yet (or an unreadable/read-only filesystem): seed one.
    if (memoryFallback) return memoryFallback;
    const seeded = seedDocument();
    memoryFallback = seeded;
    try {
      await writeDocument(seeded);
    } catch {
      // Read-only host — serve the seed from memory and let writes report the error.
    }
    return seeded;
  }
}

export async function readCatalogue(): Promise<CatalogueDocument> {
  return readDocument();
}

export async function commitCatalogue(
  mutate: (current: CatalogueDocument) => CatalogueDocument,
): Promise<CatalogueDocument> {
  const current = await readDocument();
  const next = mutate(current);
  const document: CatalogueDocument = {
    ...next,
    version: DOCUMENT_VERSION,
    updatedAt: new Date().toISOString(),
    products: next.products.map((product) => ({
      ...product,
      availability: availabilityForStock(product.stock ?? 0),
    })),
  };
  await writeDocument(document);
  return document;
}

export const catalogueStorage = {
  file: STORE_FILE,
  dir: STORE_DIR,
  lowStockThreshold: LOW_STOCK_THRESHOLD,
};

import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Database, Row } from "@/lib/db/types";
import type { Product } from "@/lib/types/domain";

/**
 * Inventory ledger.
 * Every stock change — order, adjustment, restock, cancellation — writes an
 * immutable movement row. The product's `stock` is the current balance and the
 * ledger explains how it got there.
 */

export type StockMovement = Row & {
  productId: string;
  productName: string;
  delta: number;
  balance: number;
  reason: string;
  reference?: string;
  note?: string;
  actor: string;
  createdAt: string;
};

export const movementReasons = [
  "order-placed",
  "order-cancelled",
  "admin-adjustment",
  "admin-edit",
  "restock",
  "damaged",
  "returned",
  "product-created",
  "product-deleted",
  "initial-stock",
] as const;

export async function addStockMovement(input: {
  productId: string;
  productName: string;
  delta: number;
  balance: number;
  reason: string;
  actor: string;
  reference?: string;
  note?: string;
}, transaction?: Database): Promise<StockMovement> {
  const db = transaction ?? await ensureDatabase();
  return db.insert<StockMovement>("stock_movements", {
    ...input,
    createdAt: new Date().toISOString(),
  });
}

export async function listStockMovements(options: { productId?: string; limit?: number } = {}) {
  const db = await ensureDatabase();
  const rows = await db.list<StockMovement>(
    "stock_movements",
    options.productId ? { where: { productId: options.productId } } : undefined,
  );
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return options.limit ? rows.slice(0, options.limit) : rows;
}

export type StockAdjustment = {
  productId: string;
  /** Either a delta (+/-) or an absolute target balance. */
  change: { type: "delta" | "absolute"; value: number };
  /** Displayed balance when the admin opened an absolute adjustment. */
  expectedStock?: number;
  reason: string;
  note?: string;
  actor: string;
};
type StockAdjustmentResult = { ok: true; product: Product } | { ok: false; error: string };

/** Internal operation; the server action must enforce inventory permission.
 * Mongo stock and ledger writes use one transaction; the file driver remains
 * development-only and does not provide cross-process transactions. */
export async function adjustStockInDatabase(db: Database, input: StockAdjustment): Promise<StockAdjustmentResult> {
  if (!Number.isSafeInteger(input.change.value) || (input.change.type === "delta" && input.change.value === 0)) {
    return { ok: false, error: "Enter a valid whole-number stock change." };
  }
  if (input.change.type === "absolute" && (!Number.isSafeInteger(input.expectedStock) || (input.expectedStock ?? -1) < 0)) {
    return { ok: false, error: "Refresh inventory before setting an exact stock level." };
  }
  const apply = async (tx: Database): Promise<StockAdjustmentResult> => {
    const product = await tx.get<Product>("products", input.productId);
    if (!product) return { ok: false, error: "Product not found." };
    const current = product.stock ?? 0;
    if (!Number.isSafeInteger(current) || current < 0) return { ok: false, error: "Current stock needs manual review." };
    if (input.change.type === "absolute" && input.expectedStock !== current) {
      return { ok: false, error: "Stock changed since the form was loaded. Refresh and review the current balance." };
    }
    const next = input.change.type === "absolute" ? input.change.value : current + input.change.value;
    if (!Number.isSafeInteger(next) || next < 0) return { ok: false, error: "Stock cannot go below zero." };
    if (next === current) return { ok: false, error: "That change would not alter the stock level." };
    const availability = next <= 0 ? "out_of_stock" : next <= 10 ? "low_stock" : "in_stock";
    const updated = await tx.update<Product>("products", product.id, { stock: next, availability });
    if (!updated) return { ok: false, error: "Product not found." };
    await addStockMovement({
      productId: product.id, productName: product.name, delta: next - current, balance: next,
      reason: input.reason, note: input.note, actor: input.actor,
    }, tx);
    return { ok: true, product: updated };
  };
  if (db.driver === "mongo") {
    if (!db.withTransaction) return { ok: false, error: "A transaction-capable database is required for inventory changes." };
    return db.withTransaction(apply);
  }
  return apply(db);
}

export async function adjustStock(input: StockAdjustment): Promise<StockAdjustmentResult> {
  const db = await ensureDatabase();
  const result = await adjustStockInDatabase(db, input);
  if (!result.ok) return result;
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/home-grocery");
  revalidatePath("/admin/inventory");
  revalidatePath(`/product/${result.product.slug}`);
  return result;
}

export async function getInventoryOverview() {
  const db = await ensureDatabase();
  const products = await db.list<Product>("products");
  const movements = await listStockMovements({ limit: 40 });
  const value = products.reduce((total, product) => total + (product.stock ?? 0) * product.price, 0);

  return {
    products,
    movements,
    stats: {
      skus: products.length,
      units: products.reduce((total, product) => total + (product.stock ?? 0), 0),
      value,
      out: products.filter((product) => (product.stock ?? 0) <= 0).length,
      low: products.filter((product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 10).length,
    },
  };
}

import type { CartLine, Product, ProductOptionGroup } from "@/lib/types/domain";

/**
 * Cart lines
 * ----------
 * A cart line is identified by product + selected variation, so "Oranges 500 g"
 * and "Oranges 1 Kg" are two separate lines instead of one confusing row. The
 * helpers here are used by the cart store, the drawer, the cart page and
 * checkout so every surface agrees on price and identity.
 */

export function cartLineKey(
  line: Pick<CartLine, "productId" | "variantLabel" | "preparation">,
): string {
  const base = line.variantLabel ? `${line.productId}::${line.variantLabel}` : line.productId;
  // Two preparations of the same product are two lines, never one that
  // silently replaces the other.
  return line.preparation?.signature ? `${base}::prep:${line.preparation.signature}` : base;
}

/** Options in a group, keeping the admin-defined order. */
export function optionsFor(product: Product): ProductOptionGroup[] {
  return (product.options ?? []).filter((group) => group.values.length > 0);
}

export function defaultSelection(product: Product): { group: string; value: string } | null {
  for (const group of optionsFor(product)) {
    const value = group.values.find((entry) => entry.isDefault) ?? group.values[0];
    if (value) return { group: group.name, value: value.label };
  }
  return null;
}

/** Unit price for a product, or for one of its variations. */
export function unitPrice(product: Product, variantLabel?: string): number {
  if (!variantLabel) return product.price;
  for (const group of product.options ?? []) {
    const value = group.values.find((entry) => entry.label === variantLabel);
    if (value && typeof value.price === "number" && value.price > 0) return value.price;
  }
  return product.price;
}

export function unitCompareAt(product: Product, variantLabel?: string): number | undefined {
  if (variantLabel) {
    for (const group of product.options ?? []) {
      const value = group.values.find((entry) => entry.label === variantLabel);
      if (value) return value.compareAtPrice ?? product.compareAtPrice;
    }
  }
  return product.compareAtPrice;
}

/** Stock ceiling is bounded by both the parent product and its variation. */
export function unitStock(product: Product, variantLabel?: string): number {
  const baseStock = typeof product.stock === "number" && Number.isFinite(product.stock) ? Math.max(0, product.stock) : 0;
  if (variantLabel) {
    for (const group of product.options ?? []) {
      const value = group.values.find((entry) => entry.label === variantLabel);
      if (value && typeof value.stock === "number") {
        return Number.isFinite(value.stock) ? Math.min(baseStock, Math.max(0, value.stock)) : 0;
      }
    }
  }
  return baseStock;
}

/** Per-unit preparation charge captured on the line (0 when nothing was cut). */
export function linePreparationCharge(line: CartLine): number {
  return Math.round((line.preparation?.chargePerUnit ?? 0) * 100) / 100;
}

/** Unit price including preparation — what one unit of this line really costs. */
export function lineUnitPrice(line: CartLine, product: Product | undefined): number {
  const base = product ? unitPrice(product, line.variantLabel) : (line.variantPrice ?? 0);
  return Math.round((base + linePreparationCharge(line)) * 100) / 100;
}

export function linePrice(line: CartLine, product: Product | undefined): number {
  return Math.round(lineUnitPrice(line, product) * line.quantity * 100) / 100;
}

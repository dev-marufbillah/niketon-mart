import type { Product } from "@/lib/types/domain";

/** Quick-add must not bypass variations, preparation or purchase quantity. */
export function needsPurchaseChoices(product: Product): boolean {
  return Boolean((product.options ?? []).some((group) => group.values.length > 0) ||
    product.preparation?.enabled || (product.selling?.minQuantity ?? 1) > 1 || (product.selling?.step ?? 1) > 1);
}

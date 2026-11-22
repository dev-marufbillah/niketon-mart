import type { Product } from "@/lib/types/domain";
import { formatPrice, isSafeTakaAmount } from "@/lib/utils/currency";

/** Catalogue pricing is indicative only; the server quote prices the actual
 * selection. A single group's lowest IN-STOCK option may be shown as "From".
 * Preparation costs are not included in the base, so that is made explicit.
 * Ambiguous combinations and malformed legacy prices are never advertised as
 * a purchasable base price. */
export type CatalogueDisplayPrice = {
  label: string;
  amount?: number;
  compareAtPrice?: number;
};
export function catalogueDisplayPrice(product: Product): CatalogueDisplayPrice {
  const review = { label: "Price under review" };
  if (!isSafeTakaAmount(product.price) || product.price <= 0) return review;
  const groups = (product.options ?? []).filter((group) => group.values.length > 0);
  if (groups.length > 1) return review;
  let amount = product.price;
  if (groups.length === 1) {
    const values = groups[0].values;
    const labels = values.map((option) => option.label.trim().toLowerCase());
    if (labels.some((label) => !label) || new Set(labels).size !== labels.length ||
        values.some((option) => option.price != null && (!isSafeTakaAmount(option.price) || option.price <= 0)) ||
        values.some((option) => option.stock != null && (!Number.isSafeInteger(option.stock) || option.stock < 0))) return review;
    const available = values.filter((option) => option.stock == null || option.stock > 0);
    const candidates = available.length ? available : values;
    amount = Math.min(...candidates.map((option) => option.price ?? product.price));
  }
  const preparation = Boolean(product.preparation?.enabled && product.preparation.groups?.some((group) => group.options.length));
  const prefix = preparation ? (groups.length ? "Base from " : "Base ") : groups.length ? "From " : "";
  // A compare-at price for an arbitrary option/base is not proof of a discount
  // on every selection, or on preparation. Do not show one in those cases.
  const compareAtPrice = !groups.length && !preparation && isSafeTakaAmount(product.compareAtPrice) && product.compareAtPrice > amount
    ? product.compareAtPrice : undefined;
  return { label: `${prefix}${formatPrice(amount)}`, amount, compareAtPrice };
}

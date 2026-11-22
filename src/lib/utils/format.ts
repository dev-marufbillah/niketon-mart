/**
 * Presentation helpers.
 *
 * Currency formatting is centralised in `./currency` (Bangladeshi Taka only).
 * It is re-exported here so the many existing `formatPrice` imports keep
 * working while there remains exactly one formatter in the codebase.
 */
export {
  CURRENCY_CODE,
  CURRENCY_LOCALE,
  CURRENCY_SYMBOL,
  formatAmount,
  formatPrice,
  formatPriceBare,
  round2,
} from "./currency";

export function discountPercent(price: number, compareAt?: number): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-BD").format(value);
}

import type { Money } from "@/lib/types/domain";

/**
 * Centralised Bangladeshi Taka formatting — the single source of truth for
 * every currency string in Niketon Mart (storefront, admin, cart, checkout,
 * orders, invoices, reports, error messages).
 *
 * Rules enforced here:
 *  - The only currency is Bangladeshi Taka (`BDT`, symbol `৳`). There is no
 *    USD / `$` formatting anywhere in the application.
 *  - Grouping follows the Bangladeshi convention (lakh / crore):
 *    `৳ 120`, `৳ 1,250`, `৳ 12,500`, `৳ 1,25,000`.
 *  - Catalogue and order amounts are numeric taka; `Money.amount` (where used)
 *    is integer poisha. Formatting is presentation-only. Calculations round to
 *    poisha on the server; the existing number-based storage is not a full
 *    arbitrary-precision ledger and should be audited before production.
 *
 * Note on locales: ICU's `en-BD` data currently emits western grouping
 * (`125,000`), which contradicts the documented Bangladeshi convention shown
 * above, so the digit grouping is deliberately taken from `en-IN` (same
 * lakh/crore scheme, Latin digits) while the symbol and code stay BDT.
 */

export const CURRENCY_CODE = "BDT";
export const CURRENCY_SYMBOL = "৳";
/** Locale tag for date/number-adjacent BD presentation. */
export const CURRENCY_LOCALE = "en-BD";

const integerFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const fractionFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Convert numeric taka to whole poisha for summation; do not use on untrusted NaN/Infinity. */
export function toPoisha(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError("Amount must be finite");
  const adjusted = Math.abs(value) + Number.EPSILON * Math.max(1, Math.abs(value));
  return Math.sign(value) * Math.round(adjusted * 100);
}

/** Validate stored/input taka before using it as an amount; never silently
 * round a malformed, negative, sub-poisha or unsafe-integer value. */
export function isSafeTakaAmount(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  const scaled = value * 100;
  const cents = Math.round(scaled);
  return Number.isSafeInteger(cents) && Math.abs(scaled - cents) <= 0.0000001 && toPoisha(value) === cents;
}

/** Round a numeric taka value to the nearest poisha. */
export function round2(value: number): number {
  return toPoisha(value) / 100;
}

/** `125000` → `1,25,000` · `18.2` → `18.20` · `120` → `120` */
export function formatAmount(value: number): string {
  const rounded = round2(value);
  return (Number.isInteger(rounded) ? integerFormatter : fractionFormatter).format(rounded);
}

/** `125000` → `৳ 1,25,000` · accepts raw taka or a `Money` (cents) record. */
export function formatPrice(value: number | Money): string {
  if (typeof value !== "number" && value.currency !== CURRENCY_CODE) {
    throw new Error("A non-BDT amount cannot be formatted as BDT");
  }
  const amount = typeof value === "number" ? value : value.amount / 100;
  return `${CURRENCY_SYMBOL} ${formatAmount(amount)}`;
}

/** Same as {@link formatPrice} without the symbol, for tight table cells. */
export function formatPriceBare(value: number | Money): string {
  if (typeof value !== "number" && value.currency !== CURRENCY_CODE) {
    throw new Error("A non-BDT amount cannot be formatted as BDT");
  }
  const amount = typeof value === "number" ? value : value.amount / 100;
  return formatAmount(amount);
}

import { isSafeTakaAmount, toPoisha } from "@/lib/utils/currency";

/** Shared quote/order arithmetic. Client prices are never authoritative. */
export function validCommerceRules(rules: {
  freeShippingThreshold: unknown;
  defaultDeliveryFee: unknown;
  minOrderValue: unknown;
  taxRate: unknown;
}): boolean {
  const rate = rules.taxRate;
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 100) return false;
  // Tax is expressed to two decimal percentage points (integer basis points).
  const basisPoints = rate * 100;
  return Math.abs(basisPoints - Math.round(basisPoints)) <= 0.0000001 &&
    isSafeTakaAmount(rules.freeShippingThreshold) &&
    isSafeTakaAmount(rules.defaultDeliveryFee) &&
    isSafeTakaAmount(rules.minOrderValue);
}

export function calculateCheckoutMoney(
  subtotal: unknown,
  discount: unknown,
  deliveryFee: unknown,
  taxRate: unknown,
): { ok: true; tax: number; total: number } | { ok: false } {
  if (!isSafeTakaAmount(subtotal) || !isSafeTakaAmount(discount) || !isSafeTakaAmount(deliveryFee) ||
      typeof taxRate !== "number" || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return { ok: false };
  const basisPoints = Math.round(taxRate * 100);
  if (Math.abs(taxRate * 100 - basisPoints) > 0.0000001) return { ok: false };
  const base = toPoisha(subtotal);
  const saved = toPoisha(discount);
  if (saved > base) return { ok: false };
  const taxable = base - saved;
  const numerator = taxable * basisPoints;
  // Refuse precision loss instead of presenting an inaccurate order total.
  if (!Number.isSafeInteger(numerator)) return { ok: false };
  const taxPoisha = Math.round(numerator / 10_000);
  const totalPoisha = taxable + toPoisha(deliveryFee) + taxPoisha;
  if (!Number.isSafeInteger(taxPoisha) || !Number.isSafeInteger(totalPoisha) ||
      !isSafeTakaAmount(taxPoisha / 100) || !isSafeTakaAmount(totalPoisha / 100)) return { ok: false };
  return { ok: true, tax: taxPoisha / 100, total: totalPoisha / 100 };
}

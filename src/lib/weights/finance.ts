import type { Order } from "@/lib/repositories/orders";
import { toPoisha } from "@/lib/utils/currency";

/**
 * A weight change may only alter a complete, reconcilable, unpaid BDT order.
 * Do not infer a missing historical tax rate or re-price a recorded payment.
 */
const MAX_POISHA = Math.floor(Number.MAX_SAFE_INTEGER / 100);
const isMoney = (value: unknown): value is number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  const poisha = toPoisha(value);
  return Number.isSafeInteger(poisha) && poisha <= MAX_POISHA && Math.abs(value - poisha / 100) < 0.000001;
};

export function weightAdjustmentHoldReason(order: Order): string | null {
  if (order.currency !== "BDT") return "This order's currency needs manual review before weights can change.";
  if (["cancelled", "refunded", "delivered", "out_for_delivery"].includes(order.status)) {
    return "This order is closed or already out for delivery; weights cannot be changed.";
  }
  if (order.paymentStatus !== "unpaid") {
    return "Payment was recorded or a transfer is awaiting verification. Reconcile it manually before changing weights.";
  }
  // A legacy order's current discount may already have been capped by a prior
  // weight reduction. Never infer the original checkout discount from it.
  if (!isMoney(order.checkoutDiscount)) {
    return "The original checkout discount was not recorded. Review this historical order manually before changing weights.";
  }
  if (!Array.isArray(order.items) || order.items.length === 0 ||
      ![order.subtotal, order.discount, order.deliveryFee, order.tax, order.total].every(isMoney) ||
      typeof order.taxRate !== "number" || !Number.isFinite(order.taxRate) || order.taxRate < 0 || order.taxRate > 100) {
    return "The order is missing a trustworthy financial snapshot. Review it manually before changing weights.";
  }
  let subtotal = 0;
  for (const item of order.items) {
    if (!isMoney(item.lineTotal)) return "An order line has an invalid amount; review it before changing weights.";
    subtotal += toPoisha(item.lineTotal);
    if (subtotal > MAX_POISHA) return "The order amount is outside the supported range.";
    const weight = item.weight;
    if (weight?.status === "proposed" &&
        (!isMoney(weight.actualLineTotal) || toPoisha(weight.actualLineTotal) <= toPoisha(item.lineTotal))) {
      return "A saved weight proposal is inconsistent; ask the store to reweigh and review it manually.";
    }
  }
  const discount = toPoisha(order.discount);
  const frozenDiscount = toPoisha(order.checkoutDiscount);
  const taxable = subtotal - discount;
  const expectedTax = Math.round(taxable * order.taxRate / 100);
  const expectedTotal = taxable + toPoisha(order.deliveryFee) + expectedTax;
  if (subtotal !== toPoisha(order.subtotal) || discount !== Math.min(frozenDiscount, subtotal) ||
      taxable < 0 || expectedTax !== toPoisha(order.tax) || expectedTotal !== toPoisha(order.total) || expectedTotal > MAX_POISHA) {
    return "The order's recorded totals do not reconcile. Review the historical amounts manually before changing weights.";
  }
  return null;
}

/** Fields whose changes must invalidate a financial compare-and-update. */
export function orderFinancialExpectation(order: Order): Partial<Order> {
  return {
    updatedAt: order.updatedAt, status: order.status, paymentStatus: order.paymentStatus,
    payment: order.payment, currency: order.currency, items: order.items,
    subtotal: order.subtotal, discount: order.discount, checkoutDiscount: order.checkoutDiscount,
    deliveryFee: order.deliveryFee, tax: order.tax, taxRate: order.taxRate, total: order.total,
    timeline: order.timeline,
  };
}

/** Never mark a variable-weight order as paid/dispatched while a scale or customer decision is outstanding. */
export function hasUnresolvedWeights(order: Order): boolean {
  return order.items.some((item) => item.weight && (item.weight.status === "estimated" || item.weight.status === "proposed"));
}

import { createHash } from "node:crypto";
import type { Order } from "@/lib/repositories/orders";
import { orderFinancialExpectation } from "@/lib/weights/finance";
import { toPoisha } from "@/lib/utils/currency";

/** The exact persisted facts an authorised person reviewed on the order page.
 * This is an optimistic-concurrency check, NOT an authorization secret and NOT
 * a payment provider's proof. Both the read and the eventual CAS use the same
 * server-side fields; a browser-supplied amount is never used as money. */
export function paymentReviewExpectation(order: Order): Partial<Order> {
  return {
    ...orderFinancialExpectation(order),
    number: order.number,
    customerId: order.customerId,
    customer: order.customer,
    paymentMethodId: order.paymentMethodId,
    paymentMethod: order.paymentMethod,
    couponCode: order.couponCode,
  };
}

export function paymentReviewFingerprint(order: Order): string {
  return createHash("sha256").update(JSON.stringify({ id: order.id, ...paymentReviewExpectation(order) })).digest("hex");
}

/** Old untagged/invalid totals are never silently interpreted as taka. */
export function hasValidPaymentReviewAmount(order: Order): boolean {
  if (order.currency !== "BDT" || typeof order.total !== "number" || !Number.isFinite(order.total) || order.total < 0) return false;
  const poisha = toPoisha(order.total);
  return Number.isSafeInteger(poisha) && Math.abs(order.total - poisha / 100) < 0.000001;
}

export function matchesPaymentReview(order: Order, submitted: unknown): boolean {
  return typeof submitted === "string" && /^[a-f0-9]{64}$/.test(submitted) && submitted === paymentReviewFingerprint(order);
}

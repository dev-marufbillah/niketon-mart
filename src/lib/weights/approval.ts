import "server-only";
import { createHash } from "node:crypto";
import { toPoisha } from "@/lib/utils/currency";
import type { Order, OrderItem } from "@/lib/repositories/orders";

/**
 * Recount against the order's checkout snapshot, not today's store settings.
 * The original absolute discount and delivery fee are retained; if a lighter
 * subtotal is smaller than the discount, only the subtotal is discounted. The
 * unused part becomes available again if a later weight is customer-approved.
 * The caller must first check weightAdjustmentHoldReason(order).
 */
export function recountWeightOrder(order: Order, items: OrderItem[]) {
  const subtotal = items.reduce((sum, item) => sum + toPoisha(item.lineTotal), 0);
  if (typeof order.checkoutDiscount !== "number") throw new Error("The original checkout discount is missing.");
  const checkoutDiscount = toPoisha(order.checkoutDiscount);
  const discount = Math.min(checkoutDiscount, subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * order.taxRate! / 100);
  const total = taxable + toPoisha(order.deliveryFee) + tax;
  return { subtotal: subtotal / 100, discount: discount / 100, checkoutDiscount: checkoutDiscount / 100,
    tax: tax / 100, total: total / 100, taxRate: order.taxRate! };
}

/** Bind approval to the exact line, payment state and tax-inclusive total shown. */
export function weightApprovalSnapshot(order: Order) {
  const items = order.items.map((item) => item.weight?.status === "proposed"
    ? { ...item, lineTotal: item.weight.actualLineTotal ?? item.lineTotal } : item);
  const total = recountWeightOrder(order, items).total;
  const fingerprint = createHash("sha256").update(JSON.stringify({
    id: order.id, currency: order.currency, status: order.status, paymentStatus: order.paymentStatus,
    updatedAt: order.updatedAt, items: order.items, total: order.total, subtotal: order.subtotal,
    discount: order.discount, checkoutDiscount: order.checkoutDiscount, deliveryFee: order.deliveryFee,
    tax: order.tax, taxRate: order.taxRate, proposedTotal: total,
  })).digest("hex");
  return { total, fingerprint };
}

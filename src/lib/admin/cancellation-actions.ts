"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { ensureDatabase } from "@/lib/db";
import { logActivity } from "@/lib/repositories/activity";
import { cancelOrderTransaction, getOrder } from "@/lib/repositories/orders";
import type { AdminFormState } from "@/lib/admin/operations-actions";

export async function reviewCancellationAction(
  orderId: string,
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const staff = await assertPermission("orders.manage");
  await assertPermission("payments.manage");
  const order = await getOrder(orderId);
  if (!order) return { errors: ["That order is no longer available."] };

  if (order.customerId) await assertPermission("customers.manage");
  if (order.couponCode) await assertPermission("marketing.manage");
  const note = String(formData.get("reviewNote") ?? "").trim();
  const rawCustomerDecision = String(formData.get("customerDecision") ?? "");
  const rawCouponDecision = String(formData.get("couponDecision") ?? "");
  const customerDecision = rawCustomerDecision === "leave" || rawCustomerDecision === "reconcile"
    ? rawCustomerDecision
    : undefined;
  const couponDecision = rawCouponDecision === "retain" || rawCouponDecision === "release"
    ? rawCouponDecision
    : undefined;
  const rawOrderCount = String(formData.get("reconciledOrderCount") ?? "").trim();
  const rawTotalSpent = String(formData.get("reconciledTotalSpent") ?? "").trim();
  const expectedCustomerUpdatedAt = String(formData.get("expectedCustomerUpdatedAt") ?? "");
  const errors: string[] = [];

  if (note.length < 8 || note.length > 500) errors.push("Enter a review note between 8 and 500 characters.");
  if (order.customerId && !customerDecision) {
    errors.push("Choose how to handle the customer's recorded totals.");
  }
  if (order.customerId && customerDecision === "reconcile" &&
      (!expectedCustomerUpdatedAt || !rawOrderCount || !/^\d+$/.test(rawOrderCount) ||
       !rawTotalSpent || !/^\d+(?:\.\d{1,2})?$/.test(rawTotalSpent))) {
    errors.push("Enter a verified whole-number order count and BDT total spent.");
  }
  if (order.couponCode && !couponDecision) {
    errors.push("Choose whether to retain or release this coupon use.");
  }
  if (errors.length) return { errors };

  const result = await cancelOrderTransaction(
    await ensureDatabase(),
    orderId,
    { id: staff.id, name: staff.name },
    {
      reviewedUpdatedAt: String(formData.get("reviewedUpdatedAt") ?? ""),
      note,
      ...(order.customerId && customerDecision ? {
        customerDecision,
        ...(customerDecision === "reconcile" ? {
          expectedCustomerUpdatedAt,
          reconciledOrderCount: Number(rawOrderCount),
          reconciledTotalSpent: Number(rawTotalSpent),
        } : {}),
      } : {}),
      ...(order.couponCode && couponDecision ? { couponDecision } : {}),
    },
  );
  if (!result.ok) return { errors: [result.error] };

  await logActivity({
    actor: { id: staff.id, name: staff.name },
    action: "order",
    entity: "orders",
    entityId: orderId,
    summary: `Staff-reviewed cancellation for order ${result.order.number}`,
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");
  return { success: `Order ${result.order.number} was cancelled after review; inventory and selected records were updated atomically.` };
}

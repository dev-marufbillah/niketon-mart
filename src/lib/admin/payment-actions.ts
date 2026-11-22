"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/repositories/activity";
import { markPayment, type PaymentStatus } from "@/lib/repositories/orders";
import type { AdminFormState } from "@/lib/admin/operations-actions";

/**
 * Payment verification.
 * Staff check the transfer in the merchant app, then record the outcome here.
 * Nothing marks itself paid: a gateway may do it through the verified callback
 * endpoint, and a person may do it here with their name on the timeline.
 */

const allowed: PaymentStatus[] = ["unpaid", "awaiting_verification", "paid", "refunded", "failed"];

export async function verifyPaymentAction(
  orderId: string,
  _state: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  const user = await assertPermission("payments.manage");

  const status = String(formData.get("paymentStatus") ?? "") as PaymentStatus;
  const reference = String(formData.get("reference") ?? "").trim();
  const refundReference = String(formData.get("refundReference") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!allowed.includes(status)) return { errors: ["Choose a valid payment status."] };
  if (status === "paid" && reference.length < 4) {
    return { errors: ["Enter the transaction ID you checked in the merchant app before marking it paid."] };
  }
  if (status === "refunded" && (refundReference.length < 4 || note.length < 8)) {
    return { errors: ["After the real refund is completed, enter its separate reference and a verification note of at least 8 characters."] };
  }
  if (reference.length > 160 || refundReference.length > 160 || note.length > 500) {
    return { errors: ["The reference or note is too long."] };
  }
  const decisionReference = status === "refunded" ? refundReference : reference;
  const result = await markPayment(orderId, {
    status,
    reviewFingerprint: String(formData.get("reviewFingerprint") ?? ""),
    actor: user.name,
    reference: decisionReference || undefined,
    note:
      note ||
      (status === "paid"
        ? `Payment verified against transaction ${reference}.`
        : `Payment marked ${status.replace(/_/g, " ")}.`),
  });

  if (!result.ok) return { errors: [result.error] };

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "payment",
    entity: "orders",
    entityId: orderId,
    summary: `Payment for ${result.order.number} → ${status}${decisionReference ? ` (ref ${decisionReference})` : ""}`, 
  });

  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  return { success: `Payment marked ${status.replace(/_/g, " ")}.` };
}

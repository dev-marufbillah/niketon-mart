"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { logActivity } from "@/lib/repositories/activity";
import { formatPrice } from "@/lib/utils/currency";
import {
  getOrder,
  recordWeightReadings,
  settleWeightProposals,
  type WeightReading,
} from "@/lib/repositories/orders";

export type WeightFormState = { errors?: string[]; success?: string } | null;

/**
 * Saves the packer's scale readings.
 *
 * The form sends one `grams:<line index>` field per weighed line. A reading that
 * lowers the line is applied immediately; a reading that raises it is held as a
 * proposal and the customer is asked to approve it on their order page. The
 * action never edits the amount the customer approved.
 */
export async function recordWeightsAction(
  orderId: string,
  _state: WeightFormState,
  formData: FormData,
): Promise<WeightFormState> {
  const user = await assertPermission("orders.manage");
  const order = await getOrder(orderId);
  if (!order) return { errors: ["Order not found."] };

  const readings: WeightReading[] = [];
  order.items.forEach((item, index) => {
    if (!item.weight) return;
    const raw = String(formData.get(`grams:${index}`) ?? "").trim();
    if (!raw) return;
    // Reject signs, decimals and other forged input instead of stripping them.
    readings.push({ index, grams: /^\d{1,5}$/.test(raw) ? Number(raw) : NaN });
  });

  if (readings.length === 0) {
    return { errors: ["Enter at least one weight in grams before saving."] };
  }

  const result = await recordWeightReadings(orderId, readings, user.name);
  if (!result.ok) return { errors: result.errors };

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "order",
    entity: "orders",
    entityId: orderId,
    summary: `Order ${order.number}: weights recorded (${readings.length} line${
      readings.length === 1 ? "" : "s"
    }), ${result.proposed > 0 ? `${formatPrice(result.proposed)} awaiting customer approval` : "no extra charge"}`,
  });

  revalidatePath(`/order/${order.number}`);
  return {
    success:
      result.proposed > 0
        ? "Weights saved. The higher total is waiting for the customer to approve — they will see it on their order page."
        : "Weights saved and the order total updated. The customer can see the new weight and price on their order page.",
  };
}

/**
 * Staff may waive a difference. Only the customer can approve a higher total.
 */
export async function settleWeightsAction(
  orderId: string,
  decision: "approve" | "waive",
): Promise<WeightFormState> {
  const user = await assertPermission("orders.manage");
  const order = await getOrder(orderId);
  if (!order) return { errors: ["Order not found."] };
  if (decision !== "waive") return { errors: ["Only the customer can approve a higher total on their private order page."] };

  const result = await settleWeightProposals(orderId, "waive", user.name);
  if (!result.ok) return { errors: [result.error] };

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "order",
    entity: "orders",
    entityId: orderId,
    summary: `Order ${order.number}: weight difference waived by staff`,
  });

  revalidatePath(`/order/${order.number}`);
  return {
    success: "The difference was waived.",
  };
}

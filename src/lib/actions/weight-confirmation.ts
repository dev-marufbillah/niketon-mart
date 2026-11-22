"use server";

import { revalidatePath } from "next/cache";
import { getOrderByNumber, settleWeightProposals } from "@/lib/repositories/orders";
import { hasOrderAccess } from "@/lib/auth/order-access";

export type WeightDecisionState = { error?: string; success?: string } | null;

/** Customer decisions require the authenticated checkout owner or a verified order cookie. */
export async function respondToWeightChange(
  _state: WeightDecisionState,
  formData: FormData,
): Promise<WeightDecisionState> {
  const number = String(formData.get("number") ?? "").trim().slice(0, 24);
  const decision = String(formData.get("decision") ?? "");

  if (!number) return { error: "Open this page from your order confirmation link and try again." };
  if (decision !== "approve" && decision !== "keep") {
    return { error: "Choose whether to accept the new weight or keep the current amount." };
  }

  const order = await getOrderByNumber(number);
  if (!order || !(await hasOrderAccess(order))) {
    return { error: "This order could not be verified. Open it again from your saved private link." };
  }

  const proposed = order.items.find((item) => item.weight?.status === "proposed");
  if (!proposed) {
    return { success: "There is nothing waiting for your decision on this order." };
  }

  // The customer accepting the increase is the approval; they are the actor
  // recorded on the timeline.
  const result = await settleWeightProposals(
    order.id,
    decision === "approve" ? "approve" : "waive",
    `Customer (${order.customer.name})`,
    { fingerprint: String(formData.get("fingerprint") ?? ""), total: Number(formData.get("expectedTotal") ?? NaN) },
  );
  if (!result.ok) return { error: result.error };

  revalidatePath(`/order/${order.number}`);
  revalidatePath(`/order/${order.number}/invoice`);
  revalidatePath("/account/orders");

  return {
    success:
      decision === "approve"
        ? "Thank you — the adjusted weight and total are now on your order."
        : "Thanks — the current order amount was kept and the weight difference was waived.",
  };
}

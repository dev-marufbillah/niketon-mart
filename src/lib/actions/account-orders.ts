"use server";

import { getCustomerSession } from "@/lib/auth/customer";

export type CancelState = { ok?: string; error?: string } | null;

/**
 * Online cancellation is held while the store reviews coupon use and customer
 * aggregates. This action never changes order, stock, coupon, payment or
 * customer records and does not reveal whether an arbitrary order ID exists.
 * A real permission-checked staff review and reconciliation flow is still
 * required before any online cancellation may be enabled.
 */
export async function cancelOrderAction(_state: CancelState, formData: FormData): Promise<CancelState> {
  const user = await getCustomerSession();
  if (!user) return { error: "Your session expired. Sign in again." };
  void formData;
  return { error: "Online cancellation is unavailable. Contact the store for manual review; no changes were made." };
}

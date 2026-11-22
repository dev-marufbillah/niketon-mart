"use server";

import { redirect } from "next/navigation";
import { getOrderByNumber } from "@/lib/repositories/orders";
import { getCustomerSession } from "@/lib/auth/customer";
import { grantOrderAccess } from "@/lib/auth/order-access";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";

export type TrackOrderState = { error?: string } | null;
const unavailable = { error: "We could not verify that order. Sign in to the account that placed it, or use the private access key from your confirmation link." };
const normalizeNumber = (input: unknown) => String(input ?? "").replace(/^#/, "").replace(/\s+/g, "").toUpperCase().slice(0, 24);

/** Order number plus a publicly guessable email is NOT proof of ownership. */
export async function trackOrderAction(_prev: TrackOrderState, formData: FormData): Promise<TrackOrderState> {
  const number = normalizeNumber(formData.get("number"));
  const token = String(formData.get("accessToken") ?? "").trim().slice(0, 128);
  if (!number) return { error: "Enter the order ID from your confirmation." };
  if (!(await checkLoginRateLimit("order-access", number))) return { error: "Too many attempts. Please try again later." };
  const [order, session] = await Promise.all([getOrderByNumber(number), getCustomerSession()]);
  if (!order) return unavailable;
  const ownedBySession = Boolean(session && order.customerWasAuthenticated === true && order.customerId === session.id);
  if (!ownedBySession && !(await grantOrderAccess(order, token))) return unavailable;
  redirect(`/order/${encodeURIComponent(order.number)}`);
}

/** Exchange a private fragment key for an HttpOnly order-scoped cookie by POST. */
export async function unlockOrderFragmentAction(formData: FormData): Promise<{ ok: boolean }> {
  const number = normalizeNumber(formData.get("number"));
  const key = String(formData.get("key") ?? "").trim().slice(0, 128);
  if (!number || !(await checkLoginRateLimit("order-access", number))) return { ok: false };
  const order = await getOrderByNumber(number);
  if (!order || !(await grantOrderAccess(order, key))) return { ok: false };
  return { ok: true };
}

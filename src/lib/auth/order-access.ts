import "server-only";

import { cookies } from "next/headers";
import { getCustomerSession } from "@/lib/auth/customer";
import type { Order } from "@/lib/repositories/orders";

import { hashOrderAccessKey, verifyOrderAccessKey } from "@/lib/auth/order-access-key";

const cookieName = (number: string) => `nm_order_${hashOrderAccessKey(number).slice(0, 20)}`;
const cookiePath = (number: string) => `/order/${encodeURIComponent(number)}`;

/** Cookie is scoped to this order; it is inaccessible to JavaScript. */
export async function grantOrderAccess(order: Order, key: string): Promise<boolean> {
  if (!verifyOrderAccessKey(order, key)) return false;
  (await cookies()).set(cookieName(order.number), key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
    sameSite: "lax",
    path: cookiePath(order.number),
    maxAge: 90 * 86_400,
  });
  return true;
}

/** Returns a valid key only from this order's cookie; never from a query URL. */
export async function currentOrderAccessKey(order: Order): Promise<string | undefined> {
  const key = (await cookies()).get(cookieName(order.number))?.value ?? "";
  return verifyOrderAccessKey(order, key) ? key : undefined;
}

/** Old records without authenticated-checkout provenance require a key. */
export async function hasOrderAccess(order: Order): Promise<boolean> {
  const session = await getCustomerSession();
  if (session && order.customerWasAuthenticated === true && order.customerId === session.id) return true;
  return Boolean(await currentOrderAccessKey(order));
}

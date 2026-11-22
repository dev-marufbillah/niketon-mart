"use server";

import { revalidatePath } from "next/cache";
import { createOrder, type OrderChannel } from "@/lib/repositories/orders";
import { getCustomerSession } from "@/lib/auth/customer";
import { createAddress, listAddresses } from "@/lib/repositories/accounts";
import { parseCartItems } from "@/lib/checkout/parse-items";
import { grantOrderAccess } from "@/lib/auth/order-access";

export type CheckoutState =
  | { ok: true; number: string; orderId: string; redirectUrl?: string }
  | { ok: false; errors: string[]; code?: "IDEMPOTENCY_CONFLICT" }
  | null;

/**
 * Checkout.
 *
 * The browser sends product ids, quantities, the variation labels it picked,
 * the address it typed and the two ids that describe delivery and payment.
 * Prices, stock, the delivery fee, the coupon and the final total are all
 * recalculated on the server inside `createOrder` — nothing money-related is
 * accepted from the client.
 *
 * `idempotencyKey` is generated once when the checkout starts; a double click,
 * a refresh or a retried submit returns the order that already exists instead of
 * creating a second one.
 */
export async function checkoutAction(
  _state: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, errors: ["Please sign in or create an account before checkout."] };
  let rawItems: unknown;
  try {
    const raw = String(formData.get("items") ?? "[]");
    if (raw.length > 100_000) return { ok: false, errors: ["Your basket is too large."] };
    rawItems = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ["Your basket could not be read. Please refresh the page and try again."] };
  }
  const parsed = parseCartItems(rawItems);
  if (!parsed.ok) return { ok: false, errors: [parsed.error] };
  const items = parsed.items;

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const channel: OrderChannel = text("channel") === "basket" ? "basket" : "grocery";
  const expectedRaw = text("expectedTotal");
  const expectedTotal = Number(expectedRaw);
  if (!expectedRaw || !Number.isFinite(expectedTotal) || expectedTotal < 0) {
    return { ok: false, errors: ["Refresh your basket to review the current total before placing the order."] };
  }

  const useDifferentBilling = formData.get("billingSameAsDelivery") === null
    ? false
    : String(formData.get("billingSameAsDelivery")) === "different";

  // Who is ordering is read from the session cookie on the server — the form
  // never sends a customer id.
  const result = await createOrder({
    customerId: session.id,
    items,
    customer: {
      name: text("name"),
      email: text("email"),
      phone: text("phone"),
      address: text("address"),
      notes: text("notes"),
      company: text("company"),
      addressLine2: text("addressLine2"),
      city: text("city"),
      postalCode: text("postalCode"),
    },
    areaId: text("areaId"),
    paymentMethodId: text("paymentMethodId"),
    couponCode: text("coupon"),
    channel,
    deliverySlot: text("deliverySlot") || undefined,
    paymentReference: text("paymentReference") || undefined,
    idempotencyKey: text("idempotencyKey") || undefined,
    expectedTotal,
    termsAccepted: text("acceptTerms") === "on",
    billingAddress: useDifferentBilling
      ? {
          line1: text("billingAddress"),
          line2: text("billingAddressLine2"),
          city: text("billingCity"),
          postalCode: text("billingPostalCode"),
        }
      : undefined,
  });

  if (!result.ok) return { ok: false, errors: result.errors, ...(result.code ? { code: result.code } : {}) };
  // A fresh random key is sent as an HttpOnly, order-scoped cookie, not in a
  // redirect URL or server access log. Idempotent retries never reveal a key.
  if (result.guestAccessKey) await grantOrderAccess(result.order, result.guestAccessKey);

  /**
   * "Save this address" on the billing step.
   * Only honoured for a signed-in shopper; a guest keeps the browser-local list
   * the checkout already maintains. Duplicate addresses are not stored twice.
   */
  if (session && String(formData.get("saveAddress")) === "on") {
    const areas = await import("@/lib/repositories/operations").then((mod) => mod.getDeliveryAreas());
    if (areas.some((area) => area.id === text("areaId"))) {
      const existing = await listAddresses(session.id);
      const duplicate = existing.find(
        (row) =>
          row.address.trim().toLowerCase() === text("address").toLowerCase() &&
          row.areaId === text("areaId") &&
          row.addressLine2?.trim().toLowerCase() === text("addressLine2").toLowerCase(),
      );
      if (!duplicate) {
        await createAddress(session.id, {
          label: areas.find((area) => area.id === text("areaId"))?.name ?? "Delivery address",
          firstName: text("firstName"),
          lastName: text("lastName"),
          phone: text("phone"),
          email: text("email"),
          company: text("company"),
          address: text("address"),
          addressLine2: text("addressLine2"),
          city: text("city"),
          postalCode: text("postalCode"),
          areaId: text("areaId"),
        });
      }
    }
    revalidatePath("/my-account/addresses");
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/payments");
  revalidatePath("/home-grocery");
  return {
    ok: true,
    number: result.order.number,
    orderId: result.order.id,
    redirectUrl: result.redirectUrl,
  };
}

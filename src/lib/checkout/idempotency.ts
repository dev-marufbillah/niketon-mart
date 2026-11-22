import "server-only";

import { createHash } from "node:crypto";
import type { CheckoutInput } from "@/lib/repositories/orders";

/**
 * Server-derived fingerprint of the checkout intent, not a price authority or
 * an authentication token. A retry key may identify exactly one request for
 * one signed-in customer. Never accept this digest from the browser or log it.
 *
 * Deliberately conservative: item/choice order and exact variant labels matter.
 * If a request has changed, the customer must first check the existing order
 * before explicitly starting a new checkout attempt.
 */
export function checkoutIntentFingerprint(input: CheckoutInput): string {
  const trim = (value?: string) => value?.trim() || "";
  const customer = input.customer;
  const billing = input.billingAddress;
  const intent = {
    version: 1,
    customerId: input.customerId ?? "",
    items: input.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      variantLabel: item.variantLabel ?? "",
      preparation: item.preparation ? {
        choices: item.preparation.choices.map(({ group, label }) => ({ group, label })),
        instructions: trim(item.preparation.instructions),
      } : null,
    })),
    customer: {
      name: trim(customer.name),
      email: trim(customer.email).toLowerCase(),
      phone: trim(customer.phone),
      address: trim(customer.address),
      addressLine2: trim(customer.addressLine2),
      city: trim(customer.city),
      postalCode: trim(customer.postalCode),
      notes: trim(customer.notes),
      company: trim(customer.company),
    },
    areaId: input.areaId,
    paymentMethodId: input.paymentMethodId,
    couponCode: trim(input.couponCode).toUpperCase(),
    channel: input.channel ?? "grocery",
    deliverySlot: trim(input.deliverySlot),
    paymentReference: trim(input.paymentReference),
    billing: billing && trim(billing.line1) ? {
      line1: trim(billing.line1),
      line2: trim(billing.line2),
      city: trim(billing.city),
      postalCode: trim(billing.postalCode),
    } : null,
    expectedTotal: input.expectedTotal ?? null,
    termsAccepted: Boolean(input.termsAccepted),
  };
  return createHash("sha256").update("niketon-checkout-intent-v1\0").update(JSON.stringify(intent)).digest("hex");
}

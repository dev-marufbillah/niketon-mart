import test from "node:test";
import assert from "node:assert/strict";
import { checkoutIntentFingerprint } from "../../src/lib/checkout/idempotency";
import type { CheckoutInput } from "../../src/lib/repositories/orders";

const base: CheckoutInput = {
  customerId: "synthetic-customer",
  idempotencyKey: "synthetic-attempt-key",
  items: [{ productId: "synthetic-product", quantity: 2, variantLabel: "Box", preparation: {
    choices: [{ group: "Cut", label: "Cleaned" }], instructions: "Pack separately",
  } }],
  customer: { name: "Example Shopper", email: "EXAMPLE@example.test", phone: "01700000000", address: "123 Example street" },
  areaId: "synthetic-area", paymentMethodId: "synthetic-cod", expectedTotal: 200, termsAccepted: true,
};

test("checkout fingerprint is stable for equivalent normalized input", () => {
  const same = { ...base, customer: { ...base.customer, email: " example@EXAMPLE.test ", name: " Example Shopper " },
    channel: "grocery" as const, couponCode: "  ", billingAddress: { line1: " " } };
  assert.equal(checkoutIntentFingerprint(base), checkoutIntentFingerprint(same));
  assert.match(checkoutIntentFingerprint(base), /^[a-f0-9]{64}$/);
});

test("checkout fingerprint changes for a different purchase, contact, total, account or payment", () => {
  const fingerprint = checkoutIntentFingerprint(base);
  const changes: CheckoutInput[] = [
    { ...base, customerId: "another-customer" },
    { ...base, items: [{ ...base.items[0], quantity: 3 }] },
    { ...base, items: [{ ...base.items[0], variantLabel: "Small" }] },
    { ...base, items: [{ ...base.items[0], preparation: { choices: [{ group: "Cut", label: "Whole" }] } }] },
    { ...base, customer: { ...base.customer, address: "A different street" } },
    { ...base, areaId: "another-area" },
    { ...base, paymentMethodId: "another-payment" },
    { ...base, couponCode: "SAVE10" },
    { ...base, expectedTotal: 201 },
    { ...base, termsAccepted: false },
  ];
  for (const changed of changes) assert.notEqual(checkoutIntentFingerprint(changed), fingerprint);
});

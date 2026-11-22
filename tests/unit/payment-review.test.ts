import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Order } from "../../src/lib/repositories/orders";
import { hasValidPaymentReviewAmount, matchesPaymentReview, paymentReviewExpectation, paymentReviewFingerprint } from "../../src/lib/payments/review-snapshot";

const order: Order = {
  id: "payment-test", number: "TEST-01", currency: "BDT", channel: "grocery", customerId: "test-customer",
  customer: { name: "Test", email: "test@example.invalid", phone: "", address: "Test", area: "Test" },
  items: [{ productId: "test", name: "Test", image: "", unit: "pc", price: 100, quantity: 1, lineTotal: 100 }],
  subtotal: 100, discount: 0, checkoutDiscount: 0, deliveryFee: 0, tax: 0, taxRate: 0, total: 100,
  status: "pending", paymentStatus: "unpaid", paymentMethod: "Cash on delivery",
  payment: { type: "cod", mode: "offline" }, timeline: [], createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

test("payment review accepts only a valid matching BDT financial snapshot", () => {
  const fingerprint = paymentReviewFingerprint(order);
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert(matchesPaymentReview(order, fingerprint));
  for (const value of ["", "0".repeat(64), fingerprint.toUpperCase(), null, 123]) assert(!matchesPaymentReview(order, value));
  for (const change of [
    { id: "other" }, { total: 101 }, { currency: "USD" }, { paymentStatus: "failed" },
    { customer: { ...order.customer, email: "other@example.invalid" } },
    { items: [{ ...order.items[0], lineTotal: 99 }] }, { timeline: [{ at: "now", status: "changed", actor: "test" }] },
  ]) assert(!matchesPaymentReview({ ...order, ...change } as Order, fingerprint));
  assert(hasValidPaymentReviewAmount(order));
  for (const invalid of [
    { currency: "USD" }, { currency: undefined }, { total: -1 }, { total: 1.005 },
    { total: Number.NaN }, { total: Number.POSITIVE_INFINITY }, { total: Number.MAX_SAFE_INTEGER },
  ]) assert(!hasValidPaymentReviewAmount({ ...order, ...invalid } as Order));
});

test("file payment-review CAS rejects stale nested snapshots and permits a single decision", async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "niketon-payment-review-"));
  process.env.CONTENT_STORE_DIR = dir;
  try {
    const { createFileDatabase } = await import("../../src/lib/db/file");
    const db = createFileDatabase();
    await db.insert<Order>("orders", order);
    const expected = paymentReviewExpectation(order);
    const decisions = await Promise.all([
      db.compareAndUpdate<Order>("orders", order.id, expected, { paymentStatus: "paid", timeline: [{ at: "now", status: "paid", actor: "test" }] }),
      db.compareAndUpdate<Order>("orders", order.id, expected, { paymentStatus: "failed", timeline: [{ at: "now", status: "failed", actor: "test" }] }),
    ]);
    assert.equal(decisions.filter(Boolean).length, 1);
    const current = (await db.get<Order>("orders", order.id))!;
    assert(["paid", "failed"].includes(current.paymentStatus));
    assert.equal(current.timeline.length, 1);
    assert.equal(await db.compareAndUpdate<Order>("orders", order.id, expected, { paymentStatus: "refunded" }), null);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

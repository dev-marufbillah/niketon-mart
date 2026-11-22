import test from "node:test";
import assert from "node:assert/strict";
import { calculateCheckoutMoney, validCommerceRules } from "../../src/lib/checkout/money";
import { isSafeTakaAmount } from "../../src/lib/utils/currency";
import { validatePreparation } from "../../src/lib/preparation/model";
import { parseFields } from "../../src/lib/admin/parse";

test("BDT amounts reject sub-poisha, negative, non-finite and unsafe values", () => {
  for (const value of [0, 0.01, 1.23, 100, 99999.99]) assert(isSafeTakaAmount(value), `${value} should be valid`);
  for (const value of [-1, 0.001, NaN, Infinity, Number.MAX_SAFE_INTEGER, "12"]) assert(!isSafeTakaAmount(value), `${value} should be invalid`);
});

test("checkout computes tax in whole poisha and rejects overflow or invalid rules", () => {
  assert.deepEqual(calculateCheckoutMoney(199.99, 20, 60, 7.5), { ok: true, tax: 13.5, total: 253.49 });
  for (const values of [[100.001, 0, 0, 0], [100, 101, 0, 0], [100, 0, -1, 0], [100, 0, 0, 101],
    [100, 0, 0, 7.125], [10_000_000_000_000, 0, 0, 100]] as const) {
    assert.deepEqual(calculateCheckoutMoney(values[0], values[1], values[2], values[3]), { ok: false });
  }
  const valid = { freeShippingThreshold: 500, defaultDeliveryFee: 60, minOrderValue: 0, taxRate: 7.5 };
  assert(validCommerceRules(valid));
  assert(!validCommerceRules({ ...valid, taxRate: NaN }));
  assert(!validCommerceRules({ ...valid, defaultDeliveryFee: 1.001 }));
});

test("malformed preparation prices and admin price input do not silently become free or rounded", () => {
  const prep = { enabled: true, groups: [{ id: "cut", name: "Cut", type: "single" as const,
    options: [{ id: "clean", label: "Clean", charge: -1 }] }] };
  assert(validatePreparation(prep, { choices: [{ group: "Cut", label: "Clean" }] }).errors.some((error) => /charge needs store review/i.test(error)));
  const form = new FormData(); form.set("fee", "12.345");
  const parsed = parseFields([{ name: "fee", label: "Fee", type: "price" }], form);
  assert(parsed.errors.some((error) => /at most two decimals/i.test(error)));
});

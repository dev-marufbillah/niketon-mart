import test from "node:test";
import assert from "node:assert/strict";
import { needsPurchaseChoices } from "../../src/lib/catalogue/purchase";
import { unitStock } from "../../src/lib/store/cart-line";
import type { Product } from "../../src/lib/types/domain";

const basic = { id: "synthetic", price: 100, stock: 4 } as Product;

test("quick add requires a product page for each active variation or preparation", () => {
  assert.equal(needsPurchaseChoices(basic), false);
  assert.equal(needsPurchaseChoices({ ...basic, options: [{ name: "Size", values: [] }] }), false);
  assert.equal(needsPurchaseChoices({ ...basic, options: [{ name: "Size", values: [{ label: "Large", price: 150 }] }] }), true);
  assert.equal(needsPurchaseChoices({ ...basic, preparation: { enabled: true, groups: [] } }), true);
});

test("quick add requires a choice for quantity minimums and steps", () => {
  assert.equal(needsPurchaseChoices({ ...basic, selling: { unit: "pc", minQuantity: 2, step: 1 } }), true);
  assert.equal(needsPurchaseChoices({ ...basic, selling: { unit: "pc", minQuantity: 1, step: 2 } }), true);
});

test("visible variation stock cannot exceed parent stock", () => {
  const varied = { ...basic, options: [{ name: "Size", values: [{ label: "Large", stock: 10 }, { label: "Small", stock: 2 }] }] };
  assert.equal(unitStock(varied, "Large"), 4);
  assert.equal(unitStock(varied, "Small"), 2);
  assert.equal(unitStock({ ...varied, stock: 0 }, "Large"), 0);
  assert.equal(unitStock({ ...varied, stock: NaN }, "Large"), 0);
});

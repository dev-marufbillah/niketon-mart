import test from "node:test";
import assert from "node:assert/strict";
import type { Product } from "../../src/lib/types/domain";
import { catalogueDisplayPrice } from "../../src/lib/catalogue/display-price";

const product: Product = {
  id: "test", slug: "test", name: "Test", categoryId: "test", categoryLabel: "Test", unit: "kg",
  price: 100, compareAtPrice: 150, rating: 0, reviewCount: 0, image: "/test.png", description: "Test product",
  availability: "in_stock", stock: 10,
};
test("simple products show the exact base price and a valid compare-at price", () => {
  assert.deepEqual(catalogueDisplayPrice(product), { label: "৳ 100", amount: 100, compareAtPrice: 150 });
  assert.equal(catalogueDisplayPrice({ ...product, price: NaN }).label, "Price under review");
});
test("variant previews use the cheapest in-stock option, not a lower sold-out or unrelated base", () => {
  const options = [{ name: "Weight", values: [
    { label: "Small", price: 25, stock: 0 }, { label: "Medium", price: 110, stock: 3 }, { label: "Large", price: 180 },
  ] }];
  assert.deepEqual(catalogueDisplayPrice({ ...product, options }), { label: "From ৳ 110", amount: 110, compareAtPrice: undefined });
  assert.equal(catalogueDisplayPrice({ ...product, options: [...options, { name: "Grade", values: [{ label: "A" }] }] }).label, "Price under review");
  assert.equal(catalogueDisplayPrice({ ...product, options: [{ name: "Size", values: [{ label: "A" }, { label: "a" }] }] }).label, "Price under review");
  assert.equal(catalogueDisplayPrice({ ...product, options: [{ name: "Size", values: [{ label: "A", price: 0.001 }] }] }).label, "Price under review");
});
test("preparation prices are explicitly labelled as base and do not claim an overall discount", () => {
  const preparation = { enabled: true, groups: [{ id: "cut", name: "Cut", type: "single" as const, required: true,
    options: [{ id: "sliced", label: "Sliced", charge: 15 }] }] };
  assert.deepEqual(catalogueDisplayPrice({ ...product, preparation }), { label: "Base ৳ 100", amount: 100, compareAtPrice: undefined });
  assert.equal(catalogueDisplayPrice({ ...product, preparation, options: [{ name: "Weight", values: [{ label: "1 kg", price: 120 }] }] }).label, "Base from ৳ 120");
});

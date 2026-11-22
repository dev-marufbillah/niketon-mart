import test from "node:test";
import assert from "node:assert/strict";
import { formatPrice, round2, toPoisha } from "../../src/lib/utils/currency";
import { parseCartItems } from "../../src/lib/checkout/parse-items";
import { validatePreparation } from "../../src/lib/preparation/model";
import { applyShopFilters, parseShopQuery } from "../../src/lib/catalogue/query";
import { toPublicProduct } from "../../src/lib/catalogue/public-product";
import type { Product, ProductPreparation } from "../../src/lib/types/domain";

test("BDT format, lakh grouping and poisha rounding", () => {
  assert.deepEqual([120, 1250, 12500, 125000].map(formatPrice), ["৳ 120", "৳ 1,250", "৳ 12,500", "৳ 1,25,000"]);
  assert.equal(formatPrice(18.2), "৳ 18.20");
  assert.equal(toPoisha(0.1 + 0.2), 30);
  assert.equal(round2(1.005), 1.01);
  assert.throws(() => formatPrice({amount: 100, currency: "USD" as "BDT"}));
});

test("checkout parser retains choices and strips browser prices", () => {
  const result = parseCartItems([{productId:"fish",quantity:1,variantLabel:"1 kg",price:0.01,
    preparation:{choices:[{group:"Cut",label:"Curry",charge:-99}],instructions:"small pieces",charge:0}}]);
  assert.equal(result.ok,true);
  if (result.ok) assert.deepEqual(result.items,[{productId:"fish",quantity:1,variantLabel:"1 kg",preparation:{choices:[{group:"Cut",label:"Curry"}],instructions:"small pieces"}}]);
  assert.equal(parseCartItems([{productId:"fish", quantity:1.5}]).ok,false);
  assert.equal(parseCartItems(Array(61).fill({productId:"fish",quantity:1})).ok,false);
  assert.equal(parseCartItems([{productId:"fish",quantity:1,preparation:{choices:[],instructions:"x".repeat(301)}}]).ok,false);
});

const preparation: ProductPreparation = { enabled:true, allowInstructions:true, maxInstructionLength:60,
  groups:[{id:"cut",name:"Cut",type:"single",required:true,options:[{id:"whole",label:"Whole",charge:0},{id:"curry",label:"Curry",charge:12.5}]}] };

test("preparation validation uses configured charge, detects stale/duplicates/required", () => {
  const valid = validatePreparation(preparation,{choices:[{group:"Cut",label:"Curry"}],instructions:"Clean it"});
  assert.equal(valid.chargePerUnit,12.5);
  assert.deepEqual(valid.errors,[]);
  assert.ok(validatePreparation(preparation,{choices:[]}).errors.length);
  assert.ok(validatePreparation(preparation,{choices:[{group:"Cut",label:"Unknown"}]}).errors.length);
  assert.ok(validatePreparation(preparation,{choices:[{group:"Cut",label:"Curry"},{group:"Cut",label:"Curry"}]}).errors.length);
  assert.ok(validatePreparation(undefined,{choices:[{group:"Cut",label:"Curry"}]}).errors.length);
  assert.ok(validatePreparation({...preparation,allowInstructions:false},{choices:[{group:"Cut",label:"Whole"}],instructions:"note"}).errors.length);
});

const product = {
  id:"p",slug:"p",name:"Example",categoryId:"child",categoryLabel:"Child",unit:"piece",price:10,
  rating:0,reviewCount:0,image:"/image.jpg",description:"fresh",availability:"in_stock",stock:5,
  purchaseCost:2,supplierSecret:"private",preparation:{...preparation, internalCost:3,
    groups:preparation.groups.map((group) => ({...group, privateNote:"secret", options:group.options.map((option)=>({...option,supplierCost:9}))}))},
} as unknown as Product;

test("public product projection strips top-level and nested internal fields", () => {
  const serialized = JSON.stringify(toPublicProduct(product));
  assert.doesNotMatch(serialized,/purchaseCost|supplierSecret|internalCost|privateNote|supplierCost/);
  assert.match(serialized,/Curry/);
});

test("category parent filter includes subcategory but not unrelated products", () => {
  const query = parseShopQuery({category:"parent"},{min:0,max:100});
  const filtered = applyShopFilters([product,{...product,id:"q",categoryId:"other"}],query,[
    {value:"parent",label:"Parent",count:1},{value:"child",parentId:"parent",label:"Child",count:1}
  ]);
  assert.deepEqual(filtered.map((x)=>x.id),["p"]);
});

test("shop search includes the same brand, category and description as suggestions", () => {
  const item = { ...product, brandId: "local", name: "Rui", categoryLabel: "Fresh Fish", description: "Ready to cook" };
  const brands = [{ value: "local", label: "River Valley", count: 1 }];
  for (const term of ["river valley", "FRESH FISH", "ready to cook", "rui"]) {
    const query = parseShopQuery({ q: term }, { min: 0, max: 100 });
    assert.deepEqual(applyShopFilters([item], query, [], brands).map((x) => x.id), [item.id]);
  }
  assert.deepEqual(applyShopFilters([item], parseShopQuery({ q: "not present" }, { min: 0, max: 100 }), [], brands), []);
});

test("custom and ordinary roles cannot manage admin users", async () => {
  const { can } = await import("../../src/lib/auth/permissions");
  assert.equal(can("owner", "users.manage"), true);
  assert.equal(can("admin", "users.manage"), false);
  assert.equal(can("product_manager", "products.manage"), true);
  assert.equal(can("product_manager", "orders.view"), false);
  assert.equal(can({ role: "custom", permissions: ["orders.view", "users.manage"] }, "orders.view"), true);
  assert.equal(can({ role: "custom", permissions: ["orders.view", "users.manage"] }, "users.manage"), false);
});

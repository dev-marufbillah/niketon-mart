import test from "node:test";
import assert from "node:assert/strict";
import { categoryFamilyCatalogue, categoryGroup, categoryHref, categoryImage, categoryPlaceholder, departmentCatalogue, filterFamilyForSelection, navigationCategories, primaryNavigationCategories } from "../../src/lib/catalogue/departments";
import { parseShopQuery, shopHref, shopRequestKey, toggleCategoryFilter } from "../../src/lib/catalogue/query";
import { mainNav } from "../../src/config/site";
import { buildShopFacets } from "../../src/lib/catalogue/repository";
import type { Category, Product } from "../../src/lib/types/domain";

const categories: Category[] = [
  { id: "parent", slug: "parent", name: "Parent", icon: "old", group: "fresh" },
  { id: "child", slug: "child", name: "Child", icon: "old", group: "pantry", parentId: "parent" },
  { id: "pantry", slug: "pantry", name: "Pantry", icon: "old", group: "pantry" },
  { id: "house", slug: "house", name: "House", icon: "old", group: "household" },
  { id: "bakery", slug: "bakery", name: "Bakery", icon: "old", group: "bakery" },
  { id: "legacy", slug: "legacy", name: "Legacy", icon: "old" },
];
const products = categories.map((category) => ({ id: `p-${category.id}`, categoryId: category.id, image: `/${category.id}.jpg` }) as Product);
const snapshot = { categories, products, brands: [], productTypes: [] };

test("department pages follow the current parent group and contain only their live category products", () => {
  assert.equal(categoryGroup(categories[1], categories), "fresh");
  assert.deepEqual(departmentCatalogue(snapshot, "fresh").products.map((p) => p.id), ["p-parent", "p-child", "p-legacy"]);
  assert.deepEqual(departmentCatalogue(snapshot, "grocery").products.map((p) => p.id), ["p-pantry", "p-house", "p-bakery"]);
  const moved = categories.map((c) => c.id === "parent" ? { ...c, group: "pantry" as const } : c);
  assert.equal(categoryGroup(moved[1], moved), "pantry");
  assert.equal(categoryHref(moved[1], moved), "/grocery?category=child");
  assert(departmentCatalogue({ ...snapshot, categories: moved }, "grocery").products.some((p) => p.id === "p-child"));
});

test("category navigation honors parent navigation visibility and admin image precedence", () => {
  const hidden = categories.map((c) => c.id === "parent" ? { ...c, showInNavigation: false } : c);
  assert(!navigationCategories(hidden).some((c) => c.id === "parent" || c.id === "child"));
  assert.equal(categoryImage({ ...categories[0], image: "/uploads/admin.jpg" }, categories, products), "/uploads/admin.jpg");
  assert.equal(categoryImage(categories[0], categories, products.filter((p) => p.categoryId !== "parent")), "/child.jpg");
  assert.equal(categoryImage(categories[0], categories, []), categoryPlaceholder);
});

test("primary navigation uses one admin-selected visible category and its live parent group", () => {
  const chosen = categories.map((category) => category.id === "child" ? { ...category, showInPrimaryNavigation: true } : category);
  assert.deepEqual(primaryNavigationCategories(chosen).map((category) => category.id), ["child"]);
  assert.equal(categoryHref(primaryNavigationCategories(chosen)[0], chosen), "/fresh-market?category=child");
  const moved = chosen.map((category) => category.id === "parent" ? { ...category, group: "pantry" as const } : category);
  assert.equal(categoryHref(primaryNavigationCategories(moved)[0], moved), "/grocery?category=child");
  for (const hidden of [
    chosen.map((category) => category.id === "parent" ? { ...category, visible: false } : category),
    chosen.map((category) => category.id === "parent" ? { ...category, showInNavigation: false } : category),
    chosen.map((category) => category.id === "child" ? { ...category, visible: false } : category),
    chosen.map((category) => category.id === "child" ? { ...category, showInNavigation: false } : category),
    chosen.filter((category) => category.id !== "parent"),
  ]) assert.deepEqual(primaryNavigationCategories(hidden), []);
  const duplicateFlags = chosen.map((category) => category.id === "bakery" ? { ...category, showInPrimaryNavigation: true } : category);
  assert.deepEqual(primaryNavigationCategories(duplicateFlags).map((category) => category.id), ["child"]);
  assert.deepEqual(primaryNavigationCategories(categories), []);
});

test("shop URLs and request keys preserve the current department and distinguish navigation queries", () => {
  const query = parseShopQuery({ category: "child", sort: "price-asc" }, { min: 0, max: 100 });
  assert.equal(shopHref(query, "/fresh-market"), "/fresh-market?category=child&sort=price-asc");
  assert.equal(shopHref(query, "/grocery"), "/grocery?category=child&sort=price-asc");
  assert.notEqual(shopRequestKey("/fresh-market", { category: "parent" }), shopRequestKey("/fresh-market", { category: "child" }));
  assert.equal(shopRequestKey("/grocery", { a: "1", b: "2" }), shopRequestKey("/grocery", { b: "2", a: "1" }));
  assert.equal(shopHref(query, "/fresh-market", "parent"), "/fresh-market?category=child&sort=price-asc&scope=parent");
  assert.equal(shopHref({ ...query, categories: [], sort: "default" }, "/fresh-market", "parent"), "/fresh-market?scope=parent");
});

test("featured category scope is admin-driven and includes only the selected public family", () => {
  const featured = categories.map((c) => c.id === "parent" ? { ...c, showInPrimaryNavigation: true } : c);
  assert.equal(filterFamilyForSelection(featured, ["parent"]), "parent");
  assert.equal(filterFamilyForSelection(featured, ["child"]), "parent");
  assert.equal(filterFamilyForSelection(featured, ["pantry"]), undefined);
  assert.equal(filterFamilyForSelection(featured, ["parent", "pantry"]), undefined);
  const family = categoryFamilyCatalogue({ ...snapshot, categories: featured }, "parent");
  assert(family);
  assert.deepEqual(family.categories.map((category) => category.id), ["parent", "child"]);
  assert.deepEqual(family.products.map((product) => product.id), ["p-parent", "p-child"]);
  assert.equal(categoryFamilyCatalogue(snapshot, "missing"), null);
  const childOnly = categoryFamilyCatalogue(snapshot, "child");
  assert.deepEqual(childOnly?.products.map((product) => product.id), ["p-child"]);
  const hidden = featured.map((category) => category.id === "parent" ? { ...category, visible: false } : category);
  assert.equal(filterFamilyForSelection(hidden, ["parent"]), undefined);
  assert.equal(filterFamilyForSelection(hidden, ["child"]), undefined);
  const formerFeatured = featured.map((category) => category.id === "parent" ? { ...category, showInPrimaryNavigation: false, familyFiltersOnly: true } : category);
  assert.equal(filterFamilyForSelection(formerFeatured, ["parent"]), "parent");
  assert.equal(filterFamilyForSelection(formerFeatured, ["child"]), "parent");
  assert.equal(filterFamilyForSelection(formerFeatured, ["pantry"]), undefined);
  assert.equal(filterFamilyForSelection(categories, ["parent"]), undefined, "ordinary categories retain their existing presentation");
});

test("choosing a child refines its parent while preserving unrelated selections", () => {
  const facets = [
    { value: "parent", label: "Parent", count: 3 },
    { value: "child", label: "Parent › Child", parentId: "parent", count: 1 },
    { value: "sibling", label: "Parent › Sibling", parentId: "parent", count: 2 },
    { value: "other", label: "Other", count: 2 },
  ];
  assert.deepEqual(toggleCategoryFilter(["parent", "other"], "child", facets), ["other", "child"]);
  assert.deepEqual(toggleCategoryFilter(["child", "sibling", "other"], "parent", facets), ["other", "parent"]);
  assert.deepEqual(toggleCategoryFilter(["child"], "child", facets), []);
  assert.deepEqual(toggleCategoryFilter(["child"], "unknown", facets), ["child"]);
});

test("department and family facets contain only brands, types, prices and counts from their products", () => {
  const scoped = {
    categories,
    products: [
      { id: "a", categoryId: "parent", brandId: "fresh-brand", productTypeId: "fresh-type", price: 150, stock: 2, rating: 4 },
      { id: "b", categoryId: "child", brandId: "fresh-brand", productTypeId: "fresh-type", price: 300, stock: 0, rating: 0 },
      { id: "c", categoryId: "pantry", brandId: "grocery-brand", productTypeId: "grocery-type", price: 999, stock: 3, rating: 5 },
    ] as Product[],
    brands: [
      { id: "fresh-brand", slug: "fresh-brand", name: "Fresh brand", visible: true },
      { id: "grocery-brand", slug: "grocery-brand", name: "Grocery brand", visible: true },
    ],
    productTypes: [
      { id: "fresh-type", slug: "fresh-type", name: "Fresh type", visible: true },
      { id: "grocery-type", slug: "grocery-type", name: "Grocery type", visible: true },
    ],
  };
  const all = buildShopFacets(scoped);
  assert.deepEqual(all.brands.map((brand) => brand.value), ["fresh-brand", "grocery-brand"]);
  const fresh = buildShopFacets(departmentCatalogue(scoped, "fresh"));
  assert.deepEqual(fresh.brands.map((brand) => [brand.value, brand.count]), [["fresh-brand", 2]]);
  assert.deepEqual(fresh.productTypes.map((type) => [type.value, type.count]), [["fresh-type", 2]]);
  assert.deepEqual(fresh.price, { min: 150, max: 300 });
  assert.deepEqual(fresh.stock, { in: 1, out: 1 });
  assert.equal(fresh.ratings.find((rating) => rating.value === 4)?.count, 1);
  const family = buildShopFacets(categoryFamilyCatalogue(scoped, "child")!);
  assert.deepEqual(family.categories.map((category) => [category.value, category.label, category.parentId]), [["child", "Child", undefined]]);
  assert.deepEqual(family.price, { min: 300, max: 301 });
  const grocery = buildShopFacets(departmentCatalogue(scoped, "grocery"));
  assert.deepEqual(grocery.brands.map((brand) => brand.value), ["grocery-brand"]);
  assert.deepEqual(grocery.productTypes.map((type) => type.value), ["grocery-type"]);
  assert.deepEqual(grocery.price, { min: 999, max: 1000 });
});

test("main navigation keeps Categories immediately after Shop and About Us last", () => {
  assert.deepEqual(mainNav.map((link) => link.label), ["Home", "Shop", "Categories", "Fresh Market", "Grocery", "About Us"]);
});

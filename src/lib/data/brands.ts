import type { Brand, ProductType } from "@/lib/types/domain";

/**
 * Brands and product types are first-class catalogue entities: the shop filters,
 * the product form and the admin taxonomy screen all read from the same lists.
 * They live in the content store (seeded from here) so an admin can add one
 * without a redeploy.
 */
export const brandSeed: Brand[] = [
  { id: "fresh-harvest", slug: "fresh-harvest", name: "FreshHarvest", visible: true },
  { id: "natures-best", slug: "natures-best", name: "Nature's Best", visible: true },
  { id: "good-grains", slug: "good-grains", name: "GoodGrains", visible: true },
  { id: "farm-fresh", slug: "farm-fresh", name: "FarmFresh", visible: true },
  { id: "green-grocer", slug: "green-grocer", name: "GreenGrocer", visible: true },
];

export const productTypeSeed: ProductType[] = [
  { id: "fresh", slug: "fresh-produce", name: "Fresh Produce", visible: true },
  { id: "packaged", slug: "packaged-goods", name: "Packaged Goods", visible: true },
  { id: "frozen", slug: "frozen-foods", name: "Frozen Foods", visible: true },
  { id: "chilled", slug: "dairy-chilled", name: "Dairy & Chilled", visible: true },
];

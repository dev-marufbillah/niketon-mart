import type {
  Brand,
  Category,
  PreparationGroup,
  Product,
  ProductDetails,
  ProductOptionGroup,
  ProductPreparation,
  ProductSelling,
  ProductType,
} from "@/lib/types/domain";

/**
 * Everything the catalogue layer needs to describe a product facet, a filtered
 * page of results and the URL state that produced it.
 */

export type ShopSortKey =
  | "default"
  | "price-asc"
  | "price-desc"
  | "popularity"
  | "newest"
  | "rating"
  | "best-selling"
  | "discount";

export type ShopQuery = {
  /** Category slugs. */
  categories: string[];
  /** Brand slugs. */
  brands: string[];
  /** Product-type slugs. */
  types: string[];
  /** Minimum star thresholds, e.g. [4, 5]. */
  ratings: number[];
  /** Price bounds in BDT; undefined means "use the catalogue bounds". */
  min?: number;
  max?: number;
  /** Availability filter; empty array means "all". */
  stock: ("in" | "out")[];
  sort: ShopSortKey;
  page: number;
  perPage: number;
  q?: string;
};

export type FacetOption = {
  value: string;
  label: string;
  count: number;
  parentId?: string;
};

export type ShopFacets = {
  categories: FacetOption[];
  brands: FacetOption[];
  productTypes: FacetOption[];
  price: { min: number; max: number };
  ratings: { value: number; count: number }[];
  stock: { in: number; out: number };
};

export type ShopResult = {
  items: Product[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  from: number;
  to: number;
};

export type ShopFilterChip = {
  key: "category" | "brand" | "type" | "rating" | "price" | "stock" | "q";
  label: string;
  value: string;
};

export type CatalogueDocument = {
  version: number;
  updatedAt: string;
  products: Product[];
  categories: Category[];
  brands: Brand[];
  productTypes: ProductType[];
};

/** Snapshot handed to the storefront (and to the client catalogue context). */
export type CatalogueSnapshot = {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  productTypes: ProductType[];
};

export type ProductInput = {
  id?: string;
  /** Inventory as shown when an existing product form was opened. */
  inventorySnapshot?: { stock: number; soldCount: number; options: ProductOptionGroup[] };
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  brandId: string;
  productTypeId: string;
  image: string;
  imageMode: "contain" | "cover";
  unit: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  rating: number;
  reviewCount: number;
  sku: string;
  status: "active" | "draft";
  visibility: "visible" | "hidden";
  featured: boolean;
  attributes: { label: string; value: string }[];
  /** Gallery — the first entry is the primary image on cards. */
  images: string[];
  /** Purchasable variations (Weight, Pack size…). */
  options: ProductOptionGroup[];
  /** Additional-information tab content. */
  details: ProductDetails;
  /** Selling unit, minimum quantity and quantity step. */
  selling: ProductSelling;
  /** Cut / clean / preparation configuration. */
  preparation: ProductPreparation;
};

/** The preset library handed to the product form so an admin can apply one. */
export type PreparationPresetOption = {
  id: string;
  name: string;
  category: string;
  description: string;
  groups: PreparationGroup[];
};

export type TaxonomyKind = "category" | "brand" | "productType";

export type MutationResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; errors: string[] };

export const productStatuses = ["active", "draft"] as const;
export const productVisibilities = ["visible", "hidden"] as const;

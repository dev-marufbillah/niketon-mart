import type { Product } from "@/lib/types/domain";
import { formatPrice } from "@/lib/utils/currency";
import { matchesProductSearch } from "@/lib/catalogue/search";
import type {
  ShopFacets,
  ShopFilterChip,
  ShopQuery,
  ShopResult,
  ShopSortKey,
} from "@/lib/catalogue/types";

/**
 * Pure shop query engine.
 *
 * Shared by the server page (first paint / SEO) and the client listing UI, so a
 * filtered view is always the same list in both places. Nothing here touches
 * React, the filesystem or the network.
 */

export const sortOptions: { value: ShopSortKey; label: string }[] = [
  { value: "default", label: "Default Sorting" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "popularity", label: "Popularity" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest Rated" },
  { value: "best-selling", label: "Best Selling" },
  { value: "discount", label: "Biggest Discount" },
];

export const perPageOptions = [12, 24, 36] as const;
export const defaultPerPage = 12;

const sortKeys = new Set(sortOptions.map((option) => option.value));

const list = (value: string | string[] | undefined): string[] => {
  if (!value) return [];
  const raw = Array.isArray(value) ? value.join(",") : value;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const number = (value: string | string[] | undefined): number | undefined => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export function parseShopQuery(
  params: Record<string, string | string[] | undefined>,
  bounds: { min: number; max: number },
): ShopQuery {
  const sortRaw = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort = sortRaw && sortKeys.has(sortRaw as ShopSortKey) ? (sortRaw as ShopSortKey) : "default";

  const page = Math.max(1, Math.floor(number(params.page) ?? 1));
  const perRaw = number(params.per);
  const perPage = perPageOptions.includes(perRaw as (typeof perPageOptions)[number])
    ? (perRaw as number)
    : defaultPerPage;

  const min = number(params.min);
  const max = number(params.max);

  return {
    categories: list(params.category),
    brands: list(params.brand),
    types: list(params.type),
    ratings: list(params.rating)
      .map((entry) => Number(entry))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 5),
    min: min === undefined ? undefined : Math.max(bounds.min, Math.min(min, bounds.max)),
    max: max === undefined ? undefined : Math.min(bounds.max, Math.max(max, bounds.min)),
    stock: list(params.stock).filter((value): value is "in" | "out" => value === "in" || value === "out"),
    sort,
    page,
    perPage,
    q: (Array.isArray(params.q) ? params.q[0] : params.q)?.trim() || undefined,
  };
}

export function toSearchParams(query: ShopQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.categories.length) params.set("category", query.categories.join(","));
  if (query.brands.length) params.set("brand", query.brands.join(","));
  if (query.types.length) params.set("type", query.types.join(","));
  if (query.ratings.length) params.set("rating", query.ratings.slice().sort((a, b) => b - a).join(","));
  if (typeof query.min === "number") params.set("min", String(query.min));
  if (typeof query.max === "number") params.set("max", String(query.max));
  if (query.stock.length) params.set("stock", query.stock.join(","));
  if (query.sort !== "default") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.perPage !== defaultPerPage) params.set("per", String(query.perPage));
  if (query.q) params.set("q", query.q);
  return params;
}

export function shopHref(query: ShopQuery, basePath = "/home-grocery", categoryScopeId?: string): string {
  const params = toSearchParams(query);
  // The scope is a server-validated category id, not a browser-supplied price
  // or permission. Retain it when filters are changed or cleared, and on reload.
  if (categoryScopeId) params.set("scope", categoryScopeId);
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/** Selecting a child refines its parent rather than OR-ing against the whole
 * parent. Selecting the parent likewise replaces selected children. */
export function toggleCategoryFilter(selected: string[], value: string, categories: ShopFacets["categories"]): string[] {
  if (selected.includes(value)) return selected.filter((entry) => entry !== value);
  const option = categories.find((entry) => entry.value === value);
  if (!option) return selected;
  if (option.parentId) return [...selected.filter((entry) => entry !== option.parentId), value];
  const childIds = new Set(categories.filter((entry) => entry.parentId === value).map((entry) => entry.value));
  return [...selected.filter((entry) => !childIds.has(entry)), value];
}

/** A new server navigation, including a different category on the same page,
 * gets its own initial filter state. Client-side filter edits do not remount it. */
export function shopRequestKey(path: string, params: Record<string, string | string[] | undefined>): string {
  return `${path}:${JSON.stringify(Object.keys(params).sort().map((key) => [key, params[key]]))}`;
}

/** Number of distinct facet groups currently applied (used by the mobile badge). */
export function countActiveFilters(query: ShopQuery, bounds: { min: number; max: number }): number {
  let count = 0;
  count += query.categories.length;
  count += query.brands.length;
  count += query.types.length;
  count += query.ratings.length;
  count += query.stock.length;
  if (query.q) count += 1;
  const priceTouched =
    (typeof query.min === "number" && query.min > bounds.min) ||
    (typeof query.max === "number" && query.max < bounds.max);
  if (priceTouched) count += 1;
  return count;
}

export function applyShopFilters(products: Product[], query: ShopQuery, categories: ShopFacets["categories"] = [], brands: ShopFacets["brands"] = []): Product[] {
  const categorySet = new Set(query.categories);
  // Selecting a parent includes its visible one-level subcategories.
  for (const category of categories) {
    if (category.parentId && categorySet.has(category.parentId)) categorySet.add(category.value);
  }
  const brandSet = new Set(query.brands);
  const typeSet = new Set(query.types);
  const minRating = query.ratings.length ? Math.min(...query.ratings) : 0;
  const wantsIn = query.stock.length === 0 || query.stock.includes("in");
  const wantsOut = query.stock.length === 0 || query.stock.includes("out");
  const term = query.q;
  const brandNames = new Map(brands.map((brand) => [brand.value, brand.label]));

  return products.filter((product) => {
    if (categorySet.size && !categorySet.has(product.categoryId)) return false;
    if (brandSet.size && !brandSet.has(product.brandId ?? "")) return false;
    if (typeSet.size && !typeSet.has(product.productTypeId ?? "")) return false;
    if (minRating > 0 && product.rating < minRating) return false;
    if (typeof query.min === "number" && product.price < query.min) return false;
    if (typeof query.max === "number" && product.price > query.max) return false;

    const inStock = (product.stock ?? 0) > 0;
    if (inStock && !wantsIn) return false;
    if (!inStock && !wantsOut) return false;

    if (term && !matchesProductSearch(product, term, brandNames.get(product.brandId ?? "") ?? "")) return false;
    return true;
  });
}

export function sortProducts(products: Product[], sort: ShopSortKey): Product[] {
  const items = products.slice();
  switch (sort) {
    case "price-asc":
      return items.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    case "price-desc":
      return items.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    case "rating":
      return items.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    case "popularity":
      return items.sort((a, b) => b.reviewCount - a.reviewCount || b.rating - a.rating);
    case "newest":
      return items.sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      );
    case "best-selling":
      return items.sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0));
    case "discount": {
      const off = (product: Product) =>
        product.compareAtPrice && product.compareAtPrice > product.price
          ? (product.compareAtPrice - product.price) / product.compareAtPrice
          : 0;
      return items.sort((a, b) => off(b) - off(a));
    }
    default:
      return items;
  }
}

export function paginate(products: Product[], page: number, perPage: number): ShopResult {
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * perPage;
  const items = products.slice(start, start + perPage);
  return {
    items,
    page: current,
    perPage,
    total,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + items.length, total),
  };
}

export function buildChips(
  query: ShopQuery,
  facets: ShopFacets,
  bounds: { min: number; max: number },
): ShopFilterChip[] {
  const chips: ShopFilterChip[] = [];
  const categoryName = new Map(facets.categories.map((entry) => [entry.value, entry.label]));
  const brandName = new Map(facets.brands.map((entry) => [entry.value, entry.label]));
  const typeName = new Map(facets.productTypes.map((entry) => [entry.value, entry.label]));

  query.categories.forEach((value) =>
    chips.push({ key: "category", value, label: categoryName.get(value) ?? value }),
  );
  query.brands.forEach((value) =>
    chips.push({ key: "brand", value, label: brandName.get(value) ?? value }),
  );
  query.types.forEach((value) =>
    chips.push({ key: "type", value, label: typeName.get(value) ?? value }),
  );
  query.ratings
    .slice()
    .sort((a, b) => b - a)
    .forEach((value) => chips.push({ key: "rating", value: String(value), label: `${value} Star` }));

  const priceTouched =
    (typeof query.min === "number" && query.min > bounds.min) ||
    (typeof query.max === "number" && query.max < bounds.max);
  if (priceTouched) {
    chips.push({
      key: "price",
      value: "price",
      label: `Price: ${formatPrice(query.min ?? bounds.min)} - ${formatPrice(query.max ?? bounds.max)}`,
    });
  }

  query.stock
    .slice()
    .sort()
    .forEach((value) =>
      chips.push({
        key: "stock",
        value,
        label: value === "in" ? "In Stock" : "Out of Stock",
      }),
    );

  if (query.q) chips.push({ key: "q", value: query.q, label: `“${query.q}”` });
  return chips;
}

/** Removes a single chip and always resets pagination. */
export function removeChip(query: ShopQuery, chip: ShopFilterChip): ShopQuery {
  const next: ShopQuery = { ...query, page: 1 };
  switch (chip.key) {
    case "category":
      next.categories = query.categories.filter((value) => value !== chip.value);
      break;
    case "brand":
      next.brands = query.brands.filter((value) => value !== chip.value);
      break;
    case "type":
      next.types = query.types.filter((value) => value !== chip.value);
      break;
    case "rating":
      next.ratings = query.ratings.filter((value) => String(value) !== chip.value);
      break;
    case "stock":
      next.stock = query.stock.filter((value) => value !== chip.value);
      break;
    case "price":
      next.min = undefined;
      next.max = undefined;
      break;
    case "q":
      next.q = undefined;
      break;
  }
  return next;
}

export function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

/** Page numbers with ellipsis, e.g. 1 … 4 5 6 … 10 */
export function paginationItems(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("ellipsis");
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

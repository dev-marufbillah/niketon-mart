import type { Category, Product } from "@/lib/types/domain";
import type { CatalogueSnapshot } from "@/lib/catalogue/types";

export const categoryGroups = [
  { key: "fresh", title: "Fresh Market" },
  { key: "pantry", title: "Grocery & Essentials" },
  { key: "household", title: "Household" },
  { key: "bakery", title: "Bakery" },
] as const;

export type Department = "fresh" | "grocery";
export type CategoryGroup = (typeof categoryGroups)[number]["key"];
export const categoryPlaceholder = "/images/category-placeholder.svg";

/** A child follows its current parent, even if its stored group is stale. */
export function categoryGroup(category: Category, categories: Category[]): CategoryGroup {
  const parent = category.parentId ? categories.find((entry) => entry.id === category.parentId) : undefined;
  const group = parent?.group ?? category.group;
  return categoryGroups.some((entry) => entry.key === group) ? group as CategoryGroup : "fresh";
}

/** A hidden category (or hidden parent) cannot appear in category navigation. */
export function navigationCategories(categories: Category[]): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  return categories.filter((category) => {
    if (category.visible === false || category.showInNavigation === false) return false;
    if (!category.parentId) return true;
    const parent = byId.get(category.parentId);
    return Boolean(parent && parent.visible !== false && parent.showInNavigation !== false);
  });
}

/**
 * One small primary-nav slot is chosen by the existing category admin. The
 * public catalogue is sorted by admin order. Cap the display even if a legacy
 * record or concurrent writes produce multiple flags; never invent a link.
 */
export function primaryNavigationCategories(categories: Category[]): Category[] {
  return navigationCategories(categories).filter((category) => category.showInPrimaryNavigation === true).slice(0, 1);
}

export function categoryHref(category: Category, categories: Category[]): string {
  const path = categoryGroup(category, categories) === "fresh" ? "/fresh-market" : "/grocery";
  return `${path}?category=${encodeURIComponent(category.id)}`;
}

/**
 * An admin-uploaded category image wins. Otherwise use a visible product's
 * real image (including a child's for a parent), or a neutral placeholder.
 * This never uses a hardcoded category-to-product or emoji mapping.
 */
export function categoryImage(
  category: Category,
  categories: Category[],
  products: Product[],
): string {
  if (category.image?.trim()) return category.image.trim();
  const direct = products.find((product) => product.categoryId === category.id && product.image?.trim());
  if (direct?.image) return direct.image;
  if (!category.parentId) {
    const children = new Set(categories.filter((entry) => entry.parentId === category.id).map((entry) => entry.id));
    const childProduct = products.find((product) => children.has(product.categoryId) && product.image?.trim());
    if (childProduct?.image) return childProduct.image;
  }
  return categoryPlaceholder;
}

/** Partition public products/categories using the admin-managed root group. */
export function departmentCatalogue(snapshot: CatalogueSnapshot, department: Department): CatalogueSnapshot {
  const categories = snapshot.categories.filter((category) =>
    (categoryGroup(category, snapshot.categories) === "fresh") === (department === "fresh"));
  const categoryIds = new Set(categories.map((category) => category.id));
  return {
    ...snapshot,
    categories,
    products: snapshot.products.filter((product) => categoryIds.has(product.categoryId)),
  };
}

/** A scoped family is always derived from the already-public department.
 * Parents include their direct children; a featured child scopes to itself.
 * An absent or hidden category never falls back to an unrelated department. */
export function categoryFamilyCatalogue(snapshot: CatalogueSnapshot, categoryId: string): CatalogueSnapshot | null {
  const selected = snapshot.categories.find((category) => category.id === categoryId);
  if (!selected) return null;
  const categories = snapshot.categories.filter((category) => category.id === selected.id || category.parentId === selected.id);
  const categoryIds = new Set(categories.map((category) => category.id));
  return { ...snapshot, categories, products: snapshot.products.filter((product) => categoryIds.has(product.categoryId)) };
}

/** Existing ?category= links for a family configured for filters (or the
 * primary-nav category) open its scope. The display choice is admin-owned and
 * persists even when that category is no longer in the primary nav slot. */
export function filterFamilyForSelection(categories: Category[], selectedIds: string[]): string | undefined {
  if (selectedIds.length !== 1) return undefined;
  const selected = categories.find((category) => category.id === selectedIds[0]);
  if (!selected || selected.visible === false) return undefined;
  const parent = selected.parentId ? categories.find((category) => category.id === selected.parentId) : undefined;
  if (selected.parentId && (!parent || parent.visible === false)) return undefined;
  const filterFamily = (category: Category) => category.familyFiltersOnly === true || category.showInPrimaryNavigation === true;
  if (parent && filterFamily(parent)) return parent.id;
  if (filterFamily(selected)) return selected.id;
  return undefined;
}

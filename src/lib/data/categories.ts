import type { Category } from "@/lib/types/domain";

/**
 * Seed catalogue taxonomy.
 *
 * Niketon Mart sells two things side by side: everyday grocery and a fresh
 * market (vegetables, fruit, fish, meat, eggs and dairy). These rows are seeded
 * once and then owned by the admin panel — `/admin/catalogue/taxonomy` can
 * rename, hide, add or remove any of them, and the storefront navigation, shop
 * filters and homepage tiles all read from the database.
 *
 * `productCount` is deliberately absent: it is derived from the catalogue at
 * read time (see `lib/catalogue/repository.ts`) so the number on the tiles
 * always matches what the shop can actually return.
 */
export const categories: Category[] = [
  {
    id: "vegetables",
    slug: "vegetables",
    name: "Fresh Vegetables",
    icon: "🥬",
    group: "fresh",
    visible: true,
  },
  {
    id: "fresh-fruits",
    slug: "fresh-fruits",
    name: "Fresh Fruits",
    icon: "🍎",
    group: "fresh",
    visible: true,
  },
  {
    id: "fish",
    slug: "fish",
    name: "Fresh Fish",
    icon: "🐟",
    group: "fresh",
    visible: true,
  },
  {
    id: "meat-poultry",
    slug: "meat-poultry",
    name: "Meat & Poultry",
    icon: "🍗",
    group: "fresh",
    visible: true,
  },
  {
    id: "milk-eggs",
    slug: "milk-eggs",
    name: "Eggs & Dairy",
    icon: "🥚",
    group: "fresh",
    visible: true,
  },
  {
    id: "daily-grocery",
    slug: "daily-grocery",
    name: "Daily Grocery & Essentials",
    icon: "🛒",
    group: "pantry",
    visible: true,
  },
  {
    id: "house-hold",
    slug: "house-hold",
    name: "Household Essentials",
    icon: "🧴",
    group: "household",
    visible: true,
  },
  {
    id: "bakery",
    slug: "bakery",
    name: "Bakery",
    icon: "🍞",
    group: "bakery",
    visible: true,
  },
  {
    id: "dry-fruits",
    slug: "dry-fruits",
    name: "Dry Fruits & Nuts",
    icon: "🥜",
    group: "pantry",
    visible: true,
  },
  {
    id: "beverages",
    slug: "beverages",
    name: "Drinks & Juice",
    icon: "🧃",
    group: "pantry",
    visible: true,
  },
  {
    id: "snacks",
    slug: "snacks",
    name: "Snacks & Sweets",
    icon: "🍫",
    group: "pantry",
    visible: true,
  },
  {
    id: "frozen-food",
    slug: "frozen-food",
    name: "Frozen Foods",
    icon: "🧊",
    group: "pantry",
    visible: true,
  },
];

/** Grouping used by the mega menu — every slug must exist above. */
export const megaMenuGroups: { title: string; slugs: string[] }[] = [
  { title: "Fresh Market", slugs: ["vegetables", "fresh-fruits", "fish", "meat-poultry"] },
  { title: "Dairy & Bakery", slugs: ["milk-eggs", "bakery"] },
  { title: "Grocery & Pantry", slugs: ["daily-grocery", "dry-fruits", "beverages", "snacks"] },
  { title: "Everyday Essentials", slugs: ["house-hold", "frozen-food"] },
];

export const getCategories = () => categories;

export const getCategoryBySlug = (slug: string) =>
  categories.find((category) => category.slug === slug);

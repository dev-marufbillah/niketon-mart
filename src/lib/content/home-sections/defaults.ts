import { products } from "@/lib/data/products";
import type { TopPicksSectionRecord } from "@/lib/content/home-sections/types";

/**
 * First-run seed for the Our Top Picks section.
 *
 * This is not the source of truth — it is only what the section looks like
 * before an admin saves anything. It is derived from the catalogue so there is
 * no duplicated product list to maintain.
 */
export const defaultTopPicksSection: TopPicksSectionRecord = {
  // Eyebrow defaults to empty: the requested title + subtitle pair is the design.
  // Admins can add a label here at any time.
  eyebrow: "",
  title: "Our Top Picks",
  subtitle: "Carefully selected essentials for your everyday needs.",
  ctaLabel: "Browse All Products",
  // Points at the live Featured Products rail until the /shop catalogue ships.
  ctaHref: "#featured-products",
  productIds: products
    .filter((product) => product.flags?.bestSeller)
    .map((product) => product.id),
  updatedAt: new Date(0).toISOString(),
  updatedBy: "seed",
};

/** Field limits shared by the admin form, the API route and the store. */
export const topPicksLimits = {
  eyebrow: 40,
  title: 80,
  subtitle: 180,
  ctaLabel: 32,
  ctaHref: 120,
  maxProducts: 12,
  minProducts: 1,
} as const;

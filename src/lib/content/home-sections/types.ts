import type { Product } from "@/lib/types/domain";

/**
 * Editable merchandising sections.
 *
 * The homepage never stores its own copy of a product list — it reads a section
 * record that the admin dashboard owns. That keeps the storefront as a pure
 * renderer and makes every block (Top Picks today, more later) composable.
 */

export type TopPicksSectionInput = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  /** Ordered product ids. Order is the merchandising order shown on the homepage. */
  productIds: string[];
};

export type TopPicksSectionRecord = TopPicksSectionInput & {
  updatedAt: string;
  updatedBy: string;
};

export type ResolvedTopPicksItem = {
  /** Stable row key so reordering never remounts cards. */
  key: string;
  product: Product;
};

export type ResolvedTopPicksSection = Omit<TopPicksSectionRecord, "productIds"> & {
  id: "home.top-picks";
  items: ResolvedTopPicksItem[];
  /** Product ids that no longer exist in the catalogue (surfaced to the admin). */
  missingProductIds: string[];
};

export type SectionSaveResult =
  | { ok: true; data: TopPicksSectionRecord }
  | { ok: false; errors: string[] };

export const TOP_PICKS_SECTION_ID = "home.top-picks" as const;

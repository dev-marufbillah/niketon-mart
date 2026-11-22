/**
 * Shared domain model.
 *
 * Niketon Mart is a single-business storefront: online grocery and a fresh
 * market (vegetables, fruit, fish, meat, eggs and dairy). Products can be sold
 * by unit, by weight or per piece, and fresh items can be cut, cleaned or
 * prepared on request — `preparation` below is the product-level configuration
 * that drives that flow on the product page, in the cart and on the order.
 */

export type CurrencyCode = "BDT";

/** A Money value, when used, is stored as integer poisha (1 taka = 100 poisha). */
export type Money = {
  amount: number;
  currency: CurrencyCode;
};

export type ProductAvailability = "in_stock" | "low_stock" | "out_of_stock";

export type Category = {
  id: string;
  slug: string;
  name: string;
  /** Legacy icon kept for compatibility; category thumbnails use `image`. */
  icon: string;
  description?: string;
  image?: string;
  showOnHome?: boolean;
  showInNavigation?: boolean;
  /** An admin-selected category can also appear as a primary navigation link. */
  showInPrimaryNavigation?: boolean;
  /** Show this category family as scoped filters, not illustrated child cards. */
  familyFiltersOnly?: boolean;
  /** Derived from the catalogue at read time — never authored by hand. */
  productCount?: number;
  /** Used by the browse-all mega menu grouping. */
  group?: "fresh" | "pantry" | "household" | "bakery";
  /** Optional top-level category ID. Only one subcategory level is supported. */
  parentId?: string;
  /** Admin toggle — hidden categories drop out of navigation and filters. */
  visible?: boolean;
  /** Admin-controlled display order across homepage, navigation and filters. */
  order?: number;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  visible?: boolean;
  /** Derived from the catalogue at read time (admin usage badge). */
  productCount?: number;
};

export type ProductType = {
  id: string;
  slug: string;
  name: string;
  visible?: boolean;
  /** Derived from the catalogue at read time (admin usage badge). */
  productCount?: number;
};

export type ProductAttribute = {
  label: string;
  value: string;
};

/** One selectable option inside a variation group (e.g. "1 Kg" for Weight). */
export type ProductOptionValue = {
  label: string;
  /** Weight of this option in grams — used for unit-price comparisons. */
  grams?: number;
  /** Absolute price for this option. Falls back to the product price. */
  price?: number;
  compareAtPrice?: number;
  /** Units available for this option. Falls back to the product stock. */
  stock?: number;
  /** Optional image shown in the gallery when the option is selected. */
  image?: string;
  isDefault?: boolean;
};

/** A variation group such as Weight, Size or Pack. */
export type ProductOptionGroup = {
  name: string;
  values: ProductOptionValue[];
};

/**
 * Everything behind the "Additional Information" tab. Only filled fields are
 * rendered, so a product never shows irrelevant specs.
 */
export type ProductDetails = {
  features?: string[];
  specifications?: ProductAttribute[];
  weight?: string;
  dimensions?: string;
  ingredients?: string;
  nutrition?: ProductAttribute[];
  storage?: string;
  usage?: string;
};

/* ------------------------------------------------------------------ fresh market
 * Preparation & cutting
 * ---------------------
 * Fish, meat, poultry and some vegetables are cut, cleaned or trimmed on
 * request. The configuration lives per product (`preparation` below) so a rui
 * fish can offer curry cut while a packet of lentils offers nothing at all.
 */

export type PreparationOption = {
  id: string;
  label: string;
  /** Extra charge per unit (per kg / per piece). 0 means included. */
  charge: number;
  isDefault?: boolean;
  /** Small helper under the option, e.g. "Bones removed". */
  note?: string;
};

export type PreparationGroup = {
  id: string;
  name: string;
  /** single → radio buttons, multiple → checkboxes. */
  type: "single" | "multiple";
  /** The shopper has to pick something from this group. */
  required?: boolean;
  options: PreparationOption[];
};

export type ProductPreparation = {
  enabled: boolean;
  /** Preparation preset this configuration started from (informational). */
  presetId?: string;
  groups: PreparationGroup[];
  allowInstructions?: boolean;
  maxInstructionLength?: number;
  /** Rendered above the options on the product page. */
  note?: string;
};

/**
 * How a product is sold. `unit` mirrors the human label ("1 kg", "500 g",
 * "piece"); `minQuantity`/`step` drive the quantity control on the product page
 * and are enforced again on the server when the order is created.
 */
export type ProductSelling = {
  unit?: string;
  minQuantity?: number;
  step?: number;
  /** "approx. 800–900 g each" — shown when a piece is sold by weight. */
  estimatedWeight?: string;
  /** The final weight may differ slightly; the note explains it to the shopper. */
  variableWeight?: boolean;
  /**
   * Weight of one selling unit in grams. The basis for the final price when the
   * packer's scale differs from the estimate. Derived from `unit` ("1 kg") when
   * an admin has not typed it in.
   */
  unitGrams?: number;
};

export type ProductVariantSelection = {
  variantLabel?: string;
  variantPrice?: number;
  variantStock?: number;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  /** Display label for the category (kept denormalised for card rendering). */
  categoryLabel: string;
  unit: string;
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  image: string;
  /** `cover` renders the photo full-bleed on its own backdrop; `contain` keeps a white packshot. */
  imageMode?: "contain" | "cover";
  description: string;
  availability: ProductAvailability;
  tags?: string[];
  /** Storefront merchandising flags — the admin dashboard toggles these. */
  flags?: {
    featured?: boolean;
    bestSeller?: boolean;
    dealOfTheDay?: boolean;
    weeklySpecial?: boolean;
  };
  /** Catalogue merchandising & inventory fields managed from the admin dashboard. */
  brandId?: string;
  productTypeId?: string;
  /** On-hand units. Availability is derived from this, never from the UI. */
  stock?: number;
  sku?: string;
  /** ISO date used by the "Newest" sort. */
  createdAt?: string;
  /** Units sold — popularity / best-selling sorts. */
  soldCount?: number;
  status?: "active" | "draft";
  visibility?: "visible" | "hidden";
  attributes?: ProductAttribute[];
  /** Gallery images — the first one is the primary image on cards. */
  images?: string[];
  /** Purchasable variations (Weight, Pack size…). */
  options?: ProductOptionGroup[];
  /** Additional-information content, rendered only when present. */
  details?: ProductDetails;
  /** Cut / clean / preparation options for fresh products. */
  preparation?: ProductPreparation;
  /** Selling unit, minimum quantity and quantity step. */
  selling?: ProductSelling;
};

export type CartLine = {
  productId: string;
  quantity: number;
  /** Selected selling option ("1 kg", "500 g") — same product can be in the cart twice. */
  variantLabel?: string;
  /** Unit price for the selected variation, captured when it was added. */
  variantPrice?: number;
  /** Chosen preparation (cut / cleaned / minced…) for fresh products. */
  preparation?: CartPreparation;
};

/**
 * A preparation choice the shopper made on the product page.
 *
 * `signature` is a stable string derived from the choices + instructions; it is
 * part of the cart line identity so "Rui — curry cut" and "Rui — whole" are two
 * rows instead of one that silently overwrites the other. The server never
 * trusts `charge` — it is recomputed from the product configuration at checkout.
 */
export type CartPreparation = {
  signature: string;
  /** One entry per option the shopper picked, in admin-defined group order. */
  options: { group: string; label: string; charge: number }[];
  instructions?: string;
  /** Sum of the per-unit preparation charges, for display only. */
  chargePerUnit: number;
};

export type WishlistEntry = {
  productId: string;
  addedAt: string;
};

export type Testimonial = {
  id: string;
  quote: string;
  name: string;
  role: string;
  rating: number;
  avatar: string;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  publishedAt: string;
  image: string;
  readTime: string;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type ServiceFeature = {
  id: string;
  title: string;
  description: string;
  icon: "shipping" | "payment" | "support";
};

export type NavLink = {
  label: string;
  href: string;
  /** Highlighted links get the accent treatment in the header. */
  accent?: boolean;
};

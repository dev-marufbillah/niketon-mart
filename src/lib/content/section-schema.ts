import type { FieldDef } from "@/lib/admin/fields";

/**
 * Homepage section registry
 * -------------------------
 * Each homepage section declares the fields the admin can edit, the anchor the
 * storefront renders, and (where the content lives in its own collection) the
 * admin module that owns it. The storefront, the section editor and the
 * default copy all read from this one definition.
 */

export type HomeSectionKey =
  | "hero"
  | "categories"
  | "freshMarket"
  | "promos"
  | "featured"
  | "campaign"
  | "deals"
  | "weekly"
  | "topPicks"
  | "testimonials"
  | "blog"
  | "faq"
  | "services"
  | "lifestyle"
  | "newsletter";

export type SectionSchema = {
  label: string;
  description: string;
  /** Anchor rendered on the storefront. */
  anchor?: string;
  /** Where the content really lives, when it is not inline copy. */
  relatedModule?: { label: string; href: string };
  fields: FieldDef[];
};

const heading = (defaults?: {
  eyebrow?: string;
  title?: string;
  titleAccent?: string;
}): FieldDef[] => [
  {
    name: "eyebrow",
    label: "Eyebrow",
    type: "text",
    help: "Small label above the title.",
    span: 1,
    defaultValue: defaults?.eyebrow ?? "",
  },
  { name: "title", label: "Section title", type: "text", span: 1, defaultValue: defaults?.title ?? "" },
  {
    name: "titleAccent",
    label: "Accent words (shown in green)",
    type: "text",
    span: 1,
    help: "Leave empty to use the title only.",
    defaultValue: defaults?.titleAccent ?? "",
  },
];

export const sectionSchemas: Record<HomeSectionKey, SectionSchema> = {
  freshMarket: {
    label: "Fresh market departments",
    description:
      "The fish / meat / produce counters. The products are pulled from the catalogue, so a new fish appears here automatically — this block only controls the copy and which departments are shown.",
    anchor: "fresh-market",
    relatedModule: { label: "Preparation & cutting", href: "/admin/preparation" },
    fields: [
      ...heading({ eyebrow: "Fresh Market", title: "Cut and cleaned", titleAccent: "before it reaches you" }),
      {
        name: "description",
        label: "Description",
        type: "textarea",
        span: 3,
        defaultValue:
          "Choose curry cut, boneless, minced, peeled or whole at checkout — our fishmongers and butchers prepare it the morning you order.",
      },
      {
        name: "departments",
        label: "Departments (category slugs)",
        type: "text",
        span: 2,
        help: "Comma separated, in display order. Slugs live in Catalogue → Taxonomy, e.g. fish, meat-poultry, vegetables.",
        defaultValue: "fish, meat-poultry, vegetables",
      },
      {
        name: "perDepartment",
        label: "Products per department",
        type: "number",
        span: 1,
        min: 1,
        max: 6,
        step: 1,
        defaultValue: 6,
        help: "Up to six in-stock catalogue products per department; six fills the existing mobile and desktop rows evenly.",
      },
      { name: "ctaLabel", label: "Button label", type: "text", span: 1, defaultValue: "Shop the fresh market" },
      { name: "ctaHref", label: "Button link", type: "text", span: 1, defaultValue: "/shop?category=fish" },
    ],
  },
  hero: {
    label: "Hero banner",
    description: "The first screen. Slides are managed in Hero slides; copy below is the heading used when a slide does not override it.",
    anchor: "top",
    relatedModule: { label: "Manage hero slides", href: "/admin/r/hero_slides" },
    fields: [
      { name: "badge", label: "Badge", type: "text", span: 1, defaultValue: "Your Online Grocery Store" },
      { name: "title", label: "Headline", type: "text", span: 1, defaultValue: "Your One-Stop Shop for" },
      { name: "titleAccent", label: "Headline accent", type: "text", span: 1, defaultValue: "Quality Groceries" },
      {
        name: "subtitle",
        label: "Sub-heading",
        type: "textarea",
        span: 3,
        defaultValue:
          "Everyday grocery and a fresh market — vegetables, fruit, fish and meat, cleaned and cut to order.",
      },
      { name: "primaryLabel", label: "Primary button label", type: "text", span: 1, defaultValue: "Shop Now" },
      { name: "primaryHref", label: "Primary button link", type: "text", span: 1, defaultValue: "/home-grocery" },
      { name: "secondaryLabel", label: "Secondary link label", type: "text", span: 1, defaultValue: "View All Products" },
      { name: "secondaryHref", label: "Secondary link", type: "text", span: 1, defaultValue: "/home-grocery" },
      { name: "image", label: "Hero image", type: "image", span: 1, defaultValue: "/images/hero-woman.png" },
      { name: "autoplay", label: "Automatically rotate slides", type: "boolean", span: 1, defaultValue: true },
      { name: "slideIntervalSeconds", label: "Slide interval (seconds)", type: "number", span: 1, min: 3, max: 15, step: 1, defaultValue: 6 },
    ],
  },
  categories: {
    label: "Featured categories",
    description: "Category tiles. Which categories appear is controlled by category visibility.",
    anchor: "categories",
    relatedModule: { label: "Manage categories", href: "/admin/catalogue/taxonomy" },
    fields: heading({ eyebrow: "Categories", title: "Featured", titleAccent: "Categories" }),
  },
  promos: {
    label: "Promo banners",
    description: "Two wide promotion cards under the categories.",
    anchor: "promotions",
    relatedModule: { label: "Manage promo banners", href: "/admin/r/promo_banners" },
    fields: [],
  },
  featured: {
    label: "Featured products",
    description: "Horizontal product rail. Leave the product list empty to use products flagged as featured.",
    anchor: "featured-products",
    relatedModule: { label: "Manage products", href: "/admin/catalogue/products" },
    fields: [
      ...heading({ eyebrow: "Products", title: "Featured", titleAccent: "Products" }),
      { name: "ctaLabel", label: "Button label", type: "text", span: 1, defaultValue: "View All Products" },
      { name: "ctaHref", label: "Button link", type: "text", span: 1, defaultValue: "/home-grocery" },
      { name: "productIds", label: "Products", type: "product-picker", span: 3, defaultValue: [], help: "Empty = every product flagged Featured." },
    ],
  },
  campaign: {
    label: "Discount countdown",
    description: "The countdown block. Set an end date and the timer follows it.",
    anchor: "campaign",
    fields: [
      ...heading({ title: "Summer", titleAccent: "Discount" }),
      { name: "subtitle", label: "Sub-heading", type: "text", span: 3, defaultValue: "" },
      { name: "ctaLabel", label: "Button label", type: "text", span: 1, defaultValue: "Shop Now" },
      { name: "ctaHref", label: "Button link", type: "text", span: 1, defaultValue: "/home-grocery" },
      { name: "endsAt", label: "Countdown ends", type: "date", span: 1, help: "Optional. The timer ends at 11:59:59 pm Bangladesh time on this date; leave blank to hide the timer. Update or hide expired promotions." },
      { name: "leftImage", label: "Left image", type: "image", span: 1, defaultValue: "/images/lifestyle/countdown-left.jpg" },
      { name: "rightImage", label: "Right image", type: "image", span: 1, defaultValue: "/images/lifestyle/produce-bin.jpg" },
    ],
  },
  deals: {
    label: "Deals of the day",
    description: "Two large deal cards. Empty product list = products flagged Deals of the day.",
    anchor: "deals",
    fields: [
      ...heading({ eyebrow: "Today Deals", title: "Deals", titleAccent: "of the Day" }),
      {
        name: "description",
        label: "Description",
        type: "textarea",
        span: 3,
        defaultValue: "Fresh picks at their lowest price today — while stock lasts.",
      },
      { name: "productIds", label: "Products", type: "product-picker", span: 3, defaultValue: [], help: "Empty = products flagged Deals of the day." },
    ],
  },
  weekly: {
    label: "Weekly deals banner",
    description: "The green full-width banner.",
    anchor: "weekly-deals",
    fields: [
      ...heading({ eyebrow: "Weekly Deals", title: "Unbeatable Offers: Your", titleAccent: "Weekly Grocery Specials" }),
      { name: "subtitle", label: "Sub-heading", type: "text", span: 3, defaultValue: "Save more when you stock up on the week's essentials." },
      { name: "ctaLabel", label: "Button label", type: "text", span: 1, defaultValue: "Shop Now" },
      { name: "ctaHref", label: "Button link", type: "text", span: 1, defaultValue: "/home-grocery?collection=weekly" },
      { name: "image", label: "Basket image", type: "image", span: 1, defaultValue: "/images/deals-basket.png" },
    ],
  },
  topPicks: {
    label: "Our Top Picks",
    description: "Products, title, subtitle and button are managed in the Top Picks editor.",
    anchor: "our-top-picks",
    relatedModule: { label: "Edit Our Top Picks", href: "/admin/home/our-top-picks" },
    fields: [],
  },
  testimonials: {
    label: "Testimonials",
    description: "Customer quotes carousel.",
    anchor: "testimonials",
    relatedModule: { label: "Manage testimonials", href: "/admin/r/testimonials" },
    fields: heading({ eyebrow: "Testimonials", title: "Testimonials from", titleAccent: "Our Loyal Customers" }),
  },
  blog: {
    label: "News & blogs",
    description: "Latest posts. Manage articles in the Blog module.",
    anchor: "blog",
    relatedModule: { label: "Manage blog posts", href: "/admin/r/posts" },
    fields: [
      ...heading({ eyebrow: "News & Blogs", title: "Our Latest", titleAccent: "News & Blogs" }),
      { name: "ctaLabel", label: "Button label", type: "text", span: 1, defaultValue: "View All" },
      { name: "ctaHref", label: "Button link", type: "text", span: 1, defaultValue: "/blogs" },
      { name: "limit", label: "Posts shown", type: "number", span: 1, defaultValue: 3 },
    ],
  },
  faq: {
    label: "FAQ",
    description: "Questions and answers.",
    anchor: "faq",
    relatedModule: { label: "Manage FAQs", href: "/admin/r/faqs" },
    fields: heading({ eyebrow: "FAQ", title: "Frequently Asked", titleAccent: "Questions" }),
  },
  services: {
    label: "Service benefits",
    description: "Free shipping / payment / support strip.",
    anchor: "services",
    relatedModule: { label: "Manage service benefits", href: "/admin/r/service_features" },
    fields: [],
  },
  lifestyle: {
    label: "Lifestyle strip",
    description: "Photo strip above the newsletter.",
    anchor: "lifestyle",
    fields: [
      {
        name: "images",
        label: "Photos",
        type: "repeater",
        span: 3,
        addLabel: "Add photo",
        defaultValue: [
          { url: "/images/lifestyle/strip-1.jpg", alt: "" },
          { url: "/images/lifestyle/strip-2.jpg", alt: "" },
          { url: "/images/lifestyle/strip-3.jpg", alt: "" },
          { url: "/images/lifestyle/strip-4.jpg", alt: "" },
          { url: "/images/lifestyle/strip-5.jpg", alt: "" },
        ],
        itemFields: [
          { name: "url", label: "Image", type: "image" },
          { name: "alt", label: "Alt text", type: "text" },
        ],
      },
    ],
  },
  newsletter: {
    label: "Newsletter",
    description: "Subscribe band.",
    anchor: "newsletter",
    fields: [
      ...heading({
        eyebrow: "Our Newsletter",
        title: "Subscribe to Our Newsletter to Get",
        titleAccent: "Updates on Our Latest Offers",
      }),
      {
        name: "subtitle",
        label: "Sub-heading",
        type: "text",
        span: 3,
        defaultValue: "Join the store's mailing list for future updates.",
      },
      { name: "buttonLabel", label: "Button label", type: "text", span: 1, defaultValue: "Subscribe" },
    ],
  },
};

export const sectionKeys = Object.keys(sectionSchemas) as HomeSectionKey[];

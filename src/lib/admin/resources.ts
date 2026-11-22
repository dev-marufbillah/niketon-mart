import type { ColumnDef, FieldDef } from "@/lib/admin/fields";
import type { Permission } from "@/lib/auth/permissions";
import { isSafeTakaAmount } from "@/lib/utils/currency";

/**
 * Resource registry
 * -----------------
 * Declarative definition of every collection the admin can manage through the
 * generic CRUD screens. Each resource describes *its own* fields, columns and
 * validation — a coupon form looks nothing like a delivery-area form, but both
 * share the table, form, validation, permissions and activity logging engine.
 *
 * Adding a manageable collection = one entry here + one registry entry.
 */

export type ResourceConfig = {
  key: string;
  label: string;
  singular: string;
  description: string;
  collection: string;
  permission: Permission;
  /** Read-only resources hide create/delete but still allow status edits. */
  canCreate?: boolean;
  canDelete?: boolean;
  columns: ColumnDef[];
  fields: FieldDef[];
  searchFields: string[];
  /** Optional quick filters shown above the table (`?status=new`). */
  filters?: { field: string; label: string; value: string }[];
  defaultSort?: { field: string; direction: "asc" | "desc" };
  orderField?: string;
  /** Field that must be unique (slugs, codes). */
  uniqueField?: string;
  previewPath?: (row: Record<string, unknown>) => string;
  emptyHint?: string;
  /** Resource-specific rules that run after the generic checks. */
  validate?: (values: Record<string, unknown>) => string[];
  /**
   * Records that point at this one. Deleting a record that is still referenced
   * is refused with a plain-language reason instead of leaving orphans behind.
   */
  usedBy?: { collection: string; field: string; label: string }[];
};

const visibleField: FieldDef = {
  name: "visible",
  label: "Visible on website",
  type: "boolean",
  defaultValue: true,
  span: 1,
};

const orderField: FieldDef = {
  name: "order",
  label: "Display order",
  type: "number",
  help: "Lower numbers appear first.",
  span: 1,
  defaultValue: 1,
};

export const resources: Record<string, ResourceConfig> = {
  hero_slides: {
    key: "hero_slides",
    label: "Hero slides",
    singular: "slide",
    description:
      "The first thing a shopper sees. With more than one visible slide the hero becomes a carousel.",
    collection: "hero_slides",
    permission: "content.manage",
    columns: [
      { name: "image", label: "", type: "image" },
      { name: "title", label: "Headline" },
      { name: "badge", label: "Badge", secondary: true },
      { name: "visible", label: "Visible", type: "boolean" },
      { name: "order", label: "Order", type: "number" },
    ],
    fields: [
      { name: "badge", label: "Badge", type: "text", span: 1 },
      { name: "title", label: "Headline", type: "text", span: 1, required: true },
      { name: "titleAccent", label: "Headline accent (green)", type: "text", span: 1 },
      { name: "subtitle", label: "Sub-heading", type: "textarea", span: 3 },
      { name: "image", label: "Desktop hero image", type: "image", span: 1, required: true },
      { name: "mobileImage", label: "Mobile hero image (optional)", type: "image", span: 1 },
      { name: "imageAlt", label: "Image description (accessibility)", type: "text", span: 1 },
      {
        name: "imageFit",
        label: "Image fit",
        type: "select",
        span: 1,
        defaultValue: "contain",
        options: [
          { value: "contain", label: "Show full image" },
          { value: "cover", label: "Fill image area" },
        ],
      },
      {
        name: "imagePosition",
        label: "Image focus",
        type: "select",
        span: 1,
        defaultValue: "center",
        options: [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ],
      },
      { name: "featureOne", label: "Image label 1 (optional)", type: "text", span: 1, defaultValue: "Grocery essentials" },
      { name: "featureTwo", label: "Image label 2 (optional)", type: "text", span: 1, defaultValue: "Fresh market" },
      { name: "primaryLabel", label: "Primary button", type: "text", span: 1 },
      { name: "primaryHref", label: "Primary link", type: "text", span: 1 },
      { name: "secondaryLabel", label: "Secondary link", type: "text", span: 1 },
      { name: "secondaryHref", label: "Secondary link URL", type: "text", span: 1 },
      visibleField,
      orderField,
    ],
    searchFields: ["title", "badge"],
    orderField: "order",
    defaultSort: { field: "order", direction: "asc" },
    validate: (values) => {
      const errors: string[] = [];
      if (!String(values.primaryLabel ?? "").trim() && String(values.primaryHref ?? "").trim()) {
        errors.push("Add a button label for the primary link, or clear the link.");
      }
      if (!String(values.secondaryLabel ?? "").trim() && String(values.secondaryHref ?? "").trim()) {
        errors.push("Add a label for the secondary link, or clear the link.");
      }
      if (values.imageFit !== undefined && !["contain", "cover"].includes(String(values.imageFit))) {
        errors.push("Choose a supported image fit.");
      }
      if (values.imagePosition !== undefined && !["left", "center", "right"].includes(String(values.imagePosition))) {
        errors.push("Choose a supported image focus.");
      }
      return errors;
    },
  },

  promo_banners: {
    key: "promo_banners",
    label: "Promo banners",
    singular: "banner",
    description: "The two wide promotion cards below the category tiles.",
    collection: "promo_banners",
    permission: "content.manage",
    columns: [
      { name: "image", label: "", type: "image" },
      { name: "title", label: "Title" },
      { name: "badge", label: "Badge", secondary: true },
      { name: "visible", label: "Visible", type: "boolean" },
      { name: "order", label: "Order", type: "number" },
    ],
    fields: [
      { name: "badge", label: "Badge", type: "text", span: 1 },
      { name: "title", label: "Title", type: "text", span: 1, required: true },
      { name: "titleAccent", label: "Title second line", type: "text", span: 1 },
      { name: "description", label: "Description", type: "textarea", span: 3 },
      { name: "href", label: "Link", type: "text", span: 1 },
      { name: "image", label: "Image", type: "image", span: 1, required: true },
      {
        name: "tone",
        label: "Card colour",
        type: "select",
        span: 1,
        options: [
          { value: "light", label: "Light" },
          { value: "yellow", label: "Yellow" },
        ],
        defaultValue: "light",
      },
      visibleField,
      orderField,
    ],
    searchFields: ["title", "badge"],
    orderField: "order",
    defaultSort: { field: "order", direction: "asc" },
  },

  testimonials: {
    key: "testimonials",
    label: "Testimonials",
    singular: "testimonial",
    description: "Customer quotes shown in the homepage carousel.",
    collection: "testimonials",
    permission: "content.manage",
    columns: [
      { name: "avatar", label: "", type: "image" },
      { name: "name", label: "Customer" },
      { name: "quote", label: "Quote", secondary: true },
      { name: "visible", label: "Visible", type: "boolean" },
      { name: "order", label: "Order", type: "number" },
    ],
    fields: [
      { name: "name", label: "Customer name", type: "text", span: 1, required: true },
      { name: "role", label: "Role", type: "text", span: 1 },
      { name: "rating", label: "Rating (1–5)", type: "number", min: 1, max: 5, span: 1, defaultValue: 5 },
      { name: "quote", label: "Quote", type: "textarea", span: 3, required: true },
      { name: "avatar", label: "Avatar", type: "image", span: 1, required: true },
      visibleField,
      orderField,
    ],
    searchFields: ["name", "quote"],
    orderField: "order",
    defaultSort: { field: "order", direction: "asc" },
  },

  posts: {
    key: "posts",
    label: "Blog posts",
    singular: "post",
    description:
      "Articles on /blogs and the homepage strip. Drafts stay private; a publish date in the future keeps a post scheduled until that day.",
    collection: "posts",
    permission: "content.manage",
    columns: [
      { name: "image", label: "", type: "image" },
      { name: "title", label: "Title" },
      { name: "category", label: "Category", type: "badge", secondary: true },
      { name: "author", label: "Author", secondary: true },
      { name: "status", label: "Status", type: "badge" },
      { name: "publishedAt", label: "Published", type: "date", secondary: true },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", span: 2, required: true },
      { name: "slug", label: "Slug", type: "text", span: 1, help: "Generated from the title when empty." },
      { name: "excerpt", label: "Excerpt", type: "textarea", span: 3, required: true },
      { name: "image", label: "Cover image", type: "image", span: 1, required: true },
      {
        name: "categoryId",
        label: "Category",
        type: "select",
        span: 1,
        required: true,
        optionsFrom: { collection: "blog_categories", labelField: "name", mirrorTo: "category" },
      },
      {
        name: "authorId",
        label: "Author",
        type: "select",
        span: 1,
        required: true,
        optionsFrom: { collection: "authors", labelField: "name", mirrorTo: "author" },
      },
      {
        name: "publishedAt",
        label: "Publish date",
        type: "date",
        span: 1,
        defaultToday: true,
        help: "Defaults to today. A future date keeps the post scheduled.",
      },
      { name: "readTime", label: "Read time", type: "text", span: 1, defaultValue: "4 min read" },
      {
        name: "status",
        label: "Status",
        type: "select",
        span: 1,
        options: [
          { value: "published", label: "Published" },
          { value: "draft", label: "Draft" },
        ],
        defaultValue: "published",
        help: "Draft posts never appear on the website.",
      },
      { name: "tags", label: "Tags", type: "tags", span: 3, help: "Comma separated. Used for related posts and the tag filter." },
      {
        name: "blocks",
        label: "Article content",
        type: "blocks",
        span: 3,
        help: "Add headings, paragraphs, images, lists, quotes, callouts and step cards in the order they should read.",
        blockTypes: ["paragraph", "heading", "image", "list", "quote", "callout", "columns", "steps"],
      },
      {
        name: "body",
        label: "Plain-text fallback",
        type: "textarea",
        span: 3,
        help: "Only used when the article has no content blocks. One paragraph per blank line.",
      },
      { name: "seoTitle", label: "SEO title", type: "text", span: 2, help: "Defaults to the post title." },
      {
        name: "seoDescription",
        label: "SEO description",
        type: "textarea",
        span: 1,
        help: "Defaults to the excerpt.",
      },
      visibleField,
    ],
    searchFields: ["title", "category", "author", "excerpt", "tags"],
    uniqueField: "slug",
    validate: (values) => {
      const errors: string[] = [];
      if (values.status === "published" && !String(values.publishedAt ?? "").trim()) {
        errors.push("A published post needs a publish date.");
      }
      if (String(values.excerpt ?? "").length > 320) {
        errors.push("Keep the excerpt under 320 characters — it is used on cards.");
      }
      const blocks = Array.isArray(values.blocks) ? values.blocks : [];
      const hasBody = String(values.body ?? "").trim().length > 0;
      if (blocks.length === 0 && !hasBody) {
        errors.push("Add at least one content block (or some plain text) so the article is not empty.");
      }
      return errors;
    },
    defaultSort: { field: "publishedAt", direction: "desc" },
    previewPath: (row) => `/blogs/${row.slug}`,
  },

  blog_categories: {
    key: "blog_categories",
    label: "Blog categories",
    singular: "category",
    description: "The categories in the blog sidebar and on each article. Deleting one leaves its posts uncategorised.",
    collection: "blog_categories",
    permission: "content.manage",
    columns: [
      { name: "name", label: "Category" },
      { name: "slug", label: "Slug", secondary: true },
      { name: "visible", label: "Visible", type: "boolean" },
      { name: "order", label: "Order", type: "number" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", span: 1, required: true },
      { name: "slug", label: "Slug", type: "text", span: 1, help: "Used in /blogs?category=slug" },
      { name: "description", label: "Description", type: "text", span: 1 },
      visibleField,
      orderField,
    ],
    searchFields: ["name", "description"],
    uniqueField: "name",
    orderField: "order",
    defaultSort: { field: "order", direction: "asc" },
    previewPath: (row) => `/blogs?category=${row.slug ?? ""}`,
    usedBy: [{ collection: "posts", field: "categoryId", label: "blog post" }],
  },

  authors: {
    key: "authors",
    label: "Blog authors",
    singular: "author",
    description: "The people behind the articles. Their name, role and photo appear on the article page and in the byline.",
    collection: "authors",
    permission: "content.manage",
    columns: [
      { name: "avatar", label: "", type: "image" },
      { name: "name", label: "Author" },
      { name: "role", label: "Role", secondary: true },
      { name: "visible", label: "Visible", type: "boolean" },
      { name: "order", label: "Order", type: "number" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", span: 1, required: true },
      { name: "role", label: "Role", type: "text", span: 1 },
      { name: "avatar", label: "Photo", type: "image", span: 1 },
      { name: "bio", label: "Short bio", type: "textarea", span: 3, help: "Shown in the author box under each article." },
      visibleField,
      orderField,
    ],
    searchFields: ["name", "role", "bio"],
    uniqueField: "name",
    orderField: "order",
    defaultSort: { field: "order", direction: "asc" },
    usedBy: [{ collection: "posts", field: "authorId", label: "blog post" }],
  },

  faq_categories: {
    key: "faq_categories",
    label: "FAQ categories",
    singular: "category",
    description: "The filter list on /faq. Deleting a category leaves its questions in the “Other questions” group.",
    collection: "faq_categories",
    permission: "content.manage",
    columns: [
      { name: "name", label: "Category" },
      { name: "slug", label: "Slug", secondary: true },
      { name: "visible", label: "Visible", type: "boolean" },
      { name: "order", label: "Order", type: "number" },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", span: 1, required: true },
      { name: "slug", label: "Slug", type: "text", span: 1 },
      { name: "description", label: "Description", type: "text", span: 1 },
      visibleField,
      orderField,
    ],
    searchFields: ["name", "description"],
    uniqueField: "name",
    orderField: "order",
    defaultSort: { field: "order", direction: "asc" },
    usedBy: [{ collection: "faqs", field: "categoryId", label: "FAQ" }],
  },

  faqs: {
    key: "faqs",
    label: "FAQs",
    singular: "question",
    description: "Questions shown in the homepage accordion and on /faq.",
    collection: "faqs",
    permission: "content.manage",
    columns: [
      { name: "question", label: "Question" },
      { name: "answer", label: "Answer", secondary: true },
      { name: "visible", label: "Visible", type: "boolean" },
      { name: "order", label: "Order", type: "number" },
    ],
    fields: [
      { name: "question", label: "Question", type: "text", span: 2, required: true },
      {
        name: "categoryId",
        label: "Category",
        type: "select",
        span: 1,
        optionsFrom: { collection: "faq_categories", labelField: "name" },
        help: "Groups the question on /faq. Leave empty for “Other questions”.",
      },
      { name: "answer", label: "Answer", type: "textarea", span: 3, required: true },
      visibleField,
      orderField,
    ],
    searchFields: ["question", "answer"],
    orderField: "order",
    defaultSort: { field: "order", direction: "asc" },
  },

  service_features: {
    key: "service_features",
    label: "Service benefits",
    singular: "benefit",
    description: "Free shipping / flexible payment / support strip on the homepage and shop.",
    collection: "service_features",
    permission: "content.manage",
    columns: [
      { name: "title", label: "Title" },
      { name: "description", label: "Description", secondary: true },
      { name: "visible", label: "Visible", type: "boolean" },
      { name: "order", label: "Order", type: "number" },
    ],
    fields: [
      { name: "title", label: "Title", type: "text", span: 1, required: true },
      {
        name: "icon",
        label: "Icon",
        type: "select",
        span: 1,
        options: [
          { value: "shipping", label: "Shipping box" },
          { value: "payment", label: "Card" },
          { value: "support", label: "Headset" },
        ],
        defaultValue: "shipping",
      },
      { name: "description", label: "Description", type: "text", span: 1, required: true },
      visibleField,
      orderField,
    ],
    searchFields: ["title", "description"],
    orderField: "order",
    defaultSort: { field: "order", direction: "asc" },
  },

  pages: {
    key: "pages",
    label: "Pages",
    singular: "page",
    description: "Content pages such as About, Contact, Privacy and Terms.",
    collection: "pages",
    permission: "content.manage",
    columns: [
      { name: "title", label: "Page" },
      { name: "slug", label: "Slug", secondary: true },
      { name: "published", label: "Published", type: "boolean" },
      { name: "updatedAt", label: "Updated", type: "date", secondary: true },
    ],
    fields: [
      { name: "title", label: "Page title", type: "text", span: 2, required: true },
      { name: "slug", label: "Slug", type: "text", span: 1, required: true, help: "e.g. about → /about" },
      { name: "subtitle", label: "Sub-heading", type: "text", span: 3 },
      { name: "heroImage", label: "Banner image", type: "image", span: 1 },
      { name: "body", label: "Body", type: "textarea", span: 3, required: true, help: "Blank line between paragraphs." },
      { name: "seoTitle", label: "SEO title", type: "text", span: 2 },
      { name: "seoDescription", label: "SEO description", type: "textarea", span: 1 },
      visibleField,
      { name: "published", label: "Published", type: "boolean", defaultValue: true, span: 1 },
    ],
    searchFields: ["title", "slug"],
    uniqueField: "slug",
    previewPath: (row) => `/${row.slug}`,
  },

  coupons: {
    key: "coupons",
    label: "Coupons",
    singular: "coupon",
    description:
      "Discount codes validated on the server at checkout. Codes can be limited to categories or specific products, and to a date window, usage cap and minimum basket.",
    collection: "coupons",
    permission: "marketing.manage",
    columns: [
      { name: "code", label: "Code", type: "badge" },
      { name: "description", label: "Description" },
      { name: "usedCount", label: "Used", type: "number" },
      { name: "active", label: "Active", type: "boolean" },
      { name: "endsAt", label: "Ends", type: "date", secondary: true },
    ],
    fields: [
      { name: "code", label: "Code", type: "text", span: 1, required: true, help: "Shoppers type this at checkout." },
      { name: "description", label: "Description", type: "text", span: 2 },
      {
        name: "type",
        label: "Discount type",
        type: "select",
        span: 1,
        options: [
          { value: "percent", label: "Percentage" },
          { value: "fixed", label: "Fixed amount" },
          { value: "free-shipping", label: "Free shipping" },
        ],
        defaultValue: "percent",
      },
      { name: "value", label: "Value", type: "number", span: 1, help: "% or amount." },
      { name: "minSubtotal", label: "Minimum subtotal", type: "price", span: 1 },
      { name: "maxDiscount", label: "Maximum discount", type: "price", span: 1, help: "0 = no cap." },
      { name: "usageLimit", label: "Usage limit", type: "number", span: 1, help: "0 = unlimited." },
      { name: "startsAt", label: "Starts", type: "date", span: 1 },
      { name: "endsAt", label: "Ends", type: "date", span: 1, help: "Empty = no expiry." },
      { name: "active", label: "Active", type: "boolean", defaultValue: true, span: 1 },
      {
        name: "appliesTo",
        label: "Discount applies to",
        type: "select",
        span: 1,
        defaultValue: "all",
        options: [
          { value: "all", label: "The whole basket" },
          { value: "categories", label: "Selected categories" },
          { value: "products", label: "Selected products" },
        ],
        help: "Restricted codes only discount the items they cover.",
      },
      {
        name: "categoryIds",
        label: "Categories",
        type: "category-picker",
        span: 3,
        showWhen: { field: "appliesTo", equals: "categories" },
        help: "The discount is calculated on the value of these categories only.",
      },
      {
        name: "productIds",
        label: "Products",
        type: "product-picker",
        span: 3,
        showWhen: { field: "appliesTo", equals: "products" },
        help: "The discount is calculated on the value of these products only.",
      },
      {
        name: "channels",
        label: "Sales channels",
        type: "tags",
        span: 3,
        help: "grocery, basket — leave empty to apply everywhere.",
      },
    ],
    searchFields: ["code", "description"],
    uniqueField: "code",
    validate: (values) => {
      const errors: string[] = [];
      const type = String(values.type ?? "percent");
      const value = Number(values.value ?? 0);
      if (!isSafeTakaAmount(value)) errors.push("Coupon value must be non-negative with at most two decimals.");
      if (!isSafeTakaAmount(Number(values.maxDiscount ?? 0))) errors.push("Maximum discount must be a non-negative BDT amount.");
      const limit = Number(values.usageLimit ?? 0);
      if (!Number.isSafeInteger(limit) || limit < 0) errors.push("Usage limit must be a non-negative whole number.");
      if (type === "percent" && (value <= 0 || value > 100)) {
        errors.push("A percentage discount must be between 1 and 100.");
      }
      if (type === "fixed" && value <= 0) errors.push("Enter the discount amount.");
      if (type === "free-shipping" && value < 0) errors.push("Free shipping coupons do not need a value.");
      if (Number(values.minSubtotal ?? 0) < 0) errors.push("Minimum subtotal cannot be negative.");
      if (Number(values.usageLimit ?? 0) < 0) errors.push("Usage limit cannot be negative.");
      if (values.startsAt && values.endsAt && String(values.endsAt) < String(values.startsAt)) {
        errors.push("The end date must be after the start date.");
      }
      const appliesTo = String(values.appliesTo ?? "all");
      if (appliesTo === "categories" && !(Array.isArray(values.categoryIds) && values.categoryIds.length)) {
        errors.push("Choose at least one category for this coupon, or set it to the whole basket.");
      }
      if (appliesTo === "products" && !(Array.isArray(values.productIds) && values.productIds.length)) {
        errors.push("Choose at least one product for this coupon, or set it to the whole basket.");
      }
      return errors;
    },
  },

  baskets: {
    key: "baskets",
    label: "Daily baskets",
    singular: "basket",
    description: "Ready-made baskets sold as a single priced package.",
    collection: "baskets",
    permission: "content.manage",
    columns: [
      { name: "image", label: "", type: "image" },
      { name: "name", label: "Basket" },
      { name: "cadence", label: "Cadence", type: "badge", secondary: true },
      { name: "price", label: "Price", type: "price" },
      { name: "available", label: "Available", type: "boolean" },
    ],
    fields: [
      { name: "name", label: "Basket name", type: "text", span: 1, required: true },
      { name: "slug", label: "Slug", type: "text", span: 1 },
      {
        name: "cadence",
        label: "Cadence",
        type: "select",
        span: 1,
        options: [
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "monthly", label: "Monthly" },
        ],
        defaultValue: "weekly",
      },
      { name: "description", label: "Description", type: "textarea", span: 3 },
      { name: "price", label: "Package price", type: "price", span: 1, required: true },
      { name: "compareAtPrice", label: "Compare-at price", type: "price", span: 1 },
      { name: "image", label: "Image", type: "image", span: 1 },
      {
        name: "items",
        label: "Contents",
        type: "repeater",
        span: 3,
        addLabel: "Add product",
        itemFields: [
          { name: "productId", label: "Product", type: "product-picker" },
          { name: "quantity", label: "Quantity", type: "number", min: 1 },
        ],
      },
      visibleField,
      { name: "available", label: "Available to order", type: "boolean", defaultValue: true, span: 1 },
      orderField,
    ],
    searchFields: ["name", "description"],
    uniqueField: "slug",
    orderField: "order",
    validate: (values) => {
      const errors: string[] = [];
      if (Number(values.price ?? 0) <= 0) errors.push("Enter the package price.");
      const items = Array.isArray(values.items) ? values.items : [];
      if (items.length === 0) errors.push("Add at least one product to the basket.");
      if (
        values.compareAtPrice &&
        Number(values.compareAtPrice) > 0 &&
        Number(values.compareAtPrice) <= Number(values.price ?? 0)
      ) {
        errors.push("The compare-at price must be higher than the package price.");
      }
      return errors;
    },
    previewPath: (row) => `/baskets/${row.slug}`,
  },


  contact_messages: {
    key: "contact_messages",
    label: "Contact messages",
    singular: "message",
    description: "Every message sent through the website contact form.",
    collection: "contact_messages",
    permission: "content.manage",
    canCreate: false,
    columns: [
      { name: "name", label: "From" },
      { name: "subject", label: "Subject", secondary: true },
      { name: "status", label: "Status", type: "badge" },
      { name: "createdAt", label: "Received", type: "date", secondary: true },
    ],
    fields: [
      { name: "name", label: "Name", type: "text", span: 1, required: true },
      { name: "email", label: "Email", type: "text", span: 1, required: true },
      { name: "phone", label: "Phone", type: "text", span: 1 },
      { name: "subject", label: "Subject", type: "text", span: 1 },
      { name: "message", label: "Message", type: "textarea", span: 3, required: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        span: 1,
        options: [
          { value: "new", label: "New" },
          { value: "read", label: "Read" },
          { value: "replied", label: "Replied" },
        ],
        defaultValue: "new",
      },
    ],
    searchFields: ["name", "email", "subject", "message"],
    defaultSort: { field: "createdAt", direction: "desc" },
    filters: [
      { field: "status", label: "All", value: "" },
      { field: "status", label: "New", value: "new" },
      { field: "status", label: "Read", value: "read" },
      { field: "status", label: "Replied", value: "replied" },
    ],
  },

  subscribers: {
    key: "subscribers",
    label: "Newsletter subscribers",
    singular: "subscriber",
    description: "Emails captured by the newsletter band and footer.",
    collection: "subscribers",
    permission: "marketing.manage",
    canCreate: false,
    columns: [
      { name: "email", label: "Email" },
      { name: "source", label: "Source", type: "badge", secondary: true },
      { name: "status", label: "Status", type: "badge" },
      { name: "createdAt", label: "Joined", type: "date", secondary: true },
    ],
    fields: [
      { name: "email", label: "Email", type: "text", span: 2, required: true },
      {
        name: "status",
        label: "Status",
        type: "select",
        span: 1,
        options: [
          { value: "subscribed", label: "Subscribed" },
          { value: "unsubscribed", label: "Unsubscribed" },
        ],
      },
      { name: "source", label: "Source", type: "readonly", span: 1 },
    ],
    searchFields: ["email", "source"],
    defaultSort: { field: "createdAt", direction: "desc" },
  },
};

export const resourceKeys = Object.keys(resources);

export function getResource(key: string): ResourceConfig | null {
  return resources[key] ?? null;
}

export const resourceColumns = (config: ResourceConfig) => config.columns;

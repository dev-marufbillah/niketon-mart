import type { FieldDef } from "@/lib/admin/fields";

/**
 * CMS page sections
 * -----------------
 * The About and Contact pages are built from typed, repeatable sections stored in
 * the `page_sections` collection. Each section declares the fields the admin can
 * edit here; the storefront renders the sections in order and skips hidden ones.
 *
 * Adding a section to a page = one entry in the page's map + its renderer on the
 * storefront. Adding a *field* to a section = one line here. Neither needs a new
 * table, route or admin screen.
 */

export type PageSectionSchema = {
  type: string;
  label: string;
  /** Short explanation shown above the fields in the admin. */
  description: string;
  fields: FieldDef[];
};

export type PageSchema = {
  slug: string;
  label: string;
  description: string;
  /** Storefront URL, when it is not simply `/{slug}`. */
  path?: string;
  /** Sections, in the order a new database starts with. */
  sections: { key: string; type: string }[];
};

const imageField = (name: string, label: string, help?: string): FieldDef => ({
  name,
  label,
  type: "image",
  span: 1,
  help,
});

export const pageSchemas: Record<string, PageSchema> = {
  about: {
    slug: "about",
    label: "About page",
    description:
      "Every block of the About page: the intro, the store banner, the vision/mission cards and the team. Reorder or hide a block and the page follows.",
    sections: [
      { key: "hero", type: "hero" },
      { key: "banner", type: "banner" },
      { key: "pillars", type: "pillars" },
      { key: "team", type: "team" },
    ],
  },
  contact: {
    slug: "contact",
    label: "Contact page",
    description:
      "The photo beside the contact form, the small print under it, and the map block. Address, phone, email and opening hours come from Site settings.",
    sections: [
      { key: "media", type: "media" },
      { key: "map", type: "map" },
    ],
  },
};

export const pageSectionSchemas: Record<string, Record<string, PageSectionSchema>> = {
  about: {
    hero: {
      type: "hero",
      label: "Intro block",
      description: "Badge, heading, paragraph, bullet points and the founder signature shown beside the photo.",
      fields: [
        { name: "badgeValue", label: "Badge number", type: "text", span: 1, help: "e.g. 16" },
        { name: "badgeLabel", label: "Badge caption", type: "text", span: 1, help: "e.g. Years Experience" },
        imageField("image", "Portrait photo", "Shown on the left, portrait orientation."),
        { name: "eyebrow", label: "Eyebrow", type: "text", span: 1, defaultValue: "About Us" },
        { name: "title", label: "Heading", type: "text", span: 2, required: true },
        { name: "titleAccent", label: "Heading words in green", type: "text", span: 2 },
        { name: "text", label: "Paragraph", type: "textarea", span: 3 },
        {
          name: "bullets",
          label: "Bullet points",
          type: "repeater",
          span: 3,
          addLabel: "Add a bullet",
          itemFields: [{ name: "text", label: "Text", type: "text", span: 1 }],
        },
        { name: "signature", label: "Signature (text)", type: "text", span: 1, help: "Rendered in an italic script style." },
        { name: "signatureName", label: "Founder name", type: "text", span: 1 },
        { name: "signatureRole", label: "Founder role", type: "text", span: 1, help: "e.g. Founder" },
      ],
    },
    banner: {
      type: "banner",
      label: "Store banner",
      description: "The wide photo with the rating pill on top of it.",
      fields: [
        imageField("image", "Banner image", "Landscape, around 2:1."),
        { name: "rating", label: "Rating", type: "text", span: 1, help: "e.g. 4.8" },
        { name: "ratingLabel", label: "Rating caption", type: "text", span: 1, help: "e.g. Star" },
        { name: "showRating", label: "Show the rating pill", type: "boolean", span: 1, defaultValue: true },
      ],
    },
    pillars: {
      type: "pillars",
      label: "Vision & mission",
      description: "Two or three cards with an icon, a title and a paragraph.",
      fields: [
        {
          name: "items",
          label: "Cards",
          type: "repeater",
          span: 3,
          addLabel: "Add a card",
          itemFields: [
            { name: "title", label: "Title", type: "text", span: 1 },
            {
              name: "icon",
              label: "Icon",
              type: "select",
              span: 1,
              options: [
                { value: "target", label: "Target (vision)" },
                { value: "eye", label: "Eye (mission)" },
                { value: "leaf", label: "Leaf" },
                { value: "heart", label: "Heart" },
                { value: "shield", label: "Shield" },
              ],
            },
            { name: "text", label: "Paragraph", type: "textarea", span: 3 },
          ],
        },
      ],
    },
    team: {
      type: "team",
      label: "Team",
      description: "Heading plus the people cards. Leave it empty to hide the team block.",
      fields: [
        { name: "eyebrow", label: "Eyebrow", type: "text", span: 1, defaultValue: "Our Team" },
        { name: "title", label: "Heading", type: "text", span: 1 },
        { name: "titleAccent", label: "Heading words in green", type: "text", span: 1 },
        {
          name: "members",
          label: "Team members",
          type: "repeater",
          span: 3,
          addLabel: "Add a person",
          itemFields: [
            { name: "name", label: "Name", type: "text", span: 1 },
            { name: "role", label: "Role", type: "text", span: 1 },
            { name: "image", label: "Photo", type: "image", span: 1 },
          ],
        },
      ],
    },
  },

  contact: {
    media: {
      type: "media",
      label: "Photo & form note",
      description: "The shopper photo beside the form and the sentence under the fields.",
      fields: [
        imageField("image", "Photo", "Portrait orientation sits best beside the form."),
        { name: "note", label: "Note under the form", type: "textarea", span: 3 },
      ],
    },
    map: {
      type: "map",
      label: "Map",
      description:
        "Paste a Google Maps embed URL to show a live map. Without one the block shows the stored address with an “Open in Maps” link — it never shows a fake map.",
      fields: [
        {
          name: "embedUrl",
          label: "Embed URL",
          type: "url",
          span: 2,
          help: "Google Maps → Share → Embed a map → copy the src URL.",
        },
        { name: "linkLabel", label: "Link label", type: "text", span: 1, defaultValue: "Open in Google Maps" },
        { name: "caption", label: "Caption", type: "text", span: 3 },
      ],
    },
  },
};

export function getPageSchema(slug: string): PageSchema | null {
  return pageSchemas[slug] ?? null;
}

export function getSectionSchema(page: string, type: string): PageSectionSchema | null {
  return pageSectionSchemas[page]?.[type] ?? null;
}

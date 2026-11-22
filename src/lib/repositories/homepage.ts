import "server-only";

import { cache } from "react";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import { sectionSchemas, type HomeSectionKey } from "@/lib/content/section-schema";
import type { TopPicksSectionRecord } from "@/lib/content/home-sections/types";

/**
 * Homepage layout + section copy.
 * One document owns the order, visibility and editable text of every homepage
 * section, so the storefront render order is data — never hardcoded JSX order.
 */

export type HomepageSection = {
  key: HomeSectionKey;
  label: string;
  visible: boolean;
  order: number;
};

export type HomepageDoc = Row & {
  sections: HomepageSection[];
  copy: Record<string, Record<string, unknown>>;
  updatedAt: string;
  updatedBy?: string;
};

export const sectionOrder: HomeSectionKey[] = [
  "hero",
  "categories",
  "freshMarket",
  "promos",
  "featured",
  "campaign",
  "deals",
  "weekly",
  "topPicks",
  "testimonials",
  "blog",
  "faq",
  "services",
  "lifestyle",
  "newsletter",
];

export async function getHomepage(): Promise<HomepageDoc> {
  const db = await ensureDatabase();
  const doc = await db.get<HomepageDoc>("homepage", "homepage");
  if (!doc) {
    return { id: "homepage", sections: [], copy: {}, updatedAt: new Date(0).toISOString() };
  }
  const sections = sectionOrder.map((key, index) => {
    const existing = doc.sections?.find((section) => section.key === key);
    return {
      key,
      label: sectionSchemas[key]?.label ?? key,
      visible: existing?.visible ?? true,
      order: existing?.order ?? index + 1,
    };
  });
  return { ...doc, sections: sections.sort((a, b) => a.order - b.order) };
}

/** Shared only during a server render; writes and later requests stay fresh. */
export const getRenderHomepage = cache(getHomepage);

export async function getVisibleSectionKeys(): Promise<HomeSectionKey[]> {
  const homepage = await getHomepage();
  return homepage.sections
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order)
    .map((section) => section.key);
}

export type SectionCopy = Record<string, unknown>;

const fallbackCopy = (key: HomeSectionKey): SectionCopy => {
  const defaults: SectionCopy = {};
  for (const field of sectionSchemas[key]?.fields ?? []) {
    defaults[field.name] = field.defaultValue ?? "";
  }
  return defaults;
};

export async function getSectionCopy(key: HomeSectionKey): Promise<SectionCopy> {
  const homepage = await getRenderHomepage();
  return { ...fallbackCopy(key), ...(homepage.copy?.[key] ?? {}) };
}

export async function getAllCopy(): Promise<Record<string, SectionCopy>> {
  const homepage = await getHomepage();
  const result: Record<string, SectionCopy> = {};
  for (const key of sectionOrder) {
    result[key] = { ...fallbackCopy(key), ...(homepage.copy?.[key] ?? {}) };
  }
  return result;
}

async function writeSectionCopy(key: HomeSectionKey, copy: SectionCopy, actor: string): Promise<void> {
  const db = await ensureDatabase();
  // Mutations deliberately use the fresh read, not the render-only cache.
  const homepage = await getHomepage();
  const updated = await db.update("homepage", "homepage", {
    copy: { ...homepage.copy, [key]: copy },
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  });
  if (!updated) throw new Error("Homepage configuration is missing; no changes were saved.");
}

export async function saveSectionCopy(
  key: HomeSectionKey,
  copy: SectionCopy,
  actor = "admin",
): Promise<void> {
  const section = sectionSchemas[key];
  if (!section) throw new Error(`Unknown homepage section: ${key}`);
  if (!section.fields.length) throw new Error(`${section.label} is managed by its dedicated editor.`);

  // Only persist fields the schema declares — no stray keys from the client.
  const clean: SectionCopy = {};
  for (const field of section.fields) {
    if (copy[field.name] !== undefined) clean[field.name] = copy[field.name];
  }
  await writeSectionCopy(key, clean, actor);
}

/** Persist the separately validated Top Picks editor without clearing its data. */
export async function saveTopPicksCopy(record: TopPicksSectionRecord): Promise<void> {
  await writeSectionCopy("topPicks", {
    eyebrow: record.eyebrow,
    title: record.title,
    subtitle: record.subtitle,
    ctaLabel: record.ctaLabel,
    ctaHref: record.ctaHref,
    productIds: [...record.productIds],
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  }, record.updatedBy);
}

export async function saveSections(
  sections: { key: string; visible: boolean; order: number }[],
  actor = "admin",
): Promise<void> {
  const db = await ensureDatabase();
  const homepage = await getHomepage();
  const known = new Set<string>(sectionOrder);
  const next = sectionOrder.map((key) => {
    const incoming = sections.find((section) => section.key === key);
    const existing = homepage.sections.find((section) => section.key === key);
    return {
      key,
      label: sectionSchemas[key].label,
      visible: incoming?.visible ?? existing?.visible ?? true,
      order: incoming?.order ?? existing?.order ?? 99,
    } satisfies HomepageSection;
  });
  void known;

  await db.update("homepage", "homepage", {
    sections: next.sort((a, b) => a.order - b.order),
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  });
}

export async function toggleSection(key: string, visible: boolean, actor = "admin") {
  const homepage = await getHomepage();
  await saveSections(
    homepage.sections.map((section) =>
      section.key === key ? { key, visible, order: section.order } : section,
    ),
    actor,
  );
}

export async function moveSection(key: string, direction: -1 | 1, actor = "admin") {
  const homepage = await getHomepage();
  const ordered = [...homepage.sections].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((section) => section.key === key);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= ordered.length) return;

  const swapped = ordered[index];
  ordered[index] = ordered[target];
  ordered[target] = swapped;

  await saveSections(
    ordered.map((section, position) => ({
      key: section.key,
      visible: section.visible,
      order: position + 1,
    })),
    actor,
  );
}

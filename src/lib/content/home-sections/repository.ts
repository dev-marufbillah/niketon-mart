import "server-only";

import { revalidatePath } from "next/cache";
import { ensureDatabase } from "@/lib/db";
import { getRenderHomepage, saveTopPicksCopy } from "@/lib/repositories/homepage";
import { defaultTopPicksSection, topPicksLimits } from "@/lib/content/home-sections/defaults";
import {
  TOP_PICKS_SECTION_ID,
  type ResolvedTopPicksItem,
  type ResolvedTopPicksSection,
  type SectionSaveResult,
  type TopPicksSectionInput,
  type TopPicksSectionRecord,
} from "@/lib/content/home-sections/types";
import type { Product } from "@/lib/types/domain";
import { getRenderStorefrontCatalogue } from "@/lib/catalogue/repository";

/**
 * Homepage merchandising sections (database-backed).
 *
 * The section record lives inside the `homepage` singleton document, next to the
 * section order/visibility flags, so one admin page owns the homepage layout and
 * one collection owns its content. Product ids are resolved against the live
 * catalogue on read — a deleted product simply drops out and the admin is told.
 */

type StoredTopPicks = Partial<TopPicksSectionInput> & { updatedAt?: string; updatedBy?: string };

const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
// Optional copy may intentionally be blank; do not restore a default CTA or
// subtitle after an admin explicitly removes it.
const optionalText = (value: unknown, fallback: string) =>
  typeof value === "string" ? value.trim() : fallback;

async function readStored(): Promise<StoredTopPicks> {
  const homepage = await getRenderHomepage();
  return (homepage.copy?.topPicks ?? {}) as StoredTopPicks;
}

function toRecord(stored: StoredTopPicks, productIds?: string[]): TopPicksSectionRecord {
  return {
    eyebrow: optionalText(stored.eyebrow, defaultTopPicksSection.eyebrow),
    title: text(stored.title, defaultTopPicksSection.title),
    subtitle: optionalText(stored.subtitle, defaultTopPicksSection.subtitle),
    ctaLabel: optionalText(stored.ctaLabel, defaultTopPicksSection.ctaLabel),
    ctaHref: optionalText(stored.ctaHref, defaultTopPicksSection.ctaHref),
    productIds: productIds ?? (Array.isArray(stored.productIds) ? stored.productIds : []),
    updatedAt: stored.updatedAt ?? defaultTopPicksSection.updatedAt,
    updatedBy: stored.updatedBy ?? defaultTopPicksSection.updatedBy,
  };
}

async function bestSellerFallback(): Promise<string[]> {
  const db = await ensureDatabase();
  const products = await db.list<Product>("products");
  return products
    .filter((product) => product.flags?.bestSeller)
    .map((product) => product.id);
}

export async function getResolvedTopPicksSection(): Promise<ResolvedTopPicksSection> {
  // Only the public catalogue may be passed to client-side product cards.
  // This also honours hidden parent categories and genuine-review summaries.
  const [stored, catalogue] = await Promise.all([readStored(), getRenderStorefrontCatalogue()]);
  const products = catalogue.products;
  const record = toRecord(stored);
  const configured = record.productIds.length > 0 ? record.productIds : await bestSellerFallback();

  const index = new Map(products.map((product) => [product.id, product]));
  const items: ResolvedTopPicksItem[] = [];
  const missingProductIds: string[] = [];

  configured.forEach((productId, position) => {
    // The index already contains only published products in visible categories,
    // including legacy active records whose status was not explicitly stored.
    const product = index.get(productId);
    if (!product) {
      missingProductIds.push(productId);
      return;
    }
    items.push({ key: `${productId}-${position}`, product });
  });

  return { ...record, id: TOP_PICKS_SECTION_ID, items, missingProductIds };
}

export async function getTopPicksRecord(): Promise<TopPicksSectionRecord> {
  const stored = await readStored();
  if (Array.isArray(stored.productIds) && stored.productIds.length > 0) return toRecord(stored);
  return toRecord(stored, await bestSellerFallback());
}

function validate(input: unknown): { ok: true; value: TopPicksSectionInput } | { ok: false; errors: string[] } {
  if (!input || typeof input !== "object") return { ok: false, errors: ["Nothing was submitted."] };
  const source = input as Record<string, unknown>;
  const errors: string[] = [];

  const read = (key: keyof typeof topPicksLimits, label: string, required = true) => {
    const value = typeof source[key] === "string" ? (source[key] as string).trim() : "";
    if (required && !value) errors.push(`${label} is required.`);
    const limit = topPicksLimits[key];
    if (typeof limit === "number" && value.length > limit) {
      errors.push(`${label} must be ${limit} characters or fewer.`);
    }
    return value;
  };

  const eyebrow = read("eyebrow", "Eyebrow", false);
  const title = read("title", "Title");
  const subtitle = read("subtitle", "Subtitle", false);
  const ctaLabel = read("ctaLabel", "Button label", false);
  const ctaHref = read("ctaHref", "Button link", false);

  if (ctaHref && !/^(#|\/|https?:\/\/)/.test(ctaHref)) {
    errors.push("The button link must start with #, / or https://.");
  }

  const ids = Array.isArray(source.productIds)
    ? Array.from(new Set(source.productIds.filter((id): id is string => typeof id === "string")))
    : [];
  if (ids.length < topPicksLimits.minProducts) errors.push("Choose at least one product.");
  if (ids.length > topPicksLimits.maxProducts) {
    errors.push(`Choose no more than ${topPicksLimits.maxProducts} products.`);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { eyebrow, title, subtitle, ctaLabel, ctaHref, productIds: ids } };
}

export async function saveTopPicksSection(
  input: unknown,
  options: { updatedBy?: string } = {},
): Promise<SectionSaveResult> {
  const validated = validate(input);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const db = await ensureDatabase();
  const products = await db.list<Product>("products");
  const knownIds = new Set(products.map((product) => product.id));
  const unknown = validated.value.productIds.filter((id) => !knownIds.has(id));
  if (unknown.length) {
    return { ok: false, errors: [`${unknown.length} selected product(s) no longer exist. Remove them and save again.`] };
  }

  const record: TopPicksSectionRecord = {
    ...validated.value,
    updatedAt: new Date().toISOString(),
    updatedBy: options.updatedBy ?? "admin",
  };

  await saveTopPicksCopy(record);
  revalidatePath("/");
  revalidatePath("/admin/home/our-top-picks");
  return { ok: true, data: record };
}

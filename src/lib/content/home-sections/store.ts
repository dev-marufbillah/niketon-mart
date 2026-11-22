import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { defaultTopPicksSection, topPicksLimits } from "@/lib/content/home-sections/defaults";
import {
  TOP_PICKS_SECTION_ID,
  type TopPicksSectionInput,
  type TopPicksSectionRecord,
} from "@/lib/content/home-sections/types";
import { readCatalogue } from "@/lib/catalogue/store";

/**
 * Content store
 * -------------
 * Merchandising content is persisted separately from the product catalogue so
 * the admin dashboard can rewrite copy and ordering without a deploy.
 *
 * Today the adapter is a JSON document on disk (`.data/home-sections.json`). It
 * is the only file that touches storage: swap `readDocument` / `writeDocument`
 * for Postgres, Vercel KV or S3 and nothing else in the app changes.
 */

const STORE_DIR = process.env.CONTENT_STORE_DIR ?? path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "home-sections.json");
const DOCUMENT_VERSION = 1;

type ContentDocument = {
  version: number;
  sections: Record<string, unknown>;
};

type CacheEntry = { mtimeMs: number; document: ContentDocument };
let cache: CacheEntry | null = null;

const emptyDocument: ContentDocument = { version: DOCUMENT_VERSION, sections: {} };

const text = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim().length > 0 ? value : fallback;

/** Keeps unknown/decommissioned products out of the rendered section. */
function normaliseProductIds(value: unknown, knownIds: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!id || seen.has(id) || !knownIds.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= topPicksLimits.maxProducts) break;
  }
  return ids;
}

function normaliseRecord(raw: unknown, knownIds: Set<string>): TopPicksSectionRecord {
  const source = (raw ?? {}) as Partial<Record<keyof TopPicksSectionRecord, unknown>>;
  const productIds = normaliseProductIds(source.productIds, knownIds);

  return {
    eyebrow: text(source.eyebrow, defaultTopPicksSection.eyebrow),
    title: text(source.title, defaultTopPicksSection.title),
    subtitle: text(source.subtitle, defaultTopPicksSection.subtitle),
    ctaLabel: text(source.ctaLabel, defaultTopPicksSection.ctaLabel),
    ctaHref: text(source.ctaHref, defaultTopPicksSection.ctaHref),
    productIds: productIds.length > 0 ? productIds : defaultTopPicksSection.productIds,
    updatedAt: text(source.updatedAt, defaultTopPicksSection.updatedAt),
    updatedBy: text(source.updatedBy, defaultTopPicksSection.updatedBy),
  };
}

async function readDocument(): Promise<ContentDocument> {
  try {
    const stat = await fs.stat(STORE_FILE);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.document;

    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ContentDocument>;
    const document: ContentDocument = {
      version: parsed.version ?? DOCUMENT_VERSION,
      sections:
        parsed.sections && typeof parsed.sections === "object" ? parsed.sections : {},
    };
    cache = { mtimeMs: stat.mtimeMs, document };
    return document;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      cache = null;
      return emptyDocument;
    }
    // A malformed file should never take the homepage down.
    console.error("[content-store] unable to read sections file", error);
    return emptyDocument;
  }
}

async function writeDocument(document: ContentDocument): Promise<void> {
  try {
    await fs.mkdir(STORE_DIR, { recursive: true });
    const tmp = `${STORE_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(document, null, 2), "utf8");
    await fs.rename(tmp, STORE_FILE); // atomic replace
    cache = null;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      throw new Error(
        "Content store is read-only in this environment. Point CONTENT_STORE_DIR at a writable volume or swap the storage adapter for a database.",
      );
    }
    throw error;
  }
}

export async function readTopPicksRecord(): Promise<TopPicksSectionRecord> {
  const [document, catalogue] = await Promise.all([readDocument(), readCatalogue()]);
  const knownIds = new Set(catalogue.products.map((product) => product.id));
  return normaliseRecord(document.sections[TOP_PICKS_SECTION_ID], knownIds);
}

export type ValidatedTopPicks = { ok: true; value: TopPicksSectionInput } | { ok: false; errors: string[] };

/** Server-side validation — the API and the server action both go through this. */
export function validateTopPicksInput(input: unknown, knownIds?: Set<string>): ValidatedTopPicks {
  const errors: string[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, errors: ["Payload must be an object."] };
  }
  const raw = input as Record<string, unknown>;
  const string = (key: string, max: number, required: boolean) => {
    const value = raw[key];
    if (typeof value !== "string") {
      if (required) errors.push(`${key} is required.`);
      return "";
    }
    const trimmed = value.trim();
    if (required && trimmed.length === 0) errors.push(`${key} cannot be empty.`);
    if (trimmed.length > max) errors.push(`${key} must be ${max} characters or fewer.`);
    return trimmed;
  };

  const eyebrow = string("eyebrow", topPicksLimits.eyebrow, false);
  const title = string("title", topPicksLimits.title, true);
  const subtitle = string("subtitle", topPicksLimits.subtitle, false);
  const ctaLabel = string("ctaLabel", topPicksLimits.ctaLabel, false);
  const ctaHref = string("ctaHref", topPicksLimits.ctaHref, false);

  if (ctaHref && !ctaHref.startsWith("/") && !/^https?:\/\//.test(ctaHref)) {
    errors.push("ctaHref must be an internal path (/shop) or an absolute URL.");
  }

  if (!Array.isArray(raw.productIds)) {
    errors.push("productIds must be an array.");
  }
  const productIds = Array.isArray(raw.productIds)
    ? raw.productIds.map((id) => (typeof id === "string" ? id.trim() : ""))
    : [];

  const duplicates = productIds.filter((id, index) => id && productIds.indexOf(id) !== index);
  if (duplicates.length > 0) errors.push("Each product can only appear once.");

  const unknown = knownIds ? productIds.filter((id) => id && !knownIds.has(id)) : [];
  if (unknown.length > 0) errors.push(`Unknown product id(s): ${unknown.join(", ")}.`);

  if (productIds.length > topPicksLimits.maxProducts) {
    errors.push(`A maximum of ${topPicksLimits.maxProducts} products is allowed.`);
  }
  if (productIds.filter(Boolean).length < topPicksLimits.minProducts) {
    errors.push("Select at least one product.");
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      eyebrow,
      title,
      subtitle,
      ctaLabel,
      ctaHref,
      productIds: productIds.filter(Boolean),
    },
  };
}

export async function writeTopPicksRecord(
  input: TopPicksSectionInput,
  options: { updatedBy?: string } = {},
): Promise<TopPicksSectionRecord> {
  const record: TopPicksSectionRecord = {
    ...input,
    updatedAt: new Date().toISOString(),
    updatedBy: options.updatedBy ?? "admin",
  };

  const document = await readDocument();
  const next: ContentDocument = {
    version: DOCUMENT_VERSION,
    sections: { ...document.sections, [TOP_PICKS_SECTION_ID]: record },
  };
  await writeDocument(next);
  return record;
}

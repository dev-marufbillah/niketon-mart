import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";

/**
 * Media library.
 * Files are written to `public/uploads` (local/VPS) and indexed here with alt
 * text and folder. The admin can reuse any upload through the image picker.
 */

export type MediaRow = Row & {
  url: string;
  filename: string;
  alt: string;
  folder: string;
  size: number;
  mime: string;
  createdAt: string;
};

export async function listMedia(folder?: string): Promise<MediaRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<MediaRow>("media");
  return rows
    .filter((row) => (folder ? row.folder === folder : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getMediaFolders(): Promise<string[]> {
  const rows = await listMedia();
  return Array.from(new Set(rows.map((row) => row.folder))).sort();
}

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function safeFilename(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || `upload-${Date.now()}.jpg`;
}

/** Counts how many records reference an image before allowing a delete. */
export async function countMediaUsage(url: string): Promise<number> {
  const db = await ensureDatabase();
  // Include historical order snapshots and all known CMS references. If this
  // list expands in the future, add the new collection before enabling delete.
  const collections = ["products", "posts", "hero_slides", "promo_banners", "pages", "page_sections", "homepage", "settings", "baskets", "categories", "blog_categories", "authors", "testimonials", "service_features", "orders"];
  const groups = await Promise.all(collections.map((collection) => db.list<Row>(collection)));
  const haystacks = groups.flat().map((row) => JSON.stringify(row));
  return haystacks.filter((entry) => entry.includes(url)).length;
}

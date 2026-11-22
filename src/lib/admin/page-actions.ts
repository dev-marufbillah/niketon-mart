"use server";

import { revalidatePath } from "next/cache";
import { getPageSchema, getSectionSchema } from "@/lib/content/page-sections";
import { parseFields } from "@/lib/admin/parse";
import { assertPermission } from "@/lib/auth/session";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import { logActivity } from "@/lib/repositories/activity";
import type { PageSectionRow } from "@/lib/repositories/content";

/**
 * CMS page editor actions
 * -----------------------
 * Two purpose-built writes: the page record itself (title, sub-heading, SEO,
 * publish switch) and one section's content. Both validate against the page
 * schema on the server, so a hand-crafted POST cannot create a field the admin
 * does not know about.
 */

export type PageFormState = { errors?: string[]; success?: string } | null;

function revalidatePage(page: string) {
  const storefront = page === "about" ? "/about" : page === "contact" ? "/contact" : `/${page}`;
  [storefront, "/admin/pages", `/admin/pages/${page}`, `/admin/r/pages`].forEach((path) => revalidatePath(path));
}

export async function savePageMetaAction(
  page: string,
  _state: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const user = await assertPermission("content.manage");
  const schema = getPageSchema(page);
  if (!schema) return { errors: ["Unknown page."] };

  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const seoTitle = String(formData.get("seoTitle") ?? "").trim();
  const seoDescription = String(formData.get("seoDescription") ?? "").trim();
  const published = formData.get("published") === "on";

  if (title.length < 3) return { errors: ["Page title needs at least 3 characters."] };
  if (seoDescription.length > 320) return { errors: ["Keep the SEO description under 320 characters."] };

  const db = await ensureDatabase();
  const rows = await db.list<{ id: string; slug: string }>("pages", { where: { slug: page } });
  const row = rows[0];
  if (!row) return { errors: ["This page record is missing from the database."] };

  await db.update("pages", row.id, {
    title,
    subtitle,
    seoTitle,
    seoDescription,
    published,
    visible: true,
    updatedAt: new Date().toISOString(),
  } as Partial<Row>);

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "update",
    entity: "pages",
    entityId: row.id,
    summary: `Updated the ${schema.label.toLowerCase()} settings`,
  });

  revalidatePage(page);
  return { success: published ? "Page settings saved — live on the website." : "Saved. The page is unpublished, so visitors see a 404." };
}

export async function savePageSectionAction(
  page: string,
  key: string,
  _state: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const user = await assertPermission("content.manage");
  const schema = getPageSchema(page);
  if (!schema) return { errors: ["Unknown page."] };

  const db = await ensureDatabase();
  const rows = await db.list<PageSectionRow>("page_sections");
  const section = rows.find((row) => row.page === page && row.key === key);
  if (!section) return { errors: ["That block no longer exists. Reload the page."] };

  const sectionSchema = getSectionSchema(page, section.type);
  if (!sectionSchema) return { errors: ["This block has no editor definition."] };

  const { values, errors } = parseFields(sectionSchema.fields, formData);
  if (errors.length) return { errors };

  await db.update("page_sections", section.id, {
    data: { ...section.data, ...values },
    visible: formData.get("__visible") === "on",
    updatedAt: new Date().toISOString(),
  } as Partial<Row>);

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "update",
    entity: "page_sections",
    entityId: section.id,
    summary: `Updated “${sectionSchema.label}” on the ${schema.label.toLowerCase()}`,
  });

  revalidatePage(page);
  return { success: `${sectionSchema.label} saved — the website is updated.` };
}

/** Arrow buttons on each block: swap the display order with the neighbour. */
export async function movePageSectionAction(page: string, key: string, direction: -1 | 1): Promise<void> {
  const user = await assertPermission("content.manage");
  const db = await ensureDatabase();
  const rows = (await db.list<PageSectionRow>("page_sections"))
    .filter((row) => row.page === page)
    .sort((a, b) => a.order - b.order);

  const index = rows.findIndex((row) => row.key === key);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= rows.length) {
    revalidatePage(page);
    return;
  }

  const current = rows[index];
  const neighbour = rows[target];
  await db.update("page_sections", current.id, { order: neighbour.order } as Partial<Row>);
  await db.update("page_sections", neighbour.id, { order: current.order } as Partial<Row>);

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "update",
    entity: "page_sections",
    entityId: current.id,
    summary: `Moved a block ${direction === -1 ? "up" : "down"} on /${page}`,
  });

  revalidatePage(page);
}

/** Show / hide a block without deleting its content. */
export async function togglePageSectionAction(page: string, key: string): Promise<void> {
  const user = await assertPermission("content.manage");
  const db = await ensureDatabase();
  const rows = await db.list<PageSectionRow>("page_sections");
  const section = rows.find((row) => row.page === page && row.key === key);
  if (!section) return revalidatePage(page);

  await db.update("page_sections", section.id, { visible: !section.visible } as Partial<Row>);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "update",
    entity: "page_sections",
    entityId: section.id,
    summary: `${section.visible ? "Hid" : "Showed"} “${section.key}” on /${page}`,
  });

  revalidatePage(page);
}

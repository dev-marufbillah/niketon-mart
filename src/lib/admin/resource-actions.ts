"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import { getResource } from "@/lib/admin/resources";
import { normalizeForSave, parseResourceForm, resourceUpdatePatch, validateResource } from "@/lib/admin/parse";
import { applyOptionMirrors, assertOptionExists } from "@/lib/admin/field-options";
import { can } from "@/lib/auth/permissions";
import { assertPermission, getSessionUser } from "@/lib/auth/session";
import { logActivity } from "@/lib/repositories/activity";

/**
 * Generic resource CRUD.
 *
 * One implementation serves every collection registered in `resources.ts`.
 * Each call still re-checks the resource's permission server-side, validates
 * with the resource's own rules, writes the activity log and revalidates the
 * storefront paths that read the collection.
 */

export type ResourceFormState = {
  errors?: string[];
  values?: Record<string, string>;
} | null;

const storefrontPaths: Record<string, string[]> = {
  hero_slides: ["/"],
  promo_banners: ["/"],
  testimonials: ["/"],
  posts: ["/", "/blogs", "/admin/r/posts"],
  blog_categories: ["/", "/blogs"],
  authors: ["/", "/blogs"],
  faq_categories: ["/", "/faq"],
  faqs: ["/", "/faq"],
  service_features: ["/", "/home-grocery"],
  pages: ["/"],
  coupons: ["/home-grocery", "/checkout", "/cart"],
  baskets: ["/daily-basket"],
  delivery_areas: ["/checkout", "/cart"],
  payment_methods: ["/checkout"],
};

function revalidateFor(key: string, extra: string[] = []) {
  const paths = new Set(["/admin/r", `/admin/r/${key}`, ...(storefrontPaths[key] ?? []), ...extra]);
  paths.forEach((path) => revalidatePath(path));
}

async function guard(key: string) {
  const config = getResource(key);
  if (!config) throw new Error("Unknown admin section.");
  const user = await assertPermission(config.permission);
  return { config, user };
}

/** Values echoed back to the form after a validation failure. */
function echo(config: ReturnType<typeof getResource>, formData: FormData) {
  if (!config) return {};
  const values: Record<string, string> = {};
  for (const field of config.fields) {
    if (field.type === "readonly") continue;
    const raw = formData.get(field.name);
    values[field.name] = typeof raw === "string" ? raw : "";
  }
  return values;
}

export async function createResourceAction(
  key: string,
  _state: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { config, user } = await guard(key);
  if (config.canCreate === false) return { errors: ["New records are created automatically, not here."] };

  const db = await ensureDatabase();
  const existingRows = (await db.list(config.collection)) as Record<string, unknown>[];
  const { values, errors } = parseResourceForm(config, formData);
  errors.push(...validateResource(config, values, existingRows));
  for (const field of config.fields) {
    const problem = await assertOptionExists(field, values[field.name]);
    if (problem) errors.push(problem);
  }

  if (errors.length) return { errors, values: echo(config, formData) };

  await applyOptionMirrors(config.fields, values);

  const row = normalizeForSave(config, values);
  const created = await db.insert(config.collection, row as Omit<Row, "id">);

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "create",
    entity: config.collection,
    entityId: created.id,
    summary: `Created ${config.singular} “${String(row.title ?? row.name ?? row.code ?? row.email ?? created.id)}”`,
  });

  revalidateFor(key);
  redirect(`/admin/r/${key}?created=${encodeURIComponent(created.id)}`);
}

export async function updateResourceAction(
  key: string,
  id: string,
  _state: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const { config, user } = await guard(key);

  const db = await ensureDatabase();
  const existing = await db.get(config.collection, id);
  if (!existing) return { errors: ["This record no longer exists. It may have been deleted."] };

  const existingRows = (await db.list(config.collection)) as Record<string, unknown>[];
  const { values, errors } = parseResourceForm(config, formData);
  errors.push(...validateResource(config, values, existingRows, id));
  for (const field of config.fields) {
    const problem = await assertOptionExists(field, values[field.name]);
    if (problem) errors.push(problem);
  }

  if (errors.length) return { errors, values: echo(config, formData) };

  await applyOptionMirrors(config.fields, values);

  const row = normalizeForSave(config, values, existing);
  // A coupon redemption may have completed after `existing` was read. Save
  // only the admin-editable rules, never its stale usedCount or other counters.
  await db.update(config.collection, id, resourceUpdatePatch(config, values, row) as Partial<Row>);

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "update",
    entity: config.collection,
    entityId: id,
    summary: `Updated ${config.singular} “${String(row.title ?? row.name ?? row.code ?? row.email ?? id)}”`,
  });

  revalidateFor(key);
  redirect(`/admin/r/${key}?updated=${encodeURIComponent(id)}`);
}

export async function deleteResourceAction(key: string, id: string): Promise<void> {
  const { config, user } = await guard(key);
  if (config.canDelete === false) throw new Error("This record cannot be deleted.");

  const db = await ensureDatabase();
  const existing = await db.get(config.collection, id);
  if (!existing) redirect(`/admin/r/${key}`);

  // Refuse to orphan records that are still in use (a category with posts, etc.).
  for (const link of config.usedBy ?? []) {
    const rows = await db.list<{ id: string; [field: string]: unknown }>(link.collection);
    const count = rows.filter((row) => row[link.field] === id).length;
    if (count > 0) {
      redirect(
        `/admin/r/${key}?blocked=${encodeURIComponent(
          `${count} ${link.label}${count === 1 ? " still uses" : "s still use"} this. Move or delete ${
            count === 1 ? "it" : "them"
          } first.`,
        )}`,
      );
    }
  }

  if (config.collection === "coupons") {
    const { deleteUnusedCouponInDatabase } = await import("@/lib/repositories/marketing");
    const deleted = await deleteUnusedCouponInDatabase(db, id);
    if (!deleted.ok) redirect(`/admin/r/${key}?blocked=${encodeURIComponent(deleted.error)}`);
  } else {
    await db.remove(config.collection, id);
  }
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "delete",
    entity: config.collection,
    entityId: id,
    summary: `Deleted ${config.singular} “${String(existing.title ?? existing.name ?? existing.code ?? id)}”`,
  });

  revalidateFor(key);
  redirect(`/admin/r/${key}?deleted=1`);
}

export async function toggleResourceFieldAction(
  key: string,
  id: string,
  field: string,
  value: boolean,
): Promise<void> {
  const { config, user } = await guard(key);
  if (!config.fields.some((entry) => entry.name === field && entry.type === "boolean")) {
    throw new Error("That field cannot be toggled.");
  }
  const db = await ensureDatabase();
  const existing = await db.get(config.collection, id);
  if (!existing) return;

  await db.update(config.collection, id, { [field]: value, updatedAt: new Date().toISOString() });
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "toggle",
    entity: config.collection,
    entityId: id,
    summary: `${value ? "Enabled" : "Disabled"} ${field} on ${config.singular} “${String(existing.title ?? existing.name ?? id)}”`,
  });
  revalidateFor(key);
}

export async function moveResourceAction(key: string, id: string, direction: -1 | 1): Promise<void> {
  const { config, user } = await guard(key);
  if (!config.orderField) throw new Error("This section has no display order.");

  const db = await ensureDatabase();
  const rows = await db.list(config.collection);
  const ordered = [...rows].sort(
    (a, b) => Number(a[config.orderField!] ?? 0) - Number(b[config.orderField!] ?? 0),
  );
  const index = ordered.findIndex((row) => row.id === id);
  const target = index + direction;
  if (index === -1 || target < 0 || target >= ordered.length) return;

  const moving = ordered[index];
  const swap = ordered[target];
  await db.update(config.collection, moving.id, { [config.orderField]: target + 1 });
  await db.update(config.collection, swap.id, { [config.orderField]: index + 1 });

  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "reorder",
    entity: config.collection,
    entityId: id,
    summary: `Reordered ${config.singular} “${String(moving.title ?? moving.name ?? id)}”`,
  });
  revalidateFor(key);
}

export async function duplicateResourceAction(key: string, id: string): Promise<void> {
  const { config, user } = await guard(key);
  if (config.canCreate === false) throw new Error("This record cannot be duplicated.");

  const db = await ensureDatabase();
  const existing = await db.get(config.collection, id);
  if (!existing) redirect(`/admin/r/${key}`);

  const copy = { ...existing } as Record<string, unknown>;
  delete copy.id;
  if (typeof copy.slug === "string") copy.slug = `${copy.slug}-copy-${Math.random().toString(36).slice(2, 5)}`;
  if (typeof copy.code === "string") copy.code = `${copy.code}-COPY`;
  if (typeof copy.title === "string") copy.title = `${copy.title} (copy)`;
  if (typeof copy.name === "string") copy.name = `${copy.name} (copy)`;
  copy.visible = false;
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = new Date().toISOString();

  const created = await db.insert(config.collection, copy as Omit<Row, "id">);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "duplicate",
    entity: config.collection,
    entityId: created.id,
    summary: `Duplicated ${config.singular} “${String(existing.title ?? existing.name ?? id)}”`,
  });
  revalidateFor(key);
  redirect(`/admin/r/${key}/${created.id}`);
}

/** Rows the current account may edit (used by read-only table rendering). */
export async function canManageResource(key: string): Promise<boolean> {
  const user = await getSessionUser();
  const config = getResource(key);
  if (!user || !config) return false;
  return can(user, config.permission);
}

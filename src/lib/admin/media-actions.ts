"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { del } from "@vercel/blob";
import { assertPermission } from "@/lib/auth/session";
import { ensureDatabase } from "@/lib/db";
import { countMediaUsage, type MediaRow } from "@/lib/repositories/media";
import { logActivity } from "@/lib/repositories/activity";

export type MediaFormState = { errors?: string[]; success?: string } | null;

export async function updateMediaAction(
  id: string,
  _state: MediaFormState,
  formData: FormData,
): Promise<MediaFormState> {
  const user = await assertPermission("media.manage");
  const db = await ensureDatabase();
  const media = await db.get<MediaRow>("media", id);
  if (!media) return { errors: ["That file no longer exists."] };

  const alt = String(formData.get("alt") ?? "").trim();
  const folder = String(formData.get("folder") ?? media.folder).trim();

  if (alt.length > 160) return { errors: ["Alt text must be 160 characters or fewer."] };

  await db.update("media", id, { alt, folder, updatedAt: new Date().toISOString() });
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "media",
    entity: "media",
    entityId: id,
    summary: `Updated media “${media.filename}”`,
  });
  revalidatePath("/admin/media");
  return { success: "File details saved." };
}

export async function deleteMediaAction(id: string): Promise<void> {
  const user = await assertPermission("media.manage");
  const db = await ensureDatabase();
  const media = await db.get<MediaRow>("media", id);
  if (!media) redirect("/admin/media");

  const usage = await countMediaUsage(media.url);
  if (usage > 0) {
    throw new Error(
      `This image is still used in ${usage} place${usage === 1 ? "" : "s"} on the website. Replace it there before deleting.`,
    );
  }

  if (media.url.startsWith("/uploads/")) {
    const root = path.resolve(process.cwd(), "public", "uploads");
    const file = path.resolve(root, media.url.slice("/uploads/".length));
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid media path.");
    await fs.unlink(file).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw new Error("Could not remove the stored image.");
    });
  } else if (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//i.test(media.url)) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Connect Blob storage before deleting this image.");
    try { await del(media.url); }
    catch { throw new Error("Could not remove the image from Blob storage. Please try again."); }
  }

  await db.remove("media", id);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "media",
    entity: "media",
    entityId: id,
    summary: `Deleted media “${media.filename}”`,
  });
  revalidatePath("/admin/media");
  redirect("/admin/media?deleted=1");
}

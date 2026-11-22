import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { put, del } from "@vercel/blob";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { ensureDatabase } from "@/lib/db";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, safeFilename, type MediaRow } from "@/lib/repositories/media";
import { logActivity } from "@/lib/repositories/activity";
import { readBoundedBody } from "@/lib/uploads/bounded-body";

export const runtime = "nodejs";

/** Authenticated image upload. Blob is required on Vercel; local disk is for
 * development or self-hosted machines with a deliberately persistent disk. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !(can(user, "media.manage") || can(user, "content.manage") || can(user, "products.manage"))) {
    return NextResponse.json({ error: "You do not have permission to upload files." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data\s*;/i.test(contentType)) {
    return NextResponse.json({ error: "Upload a multipart image form." }, { status: 415 });
  }
  // Bound the actual stream before invoking the multipart parser; an absent or
  // false Content-Length must not allow unlimited buffering in a server process.
  const body = await readBoundedBody(request, MAX_UPLOAD_BYTES + 256 * 1024);
  if (!body.ok) {
    return NextResponse.json({ error: body.status === 413 ? "Images must be 5 MB or smaller." : "The file could not be read." }, { status: body.status });
  }
  let formData: FormData;
  try { formData = await new Response(body.bytes as BodyInit, { headers: { "content-type": contentType } }).formData(); }
  catch { return NextResponse.json({ error: "The file could not be read." }, { status: 400 }); }
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "general").replace(/[^a-z0-9-]/gi, "").toLowerCase().slice(0, 40) || "general";
  if (!(file instanceof File)) return NextResponse.json({ error: "No file was received." }, { status: 400 });
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return NextResponse.json({ error: "Upload a JPG, PNG or WebP image." }, { status: 415 });
  if (!file.size) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Images must be 5 MB or smaller." }, { status: 413 });
  if (process.env.VERCEL && !process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return NextResponse.json({ error: "Persistent image storage is not configured. Connect Vercel Blob and set BLOB_READ_WRITE_TOKEN." }, { status: 503 });
  }

  let bytes: Buffer;
  let extension: string;
  try {
    // Validate decoded bytes rather than trusting the browser's MIME type. The
    // re-encode also strips metadata and rejects malformed/polyglot payloads.
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000, failOn: "error" }).rotate();
    const meta = await image.metadata();
    const expected: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
    if (!meta.width || !meta.height || meta.format !== expected[file.type]) {
      return NextResponse.json({ error: "The image content does not match its file type." }, { status: 415 });
    }
    extension = meta.format === "jpeg" ? "jpg" : meta.format;
    bytes = await image.toBuffer();
  } catch {
    return NextResponse.json({ error: "The file is not a valid JPG, PNG or WebP image, or its dimensions are too large." }, { status: 415 });
  }

  const stem = safeFilename(file.name).replace(/\.[^.]+$/, "").slice(0, 80) || "image";
  const filename = `${Date.now()}-${randomBytes(6).toString("hex")}-${stem}.${extension}`;
  const localPath = path.join(process.cwd(), "public", "uploads", folder, filename);
  const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
  let url = "";
  let inserted = false;
  try {
    if (useBlob) {
      const blob = await put(`niketon-mart/${folder}/${filename}`, bytes, { access: "public", contentType: file.type, addRandomSuffix: true });
      url = blob.url;
    } else {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      await fs.writeFile(localPath, bytes, { flag: "wx" });
      url = `/uploads/${folder}/${filename}`;
    }
    const db = await ensureDatabase();
    const media = await db.insert<MediaRow>("media", {
      url, filename, alt: file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 160),
      folder, size: bytes.length, mime: file.type, createdAt: new Date().toISOString(),
    });
    inserted = true;
    await logActivity({ actor: { id: user.id, name: user.name }, action: "media", entity: "media", entityId: media.id, summary: `Uploaded ${filename}` });
    return NextResponse.json({ url, id: media.id, folder, alt: media.alt });
  } catch {
    // Only clean up a new file when its DB row was not committed. Never remove a
    // recorded or shared image after a later activity-log failure.
    if (!inserted && url) {
      if (useBlob) await del(url).catch(() => undefined);
      else await fs.unlink(localPath).catch(() => undefined);
    }
    console.error("[media] upload failed; storage or database unavailable");
    return NextResponse.json({ error: "The image could not be saved. Check the storage and database configuration and try again." }, { status: 500 });
  }
}

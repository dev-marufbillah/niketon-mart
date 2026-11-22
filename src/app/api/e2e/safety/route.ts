import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Explicit opt-in handshake to keep destructive browser tests away from real stores. */
export async function GET() {
  const missing = () => new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (process.env.NODE_ENV === "production" || process.env.VERCEL || process.env.E2E_TEST_MODE !== "1" ||
      process.env.MONGODB_URI?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim() || !process.env.CONTENT_STORE_DIR ||
      process.env.ADMIN_MAIL_TEST_URL !== "http://127.0.0.1:3666/emails") return missing();
  try {
    const directory = await fs.realpath(path.resolve(process.env.CONTENT_STORE_DIR));
    const marker = await fs.readFile(path.join(directory, ".niketon-e2e-disposable"), "utf8");
    if (marker.trim() !== "niketon-mart-e2e-disposable" || (await getDatabase()).driver !== "file") return missing();
    const storeHash = createHash("sha256").update(directory).digest("hex");
    return NextResponse.json({ isolated: true, storeHash }, { headers: { "Cache-Control": "no-store" } });
  } catch { return missing(); }
}

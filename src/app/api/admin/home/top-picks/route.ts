import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/repositories/activity";
import {
  getResolvedTopPicksSection,
  getTopPicksRecord,
  saveTopPicksSection,
} from "@/lib/content/home-sections/repository";

export const dynamic = "force-dynamic";

/**
 * Admin content API — `GET/PUT /api/admin/home/top-picks`.
 *
 * The dashboard UI uses the server action, but the same contract is exposed over
 * HTTP so a future admin SPA (or an integration) can manage the section without
 * touching React.
 *
 * Access: an admin session with `content.view` (GET) or `content.manage` (PUT),
 * **or** a bearer token when `ADMIN_API_TOKEN` is configured for scripted
 * maintenance. The route is never open: an unset token used to mean "allow
 * everyone", which would have let any visitor rewrite the homepage.
 */
async function authorised(request: Request, permission: "content.view" | "content.manage"): Promise<{ id?: string; name: string } | null> {
  const bearer = process.env.ADMIN_API_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  if (bearer && header === `Bearer ${bearer}`) return { name: "admin-api-token" };

  const user = await getSessionUser();
  if (!user) return null;
  if (can(user, permission) || (permission === "content.view" && can(user, "content.manage"))) {
    return { id: user.id, name: user.name };
  }
  return null;
}

export async function GET(request: Request) {
  if (!(await authorised(request, "content.view"))) {
    return NextResponse.json({ ok: false, error: "You do not have permission to read this section." }, { status: 403 });
  }
  const [record, resolved] = await Promise.all([
    getTopPicksRecord(),
    getResolvedTopPicksSection(),
  ]);

  return NextResponse.json({
    section: record,
    products: resolved.items.map(({ product }) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.categoryLabel,
      price: product.price,
      unit: product.unit,
      image: product.image,
    })),
    missingProductIds: resolved.missingProductIds,
  });
}

export async function PUT(request: Request) {
  const actor = await authorised(request, "content.manage");
  if (!actor) {
    return NextResponse.json({ ok: false, error: "You do not have permission to change this section." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, errors: ["Request body must be valid JSON."] },
      { status: 400 },
    );
  }

  const result = await saveTopPicksSection(payload, { updatedBy: actor.name });
  if (result.ok) await logActivity({ actor, action: "save", entity: "homepage", entityId: "topPicks", summary: "Updated Top Picks via the content API" });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

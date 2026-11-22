import { NextRequest, NextResponse } from "next/server";
import { getGoogleConfig, startGoogleFlow } from "@/lib/auth/google";
import { checkGoogleOAuthRateLimit } from "@/lib/auth/rate-limit";
import { safeAccountNext } from "@/lib/auth/return-to";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const next = safeAccountNext(request.nextUrl.searchParams.get("next"));
  const config = getGoogleConfig();
  if (!config || !(await checkGoogleOAuthRateLimit())) {
    const url = new URL("/my-account/login", request.url);
    url.searchParams.set("next", next);
    url.searchParams.set("google", config ? "rate_limited" : "not_configured");
    return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
  const url = await startGoogleFlow(config, { next });
  return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

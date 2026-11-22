import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db";
import { createCustomerSession, destroyCustomerSession, getCustomerProfile, getCustomerSession } from "@/lib/auth/customer";
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { findOrCreateGoogleCustomer, linkGoogleCustomer } from "@/lib/auth/google-accounts";
import { equalSecret, googleCustomerTarget, googlePasswordStamp, type GoogleFlow } from "@/lib/auth/google-flow";
import { getGoogleConfig, googleClient, takeGoogleFlow, verifyGoogleIdToken, type GoogleConfig } from "@/lib/auth/google";
import { logActivity } from "@/lib/repositories/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const responseHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };

function fail(config: GoogleConfig, flow: GoogleFlow | null, reason: string) {
  const linkFlow = flow?.mode === "link";
  const url = new URL(linkFlow ? "/my-account/personal-information" : "/my-account/login", config.redirectUri);
  url.searchParams.set("google", reason);
  if (!linkFlow && flow?.next) url.searchParams.set("next", googleCustomerTarget(flow.next));
  return NextResponse.redirect(url, { status: 303, headers: responseHeaders });
}

export async function GET(request: NextRequest) {
  const config = getGoogleConfig();
  if (!config) {
    const url = new URL("/my-account/login?google=not_configured", request.url);
    return NextResponse.redirect(url, { status: 303, headers: responseHeaders });
  }
  const flow = await takeGoogleFlow(config);
  const params = request.nextUrl.searchParams;
  if (!flow || params.getAll("state").length !== 1 || !equalSecret(params.get("state"), flow.state)) {
    return fail(config, flow, "invalid_flow");
  }
  if (params.has("error")) return fail(config, flow, "cancelled");
  const codes = params.getAll("code");
  if (codes.length !== 1 || !codes[0] || codes[0].length > 4096) return fail(config, flow, "invalid_flow");

  try {
    const client = googleClient(config);
    const { tokens } = await client.getToken({ code: codes[0], codeVerifier: flow.verifier, redirect_uri: config.redirectUri });
    if (!tokens.id_token) return fail(config, flow, "verification_failed");
    const identity = await verifyGoogleIdToken(client, tokens.id_token, config.clientId, flow.nonce);
    // Do not persist the Google access, ID or refresh token; our own opaque
    // customer session is the only credential issued to the browser.
    const db = await ensureDatabase();
    if (flow.mode === "link") {
      const [shopper, staff, profile] = await Promise.all([getCustomerSession(), getSessionUser(), getCustomerProfile()]);
      if (!shopper || staff || !profile || profile.id !== flow.customerId || shopper.id !== flow.customerId ||
          !profile.passwordHash || !equalSecret(flow.passwordStamp, googlePasswordStamp(config.cookieSecret, profile.id, profile.passwordHash, profile.googleLinkVersion, profile.sessionVersion))) {
        return fail(config, flow, "changed");
      }
      const result = await linkGoogleCustomer(db, profile.id, profile.passwordHash, identity, profile.googleLinkVersion, profile.sessionVersion);
      if (!result.ok) return fail(config, flow, result.reason);
      await logActivity({ actor: { id: profile.id, name: profile.name }, action: "google-linked", entity: "customers", entityId: profile.id, summary: "Customer connected Google sign-in after password verification" });
      const done = new URL("/my-account/personal-information?google=linked", config.redirectUri);
      return NextResponse.redirect(done, { status: 303, headers: responseHeaders });
    }

    const result = await findOrCreateGoogleCustomer(db, identity);
    if (!result.ok) return fail(config, flow, result.reason);
    const version = result.customer.googleAuthVersion;
    if (!version) return fail(config, flow, "verification_failed");
    // Google login never grants staff access, even if the email matches staff.
    await destroySession();
    await destroyCustomerSession();
    await createCustomerSession(result.customer, request.headers.get("user-agent") ?? undefined, {
      subjectHash: identity.subjectHash, version,
    });
    await logActivity({ actor: { id: result.customer.id, name: result.customer.name }, action: result.created ? "google-sign-up" : "google-sign-in", entity: "customers", entityId: result.customer.id, summary: result.created ? "Customer created an account using Google" : "Customer signed in using Google" });
    const destination = new URL(googleCustomerTarget(flow.next), config.redirectUri);
    return NextResponse.redirect(destination, { status: 303, headers: responseHeaders });
  } catch {
    // OAuth/network errors can contain codes, tokens or credentials. Never log
    // them; show only a generic actionable message.
    return fail(config, flow, "verification_failed");
  }
}

import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { CodeChallengeMethod, OAuth2Client } from "google-auth-library";
import {
  GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_SECONDS, equalSecret, makeGoogleFlow, pkceChallenge,
  readGoogleFlow, sealGoogleFlow, type GoogleFlow,
} from "@/lib/auth/google-flow";

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string; cookieSecret: string };
export type VerifiedGoogleIdentity = { subjectHash: string; email: string; name: string; firstName: string; lastName: string };

/** Only a fixed, operator-configured callback may be used, never the Host header. */
export function getGoogleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = (env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET ?? "").trim();
  const cookieSecret = (env.GOOGLE_OAUTH_COOKIE_SECRET ?? "").trim();
  const redirectUri = (env.GOOGLE_REDIRECT_URI ?? "").trim();
  if (!clientId || !clientSecret || clientId.length > 512 || clientSecret.length > 512 ||
      Buffer.byteLength(cookieSecret, "utf8") < 32 || cookieSecret.length > 512 || !redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
        url.username || url.password || url.search || url.hash || url.pathname !== "/api/auth/google/callback") return null;
    return { clientId, clientSecret, redirectUri: url.toString(), cookieSecret };
  } catch {
    return null;
  }
}

export function googleClient(config: GoogleConfig): OAuth2Client {
  return new OAuth2Client({ clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri });
}

function cookieOptions(config: GoogleConfig) {
  return {
    httpOnly: true, sameSite: "lax" as const, path: "/",
    secure: process.env.NODE_ENV === "production" || new URL(config.redirectUri).protocol === "https:",
  };
}

export async function startGoogleFlow(config: GoogleConfig, input: {
  next?: string;
  link?: { customerId: string; passwordStamp: string };
}): Promise<string> {
  const flow = makeGoogleFlow(input);
  const store = await cookies();
  store.set(GOOGLE_FLOW_COOKIE, sealGoogleFlow(flow, config.cookieSecret), { ...cookieOptions(config), maxAge: GOOGLE_FLOW_SECONDS });
  return googleClient(config).generateAuthUrl({
    response_type: "code",
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: pkceChallenge(flow.verifier),
    code_challenge_method: CodeChallengeMethod.S256,
    prompt: "select_account",
  });
}

/** Consume on every callback, including errors. Google also consumes each code once. */
export async function takeGoogleFlow(config: GoogleConfig): Promise<GoogleFlow | null> {
  const store = await cookies();
  const value = store.get(GOOGLE_FLOW_COOKIE)?.value;
  store.set(GOOGLE_FLOW_COOKIE, "", { ...cookieOptions(config), maxAge: 0 });
  return readGoogleFlow(value, config.cookieSecret);
}

const cleanName = (value: unknown) => typeof value === "string"
  ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80)
  : "";

/**
 * Verify Google's signature, issuer, audience and expiry with Google's official
 * library, then check the one-time nonce and verified email ourselves. Never
 * accept a browser-provided profile or a bare decoded JWT as proof of identity.
 */
export async function verifyGoogleIdToken(
  client: Pick<OAuth2Client, "verifyIdToken">,
  idToken: string,
  audience: string,
  expectedNonce: string,
): Promise<VerifiedGoogleIdentity> {
  if (!idToken || idToken.length > 16_384) throw new Error("Invalid Google identity.");
  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload || !equalSecret(payload.nonce, expectedNonce) || payload.email_verified !== true ||
      !["https://accounts.google.com", "accounts.google.com"].includes(payload.iss) ||
      payload.aud !== audience || (payload.azp && payload.azp !== audience) ||
      typeof payload.sub !== "string" || !/^[\x21-\x7e]{1,255}$/.test(payload.sub)) {
    throw new Error("Invalid Google identity.");
  }
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (email.length > 254 || /[\u0000-\u001f\u007f]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Invalid Google identity.");
  const name = cleanName(payload.name);
  const firstName = cleanName(payload.given_name) || name.split(/\s+/)[0] || "";
  const lastName = cleanName(payload.family_name) || name.split(/\s+/).slice(1).join(" ").slice(0, 80);
  return {
    subjectHash: createHash("sha256").update(payload.sub, "utf8").digest("hex"),
    email, name: name || [firstName, lastName].filter(Boolean).join(" ") || email,
    firstName, lastName,
  };
}

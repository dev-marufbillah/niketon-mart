import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { DEFAULT_ACCOUNT_DESTINATION, isAdminDestination, safeAccountNext } from "@/lib/auth/return-to";

export const GOOGLE_FLOW_COOKIE = "nm_google_oauth";
export const GOOGLE_FLOW_SECONDS = 10 * 60;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export type GoogleFlow = {
  version: 1;
  state: string;
  nonce: string;
  verifier: string;
  next: string;
  expiresAt: number;
  mode: "login" | "link";
  customerId?: string;
  passwordStamp?: string;
};

const token = () => randomBytes(32).toString("base64url");
const mac = (secret: string, purpose: string, value: string) =>
  createHmac("sha256", secret).update(`${purpose}\0${value}`).digest("base64url");

export function equalSecret(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Reauthentication is invalidated if the account password changes mid-flow. */
export function googlePasswordStamp(secret: string, customerId: string, passwordHash: string, linkVersion?: string | null, sessionVersion?: string | null): string {
  return mac(secret, "google-link-password", `${customerId}\0${passwordHash}\0${linkVersion ?? ""}\0${sessionVersion ?? ""}`);
}

export function makeGoogleFlow(input: {
  next?: string;
  link?: { customerId: string; passwordStamp: string };
}, now = Date.now()): GoogleFlow {
  return {
    version: 1,
    state: token(),
    nonce: token(),
    verifier: token(),
    next: safeAccountNext(input.next),
    expiresAt: now + GOOGLE_FLOW_SECONDS * 1000,
    mode: input.link ? "link" : "login",
    ...(input.link ? { customerId: input.link.customerId, passwordStamp: input.link.passwordStamp } : {}),
  };
}

/** HMAC-authenticated, short-lived HttpOnly cookie; never contains a password. */
export function sealGoogleFlow(flow: GoogleFlow, secret: string): string {
  const payload = Buffer.from(JSON.stringify(flow), "utf8").toString("base64url");
  return `${payload}.${mac(secret, "google-oauth-flow-v1", payload)}`;
}

export function readGoogleFlow(value: string | undefined, secret: string, now = Date.now()): GoogleFlow | null {
  if (!value || value.length > 4096) return null;
  const parts = value.split(".");
  if (parts.length !== 2 || !equalSecret(parts[1], mac(secret, "google-oauth-flow-v1", parts[0]))) return null;
  try {
    const obj: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!obj || typeof obj !== "object") return null;
    const flow = obj as Partial<GoogleFlow>;
    if (flow.version !== 1 || typeof flow.state !== "string" || !tokenPattern.test(flow.state) ||
        typeof flow.nonce !== "string" || !tokenPattern.test(flow.nonce) ||
        typeof flow.verifier !== "string" || !tokenPattern.test(flow.verifier) ||
        typeof flow.next !== "string" || !Number.isSafeInteger(flow.expiresAt) ||
        (flow.expiresAt as number) <= now || (flow.expiresAt as number) > now + (GOOGLE_FLOW_SECONDS + 5) * 1000 ||
        (flow.mode !== "login" && flow.mode !== "link")) return null;
    if (flow.mode === "link" && (typeof flow.customerId !== "string" || !flow.customerId || flow.customerId.length > 200 ||
        typeof flow.passwordStamp !== "string" || !tokenPattern.test(flow.passwordStamp))) return null;
    return { ...flow, next: safeAccountNext(flow.next) } as GoogleFlow;
  } catch {
    return null;
  }
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** Google is for shoppers; a Google cookie is never an admin credential. */
export function googleCustomerTarget(next: string | undefined): string {
  const target = safeAccountNext(next);
  return isAdminDestination(target) ? DEFAULT_ACCOUNT_DESTINATION : target;
}

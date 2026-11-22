import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureDatabase } from "@/lib/db";
import {
  ACCOUNT_COLLECTION,
  SESSION_COLLECTION,
  findProfileByEmail,
  ensureStaffShopper,
  touchLogin,
  type CustomerProfile,
  type CustomerSessionRow,
} from "@/lib/repositories/accounts";
import { verifyPassword } from "@/lib/auth/password";
import { getSessionUser } from "@/lib/auth/session";
import { googleSessionMatches } from "@/lib/auth/customer-session-guard";
import { sameSessionVersion } from "@/lib/auth/session-version";
import { revokeCustomerSessionsInDatabase } from "@/lib/auth/customer-credentials";
import { registrationHref } from "@/lib/auth/return-to";
export { safeAccountNext } from "@/lib/auth/return-to";

/**
 * Customer authentication.
 *
 * Deliberately the same shape as the admin session: an opaque random token in an
 * httpOnly cookie, only its SHA-256 hash in the database, an expiry column and a
 * delete-on-logout. No JWT secret to leak and no session data the browser can
 * read. A per-customer version invalidates old and in-flight sessions on
 * password changes, email changes and staff revocation.
 *
 * A customer cookie can never satisfy an admin guard. A verified staff session
 * may also use its own separately stored shopper profile, bound by admin id and
 * valid only while that staff session is active. Email alone never links them.
 */

export const CUSTOMER_COOKIE = "nm_customer_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type CustomerUser = {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
};

const toUser = (profile: CustomerProfile): CustomerUser => ({
  id: profile.id,
  name: profile.name,
  email: profile.email,
  firstName: profile.firstName || profile.name.split(" ")[0] || "",
  lastName: profile.lastName || profile.name.split(" ").slice(1).join(" ") || "",
  avatar: profile.avatar,
});

export async function authenticateCustomer(
  email: string,
  password: string,
): Promise<{ ok: true; profile: CustomerProfile } | { ok: false; error: string }> {
  const profile = await findProfileByEmail(email);
  // Always run a hash comparison so "no such email" and "wrong password" take
  // roughly the same time and give the same message.
  const stored = profile?.passwordHash ?? `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;
  const valid = verifyPassword(password, stored);
  if (!profile || !profile.passwordHash || !valid) {
    return { ok: false, error: "That email and password combination does not match an account." };
  }
  if (profile.status !== "active" || profile.staffAdminId) {
    return { ok: false, error: "This account cannot sign in. Please contact the store." };
  }
  return { ok: true, profile };
}

export async function createCustomerSession(
  authenticated: Pick<CustomerProfile, "id" | "sessionVersion">,
  userAgent?: string,
  googleAuth?: { subjectHash: string; version: string },
): Promise<void> {
  // Capture the version actually authenticated, not a fresh profile read. A
  // reset racing an old-password login must make the resulting session invalid.
  const customerId = authenticated.id;
  const db = await ensureDatabase();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await db.insert(SESSION_COLLECTION, {
    tokenHash: hashToken(token),
    customerId,
    sessionVersion: authenticated.sessionVersion ?? "",
    expiresAt,
    createdAt: new Date().toISOString(),
    userAgent: userAgent?.slice(0, 180) ?? "",
    ...(googleAuth ? { googleSubjectHash: googleAuth.subjectHash, googleAuthVersion: googleAuth.version } : {}),
  });
  await touchLogin(customerId);

  const store = await cookies();
  store.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroyCustomerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  if (token) {
    const db = await ensureDatabase();
    const sessions = await db.list<CustomerSessionRow>(SESSION_COLLECTION);
    const match = sessions.find((row) => row.tokenHash === hashToken(token));
    if (match) await db.remove(SESSION_COLLECTION, match.id);
  }
  store.delete(CUSTOMER_COOKIE);
}

/** Signs the customer out of every browser (used after a password change). */
export async function revokeCustomerSessions(customerId: string): Promise<number> {
  return revokeCustomerSessionsInDatabase(await ensureDatabase(), customerId);
}

/** Return the exact profile snapshot whose status and session version were
 * checked. Sensitive actions must CAS against this snapshot, not re-read a
 * newer profile and accidentally authorize an in-flight revoked session. */
export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const store = await cookies();
  const token = store.get(CUSTOMER_COOKIE)?.value;
  const staff = await getSessionUser();
  const db = token || staff ? await ensureDatabase() : null;
  // Old installations may already have both cookies. Always use the staff's
  // own shopper identity while a valid staff session is present; never merge
  // with a different customer's account merely because both cookies exist.
  if (staff && db) {
    const profile = await ensureStaffShopper(staff);
    return profile.status === "active" ? profile : null;
  }
  if (token && db) {
    const tokenHash = hashToken(token);
    const sessions = await db.list<CustomerSessionRow>(SESSION_COLLECTION);
    const session = sessions.find((row) => row.tokenHash === tokenHash);
    const expiresAt = session ? Date.parse(session.expiresAt) : NaN;
    if (session && Number.isFinite(expiresAt) && expiresAt > Date.now()) {
      const profile = await db.get<CustomerProfile>(ACCOUNT_COLLECTION, session.customerId);
      // A staff shopper profile must never be activated by a customer cookie:
      // staff suspension/reset must invalidate access everywhere.
      if (profile && !profile.staffAdminId && profile.status === "active" &&
          sameSessionVersion(profile.sessionVersion, session.sessionVersion) && googleSessionMatches(profile, session)) return profile;
    } else if (session) {
      await db.remove(SESSION_COLLECTION, session.id);
    }
  }
  return null;
}

/** Minimal user-safe view of the checked profile. */
export async function getCustomerSession(): Promise<CustomerUser | null> {
  const profile = await getCustomerProfile();
  return profile ? toUser(profile) : null;
}

/**
 * Page guard: sends a signed-out visitor to the login page and remembers where
 * they were going, so `?next=` returns them to the right account page.
 */
export async function requireCustomer(next = "/my-account"): Promise<CustomerUser> {
  const user = await getCustomerSession();
  if (!user) redirect(`/my-account/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Shopping destinations require sign-in or customer signup, including on a
 * direct request. Historical order links remain independently key-protected. */
export async function requireShopper(next: string): Promise<CustomerUser> {
  const user = await getCustomerSession();
  if (!user) redirect(registrationHref(next));
  return user;
}

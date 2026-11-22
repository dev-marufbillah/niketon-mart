import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import { isBlockedLegacyPassword, verifyPassword } from "@/lib/auth/password";
import { sameSessionVersion } from "@/lib/auth/session-version";
import { isSuperAdminIdentity } from "@/lib/auth/super-admin";
import { can, PERMISSIONS, roleDefinitions, type AdminRole, type Permission } from "@/lib/auth/permissions";

/**
 * Admin authentication.
 *
 * Sessions are opaque random tokens; only a SHA-256 hash is stored in the
 * database, so a database leak cannot be replayed as a login. The cookie is
 * httpOnly + sameSite=lax and expires with the session row.
 */

export const SESSION_COOKIE = "nm_admin_session";
const SESSION_DAYS = 7;

export type AdminUser = Row & {
  name: string;
  email: string;
  role: AdminRole;
  passwordHash: string;
  /** Rotated atomically on password reset or suspension. */
  sessionVersion?: string;
  active: boolean;
  mustChangePassword?: boolean;
  permissions?: Permission[];
  invitationStatus?: "pending" | "sent" | "failed" | "accepted";
  lastLoginAt?: string;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  mustChangePassword: boolean;
  permissions?: Permission[];
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function authenticate(
  email: string,
  password: string,
): Promise<{ ok: true; user: AdminUser } | { ok: false; error: string }> {
  const db = await ensureDatabase();
  const normalised = email.trim().toLowerCase();
  const users = await db.list<AdminUser>("admin_users");
  const user = users.find((entry) => entry.email.toLowerCase() === normalised);
  const dummyHash = `scrypt$${"00".repeat(16)}$${"00".repeat(64)}`;
  const valid = verifyPassword(password, user?.passwordHash ?? dummyHash);
  const knownDemoPassword = (process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL)) && isBlockedLegacyPassword(password);
  if (!user || !user.active || !valid || knownDemoPassword || !roleDefinitions[user.role] ||
      (user.role === "owner" && !isSuperAdminIdentity(user.email)) ||
      (isSuperAdminIdentity(user.email) && user.role !== "owner")) {
    return { ok: false, error: "That email and password combination could not be verified." };
  }
  await db.update("admin_users", user.id, { lastLoginAt: new Date().toISOString() });
  return { ok: true, user };
}

export async function createSession(user: AdminUser): Promise<void> {
  const db = await ensureDatabase();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  // Capture the version that was actually authenticated, not a later re-read:
  // a simultaneous reset or suspension must invalidate this login as well.
  await db.insert("admin_sessions", { tokenHash: hashToken(token), userId: user.id, sessionVersion: user.sessionVersion ?? "", expiresAt, createdAt: new Date().toISOString() });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await ensureDatabase();
    const sessions = await db.list<Row>("admin_sessions", {
      where: { tokenHash: hashToken(token) },
    });
    await Promise.all(sessions.map((session) => db.remove("admin_sessions", session.id)));
  }
  store.delete(SESSION_COOKIE);
}

/** Current admin or null. Verifies the session row, not just the cookie. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await ensureDatabase();
  const sessions = await db.list<Row & { tokenHash: string; userId: string; expiresAt: string; sessionVersion?: string }>(
    "admin_sessions",
    { where: { tokenHash: hashToken(token) } },
  );
  const session = sessions[0];
  if (!session) return null;
  const expiresAt = new Date(session.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await db.remove("admin_sessions", session.id);
    return null;
  }

  const user = await db.get<AdminUser>("admin_users", session.userId);
  if (!user || !user.active || !sameSessionVersion(user.sessionVersion, session.sessionVersion) || !roleDefinitions[user.role] ||
      (user.role === "owner" && !isSuperAdminIdentity(user.email)) ||
      (isSuperAdminIdentity(user.email) && user.role !== "owner")) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    permissions: user.role === "custom" && Array.isArray(user.permissions)
      ? user.permissions.filter((permission) => PERMISSIONS.includes(permission) && permission !== "users.manage") : undefined,
  };
}

/** Page guard — redirects to the login screen (keeping the intended path). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireAdmin();
  if (!can(user, permission)) {
    redirect(`/admin?denied=${encodeURIComponent(permission)}`);
  }
  return user;
}

/** Server-action guard — throws instead of redirecting. */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("You need to sign in again.");
  if (!can(user, permission)) {
    throw new Error("Your role does not allow this action.");
  }
  return user;
}

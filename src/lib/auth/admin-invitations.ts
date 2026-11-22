import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { ensureDatabase } from "@/lib/db";
import { hashPasswordSync } from "@/lib/auth/password";
import { sendAdminLink } from "@/lib/auth/admin-mail";
import { logActivity } from "@/lib/repositories/activity";
import type { AdminUser } from "@/lib/auth/session";
import type { AdminRole, Permission } from "@/lib/auth/permissions";
import type { Row } from "@/lib/db/types";

export type InvitableUser = AdminUser & {
  inviteHash?: string | null; inviteExpiresAt?: string | null;
  resetHash?: string | null; resetExpiresAt?: string | null;
};
const newToken = () => randomBytes(32).toString("hex");
const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates an inactive user and sends an invitation. Failed delivery is explicit. */
export async function inviteAdmin(input: { name: string; email: string; role: AdminRole; permissions: Permission[] }, actor: { id: string; name: string }) {
  const db = await ensureDatabase();
  const token = newToken();
  const hash = digest(token);
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 48 * 3_600_000).toISOString();
  const user = await db.insert<InvitableUser>("admin_users", {
    ...input, passwordHash: "", active: false, inviteHash: hash, inviteExpiresAt: expires,
    invitationStatus: "pending", createdAt: now, updatedAt: now,
  });
  await logActivity({ actor, action: "admin-invitation", entity: "admin_users", entityId: user.id, summary: `Invitation created for ${user.email} (${input.role})` });
  const sent = await sendAdminLink(user.email, token, "invite");
  await db.compareAndUpdate<InvitableUser>("admin_users", user.id, { inviteHash: hash, active: false }, {
    invitationStatus: sent ? "sent" : "failed", ...(!sent ? { inviteHash: null, inviteExpiresAt: null } : {}), updatedAt: new Date().toISOString(),
  });
  return { sent, id: user.id };
}

export async function resendAdminInvite(user: InvitableUser, actor: { id: string; name: string }) {
  const db = await ensureDatabase();
  if (user.active || user.role === "owner") return false;
  const token = newToken();
  const hash = digest(token);
  const updated = await db.compareAndUpdate<InvitableUser>("admin_users", user.id, { active: false }, {
    inviteHash: hash, inviteExpiresAt: new Date(Date.now() + 48 * 3_600_000).toISOString(), invitationStatus: "pending", updatedAt: new Date().toISOString(),
  });
  if (!updated) return false;
  const sent = await sendAdminLink(user.email, token, "invite");
  await db.compareAndUpdate<InvitableUser>("admin_users", user.id, { inviteHash: hash, active: false }, {
    invitationStatus: sent ? "sent" : "failed", ...(!sent ? { inviteHash: null, inviteExpiresAt: null } : {}), updatedAt: new Date().toISOString(),
  });
  await logActivity({ actor, action: "admin-invitation", entity: "admin_users", entityId: user.id, summary: `${sent ? "Resent" : "Could not send"} admin invitation to ${user.email}` });
  return sent;
}

export async function requestAdminPasswordReset(email: string) {
  const db = await ensureDatabase();
  const user = (await db.list<InvitableUser>("admin_users")).find((entry) => entry.email.toLowerCase() === email.toLowerCase() && entry.active);
  if (!user) return;
  const token = newToken();
  const hash = digest(token);
  await db.update<InvitableUser>("admin_users", user.id, { resetHash: hash, resetExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString() });
  const sent = await sendAdminLink(user.email, token, "reset");
  if (!sent) await db.compareAndUpdate<InvitableUser>("admin_users", user.id, { resetHash: hash }, { resetHash: null, resetExpiresAt: null });
  await logActivity({ actor: { id: user.id, name: user.name }, action: "admin-reset-request", entity: "admin_users", entityId: user.id, summary: `Admin password reset ${sent ? "requested" : "delivery failed"}` });
}

/** One atomic document update consumes the token and sets the password. */
export async function consumeAdminLink(token: string, password: string, kind: "invite" | "reset"): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  const db = await ensureDatabase();
  const hash = digest(token);
  const hashField = kind === "invite" ? "inviteHash" : "resetHash";
  const expiresField = kind === "invite" ? "inviteExpiresAt" : "resetExpiresAt";
  const user = (await db.list<InvitableUser>("admin_users", { where: { [hashField]: hash } }))[0];
  const now = new Date().toISOString();
  if (!user || user.active !== (kind === "reset") || !user[expiresField] || user[expiresField]! <= now ||
      (kind === "invite" && user.role === "owner")) return false;
  const passwordHash = hashPasswordSync(password);
  const patch = kind === "invite"
    ? { passwordHash, sessionVersion: newToken(), active: true, inviteHash: null, inviteExpiresAt: null, invitationStatus: "accepted" as const, mustChangePassword: false, updatedAt: now }
    : { passwordHash, sessionVersion: newToken(), resetHash: null, resetExpiresAt: null, mustChangePassword: false, updatedAt: now };
  const result = await db.compareAndUpdate<InvitableUser>("admin_users", user.id,
    { [hashField]: hash, active: kind === "reset" }, patch, { field: expiresField, after: now });
  if (!result) return false;
  // Reset invalidates all existing sessions. Invitations have no sessions yet.
  if (kind === "reset") {
    const sessions = await db.list<Row>("admin_sessions", { where: { userId: user.id } });
    await Promise.all(sessions.map((session) => db.remove("admin_sessions", session.id)));
  }
  await logActivity({ actor: { id: user.id, name: user.name }, action: kind === "invite" ? "admin-setup" : "admin-password-reset", entity: "admin_users", entityId: user.id, summary: kind === "invite" ? "Admin invitation accepted" : "Admin password reset" });
  return true;
}

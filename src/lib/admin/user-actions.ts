"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { PERMISSIONS, roleDefinitions, type AdminRole, type Permission } from "@/lib/auth/permissions";
import { isSuperAdminIdentity } from "@/lib/auth/super-admin";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { inviteAdmin, resendAdminInvite, type InvitableUser } from "@/lib/auth/admin-invitations";
import { isAdminMailConfigured } from "@/lib/auth/admin-mail";
import { ensureDatabase } from "@/lib/db";
import { logActivity } from "@/lib/repositories/activity";
import type { Row } from "@/lib/db/types";

export type AdminUserState = { errors?: string[]; success?: string } | null;
function parseRole(formData: FormData) {
  const role = String(formData.get("role") ?? "") as AdminRole;
  const requested = formData.getAll("permissions").map(String);
  const errors: string[] = [];
  if (!Object.hasOwn(roleDefinitions, role) || role === "owner") errors.push("Choose a non-owner admin role.");
  if (requested.some((permission) => !PERMISSIONS.includes(permission as Permission) || permission === "users.manage")) {
    errors.push("One or more permissions cannot be assigned.");
  }
  const permissions = role === "custom" ? [...new Set(requested as Permission[])] : [];
  if (role === "custom" && !permissions.includes("dashboard.view")) permissions.push("dashboard.view");
  return { role, permissions, errors };
}

export async function inviteAdminAction(_state: AdminUserState, formData: FormData): Promise<AdminUserState> {
  const actor = await assertPermission("users.manage");
  if (!(await checkLoginRateLimit("admin-invite", actor.id))) return { errors: ["Too many invitation attempts. Try again later."] };
  if (!isAdminMailConfigured()) return { errors: ["Invitation email is not configured. Set RESEND_API_KEY, ADMIN_EMAIL_FROM and NEXT_PUBLIC_SITE_URL on the server first."] };
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const { role, permissions, errors } = parseRole(formData);
  if (name.length < 2 || name.length > 100) errors.push("Enter a name between 2 and 100 characters.");
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("Enter a valid email address.");
  if (isSuperAdminIdentity(email)) errors.push("The protected Super Admin identity cannot be invited.");
  const db = await ensureDatabase();
  if ((await db.list<InvitableUser>("admin_users")).some((user) => user.email.toLowerCase() === email)) errors.push("That email already has an admin account.");
  if (errors.length) return { errors };
  try {
    const result = await inviteAdmin({ name, email, role, permissions }, { id: actor.id, name: actor.name });
    revalidatePath("/admin/users");
    if (!result.sent) return { errors: ["The account was created inactive, but the mail provider did not accept the invitation. Open Admin users and resend after checking email configuration."] };
  } catch {
    return { errors: ["The invitation could not be created. Check for a duplicate email and try again."] };
  }
  redirect("/admin/users?invited=1");
}

export async function saveAdminUserAction(id: string, _state: AdminUserState, formData: FormData): Promise<AdminUserState> {
  const actor = await assertPermission("users.manage");
  const db = await ensureDatabase();
  const existing = await db.get<InvitableUser>("admin_users", id);
  if (!existing) return { errors: ["That account no longer exists."] };
  if (isSuperAdminIdentity(existing.email)) return { errors: ["The protected Super Admin cannot be changed here. Use My account to change your own password."] };
  const name = String(formData.get("name") ?? "").trim();
  const active = formData.get("active") === "on";
  const { role, permissions, errors } = parseRole(formData);
  if (name.length < 2 || name.length > 100) errors.push("Enter a name between 2 and 100 characters.");
  if (active && !existing.active && (existing.invitationStatus === "pending" || existing.invitationStatus === "sent" || existing.invitationStatus === "failed" || !existing.passwordHash)) {
    errors.push("This user must complete their invitation before activation.");
  }
  if (errors.length) return { errors };
  await db.update<InvitableUser>("admin_users", id, { name, role, permissions, active,
    ...(!active ? { sessionVersion: randomBytes(24).toString("hex"), resetHash: null, resetExpiresAt: null } : {}), updatedAt: new Date().toISOString() });
  if (!active) {
    const sessions = await db.list<Row>("admin_sessions", { where: { userId: id } });
    await Promise.all(sessions.map((session) => db.remove("admin_sessions", session.id)));
  }
  await logActivity({ actor: { id: actor.id, name: actor.name }, action: "admin-user", entity: "admin_users", entityId: id,
    summary: `Updated ${name}; role ${existing.role} → ${role}; ${active ? "active" : "disabled"}` });
  revalidatePath("/admin/users");
  redirect("/admin/users?saved=1");
}

export async function resendInviteAction(id: string, _state: AdminUserState): Promise<AdminUserState> {
  const actor = await assertPermission("users.manage");
  if (!(await checkLoginRateLimit("admin-invite", actor.id))) return { errors: ["Too many invitation attempts. Try again later."] };
  if (!isAdminMailConfigured()) return { errors: ["Invitation email is not configured."] };
  const db = await ensureDatabase();
  const target = await db.get<InvitableUser>("admin_users", id);
  if (!target || target.active || isSuperAdminIdentity(target.email)) return { errors: ["This account cannot receive an invitation."] };
  const sent = await resendAdminInvite(target, { id: actor.id, name: actor.name });
  revalidatePath("/admin/users");
  return sent ? { success: "A new invitation was accepted by the email provider. Any previous invitation is now invalid." } : { errors: ["The invitation was not sent. Check the provider configuration and try again."] };
}

export async function deleteAdminUserAction(id: string): Promise<void> {
  const actor = await assertPermission("users.manage");
  const db = await ensureDatabase();
  const target = await db.get<InvitableUser>("admin_users", id);
  if (!target) redirect("/admin/users");
  if (id === actor.id || isSuperAdminIdentity(target.email)) throw new Error("The protected Super Admin cannot be deleted.");
  await db.remove("admin_users", id);
  const sessions = await db.list<Row>("admin_sessions", { where: { userId: id } });
  await Promise.all(sessions.map((session) => db.remove("admin_sessions", session.id)));
  await logActivity({ actor: { id: actor.id, name: actor.name }, action: "admin-removal", entity: "admin_users", entityId: id, summary: `Revoked and deleted admin account ${target.email}` });
  revalidatePath("/admin/users");
  redirect("/admin/users?deleted=1");
}

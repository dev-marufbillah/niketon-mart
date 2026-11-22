"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { destroySession, getSessionUser, createSession } from "@/lib/auth/session";
import { destroyCustomerSession } from "@/lib/auth/customer";
import { hashPasswordSync, isBlockedLegacyPassword, verifyPassword } from "@/lib/auth/password";
import { ensureDatabase } from "@/lib/db";
import { logActivity } from "@/lib/repositories/activity";

export async function signOutAction() {
  const user = await getSessionUser();
  await destroySession();
  await destroyCustomerSession();
  if (user) {
    await logActivity({
      actor: { id: user.id, name: user.name },
      action: "sign-out",
      entity: "admin_users",
      entityId: user.id,
      summary: `${user.name} signed out`,
    });
  }
  redirect("/my-account/login?signedOut=1");
}

export type PasswordState = { error?: string; success?: string } | null;

export async function changePasswordAction(
  _state: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const user = await getSessionUser();
  if (!user) return { error: "Your session expired. Sign in again." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 12 || next.length > 256) return { error: "Use a password between 12 and 256 characters." };
  if (isBlockedLegacyPassword(next)) return { error: "Choose a unique password that was not used in an old demo." };
  if (next !== confirm) return { error: "The new passwords do not match." };

  const db = await ensureDatabase();
  const record = await db.get<import("@/lib/auth/session").AdminUser>("admin_users", user.id);
  if (!record) return { error: "Account not found." };
  if (!verifyPassword(current, record.passwordHash)) return { error: "Your current password is incorrect." };

  const changed = await db.compareAndUpdate<import("@/lib/auth/session").AdminUser>("admin_users", user.id,
    { passwordHash: record.passwordHash, sessionVersion: record.sessionVersion, active: true }, {
      passwordHash: hashPasswordSync(next), sessionVersion: randomBytes(24).toString("hex"),
      resetHash: null, resetExpiresAt: null, mustChangePassword: false, updatedAt: new Date().toISOString(),
    });
  if (!changed) return { error: "The account changed while saving. Sign in again and retry." };
  // Keep only this device signed in, using the new version. A concurrent reset
  // rotates the version again and therefore also invalidates this session.
  await destroySession();
  await createSession(changed);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "password-change",
    entity: "admin_users",
    entityId: user.id,
    summary: `${user.name} changed their password`,
  });

  revalidatePath("/admin");
  return { success: "Password updated. Other admin sessions were signed out." };
}

"use server";
import { isBlockedLegacyPassword } from "@/lib/auth/password";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { isAdminMailConfigured } from "@/lib/auth/admin-mail";
import { consumeAdminLink, requestAdminPasswordReset } from "@/lib/auth/admin-invitations";

export type AdminLinkState = { error?: string; success?: string } | null;
export async function completeAdminLinkAction(_state: AdminLinkState, formData: FormData): Promise<AdminLinkState> {
  const token = String(formData.get("token") ?? "");
  const kind = String(formData.get("purpose") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!(await checkLoginRateLimit("admin-setup", token.slice(0, 64)))) return { error: "Too many attempts. Please try again later." };
  if (kind !== "invite" && kind !== "reset") return { error: "Invalid or expired link. Request a new one." };
  if (password.length < 12 || password.length > 256) return { error: "Use a password between 12 and 256 characters." };
  if (isBlockedLegacyPassword(password)) return { error: "Choose a unique password that was not used in an old demo." };
  if (password !== confirm) return { error: "Passwords do not match." };
  const success = await consumeAdminLink(token, password, kind);
  return success ? { success: "Password set. You can now sign in to the admin panel." } : { error: "Invalid, expired or already used link. Request a new one." };
}
export async function requestAdminResetAction(_state: AdminLinkState, formData: FormData): Promise<AdminLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!(await checkLoginRateLimit("admin-reset", email))) return { error: "Too many attempts. Please try again later." };
  if (!isAdminMailConfigured()) return { error: "Password reset email is not configured. Contact the store owner." };
  if (email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) await requestAdminPasswordReset(email);
  return { success: "If an active account matches, check its email for a reset link. If nothing arrives, contact the store owner." };
}

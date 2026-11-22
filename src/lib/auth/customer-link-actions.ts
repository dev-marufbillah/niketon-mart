"use server";

import { revalidatePath } from "next/cache";
import { ensureDatabase } from "@/lib/db";
import { getCustomerProfile } from "@/lib/auth/customer";
import { getSessionUser } from "@/lib/auth/session";
import { hashPasswordSync, verifyPassword } from "@/lib/auth/password";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { isCustomerMailConfigured, sendCustomerLink } from "@/lib/auth/admin-mail";
import { sendCustomerVerification } from "@/lib/auth/customer-security-mail";
import {
  consumeCustomerEmailVerificationInDatabase, consumeCustomerResetInDatabase,
  discardCustomerResetInDatabase, issueCustomerResetInDatabase,
} from "@/lib/auth/customer-credentials";
import { logActivity } from "@/lib/repositories/activity";

export type CustomerLinkState = { error?: string; success?: string } | null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const genericResetMessage = "If a verified customer password account is eligible, a link may arrive. Check your inbox and spam folder; otherwise contact the store.";

/** Never confirms whether an email identifies an account or whether mail was
 * accepted. Minimum response padding reduces, but does not eliminate, timing
 * enumeration: a shared production rate limiter is still required. */
export async function requestCustomerResetAction(_state: CustomerLinkState, formData: FormData): Promise<CustomerLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!(await checkLoginRateLimit("customer-reset", email.slice(0, 254)))) return { error: "Too many attempts. Please try again later." };
  if (!isCustomerMailConfigured()) return { error: "Password reset email is not configured. Please contact the store." };
  const delay = new Promise<void>((resolve) => setTimeout(resolve, 1200));
  try {
    if (email.length <= 254 && EMAIL_RE.test(email)) {
      const db = await ensureDatabase();
      const pending = await issueCustomerResetInDatabase(db, email);
      if (pending) {
        const accepted = await sendCustomerLink(pending.email, pending.token, "reset");
        if (!accepted) await discardCustomerResetInDatabase(db, pending);
        await logActivity({ actor: { id: pending.customerId, name: "Customer" }, action: "customer-reset-request", entity: "customers", entityId: pending.customerId,
          summary: accepted ? "Customer reset email accepted by provider; delivery not confirmed" : "Customer reset email could not be sent" });
      }
    }
  } catch {
    // DB/provider exceptions can contain addresses or secrets. Expose the same
    // public message and a generic operator log, never the exception or link.
    console.error("[customer-security] reset request could not be completed");
  } finally { await delay; }
  return { success: genericResetMessage };
}

export async function completeCustomerResetAction(_state: CustomerLinkState, formData: FormData): Promise<CustomerLinkState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!(await checkLoginRateLimit("customer-setup", token.slice(0, 64)))) return { error: "Too many attempts. Please try again later." };
  if (!/^[a-f0-9]{64}$/.test(token)) return { error: "Invalid, expired or already used link. Request a new one." };
  if (password.length < 8 || password.length > 256) return { error: "Use a password between 8 and 256 characters." };
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return { error: "Mix letters and numbers in the new password." };
  if (password !== confirm) return { error: "Passwords do not match." };
  const updated = await consumeCustomerResetInDatabase(await ensureDatabase(), token, hashPasswordSync(password));
  if (!updated) return { error: "Invalid, expired or already used link. Request a new one." };
  await logActivity({ actor: { id: updated.id, name: "Customer" }, action: "customer-password-reset", entity: "customers", entityId: updated.id,
    summary: "Customer reset their password; older sessions were invalidated" });
  return { success: "Password reset. Other customer sessions have been signed out. You can now sign in." };
}

/** A signed-in password customer must reauthenticate before requesting a link
 * to verify the current email or change it. Staff and Google-only identities
 * cannot establish a password or change staff credentials through this path. */
export async function requestCustomerEmailVerificationAction(_state: CustomerLinkState, formData: FormData): Promise<CustomerLinkState> {
  const [profile, staff] = await Promise.all([getCustomerProfile(), getSessionUser()]);
  if (!profile || staff || profile.staffAdminId || profile.status !== "active") return { error: "Sign in to your customer account again." };
  if (!profile.passwordHash) return { error: "This account uses Google sign-in. Contact the store for account email help." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("currentPassword") ?? "");
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!password || password.length > 256) return { error: "Enter your current password." };
  if (!(await checkLoginRateLimit("customer-email", profile.email))) return { error: "Too many attempts. Please try again later." };
  if (!verifyPassword(password, profile.passwordHash)) return { error: "That is not your current password." };
  if (email !== profile.email && profile.googleSubjectHash) return { error: "Disconnect Google sign-in below before changing your sign-in email. You can reconnect it with a matching Google email afterwards." };
  const result = await sendCustomerVerification(await ensureDatabase(), profile, email);
  if (result === "not-configured") return { error: "Email verification is not configured. Please contact the store." };
  if (result === "failed") return { error: "The verification email could not be sent. Please try again or contact the store." };
  if (result === "changed") return { error: "The account changed or that email is unavailable. Refresh and try again." };
  await logActivity({ actor: { id: profile.id, name: "Customer" }, action: "customer-email-verification-request", entity: "customers", entityId: profile.id,
    summary: "Customer verification email accepted by provider; delivery not confirmed" });
  return { success: "The email provider accepted the verification message. Check that inbox and spam folder; your sign-in email remains unchanged until you verify it." };
}

export async function completeCustomerEmailVerificationAction(_state: CustomerLinkState, formData: FormData): Promise<CustomerLinkState> {
  const token = String(formData.get("token") ?? "");
  if (!(await checkLoginRateLimit("customer-setup", token.slice(0, 64)))) return { error: "Too many attempts. Please try again later." };
  const updated = await consumeCustomerEmailVerificationInDatabase(await ensureDatabase(), token);
  if (!updated) return { error: "Invalid, expired or already used link. Request a new one from your account." };
  await logActivity({ actor: { id: updated.id, name: "Customer" }, action: "customer-email-verified", entity: "customers", entityId: updated.id,
    summary: "Customer verified their sign-in email" });
  revalidatePath("/my-account/personal-information");
  return { success: "Email verified. If you changed your sign-in email, sign in again using the new address." };
}

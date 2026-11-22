"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ensureDatabase } from "@/lib/db";
import { createCustomerSession, getCustomerProfile } from "@/lib/auth/customer";
import { getSessionUser } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { getGoogleConfig, startGoogleFlow } from "@/lib/auth/google";
import { googlePasswordStamp } from "@/lib/auth/google-flow";
import { unlinkGoogleCustomer } from "@/lib/auth/google-accounts";
import { logActivity } from "@/lib/repositories/activity";

export type GoogleLinkState = { error?: string; success?: string } | null;

/** Existing password customers must authenticate again before connecting an
 * identity. Staff identities cannot be linked or elevated through this flow. */
export async function linkGoogleAction(_state: GoogleLinkState, formData: FormData): Promise<GoogleLinkState> {
  const [profile, staff] = await Promise.all([getCustomerProfile(), getSessionUser()]);
  const config = getGoogleConfig();
  if (!profile || staff || profile.staffAdminId || profile.status !== "active") return { error: "Please sign in to your customer account again." };
  if (!config) return { error: "Google sign-in is not configured yet." };
  if (profile.googleSubjectHash) return { error: "This customer account is already connected to Google." };
  if (!profile.passwordHash) return { error: "A password is required to connect an existing account." };
  const password = String(formData.get("currentPassword") ?? "");
  if (!password || password.length > 256) return { error: "Enter your current password." };
  if (!(await checkLoginRateLimit("customer", profile.email))) return { error: "Too many attempts. Please try again later." };
  if (!verifyPassword(password, profile.passwordHash)) return { error: "That is not your current password." };
  const url = await startGoogleFlow(config, {
    next: "/my-account/personal-information",
    link: { customerId: profile.id, passwordStamp: googlePasswordStamp(config.cookieSecret, profile.id, profile.passwordHash, profile.googleLinkVersion, profile.sessionVersion) },
  });
  redirect(url);
}

export async function unlinkGoogleAction(_state: GoogleLinkState, formData: FormData): Promise<GoogleLinkState> {
  const [profile, staff] = await Promise.all([getCustomerProfile(), getSessionUser()]);
  if (!profile || staff || profile.staffAdminId || profile.status !== "active") return { error: "Please sign in to your customer account again." };
  if (!profile.googleSubjectHash) return { error: "This account is not connected to Google." };
  if (!profile.passwordHash) return { error: "This account only uses Google. Contact the store before changing its sign-in method." };
  const password = String(formData.get("currentPassword") ?? "");
  if (!password || password.length > 256) return { error: "Enter your current password." };
  if (!(await checkLoginRateLimit("customer", profile.email))) return { error: "Too many attempts. Please try again later." };
  if (!verifyPassword(password, profile.passwordHash)) return { error: "That is not your current password." };
  const updated = await unlinkGoogleCustomer(await ensureDatabase(), profile);
  if (!updated) return { error: "Your account changed. Refresh this page and try again." };
  // The CAS rotates the version in the same write. A newer concurrent reset
  // makes this fresh session invalid rather than letting an old login survive.
  await createCustomerSession(updated);
  await logActivity({ actor: { id: profile.id, name: profile.name }, action: "google-unlinked", entity: "customers", entityId: profile.id, summary: "Customer disconnected Google sign-in after password verification" });
  revalidatePath("/my-account/personal-information");
  return { success: "Google disconnected. Other sessions have been signed out." };
}

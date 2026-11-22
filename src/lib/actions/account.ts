"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPasswordSync, verifyPassword } from "@/lib/auth/password";
import {
  authenticateCustomer,
  createCustomerSession,
  destroyCustomerSession,
  getCustomerProfile,
  getCustomerSession,
  safeAccountNext,
} from "@/lib/auth/customer";
import {
  createAddress,
  createAccount,
  deleteAddress,
  getAddress,
  setDefaultAddress,
  setDefaultPaymentMethod,
  updateAddress,
} from "@/lib/repositories/accounts";
import { ensureDatabase } from "@/lib/db";
import { changeCustomerPasswordInDatabase, updateCustomerContactInDatabase } from "@/lib/auth/customer-credentials";
import { sendCustomerVerification } from "@/lib/auth/customer-security-mail";
import { logActivity } from "@/lib/repositories/activity";
import { checkLoginRateLimit } from "@/lib/auth/rate-limit";
import { authenticate as authenticateAdmin, createSession as createAdminSession, destroySession as destroyAdminSession } from "@/lib/auth/session";
import { ensureStaffShopper } from "@/lib/repositories/accounts";
import { DEFAULT_ACCOUNT_DESTINATION, isAdminDestination } from "@/lib/auth/return-to";

/**
 * Account actions
 * ---------------
 * Every action re-reads the session on the server and scopes its query to that
 * customer id. The browser never sends a customer id, so there is nothing to
 * tamper with; a signed-out request is refused rather than trusted.
 */

export type AuthState = { error?: string; success?: string; values?: Record<string, string> } | null;
export type FormState = { errors?: string[]; success?: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ------------------------------------------------------------- throttling -- */

const attempts = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;

async function clientKey(action: string): Promise<string> {
  const store = await headers();
  const ip = (store.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || store.get("x-real-ip") || "local";
  return `${action}:${ip}`;
}

/** Returns true when the caller has made too many attempts in the window. */
function tooMany(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= limit) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  return false;
}

function clearAttempts(key: string) {
  attempts.delete(key);
}

async function log(actor: { id: string; name: string }, action: string, summary: string) {
  await logActivity({ actor, action, entity: "customers", entityId: actor.id, summary });
}

/* ------------------------------------------------------------------ auth -- */

export async function registerCustomerAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  const accept = formData.get("acceptTerms") === "on";
  const next = safeAccountNext(formData.get("next"));
  const values = { firstName, lastName, email, phone };

  const errors: string[] = [];
  if (firstName.length < 2 || firstName.length > 80) errors.push("Enter a first name between 2 and 80 characters.");
  if (lastName.length < 2 || lastName.length > 80) errors.push("Enter a last name between 2 and 80 characters.");
  if (email.length > 254 || !EMAIL_RE.test(email)) errors.push("Enter a valid email address.");
  if (phone.length > 32 || phone.replace(/\D/g, "").length < 7) errors.push("Enter a phone number we can reach you on.");
  if (password.length < 8 || password.length > 256) errors.push("Use between 8 and 256 characters for your password.");
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) errors.push("Mix letters and numbers in your password.");
  if (password !== confirm) errors.push("The two passwords do not match.");
  if (!accept) errors.push("Please accept the store terms to create an account.");
  if (errors.length) return { error: errors[0], values };

  if (tooMany(await clientKey("register"), 10)) {
    return { error: "Too many accounts created from this connection. Try again later.", values };
  }

  const result = await createAccount({ firstName, lastName, email, phone, passwordHash: hashPasswordSync(password) });
  if (!result.ok) return { error: result.error, values };

  // Switching to a customer must also end any old staff session in this
  // browser. A public registration never creates or inherits admin access.
  await destroyAdminSession();
  await destroyCustomerSession();
  await createCustomerSession(result.customer);
  try {
    const verification = await sendCustomerVerification(await ensureDatabase(), result.customer, email);
    if (verification === "accepted" || verification === "failed") {
      await logActivity({ actor: { id: result.customer.id, name: "Customer" }, action: "customer-email-verification-request", entity: "customers", entityId: result.customer.id,
        summary: verification === "accepted" ? "Signup verification email accepted by provider; delivery not confirmed" : "Signup verification email could not be sent" });
    }
  } catch {
    // Registration succeeded already. Do not leak a DB/provider exception or
    // pretend the email was delivered; the profile offers an explicit retry.
    console.error("[customer-security] signup verification could not be completed");
  }
  await logActivity({
    actor: { id: result.customer.id, name: result.customer.name },
    action: "sign-up",
    entity: "customers",
    entityId: result.customer.id,
    summary: `${result.customer.name} created an account`,
  });
  redirect(isAdminDestination(next) ? DEFAULT_ACCOUNT_DESTINATION : next);
}

export async function loginCustomerAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeAccountNext(formData.get("next"));
  const values = { email };

  if (!email || !password) return { error: "Enter your email and password.", values };
  if (email.length > 254 || password.length > 256) return { error: "That email and password combination could not be verified.", values };

  const key = await clientKey("login");
  // Both credential stores are protected by their own existing rate limits.
  // Never fall back to a less protected path when either limit is exceeded.
  const [adminAllowed, customerAllowed] = await Promise.all([
    checkLoginRateLimit("admin", email), checkLoginRateLimit("customer", email),
  ]);
  if (tooMany(key, 30) || !adminAllowed || !customerAllowed) {
    return { error: "Too many sign-in attempts. Wait a few minutes and try again.", values };
  }

  // Only a successful server-side staff password check creates a staff session.
  // An email match or a customer registration is not proof of a staff identity.
  const admin = await authenticateAdmin(email, password);
  if (admin.ok) {
    await ensureStaffShopper(admin.user);
    await destroyCustomerSession();
    await destroyAdminSession();
    await createAdminSession(admin.user);
    await logActivity({ actor: { id: admin.user.id, name: admin.user.name }, action: "sign-in", entity: "admin_users", entityId: admin.user.id, summary: `${admin.user.name} signed in` });
    clearAttempts(key);
    redirect(next === DEFAULT_ACCOUNT_DESTINATION ? "/admin" : next);
  }

  const result = await authenticateCustomer(email, password);
  if (!result.ok) return { error: "That email and password combination could not be verified.", values };

  clearAttempts(key);
  const store = await headers();
  await destroyAdminSession();
  await destroyCustomerSession();
  await createCustomerSession(result.profile, store.get("user-agent") ?? undefined);
  await log(
    { id: result.profile.id, name: result.profile.name },
    "sign-in",
    `${result.profile.name} signed in to their account`,
  );
  redirect(isAdminDestination(next) ? DEFAULT_ACCOUNT_DESTINATION : next);
}

export async function logoutCustomerAction(): Promise<void> {
  const user = await getCustomerSession();
  await destroyCustomerSession();
  await destroyAdminSession();
  if (user) await log(user, "sign-out", `${user.name} signed out`);
  redirect("/my-account/login?signedOut=1");
}

/* --------------------------------------------------------------- profile -- */

export async function updateProfileAction(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getCustomerProfile();
  if (!profile) return { errors: ["Your session expired. Sign in again."] };

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  const errors: string[] = [];
  if (firstName.length < 2 || firstName.length > 80) errors.push("Enter a first name between 2 and 80 characters.");
  if (lastName.length < 2 || lastName.length > 80) errors.push("Enter a last name between 2 and 80 characters.");
  if (email !== profile.email.trim().toLowerCase()) errors.push("Use the email verification form below to change your sign-in email.");
  if (phone.length > 32 || phone.replace(/\D/g, "").length < 7) errors.push("Enter a phone number we can reach you on.");
  if (gender && !["female", "male", "other", "prefer-not"].includes(gender)) errors.push("Choose a valid option.");
  if (errors.length) return { errors };

  const updated = await updateCustomerContactInDatabase(await ensureDatabase(), profile, {
    firstName, lastName, name: `${firstName} ${lastName}`.trim(), phone, gender, marketingOptIn,
  });
  if (!updated) return { errors: ["Your account changed. Sign in again and retry."] };
  revalidatePath("/my-account/personal-information");
  revalidatePath("/my-account");
  return { success: "Your details are saved." };
}

/* ------------------------------------------------------------- addresses -- */

function readAddress(formData: FormData) {
  return {
    label: String(formData.get("label") ?? "").trim(),
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    company: String(formData.get("company") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    addressLine2: String(formData.get("addressLine2") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    postalCode: String(formData.get("postalCode") ?? "").trim(),
    areaId: String(formData.get("areaId") ?? "").trim(),
  };
}

function validateAddress(input: ReturnType<typeof readAddress>, validAreaIds: string[]): string[] {
  const errors: string[] = [];
  if (input.firstName.length < 2) errors.push("Enter the recipient's first name.");
  if (input.lastName.length < 2) errors.push("Enter the recipient's last name.");
  if (input.phone.replace(/\D/g, "").length < 7) errors.push("Enter a contact phone number.");
  if (input.email && !EMAIL_RE.test(input.email)) errors.push("Enter a valid email address.");
  if (input.address.length < 8) errors.push("Enter the house, road and area.");
  if (!validAreaIds.includes(input.areaId)) errors.push("Choose a delivery area.");
  return errors;
}

export async function saveAddressAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await getCustomerSession();
  if (!user) return { errors: ["Your session expired. Sign in again."] };

  const { getDeliveryAreas } = await import("@/lib/repositories/operations");
  const areas = await getDeliveryAreas();
  const input = readAddress(formData);
  const errors = validateAddress(input, areas.map((area) => area.id));
  if (errors.length) return { errors };

  const id = String(formData.get("id") ?? "").trim();
  const isDefaultShipping = formData.get("isDefaultShipping") === "on";
  const isDefaultBilling = formData.get("isDefaultBilling") === "on";

  if (id) {
    const updated = await updateAddress(user.id, id, { ...input, isDefaultShipping, isDefaultBilling });
    if (!updated) return { errors: ["That address no longer exists."] };
  } else {
    await createAddress(user.id, { ...input, isDefaultShipping, isDefaultBilling });
  }

  revalidatePath("/my-account/addresses");
  revalidatePath("/checkout");
  return { success: id ? "Address updated." : "Address saved." };
}

export async function deleteAddressAction(formData: FormData): Promise<void> {
  const user = await getCustomerSession();
  if (!user) redirect("/my-account/login?next=/my-account/addresses");
  const id = String(formData.get("id") ?? "");
  if (id && (await getAddress(user.id, id))) await deleteAddress(user.id, id);
  revalidatePath("/my-account/addresses");
  revalidatePath("/checkout");
}

export async function setDefaultAddressAction(formData: FormData): Promise<void> {
  const user = await getCustomerSession();
  if (!user) redirect("/my-account/login?next=/my-account/addresses");
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "shipping") === "billing" ? "billing" : "shipping";
  await setDefaultAddress(user.id, id, kind);
  revalidatePath("/my-account/addresses");
  revalidatePath("/checkout");
}

/* -------------------------------------------------------- payment default -- */

export async function setDefaultPaymentAction(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await getCustomerSession();
  if (!user) return { errors: ["Your session expired. Sign in again."] };
  const methodId = String(formData.get("paymentMethodId") ?? "");

  const { getAvailableCheckoutMethods } = await import("@/lib/repositories/operations");
  const methods = await getAvailableCheckoutMethods();
  // Only a method the store currently offers can be remembered.
  if (!methods.some((method) => method.id === methodId)) {
    return { errors: ["That payment method is not available right now."] };
  }

  await setDefaultPaymentMethod(user.id, methodId);
  revalidatePath("/my-account/payment-methods");
  revalidatePath("/checkout");
  return { success: "Saved — checkout will preselect this method." };
}

/* --------------------------------------------------------------- password -- */

export async function changePasswordAction(_state: FormState, formData: FormData): Promise<FormState> {
  const profile = await getCustomerProfile();
  if (!profile) return { errors: ["Your session expired. Sign in again."] };

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (!profile.passwordHash) {
    return { errors: ["This account has no password yet. Contact the store to set one."] };
  }

  const errors: string[] = [];
  if (!current || current.length > 256) errors.push("Enter your current password.");
  if (next.length < 8 || next.length > 256) errors.push("Use between 8 and 256 characters for the new password.");
  if (!/[a-zA-Z]/.test(next) || !/\d/.test(next)) errors.push("Mix letters and numbers in the new password.");
  if (next !== confirm) errors.push("The two new passwords do not match.");
  if (!errors.length && !(await checkLoginRateLimit("customer", profile.email))) errors.push("Too many attempts. Please try again later.");
  if (!errors.length && !verifyPassword(current, profile.passwordHash)) {
    errors.push("That is not your current password.");
  }
  if (!errors.length && next === current) errors.push("Choose a password you have not used here before.");
  if (errors.length) return { errors };

  const updated = await changeCustomerPasswordInDatabase(await ensureDatabase(), profile, hashPasswordSync(next));
  if (!updated) return { errors: ["Your account changed. Sign in again and retry."] };
  // The version rotated atomically with the password; an old login racing this
  // write cannot create a valid session, even if inserted after this response.
  await createCustomerSession(updated);
  await log({ id: profile.id, name: profile.name }, "password-change", `${profile.name} changed their password`);

  revalidatePath("/my-account");
  return { success: "Password changed. Other devices have been signed out." };
}

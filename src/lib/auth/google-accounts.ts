import "server-only";

import { randomBytes } from "node:crypto";
import type { Database } from "@/lib/db/types";
import type { CustomerProfile } from "@/lib/repositories/accounts";
import type { VerifiedGoogleIdentity } from "@/lib/auth/google";

const COLLECTION = "customers";
const newVersion = () => randomBytes(24).toString("hex");
const now = () => new Date().toISOString();
const validSubject = (value: string) => /^[a-f0-9]{64}$/.test(value);

type AccountError = "existing_account" | "blocked" | "identity_used" | "wrong_email" | "changed" | "invalid";
type AccountResult = { ok: true; customer: CustomerProfile; created: boolean } | { ok: false; reason: AccountError };

function approvedCustomer(customer: CustomerProfile, subjectHash: string): boolean {
  return customer.status === "active" && !customer.staffAdminId && customer.googleSubjectHash === subjectHash &&
    typeof customer.googleAuthVersion === "string" && customer.googleAuthVersion.length >= 32;
}

/** Input is accepted only after Google ID-token verification. Email never grants
 * access to an old password/guest/staff profile. A password account must link
 * explicitly from a signed-in, password-reauthenticated customer session. */
export async function findOrCreateGoogleCustomer(db: Database, identity: VerifiedGoogleIdentity): Promise<AccountResult> {
  if (!validSubject(identity.subjectHash)) return { ok: false, reason: "invalid" };
  const linked = await db.list<CustomerProfile>(COLLECTION, { where: { googleSubjectHash: identity.subjectHash } });
  if (linked.length > 1) return { ok: false, reason: "invalid" };
  if (linked.length === 1) {
    const customer = linked[0];
    if (customer.status !== "active") return { ok: false, reason: "blocked" };
    return approvedCustomer(customer, identity.subjectHash)
      ? { ok: true, customer, created: false }
      : { ok: false, reason: "invalid" };
  }
  const profiles = await db.list<CustomerProfile>(COLLECTION);
  // Another request may have created this same verified subject between the
  // subject lookup and this scan; treat only that exact subject as a race win.
  const appeared = profiles.filter((profile) => profile.googleSubjectHash === identity.subjectHash);
  if (appeared.length > 1) return { ok: false, reason: "invalid" };
  if (appeared.length === 1) {
    if (appeared[0].status !== "active") return { ok: false, reason: "blocked" };
    return approvedCustomer(appeared[0], identity.subjectHash)
      ? { ok: true, customer: appeared[0], created: false } : { ok: false, reason: "invalid" };
  }
  const alreadyRegistered = profiles.some((profile) => !profile.staffAdminId &&
    typeof profile.email === "string" && profile.email.trim().toLowerCase() === identity.email &&
    Boolean(profile.passwordHash || profile.googleSubjectHash));
  if (alreadyRegistered) return { ok: false, reason: "existing_account" };

  const timestamp = now();
  // Deterministic subject id and Mongo's unique subject index prevent two
  // concurrent sign-ins from creating different accounts for one Google id.
  const id = `google_customer_${identity.subjectHash}`;
  try {
    const customer = await db.insert<CustomerProfile>(COLLECTION, {
      id, name: identity.name, firstName: identity.firstName, lastName: identity.lastName,
      email: identity.email, phone: "", address: "", status: "active", notes: "",
      orderCount: 0, totalSpent: 0, googleSubjectHash: identity.subjectHash,
      googleAuthVersion: newVersion(), googleLinkVersion: newVersion(), emailVerified: true, lastLoginAt: timestamp,
      createdAt: timestamp, updatedAt: timestamp,
    });
    return { ok: true, customer, created: true };
  } catch (error) {
    // Only a verified, valid record for the same subject is a race winner. Do
    // not convert arbitrary connection/write failures into successful logins.
    const matches = await db.list<CustomerProfile>(COLLECTION, { where: { googleSubjectHash: identity.subjectHash } });
    if (matches.length === 1 && approvedCustomer(matches[0], identity.subjectHash)) {
      return { ok: true, customer: matches[0], created: false };
    }
    if (matches.length === 1 && matches[0].status !== "active") return { ok: false, reason: "blocked" };
    // A simultaneous password/Google signup may win the registered-email
    // unique index. Never attach it merely because the emails match.
    const accounts = await db.list<CustomerProfile>(COLLECTION);
    if (accounts.some((row) => !row.staffAdminId && typeof row.email === "string" &&
      row.email.trim().toLowerCase() === identity.email && Boolean(row.passwordHash || row.googleSubjectHash))) {
      return { ok: false, reason: "existing_account" };
    }
    throw error;
  }
}

/** The caller must first reauthenticate the active customer with their password
 * and verify the Google token. A CAS also refuses changes during the flow. */
export async function linkGoogleCustomer(
  db: Database,
  customerId: string,
  expectedPasswordHash: string,
  identity: VerifiedGoogleIdentity,
  expectedLinkVersion?: string | null,
  expectedSessionVersion?: string | null,
): Promise<AccountResult> {
  if (!validSubject(identity.subjectHash) || !expectedPasswordHash) return { ok: false, reason: "invalid" };
  const customer = await db.get<CustomerProfile>(COLLECTION, customerId);
  if (!customer || customer.staffAdminId || customer.status !== "active" || customer.passwordHash !== expectedPasswordHash ||
      customer.googleLinkVersion !== expectedLinkVersion || customer.sessionVersion !== expectedSessionVersion) {
    return { ok: false, reason: "changed" };
  }
  if (customer.email.trim().toLowerCase() !== identity.email) return { ok: false, reason: "wrong_email" };
  if (customer.googleSubjectHash) {
    return approvedCustomer(customer, identity.subjectHash)
      ? { ok: true, customer, created: false }
      : { ok: false, reason: "identity_used" };
  }
  const linked = await db.list<CustomerProfile>(COLLECTION, { where: { googleSubjectHash: identity.subjectHash } });
  if (linked.length) return { ok: false, reason: "identity_used" };
  try {
    const updated = await db.compareAndUpdate<CustomerProfile>(COLLECTION, customer.id, {
      email: customer.email, passwordHash: expectedPasswordHash, status: "active",
      staffAdminId: customer.staffAdminId, googleSubjectHash: customer.googleSubjectHash,
      googleAuthVersion: customer.googleAuthVersion, googleLinkVersion: customer.googleLinkVersion,
      sessionVersion: customer.sessionVersion,
    }, {
      googleSubjectHash: identity.subjectHash, googleAuthVersion: newVersion(), googleLinkVersion: newVersion(), emailVerified: true, updatedAt: now(),
    });
    return updated ? { ok: true, customer: updated, created: false } : { ok: false, reason: "changed" };
  } catch (error) {
    // The unique subject index catches concurrent links across instances.
    const matches = await db.list<CustomerProfile>(COLLECTION, { where: { googleSubjectHash: identity.subjectHash } });
    if (matches.length) return { ok: false, reason: "identity_used" };
    throw error;
  }
}

/** Requires password reauthentication; existing Google sessions immediately fail
 * their subject+version check, including a login racing with this unlink. */
export async function unlinkGoogleCustomer(db: Database, customer: CustomerProfile): Promise<CustomerProfile | null> {
  if (!customer.passwordHash || !customer.googleSubjectHash || customer.staffAdminId || customer.status !== "active") return null;
  return db.compareAndUpdate<CustomerProfile>(COLLECTION, customer.id, {
    status: "active", staffAdminId: customer.staffAdminId, passwordHash: customer.passwordHash, sessionVersion: customer.sessionVersion,
    googleSubjectHash: customer.googleSubjectHash, googleAuthVersion: customer.googleAuthVersion, googleLinkVersion: customer.googleLinkVersion,
  }, {
    googleSubjectHash: null, googleAuthVersion: null, googleLinkVersion: newVersion(), sessionVersion: newVersion(),
    passwordResetHash: null, passwordResetEmail: null, passwordResetExpiresAt: null,
    emailVerificationHash: null, emailVerificationFrom: null, emailVerificationTarget: null, emailVerificationExpiresAt: null, updatedAt: now(),
  });
}

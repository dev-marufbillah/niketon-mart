import "server-only";

import { createHash, randomBytes } from "node:crypto";
import type { Database } from "@/lib/db/types";
import type { CustomerProfile } from "@/lib/repositories/accounts";
import { sameSessionVersion } from "@/lib/auth/session-version";

const COLLECTION = "customers";
const RESET_TTL_MS = 30 * 60 * 1000;
const VERIFY_TTL_MS = 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clearReset = { passwordResetHash: null, passwordResetEmail: null, passwordResetExpiresAt: null } as const;
const clearVerification = { emailVerificationHash: null, emailVerificationFrom: null, emailVerificationTarget: null, emailVerificationExpiresAt: null } as const;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export const newCustomerSessionVersion = () => randomBytes(32).toString("hex");

/** A raw reset token is returned to the server caller for email delivery only.
 * It is never persisted, logged, put in query parameters or shown in admin. */
export type PendingCustomerReset = { customerId: string; email: string; token: string; tokenHash: string };

export async function issueCustomerResetInDatabase(db: Database, email: string, now = new Date()): Promise<PendingCustomerReset | null> {
  const normal = email.trim().toLowerCase();
  if (normal.length > 254 || !EMAIL_RE.test(normal)) return null;
  const all = await db.list<CustomerProfile>(COLLECTION);
  // Email is only an address for delivering a secret to a *registered password
  // customer*. Guests, staff shoppers and Google-only customers cannot be
  // claimed here. Duplicate eligible identities must be reviewed, not merged.
  const matches = all.filter((row) => !row.staffAdminId && typeof row.email === "string" &&
    row.email.trim().toLowerCase() === normal && Boolean(row.passwordHash));
  if (matches.length !== 1) return null;
  const profile = matches[0];
  // Legacy signups/profile edits did not prove mailbox ownership. Require an
  // already verified address, not merely a previously editable email string.
  if (profile.status !== "active" || profile.emailVerified !== true || typeof profile.passwordHash !== "string") return null;
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(token);
  const updated = await db.compareAndUpdate<CustomerProfile>(COLLECTION, profile.id, {
    email: profile.email, status: "active", staffAdminId: profile.staffAdminId,
    passwordHash: profile.passwordHash, sessionVersion: profile.sessionVersion,
    passwordResetHash: profile.passwordResetHash, emailVerified: true,
  }, {
    passwordResetHash: tokenHash, passwordResetEmail: profile.email,
    passwordResetExpiresAt: new Date(now.getTime() + RESET_TTL_MS).toISOString(),
    updatedAt: now.toISOString(),
  });
  return updated ? { customerId: profile.id, email: profile.email, token, tokenHash } : null;
}

/** A failed send must not leave a usable reset token. This cannot erase a
 * newer link created by a concurrent request. */
export async function discardCustomerResetInDatabase(db: Database, pending: PendingCustomerReset): Promise<void> {
  await db.compareAndUpdate<CustomerProfile>(COLLECTION, pending.customerId, { passwordResetHash: pending.tokenHash }, {
    passwordResetHash: null, passwordResetEmail: null, passwordResetExpiresAt: null,
    updatedAt: new Date().toISOString(),
  });
}

/** Atomic single-use consume, including expiry and email/account/credential
 * checks. All old sessions become invalid at the same instant as the change. */
export async function consumeCustomerResetInDatabase(db: Database, token: string, passwordHash: string, now = new Date()): Promise<CustomerProfile | null> {
  if (!/^[a-f0-9]{64}$/.test(token) || !passwordHash) return null;
  const tokenHash = digest(token);
  const matches = await db.list<CustomerProfile>(COLLECTION, { where: { passwordResetHash: tokenHash } });
  if (matches.length !== 1) return null;
  const profile = matches[0];
  const nowIso = now.toISOString();
  const expires = Date.parse(profile.passwordResetExpiresAt ?? "");
  if (profile.status !== "active" || profile.staffAdminId || profile.emailVerified !== true ||
      typeof profile.passwordHash !== "string" || !profile.passwordHash ||
      typeof profile.passwordResetEmail !== "string" || profile.passwordResetEmail !== profile.email ||
      !Number.isFinite(expires) || expires <= now.getTime()) return null;
  return db.compareAndUpdate<CustomerProfile>(COLLECTION, profile.id, {
    passwordResetHash: tokenHash, passwordResetEmail: profile.email, email: profile.email,
    passwordResetExpiresAt: profile.passwordResetExpiresAt, status: "active", staffAdminId: profile.staffAdminId,
    passwordHash: profile.passwordHash, sessionVersion: profile.sessionVersion, emailVerified: true,
  }, {
    passwordHash, sessionVersion: newCustomerSessionVersion(),
    ...clearReset, ...clearVerification, updatedAt: nowIso,
  }, { field: "passwordResetExpiresAt", after: nowIso });
}

/** The caller must have just verified the snapshot's password (or just created
 * the account). The existing login email stays unchanged until the recipient
 * proves control of the requested mailbox using this short-lived link. */
export async function issueCustomerEmailVerificationInDatabase(
  db: Database, profile: CustomerProfile, targetEmail: string, now = new Date(),
): Promise<PendingCustomerReset | null> {
  const target = targetEmail.trim().toLowerCase();
  if (target.length > 254 || !EMAIL_RE.test(target) || !profile.passwordHash || profile.staffAdminId || profile.status !== "active") return null;
  // Linking Google requires matching verified email. Do not silently retain a
  // different Google identity after a change; the customer must disconnect it
  // explicitly first. Re-verifying the current address remains allowed.
  if (target !== profile.email && profile.googleSubjectHash) return null;
  const rows = await db.list<CustomerProfile>(COLLECTION);
  if (rows.some((row) => row.id !== profile.id && !row.staffAdminId &&
    typeof row.email === "string" && row.email.trim().toLowerCase() === target && Boolean(row.passwordHash || row.googleSubjectHash))) return null;
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(token);
  const updated = await db.compareAndUpdate<CustomerProfile>(COLLECTION, profile.id, {
    email: profile.email, passwordHash: profile.passwordHash, staffAdminId: profile.staffAdminId,
    status: "active", sessionVersion: profile.sessionVersion, emailVerificationHash: profile.emailVerificationHash,
    googleSubjectHash: profile.googleSubjectHash, googleAuthVersion: profile.googleAuthVersion, googleLinkVersion: profile.googleLinkVersion,
  }, {
    emailVerificationHash: tokenHash, emailVerificationFrom: profile.email, emailVerificationTarget: target,
    emailVerificationExpiresAt: new Date(now.getTime() + VERIFY_TTL_MS).toISOString(), updatedAt: now.toISOString(),
  });
  return updated ? { customerId: profile.id, email: target, token, tokenHash } : null;
}

export async function discardCustomerEmailVerificationInDatabase(db: Database, pending: PendingCustomerReset): Promise<void> {
  await db.compareAndUpdate<CustomerProfile>(COLLECTION, pending.customerId, { emailVerificationHash: pending.tokenHash }, {
    ...clearVerification, updatedAt: new Date().toISOString(),
  });
}

/** The hash, original email, password, version, status and expiry all remain
 * part of the atomic predicate. The unique registered-email constraint also
 * protects the target against another signup between issue and consume. */
export async function consumeCustomerEmailVerificationInDatabase(db: Database, token: string, now = new Date()): Promise<CustomerProfile | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = digest(token);
  const matches = await db.list<CustomerProfile>(COLLECTION, { where: { emailVerificationHash: tokenHash } });
  if (matches.length !== 1) return null;
  const profile = matches[0];
  const target = profile.emailVerificationTarget;
  const expires = Date.parse(profile.emailVerificationExpiresAt ?? "");
  if (profile.status !== "active" || profile.staffAdminId || !profile.passwordHash ||
      profile.emailVerificationFrom !== profile.email || typeof target !== "string" || target !== target.trim().toLowerCase() ||
      target.length > 254 || !EMAIL_RE.test(target) || !Number.isFinite(expires) || expires <= now.getTime()) return null;
  const change = target !== profile.email;
  if (change && profile.googleSubjectHash) return null;
  try {
    return await db.compareAndUpdate<CustomerProfile>(COLLECTION, profile.id, {
      emailVerificationHash: tokenHash, emailVerificationFrom: profile.email, emailVerificationTarget: target,
      emailVerificationExpiresAt: profile.emailVerificationExpiresAt, email: profile.email, status: "active",
      staffAdminId: profile.staffAdminId, passwordHash: profile.passwordHash, sessionVersion: profile.sessionVersion,
      // A Google link racing this proof must win OR the email change must win,
      // never both with mismatched identities.
      googleSubjectHash: profile.googleSubjectHash, googleAuthVersion: profile.googleAuthVersion, googleLinkVersion: profile.googleLinkVersion,
    }, {
      email: target, emailVerified: true, ...clearVerification, ...clearReset,
      ...(change ? { sessionVersion: newCustomerSessionVersion() } : {}), updatedAt: now.toISOString(),
    }, { field: "emailVerificationExpiresAt", after: now.toISOString() });
  } catch (error) {
    // Translate only a confirmed registered-identity collision; never hide DB
    // failures or automatically attach/merge another account or a guest row.
    const rows = await db.list<CustomerProfile>(COLLECTION);
    if (rows.some((row) => row.id !== profile.id && !row.staffAdminId && typeof row.email === "string" &&
      row.email.trim().toLowerCase() === target && Boolean(row.passwordHash || row.googleSubjectHash))) return null;
    throw error;
  }
}

/** Requires the caller to have verified the snapshot's current password. A
 * concurrent password change, reset, block or session revocation makes it fail. */
export async function changeCustomerPasswordInDatabase(db: Database, profile: CustomerProfile, passwordHash: string): Promise<CustomerProfile | null> {
  if (!profile.passwordHash || profile.staffAdminId || profile.status !== "active" || !passwordHash) return null;
  return db.compareAndUpdate<CustomerProfile>(COLLECTION, profile.id, {
    passwordHash: profile.passwordHash, status: "active", staffAdminId: profile.staffAdminId,
    sessionVersion: profile.sessionVersion,
  }, {
    passwordHash, sessionVersion: newCustomerSessionVersion(),
    ...clearReset, ...clearVerification, updatedAt: new Date().toISOString(),
  });
}

/** Profile contact fields cannot change the login identity. Use the exact
 * session-checked snapshot so an in-flight revoked account cannot write. */
export async function updateCustomerContactInDatabase(
  db: Database, profile: CustomerProfile,
  patch: Pick<CustomerProfile, "firstName" | "lastName" | "name" | "phone" | "gender" | "marketingOptIn">,
): Promise<CustomerProfile | null> {
  if (profile.status !== "active") return null;
  return db.compareAndUpdate<CustomerProfile>(COLLECTION, profile.id, {
    email: profile.email, status: "active", staffAdminId: profile.staffAdminId, sessionVersion: profile.sessionVersion,
  }, { ...patch, updatedAt: new Date().toISOString() });
}

/** Used only by permission-checked staff session revocation. CAS is retried
 * rather than overwriting a concurrently rotated password/session version. */
export async function revokeCustomerSessionsInDatabase(db: Database, customerId: string): Promise<number> {
  let revokedVersion: string | null | undefined;
  let rotated = false;
  for (let i = 0; i < 4; i++) {
    const profile = await db.get<CustomerProfile>(COLLECTION, customerId);
    if (!profile) return 0;
    const version = newCustomerSessionVersion();
    const updated = await db.compareAndUpdate<CustomerProfile>(COLLECTION, customerId, { sessionVersion: profile.sessionVersion }, {
      sessionVersion: version, ...clearReset, ...clearVerification, updatedAt: new Date().toISOString(),
    });
    if (updated) { revokedVersion = profile.sessionVersion; rotated = true; break; }
  }
  if (!rotated) throw new Error("Customer credentials changed; refresh before revoking sessions.");
  const sessions = await db.list<{ id: string; customerId: string; sessionVersion?: string | null }>("customer_sessions", { where: { customerId } });
  const stale = sessions.filter((session) => sameSessionVersion(revokedVersion, session.sessionVersion));
  // Delete only the version actually revoked, never sessions created after a
  // later rotation. A stale login inserted after this scan is still invalid.
  for (const row of stale) await db.remove("customer_sessions", row.id);
  return stale.length;
}

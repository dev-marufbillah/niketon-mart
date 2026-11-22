import "server-only";

import { createHash } from "node:crypto";
import { ensureDatabase } from "@/lib/db";
import type { Database, Row } from "@/lib/db/types";
import type { Customer } from "@/lib/repositories/customers";
import type { SavedAddress } from "@/lib/checkout/view-types";
import { sameSessionVersion } from "@/lib/auth/session-version";
import { googleSessionMatches } from "@/lib/auth/customer-session-guard";

/**
 * Customer accounts
 * -----------------
 * The `customers` collection already existed: it is created from orders and
 * managed in Admin → Customers. This adds the *account* half of the same record —
 * a password, a login timestamp and a few profile fields — instead of creating a
 * second "users" table. An unverified signup is NEVER attached to a guest row
 * merely because it claims the same email; guest history remains separate.
 *
 * Addresses live in `customer_addresses` (one row per address) because the
 * checkout needs to list, edit and default them without rewriting a blob.
 */

export type CustomerProfile = Customer & {
  firstName?: string;
  lastName?: string;
  gender?: string;
  avatar?: string;
  /** scrypt hash — never leaves the server, never rendered. */
  passwordHash?: string;
  /** A separate shopper profile owned by this verified staff id, never by email. */
  staffAdminId?: string;
  /** Hash of Google's immutable subject; no Google tokens are stored. */
  googleSubjectHash?: string | null;
  /** Rotated on Google link/unlink, to invalidate previously issued Google sessions. */
  googleAuthVersion?: string | null;
  /** Rotated on connect/disconnect to invalidate older in-flight link flows. */
  googleLinkVersion?: string | null;
  /** Rotated on credential changes and admin session revocation. Legacy sessions use an empty version. */
  sessionVersion?: string | null;
  /** Only a digest and expiry of an email reset link are stored; never the token. */
  passwordResetHash?: string | null;
  passwordResetEmail?: string | null;
  passwordResetExpiresAt?: string | null;
  /** Password-reauthenticated mailbox verification/change; only a hash is stored. */
  emailVerificationHash?: string | null;
  emailVerificationFrom?: string | null;
  emailVerificationTarget?: string | null;
  emailVerificationExpiresAt?: string | null;
  emailVerified?: boolean;
  lastLoginAt?: string;
  /** Payment method id the shopper prefers; preselected at checkout. */
  defaultPaymentMethodId?: string;
  marketingOptIn?: boolean;
};

export const ACCOUNT_COLLECTION = "customers";
export const ADDRESS_COLLECTION = "customer_addresses";
export const SESSION_COLLECTION = "customer_sessions";

export type CustomerAddress = Row & {
  customerId: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company?: string;
  address: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  areaId: string;
  /** Addresses can serve either purpose; a customer may mark one of each. */
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: string;
  updatedAt: string;
};

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ read -- */

export async function getProfile(id: string): Promise<CustomerProfile | null> {
  const db = await ensureDatabase();
  return db.get<CustomerProfile>(ACCOUNT_COLLECTION, id);
}

export async function findProfileByEmailInDatabase(db: Database, email: string): Promise<CustomerProfile | null> {
  const normalised = email.trim().toLowerCase();
  const rows = await db.list<CustomerProfile>(ACCOUNT_COLLECTION);
  // Staff shopper profiles are bound to a verified admin id, not an email.
  // They must never be selected or claimed by a public customer registration.
  const matches = rows.filter((row) => !row.staffAdminId && typeof row.email === "string" && row.email.trim().toLowerCase() === normalised);
  // A guest record and a separately registered account may share an email.
  return matches.find((row) => Boolean(row.passwordHash)) ?? matches.find((row) => Boolean(row.googleSubjectHash)) ?? matches[0] ?? null;
}

export async function findProfileByEmail(email: string): Promise<CustomerProfile | null> {
  return findProfileByEmailInDatabase(await ensureDatabase(), email);
}

/** Stable, non-email identity for the shopper profile of a verified staff user. */
export function staffShopperId(adminId: string): string {
  return `staff_shopper_${createHash("sha256").update(adminId).digest("hex")}`;
}

/** Called only after the staff password has been verified. Never attaches an
 * existing customer account by email. Repeated or concurrent logins reuse the
 * same row; the file driver is atomic only within one process. */
export async function ensureStaffShopper(admin: { id: string; name: string; email: string }): Promise<CustomerProfile> {
  const db = await ensureDatabase();
  const id = staffShopperId(admin.id);
  let profile = await db.get<CustomerProfile>(ACCOUNT_COLLECTION, id);
  if (!profile) {
    const names = admin.name.trim().split(/\s+/).filter(Boolean);
    try {
      profile = await db.insert<CustomerProfile>(ACCOUNT_COLLECTION, {
        id, staffAdminId: admin.id, name: admin.name, firstName: names[0] ?? "", lastName: names.slice(1).join(" "),
        email: admin.email.trim().toLowerCase(), phone: "", address: "", status: "active", notes: "",
        orderCount: 0, totalSpent: 0, emailVerified: false, createdAt: now(), updatedAt: now(),
      });
    } catch (error) {
      profile = await db.get<CustomerProfile>(ACCOUNT_COLLECTION, id);
      if (!profile) throw error;
    }
  }
  if (profile.staffAdminId !== admin.id || profile.passwordHash) throw new Error("Staff shopper identity requires review.");
  return profile;
}

export async function hasAccount(customer: Pick<CustomerProfile, "passwordHash" | "googleSubjectHash">): Promise<boolean> {
  return Boolean(customer.passwordHash || customer.googleSubjectHash);
}

/* ----------------------------------------------------------------- write -- */

/**
 * Registers an account.
 *
 * A guest's email is not proof of ownership. A new registration gets its own
 * customer id even when a guest record has the same email. Historical guest
 * orders can only be linked after a future verified ownership flow.
 */
export type AccountRegistrationInput = { firstName: string; lastName: string; email: string; phone: string; passwordHash: string };
type AccountRegistrationResult = { ok: true; customer: CustomerProfile } | { ok: false; error: string };

/** The caller validates user input and hashes the password before calling. */
export async function createAccountInDatabase(db: Database, input: AccountRegistrationInput): Promise<AccountRegistrationResult> {
  const email = input.email.trim().toLowerCase();
  const duplicate = { ok: false as const, error: "An account already uses this email. Sign in instead." };
  const existing = await findProfileByEmailInDatabase(db, email);
  if (existing?.passwordHash || existing?.googleSubjectHash) return duplicate;
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  try {
    const customer = await db.insert<CustomerProfile>(ACCOUNT_COLLECTION, {
      name, firstName: input.firstName, lastName: input.lastName, email, phone: input.phone,
      address: "", status: "active", notes: "", orderCount: 0, totalSpent: 0,
      passwordHash: input.passwordHash, emailVerified: false, lastLoginAt: now(), createdAt: now(), updatedAt: now(),
    });
    return { ok: true, customer };
  } catch (error) {
    // The unique index/queue resolves concurrent signups. Only translate a
    // confirmed registered-email collision; unrelated storage errors propagate.
    const winner = await findProfileByEmailInDatabase(db, email);
    if (winner?.passwordHash || winner?.googleSubjectHash) return duplicate;
    throw error;
  }
}

export async function createAccount(input: AccountRegistrationInput): Promise<AccountRegistrationResult> {
  return createAccountInDatabase(await ensureDatabase(), input);
}

export async function touchLogin(id: string): Promise<void> {
  const db = await ensureDatabase();
  await db.update(ACCOUNT_COLLECTION, id, { lastLoginAt: now(), updatedAt: now() });
}

export async function setDefaultPaymentMethod(id: string, methodId: string): Promise<void> {
  const db = await ensureDatabase();
  await db.update(ACCOUNT_COLLECTION, id, { defaultPaymentMethodId: methodId, updatedAt: now() });
}

/* -------------------------------------------------------------- addresses -- */

export async function listAddresses(customerId: string): Promise<CustomerAddress[]> {
  const db = await ensureDatabase();
  const rows = await db.list<CustomerAddress>(ADDRESS_COLLECTION);
  return rows
    .filter((row) => row.customerId === customerId)
    .sort((a, b) => Number(b.isDefaultShipping) - Number(a.isDefaultShipping) || a.createdAt.localeCompare(b.createdAt));
}

export async function getAddress(customerId: string, addressId: string): Promise<CustomerAddress | null> {
  const db = await ensureDatabase();
  const row = await db.get<CustomerAddress>(ADDRESS_COLLECTION, addressId);
  // The customer id check is what stops one shopper from reading another's row.
  return row && row.customerId === customerId ? row : null;
}

export type AddressInput = {
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  address: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  areaId: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

export async function createAddress(customerId: string, input: AddressInput): Promise<CustomerAddress> {
  const db = await ensureDatabase();
  const existing = await listAddresses(customerId);
  const makeShippingDefault = input.isDefaultShipping || existing.length === 0;
  const makeBillingDefault = input.isDefaultBilling || existing.length === 0;

  if (makeShippingDefault || makeBillingDefault) {
    for (const row of existing) {
      const patch: Record<string, unknown> = {};
      if (makeShippingDefault && row.isDefaultShipping) patch.isDefaultShipping = false;
      if (makeBillingDefault && row.isDefaultBilling) patch.isDefaultBilling = false;
      if (Object.keys(patch).length) await db.update(ADDRESS_COLLECTION, row.id, patch);
    }
  }

  return db.insert<CustomerAddress>(ADDRESS_COLLECTION, {
    ...input,
    customerId,
    isDefaultShipping: makeShippingDefault,
    isDefaultBilling: makeBillingDefault,
    createdAt: now(),
    updatedAt: now(),
  });
}

export async function updateAddress(
  customerId: string,
  addressId: string,
  patch: Partial<AddressInput>,
): Promise<CustomerAddress | null> {
  const db = await ensureDatabase();
  const existing = await getAddress(customerId, addressId);
  if (!existing) return null;

  if (patch.isDefaultShipping) {
    for (const row of await listAddresses(customerId)) {
      if (row.isDefaultShipping && row.id !== addressId) {
        await db.update(ADDRESS_COLLECTION, row.id, { isDefaultShipping: false });
      }
    }
  }
  if (patch.isDefaultBilling) {
    for (const row of await listAddresses(customerId)) {
      if (row.isDefaultBilling && row.id !== addressId) {
        await db.update(ADDRESS_COLLECTION, row.id, { isDefaultBilling: false });
      }
    }
  }

  return db.update<CustomerAddress>(ADDRESS_COLLECTION, addressId, { ...patch, updatedAt: now() });
}

export async function deleteAddress(customerId: string, addressId: string): Promise<boolean> {
  const db = await ensureDatabase();
  const existing = await getAddress(customerId, addressId);
  if (!existing) return false;
  await db.remove(ADDRESS_COLLECTION, addressId);

  // Never leave a customer with addresses but no default.
  const remaining = await listAddresses(customerId);
  if (remaining.length > 0) {
    if (!remaining.some((row) => row.isDefaultShipping)) {
      await db.update(ADDRESS_COLLECTION, remaining[0].id, { isDefaultShipping: true });
    }
    if (!remaining.some((row) => row.isDefaultBilling)) {
      await db.update(ADDRESS_COLLECTION, remaining[0].id, { isDefaultBilling: true });
    }
  }
  return true;
}

export async function setDefaultAddress(
  customerId: string,
  addressId: string,
  kind: "shipping" | "billing",
): Promise<boolean> {
  const db = await ensureDatabase();
  const existing = await getAddress(customerId, addressId);
  if (!existing) return false;
  for (const row of await listAddresses(customerId)) {
    const field = kind === "shipping" ? "isDefaultShipping" : "isDefaultBilling";
    if (row.id === addressId) {
      await db.update(ADDRESS_COLLECTION, row.id, { [field]: true, updatedAt: now() });
    } else if (row[field]) {
      await db.update(ADDRESS_COLLECTION, row.id, { [field]: false });
    }
  }
  return true;
}

/** Shape the checkout already understands. */
export function toSavedAddress(row: CustomerAddress): SavedAddress {
  return {
    id: row.id,
    label: row.label || `${row.firstName} ${row.lastName}`.trim() || "Saved address",
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    email: row.email,
    company: row.company ?? "",
    address: row.address,
    addressLine2: row.addressLine2 ?? "",
    city: row.city ?? "",
    postalCode: row.postalCode ?? "",
    areaId: row.areaId,
  };
}

export async function defaultShippingAddress(customerId: string): Promise<CustomerAddress | null> {
  const addresses = await listAddresses(customerId);
  return addresses.find((row) => row.isDefaultShipping) ?? addresses[0] ?? null;
}

/* --------------------------------------------------------------- sessions -- */

export type CustomerSessionRow = Row & {
  tokenHash: string;
  customerId: string;
  expiresAt: string;
  createdAt: string;
  userAgent?: string;
  /** Version of the profile actually authenticated, not a later re-read. */
  sessionVersion?: string | null;
  /** Present only for sessions issued after Google sign-in. */
  googleSubjectHash?: string;
  googleAuthVersion?: string;
};

export async function countActiveSessions(customerId: string): Promise<number> {
  const db = await ensureDatabase();
  const [profile, rows] = await Promise.all([
    db.get<CustomerProfile>(ACCOUNT_COLLECTION, customerId), db.list<CustomerSessionRow>(SESSION_COLLECTION, { where: { customerId } }),
  ]);
  if (!profile || profile.status !== "active" || profile.staffAdminId) return 0;
  const timestamp = Date.now();
  return rows.filter((row) => Number.isFinite(Date.parse(row.expiresAt)) && Date.parse(row.expiresAt) > timestamp &&
    sameSessionVersion(profile.sessionVersion, row.sessionVersion) && googleSessionMatches(profile, row)).length;
}

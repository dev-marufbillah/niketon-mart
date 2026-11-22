import "server-only";

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing (scrypt, no external dependency).
 * Format: `scrypt$<salt-hex>$<hash-hex>` — self-describing so the parameters
 * can be upgraded later without breaking stored hashes.
 */

const KEY_LENGTH = 64;

export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !/^[0-9a-f]{32}$/i.test(saltHex ?? "") || !/^[0-9a-f]{128}$/i.test(hashHex ?? "")) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Reject passwords known to have been published with older demo builds. */
export function isBlockedLegacyPassword(password: string): boolean {
  const digest = createHash("sha256").update(password).digest("hex");
  return new Set([
    "be2a33a6e16a740a2b71472edfcfb6a7cf6b9e9b3d3bade4fedc1585c20a4928",
    "95ef913555bdab546aa42f304d8cbbf0d9974b4ee04285580e4fde520ca5a19b",
  ]).has(digest);
}

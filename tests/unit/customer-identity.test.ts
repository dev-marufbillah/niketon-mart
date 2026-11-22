import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Database } from "../../src/lib/db/types";
import type { CustomerProfile } from "../../src/lib/repositories/accounts";
import { findOrCreateGoogleCustomer } from "../../src/lib/auth/google-accounts";

const dir = mkdtempSync(path.join(tmpdir(), "niketon-customer-identities-"));
process.env.CONTENT_STORE_DIR = dir;
let db: Database;
let createAccountInDatabase: typeof import("../../src/lib/repositories/accounts").createAccountInDatabase;
before(async () => {
  // Set the disposable directory BEFORE loading accounts -> db -> file.ts.
  ({ createAccountInDatabase } = await import("../../src/lib/repositories/accounts"));
  const { createFileDatabase } = await import("../../src/lib/db/file");
  db = createFileDatabase();
});
after(async () => { await rm(dir, { recursive: true, force: true }); });
const registration = (email: string) => ({ firstName: "Test", lastName: "Customer", email, phone: "01700000000", passwordHash: "scrypt-test-only" });
const identity = (sub: string, email: string) => ({ subjectHash: createHash("sha256").update(sub).digest("hex"), email, name: "Test Customer", firstName: "Test", lastName: "Customer" });
const guest = (id: string, email: string, extra: Record<string, unknown> = {}) => ({
  id, email, name: "Old guest", phone: "", address: "", status: "active" as const,
  orderCount: 2, totalSpent: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...extra,
});

test("case-variant simultaneous password registrations yield one account and preserve guest/staff rows", async () => {
  await db.insert<CustomerProfile>("customers", guest("old-guest", "Case@Example.test"));
  await db.insert<CustomerProfile>("customers", guest("old-staff-shopper", "case@example.test", { staffAdminId: "staff-1" }));
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => createAccountInDatabase(db, registration(i % 2 ? "CASE@example.test" : "case@example.test"))));
  assert.equal(results.filter((entry) => entry.ok).length, 1);
  assert.equal(results.filter((entry) => !entry.ok).length, 7);
  assert.equal((await db.get<CustomerProfile>("customers", "old-guest"))?.orderCount, 2);
  assert.equal((await db.get<CustomerProfile>("customers", "old-staff-shopper"))?.staffAdminId, "staff-1");
});

test("simultaneous password and Google signup for the same email have one winner without merging", async () => {
  const email = "mixed@example.test";
  const [password, google] = await Promise.all([
    createAccountInDatabase(db, registration(email)), findOrCreateGoogleCustomer(db, identity("mixed-subject", email)),
  ]);
  assert.equal(Number(password.ok) + Number(google.ok), 1);
  const customers = (await db.list<CustomerProfile>("customers")).filter((row) => row.email === email && (row.passwordHash || row.googleSubjectHash));
  assert.equal(customers.length, 1);
  assert(!(customers[0].passwordHash && customers[0].googleSubjectHash));
});

test("different Google subjects cannot register the same email simultaneously", async () => {
  const email = "google-race@example.test";
  const outcomes = await Promise.all([
    findOrCreateGoogleCustomer(db, identity("first-subject", email)),
    findOrCreateGoogleCustomer(db, identity("second-subject", email)),
  ]);
  assert.equal(outcomes.filter((result) => result.ok).length, 1);
  assert.equal((await db.list<CustomerProfile>("customers")).filter((row) => row.email === email && row.googleSubjectHash).length, 1);
});

test("registered email change cannot race into another account; guest email is not an ownership claim", async () => {
  const first = await createAccountInDatabase(db, registration("one@example.test"));
  const second = await createAccountInDatabase(db, registration("two@example.test"));
  assert(first.ok && second.ok);
  await assert.rejects(db.update<CustomerProfile>("customers", second.customer.id, { email: "ONE@example.test" }));
  assert.equal((await db.get<CustomerProfile>("customers", second.customer.id))?.email, "two@example.test");
  await db.insert<CustomerProfile>("customers", guest("guest-same-email", "one@example.test"));
  assert.equal((await db.get<CustomerProfile>("customers", "guest-same-email"))?.orderCount, 2);
});

import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
import type { Database } from "../../src/lib/db/types";
import type { CustomerProfile } from "../../src/lib/repositories/accounts";
import { toAdminCustomerFormData } from "../../src/lib/admin/customer-dto";
import { sameSessionVersion } from "../../src/lib/auth/session-version";
import {
  changeCustomerPasswordInDatabase, consumeCustomerEmailVerificationInDatabase, consumeCustomerResetInDatabase,
  discardCustomerResetInDatabase, issueCustomerEmailVerificationInDatabase, issueCustomerResetInDatabase,
  revokeCustomerSessionsInDatabase, updateCustomerContactInDatabase,
} from "../../src/lib/auth/customer-credentials";
import { sendCustomerVerification } from "../../src/lib/auth/customer-security-mail";
import { linkGoogleCustomer, unlinkGoogleCustomer } from "../../src/lib/auth/google-accounts";

const dir = mkdtempSync(path.join(tmpdir(), "niketon-security-unit-"));
process.env.CONTENT_STORE_DIR = dir;
let db: Database;
let updateCustomerInDatabase: typeof import("../../src/lib/repositories/customers").updateCustomerInDatabase;
before(async () => {
  const { createFileDatabase } = await import("../../src/lib/db/file");
  db = createFileDatabase();
  ({ updateCustomerInDatabase } = await import("../../src/lib/repositories/customers"));
});
after(async () => { await rm(dir, { recursive: true, force: true }); });
const now = new Date("2030-01-01T12:00:00.000Z");
const profile = (id: string, extra: Partial<CustomerProfile> = {}): CustomerProfile => ({
  id, name: "Example Customer", email: `${id}@example.test`, phone: "01700000000", address: "",
  status: "active", orderCount: 0, totalSpent: 0, createdAt: now.toISOString(), updatedAt: now.toISOString(), ...extra,
});
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

// A TypeScript Pick does not strip runtime properties. Assert the serialized
// RSC-bound value has an explicit allowlist even when DB rows contain secrets.
test("admin customer form DTO cannot serialize password, tokens or extra private fields", () => {
  const row = profile("dto", { passwordHash: "password-hash-should-not-reach-browser", sessionVersion: "session-secret",
    passwordResetHash: "reset-digest", emailVerificationHash: "verify-digest", googleSubjectHash: "subject-secret" });
  const dto = toAdminCustomerFormData({ ...row, arbitraryPrivateValue: "private" });
  assert.deepEqual(Object.keys(dto).sort(), ["address", "area", "id", "name", "notes", "phone", "status"]);
  for (const secret of ["password-hash-should-not-reach-browser", "session-secret", "reset-digest", "verify-digest", "subject-secret", "private"]) {
    assert(!JSON.stringify(dto).includes(secret));
  }
});

test("recovery is limited to active, verified password customers; never guest, unverified, Google-only or staff", async () => {
  const allowed = profile("verified", { passwordHash: "hash", emailVerified: true });
  const unverified = profile("unverified", { passwordHash: "hash", emailVerified: false });
  const guest = profile("guest");
  const google = profile("google-only", { googleSubjectHash: "g".repeat(64), emailVerified: true });
  const staff = profile("staff", { staffAdminId: "admin1", passwordHash: "hash", emailVerified: true });
  const blocked = profile("blocked", { status: "blocked", passwordHash: "hash", emailVerified: true });
  for (const row of [allowed, unverified, guest, google, staff, blocked]) await db.insert<CustomerProfile>("customers", row);
  for (const row of [unverified, guest, google, staff, blocked]) assert.equal(await issueCustomerResetInDatabase(db, row.email, now), null);
  const pending = await issueCustomerResetInDatabase(db, allowed.email.toUpperCase(), now);
  assert(pending);
  const saved = (await db.get<CustomerProfile>("customers", allowed.id))!;
  assert.equal(saved.passwordResetHash, digest(pending.token));
  assert(!JSON.stringify(saved).includes(pending.token));
  assert.equal(saved.passwordResetExpiresAt, "2030-01-01T12:30:00.000Z");
});

test("reset is expiring and single-use, rotates sessions atomically, and later stale logins fail", async () => {
  await db.insert<CustomerProfile>("customers", profile("reset", { passwordHash: "old-hash", emailVerified: true }));
  const p = await issueCustomerResetInDatabase(db, "reset@example.test", now);
  assert(p);
  assert.equal(await consumeCustomerResetInDatabase(db, "bad-token", "new", now), null);
  assert.equal(await consumeCustomerResetInDatabase(db, p.token, "new", new Date(now.getTime() + 30 * 60_000)), null);
  const outcomes = await Promise.all(Array.from({ length: 8 }, (_, i) => consumeCustomerResetInDatabase(db, p.token, `new-hash-${i}`, now)));
  assert.equal(outcomes.filter(Boolean).length, 1);
  const current = (await db.get<CustomerProfile>("customers", "reset"))!;
  assert(current.passwordHash?.startsWith("new-hash-"));
  assert.equal(current.passwordResetHash, null);
  assert(!sameSessionVersion(current.sessionVersion, undefined)); // legacy session / late old-password login
  assert(sameSessionVersion(current.sessionVersion, current.sessionVersion));
  assert.equal(await consumeCustomerResetInDatabase(db, p.token, "another", now), null);
});

test("a newer reset link supersedes the old; failed delivery only discards its own token", async () => {
  await db.insert<CustomerProfile>("customers", profile("newer", { passwordHash: "hash", emailVerified: true }));
  const first = await issueCustomerResetInDatabase(db, "newer@example.test", now);
  const second = await issueCustomerResetInDatabase(db, "newer@example.test", now);
  assert(first && second && first.token !== second.token);
  await discardCustomerResetInDatabase(db, first);
  assert.equal(await consumeCustomerResetInDatabase(db, first.token, "old-request", now), null);
  assert(await consumeCustomerResetInDatabase(db, second.token, "new-request", now));
});

test("email proof leaves login unchanged until consumed and is single-use", async () => {
  const customer = profile("verify", { passwordHash: "password-hash", emailVerified: false });
  await db.insert<CustomerProfile>("customers", customer);
  const pending = await issueCustomerEmailVerificationInDatabase(db, customer, customer.email, now);
  assert(pending);
  const before = (await db.get<CustomerProfile>("customers", customer.id))!;
  assert.equal(before.emailVerified, false); assert.equal(before.emailVerificationHash, digest(pending.token));
  assert(!JSON.stringify(before).includes(pending.token));
  assert.equal(await consumeCustomerEmailVerificationInDatabase(db, pending.token, new Date(now.getTime() + 3_600_000)), null);
  const verified = await consumeCustomerEmailVerificationInDatabase(db, pending.token, now);
  assert(verified?.emailVerified); assert.equal(verified.email, customer.email);
  assert(sameSessionVersion(verified.sessionVersion, customer.sessionVersion));
  assert.equal(await consumeCustomerEmailVerificationInDatabase(db, pending.token, now), null);
  assert(await issueCustomerResetInDatabase(db, customer.email, now));
});

test("verified email change invalidates prior sessions and pending reset links", async () => {
  const initial = profile("change", { passwordHash: "old", emailVerified: true, sessionVersion: "version-before" });
  await db.insert<CustomerProfile>("customers", initial);
  const reset = await issueCustomerResetInDatabase(db, initial.email, now);
  const snapshot = (await db.get<CustomerProfile>("customers", initial.id))!;
  const change = await issueCustomerEmailVerificationInDatabase(db, snapshot, "NEW@example.test", now);
  assert(reset && change);
  assert.equal((await db.get<CustomerProfile>("customers", initial.id))?.email, initial.email);
  const changed = await consumeCustomerEmailVerificationInDatabase(db, change.token, now);
  assert(changed); assert.equal(changed.email, "new@example.test"); assert.equal(changed.emailVerified, true);
  assert(!sameSessionVersion(changed.sessionVersion, initial.sessionVersion));
  assert.equal(await consumeCustomerResetInDatabase(db, reset.token, "unauthorized", now), null);
  assert.equal(await issueCustomerResetInDatabase(db, initial.email, now), null);
  assert(await issueCustomerResetInDatabase(db, changed.email, now));
});

test("another registration cannot be overwritten or merged when a pending email change is consumed", async () => {
  const first = profile("email-race", { passwordHash: "hash", emailVerified: true });
  await db.insert<CustomerProfile>("customers", first);
  const pending = await issueCustomerEmailVerificationInDatabase(db, first, "race-target@example.test", now);
  assert(pending);
  const other = profile("other-account", { email: "race-target@example.test", passwordHash: "other-hash", emailVerified: true });
  await db.insert<CustomerProfile>("customers", other);
  assert.equal(await consumeCustomerEmailVerificationInDatabase(db, pending.token, now), null);
  assert.equal((await db.get<CustomerProfile>("customers", first.id))?.email, first.email);
  assert.equal((await db.get<CustomerProfile>("customers", other.id))?.passwordHash, "other-hash");
});

test("email change cannot retain a Google link or race with a new link", async () => {
  const initial = profile("email-google-race", { passwordHash: "hash", emailVerified: true });
  await db.insert<CustomerProfile>("customers", initial);
  const pending = await issueCustomerEmailVerificationInDatabase(db, initial, "google-new@example.test", now);
  assert(pending);
  const identity = { subjectHash: digest("google-race-subject"), email: initial.email,
    name: initial.name, firstName: "Example", lastName: "Customer" };
  const [changed, linked] = await Promise.all([
    consumeCustomerEmailVerificationInDatabase(db, pending.token, now),
    linkGoogleCustomer(db, initial.id, "hash", identity, initial.googleLinkVersion, initial.sessionVersion),
  ]);
  assert.equal(Number(Boolean(changed)) + Number(linked.ok), 1);
  const current = (await db.get<CustomerProfile>("customers", initial.id))!;
  if (linked.ok) {
    assert.equal(current.email, initial.email);
    assert(current.googleSubjectHash);
    assert.equal(await issueCustomerEmailVerificationInDatabase(db, current, "google-new@example.test", now), null);
    assert(await issueCustomerEmailVerificationInDatabase(db, current, current.email, now));
    const disconnected = await unlinkGoogleCustomer(db, current);
    assert(disconnected);
    assert(await issueCustomerEmailVerificationInDatabase(db, disconnected, "google-new@example.test", now));
  } else {
    assert.equal(current.email, "google-new@example.test");
    assert(!current.googleSubjectHash);
  }
});

test("password reset versus a current-password change has only one winner", async () => {
  const initial = profile("pw-race", { passwordHash: "old", emailVerified: true, sessionVersion: "v-old" });
  await db.insert<CustomerProfile>("customers", initial);
  const pending = await issueCustomerResetInDatabase(db, initial.email, now);
  assert(pending);
  const snapshot = (await db.get<CustomerProfile>("customers", initial.id))!;
  const results = await Promise.all([
    consumeCustomerResetInDatabase(db, pending.token, "reset-hash", now),
    changeCustomerPasswordInDatabase(db, snapshot, "change-hash"),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  const final = (await db.get<CustomerProfile>("customers", initial.id))!;
  assert(["reset-hash", "change-hash"].includes(final.passwordHash!));
  assert(!sameSessionVersion(final.sessionVersion, snapshot.sessionVersion));
});

test("admin block/unblock and session revocation invalidate pending links and in-flight writes", async () => {
  const initial = profile("suspend", { passwordHash: "hash", emailVerified: true });
  await db.insert<CustomerProfile>("customers", initial);
  const reset = await issueCustomerResetInDatabase(db, initial.email, now); assert(reset);
  const snapshot = (await db.get<CustomerProfile>("customers", initial.id))!;
  const verify = await issueCustomerEmailVerificationInDatabase(db, snapshot, "target-suspend@example.test", now); assert(verify);
  await updateCustomerInDatabase(db, initial.id, { status: "blocked" });
  await updateCustomerInDatabase(db, initial.id, { status: "active" });
  assert.equal(await consumeCustomerResetInDatabase(db, reset.token, "no", now), null);
  assert.equal(await consumeCustomerEmailVerificationInDatabase(db, verify.token, now), null);
  assert.equal(await updateCustomerContactInDatabase(db, snapshot, { firstName: "Bad", lastName: "Write", name: "Bad Write", phone: "01700000000", gender: "", marketingOptIn: false }), null);
  const beforeRevoke = (await db.get<CustomerProfile>("customers", initial.id))!;
  await db.insert("customer_sessions", { id: "stale-row", customerId: initial.id, sessionVersion: beforeRevoke.sessionVersion });
  await db.insert("customer_sessions", { id: "future-row", customerId: initial.id, sessionVersion: "a-different-later-version" });
  assert.equal(await revokeCustomerSessionsInDatabase(db, initial.id), 1);
  const after = (await db.get<CustomerProfile>("customers", initial.id))!;
  assert(!sameSessionVersion(after.sessionVersion, beforeRevoke.sessionVersion));
  assert.equal(await db.get("customer_sessions", "stale-row"), null);
  assert(await db.get("customer_sessions", "future-row"));
});

test("customer verification uses only loopback mock mail in tests and discards a rejected send", async () => {
  let status = 202;
  const bodies: { to: string[]; subject: string; text: string }[] = [];
  const server = http.createServer((req, res) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => { bodies.push(JSON.parse(data)); res.writeHead(status); res.end("{}"); });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert(address && typeof address !== "string");
  const keys = ["RESEND_API_KEY", "ADMIN_EMAIL_FROM", "CUSTOMER_EMAIL_FROM", "NEXT_PUBLIC_SITE_URL", "ADMIN_MAIL_TEST_URL", "NODE_ENV", "VERCEL"] as const;
  const env = process.env as Record<string, string | undefined>;
  const saved = Object.fromEntries(keys.map((key) => [key, env[key]]));
  Object.assign(process.env, { NODE_ENV: "test", RESEND_API_KEY: "fake-test-key", ADMIN_EMAIL_FROM: "Store <test@example.test>", NEXT_PUBLIC_SITE_URL: "http://localhost:3000", ADMIN_MAIL_TEST_URL: `http://127.0.0.1:${address.port}/emails` });
  delete process.env.VERCEL; delete process.env.CUSTOMER_EMAIL_FROM;
  try {
    const a = profile("mail-ok", { passwordHash: "hash", emailVerified: false });
    await db.insert<CustomerProfile>("customers", a);
    assert.equal(await sendCustomerVerification(db, a, a.email), "accepted");
    assert.equal(bodies.length, 1); assert.deepEqual(bodies[0].to, [a.email]);
    const token = /#token=([a-f0-9]{64})/.exec(bodies[0].text)?.[1]; assert(token);
    const row = (await db.get<CustomerProfile>("customers", a.id))!;
    assert.equal(row.emailVerificationHash, digest(token)); assert(!JSON.stringify(row).includes(token));
    status = 500;
    const b = profile("mail-fail", { passwordHash: "hash", emailVerified: false });
    await db.insert<CustomerProfile>("customers", b);
    assert.equal(await sendCustomerVerification(db, b, b.email), "failed");
    assert.equal((await db.get<CustomerProfile>("customers", b.id))?.emailVerificationHash, null);
  } finally {
    for (const key of keys) saved[key] === undefined ? delete env[key] : env[key] = saved[key];
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

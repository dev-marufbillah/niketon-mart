import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { OAuth2Client } from "google-auth-library";
import { getGoogleConfig, verifyGoogleIdToken, type VerifiedGoogleIdentity } from "../../src/lib/auth/google";
import { equalSecret, googleCustomerTarget, googlePasswordStamp, makeGoogleFlow, pkceChallenge, readGoogleFlow, sealGoogleFlow } from "../../src/lib/auth/google-flow";
import { findOrCreateGoogleCustomer, linkGoogleCustomer, unlinkGoogleCustomer } from "../../src/lib/auth/google-accounts";
import { googleSessionMatches } from "../../src/lib/auth/customer-session-guard";
import type { CustomerProfile } from "../../src/lib/repositories/accounts";
import type { Database } from "../../src/lib/db/types";

const secret = "random-test-only-cookie-key-32-characters-or-more";
const env = { GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "test-client-secret", GOOGLE_OAUTH_COOKIE_SECRET: secret, GOOGLE_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback" };

test("Google config requires private credentials, strong-length secret and a fixed safe callback", () => {
  assert(getGoogleConfig(env));
  assert.equal(getGoogleConfig({ ...env, GOOGLE_CLIENT_SECRET: "" }), null);
  assert.equal(getGoogleConfig({ ...env, GOOGLE_OAUTH_COOKIE_SECRET: "short" }), null);
  for (const url of ["http://evil.invalid/api/auth/google/callback", "https://evil.invalid/api/auth/google/callback?x=1", "https://user:pass@site.test/api/auth/google/callback", "https://site.test/another", "javascript:alert(1)"]) {
    assert.equal(getGoogleConfig({ ...env, GOOGLE_REDIRECT_URI: url }), null, url);
  }
  assert(getGoogleConfig({ ...env, GOOGLE_REDIRECT_URI: "https://shop.example/api/auth/google/callback" }));
});

test("Google flow uses distinct state, nonce, PKCE, authenticated short-lived cookies and safe destinations", () => {
  const time = 1_000_000;
  const flow = makeGoogleFlow({ next: "/cart" }, time);
  assert.notEqual(flow.state, flow.nonce); assert.notEqual(flow.state, flow.verifier);
  assert.equal(pkceChallenge(flow.verifier), createHash("sha256").update(flow.verifier).digest("base64url"));
  const sealed = sealGoogleFlow(flow, secret);
  assert.deepEqual(readGoogleFlow(sealed, secret, time + 100), flow);
  assert.equal(readGoogleFlow(`${sealed.slice(0, -2)}zz`, secret, time + 100), null);
  assert.equal(readGoogleFlow(sealed, "wrong-secret-wrong-secret-wrong-secret", time + 100), null);
  assert.equal(readGoogleFlow(sealed, secret, time + 600_001), null);
  assert(!equalSecret(flow.state, flow.nonce));
  assert.equal(googleCustomerTarget("/admin/orders"), "/my-account/personal-information");
  assert.equal(googleCustomerTarget("//evil.invalid"), "/my-account/personal-information");
  assert.equal(googleCustomerTarget("/product/fresh-rui-fish"), "/product/fresh-rui-fish");
  assert.notEqual(googlePasswordStamp(secret, "customer", "hash", "old"), googlePasswordStamp(secret, "customer", "hash", "new"));
  assert.notEqual(googlePasswordStamp(secret, "customer", "hash", "old"), googlePasswordStamp(secret, "customer", "changed", "old"));
  assert.notEqual(googlePasswordStamp(secret, "customer", "hash", "old", "before"), googlePasswordStamp(secret, "customer", "hash", "old", "after"));
});

test("Google's library verifies signature, issuer, expiry and audience; nonce and verified email are mandatory", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  Object.defineProperty(client, "getFederatedSignonCertsAsync", { value: async () => ({ certs: { localtest: pem }, format: "PEM" }) });
  const seconds = Math.floor(Date.now() / 1000);
  const nonce = "test-nonce";
  const payload = { iss: "https://accounts.google.com", aud: env.GOOGLE_CLIENT_ID, sub: "subject-123", iat: seconds - 5, exp: seconds + 300, nonce, email: "Customer@Example.com", email_verified: true, name: "Test Customer", given_name: "Test", family_name: "Customer" };
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const jwt = (data: object) => {
    const body = `${b64({ alg: "RS256", typ: "JWT", kid: "localtest" })}.${b64(data)}`;
    return `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`;
  };
  const valid = jwt(payload);
  const identity = await verifyGoogleIdToken(client, valid, env.GOOGLE_CLIENT_ID, nonce);
  assert.equal(identity.email, "customer@example.com");
  assert.equal(identity.subjectHash, createHash("sha256").update("subject-123").digest("hex"));
  const parts = valid.split(".");
  const forged = `${parts[0]}.${parts[1]}.${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
  await assert.rejects(verifyGoogleIdToken(client, forged, env.GOOGLE_CLIENT_ID, nonce));
  for (const bad of [
    { ...payload, aud: "other-client" }, { ...payload, iss: "https://evil.invalid" }, { ...payload, iss: "googleapis.com" },
    { ...payload, exp: seconds - 1000 }, { ...payload, nonce: "wrong" },
    { ...payload, email_verified: false }, { ...payload, azp: "other-client" },
  ]) await assert.rejects(verifyGoogleIdToken(client, jwt(bad), env.GOOGLE_CLIENT_ID, nonce));
});

const dir = mkdtempSync(path.join(tmpdir(), "niketon-google-unit-"));
process.env.CONTENT_STORE_DIR = dir;
let db: Database;
before(async () => { const { createFileDatabase } = await import("../../src/lib/db/file"); db = createFileDatabase(); });
after(async () => { await rm(dir, { recursive: true, force: true }); });
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const identity = (subject: string, email: string): VerifiedGoogleIdentity => ({ subjectHash: hash(subject), email, name: "Test Customer", firstName: "Test", lastName: "Customer" });
const profile = (id: string, email: string, patch: Partial<CustomerProfile> = {}): CustomerProfile => ({
  id, name: "Existing Customer", email, phone: "", address: "", status: "active", orderCount: 0, totalSpent: 0,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...patch,
});

test("Google sign-up is a separate customer, never claims guest/staff data, and respects blocks", async () => {
  const email = "guest@example.test";
  await db.insert<CustomerProfile>("customers", profile("guest-row", email, { orderCount: 3 }));
  await db.insert<CustomerProfile>("customers", profile("staff-shopper", email, { staffAdminId: "admin-id" }));
  const result = await findOrCreateGoogleCustomer(db, identity("guest-subject", email));
  assert(result.ok && result.created);
  assert.notEqual(result.customer.id, "guest-row"); assert(!result.customer.staffAdminId);
  assert.equal((await db.get<CustomerProfile>("customers", "guest-row"))?.orderCount, 3);
  assert.equal(result.customer.emailVerified, true);
  assert(!("accessToken" in result.customer) && !("idToken" in result.customer));
  await db.update<CustomerProfile>("customers", result.customer.id, { status: "blocked" });
  assert.deepEqual(await findOrCreateGoogleCustomer(db, identity("guest-subject", email)), { ok: false, reason: "blocked" });
});

test("existing password account needs explicit same-email link; unlink invalidates old Google sessions and link stamps", async () => {
  const email = "password@example.test", passwordHash = "test-password-hash";
  await db.insert<CustomerProfile>("customers", profile("password-row", email, { passwordHash }));
  const id = identity("password-subject", email);
  assert.deepEqual(await findOrCreateGoogleCustomer(db, id), { ok: false, reason: "existing_account" });
  assert.deepEqual(await linkGoogleCustomer(db, "password-row", passwordHash, { ...id, email: "other@example.test" }), { ok: false, reason: "wrong_email" });
  assert.deepEqual(await linkGoogleCustomer(db, "password-row", "wrong-hash", id), { ok: false, reason: "changed" });
  const linked = await linkGoogleCustomer(db, "password-row", passwordHash, id);
  assert(linked.ok && linked.customer.googleSubjectHash === id.subjectHash);
  const session = { googleSubjectHash: id.subjectHash, googleAuthVersion: linked.customer.googleAuthVersion! };
  assert(googleSessionMatches(linked.customer, session));
  assert(googleSessionMatches(linked.customer, {})); // legacy/password session
  const nextLogin = await findOrCreateGoogleCustomer(db, id);
  assert(nextLogin.ok && nextLogin.customer.id === "password-row");
  assert(await unlinkGoogleCustomer(db, linked.customer));
  const afterUnlink = (await db.get<CustomerProfile>("customers", "password-row"))!;
  assert(!googleSessionMatches(afterUnlink, session));
  assert.notEqual(afterUnlink.googleLinkVersion, linked.customer.googleLinkVersion);
  assert.deepEqual(await linkGoogleCustomer(db, "password-row", passwordHash, id, linked.customer.googleLinkVersion), { ok: false, reason: "changed" });
  assert.notEqual(afterUnlink.sessionVersion, linked.customer.sessionVersion);
  assert.deepEqual(await linkGoogleCustomer(db, "password-row", passwordHash, id, afterUnlink.googleLinkVersion, linked.customer.sessionVersion), { ok: false, reason: "changed" });
  const relink = await linkGoogleCustomer(db, "password-row", passwordHash, id, afterUnlink.googleLinkVersion, afterUnlink.sessionVersion);
  assert(relink.ok && !googleSessionMatches(relink.customer, session));
});

test("simultaneous Google logins create one profile; one subject cannot link to two customers", async () => {
  const newIdentity = identity("concurrent-subject", "concurrent@example.test");
  const entries = await Promise.all(Array.from({ length: 8 }, () => findOrCreateGoogleCustomer(db, newIdentity)));
  assert(entries.every((entry) => entry.ok));
  const ids = entries.filter((entry) => entry.ok).map((entry) => entry.customer.id);
  assert.equal(new Set(ids).size, 1);
  assert.equal(entries.filter((entry) => entry.ok && entry.created).length, 1);
  await db.insert<CustomerProfile>("customers", profile("race-one", "race-one@example.test", { passwordHash: "hash-one" }));
  await db.insert<CustomerProfile>("customers", profile("race-two", "race-two@example.test", { passwordHash: "hash-two" }));
  // The same Google subject can legitimately have changed email between issued tokens.
  const same = identity("race-subject", "race-one@example.test");
  const outcomes = await Promise.all([
    linkGoogleCustomer(db, "race-one", "hash-one", same),
    linkGoogleCustomer(db, "race-two", "hash-two", { ...same, email: "race-two@example.test" }),
  ]);
  assert.equal(outcomes.filter((entry) => entry.ok).length, 1);
  assert.equal((await db.list<CustomerProfile>("customers", { where: { googleSubjectHash: same.subjectHash } })).length, 1);
});

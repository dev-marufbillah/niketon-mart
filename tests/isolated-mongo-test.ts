/**
 * Disposable MongoDB integration probe. Starts its OWN unauthenticated mongod on
 * 127.0.0.1 with a fresh temporary dbpath, never accepts a URI or touches Atlas.
 * Requires a locally installed MongoDB 6.0+ binary (7.x tested).
 * MONGOD_TEST_BINARY=/path/to/mongod npm run test:mongo:local
 * Includes synthetic tests of the held experimental checkout core; no Atlas or
 * live integration is contacted. Public production checkout remains disabled.
 */
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { MongoClient } from "mongodb";
import type { CustomerProfile } from "../src/lib/repositories/accounts";
import { createAccountInDatabase } from "../src/lib/repositories/accounts";
import { findOrCreateGoogleCustomer, linkGoogleCustomer } from "../src/lib/auth/google-accounts";
import { changeCustomerPasswordInDatabase, consumeCustomerEmailVerificationInDatabase, consumeCustomerResetInDatabase, issueCustomerEmailVerificationInDatabase, issueCustomerResetInDatabase } from "../src/lib/auth/customer-credentials";
import { sameSessionVersion } from "../src/lib/auth/session-version";
import { mongoCompareFilter } from "../src/lib/db/mongo-cas";
import type { Database, Row } from "../src/lib/db/types";
import type { CheckoutInput, Order } from "../src/lib/repositories/orders";
import type { Product } from "../src/lib/types/domain";
import type { ProductInput } from "../src/lib/catalogue/types";
import { orderFinancialExpectation } from "../src/lib/weights/finance";
import { paymentReviewExpectation } from "../src/lib/payments/review-snapshot";
import { getResource } from "../src/lib/admin/resources";
import { normalizeForSave, resourceUpdatePatch } from "../src/lib/admin/parse";

async function main() {
const scratch = await fs.mkdtemp(path.join(tmpdir(), "niketon-own-mongo-test-"));
const data = path.join(scratch, "data");
await fs.mkdir(data);
const port = await new Promise<number>((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") return reject(new Error("Cannot reserve a local port"));
    server.close(() => resolve(address.port));
  });
});
const uri = `mongodb://127.0.0.1:${port}/?directConnection=true`;
const databaseName = `niketon_disposable_${randomBytes(8).toString("hex")}`;
const mongod = spawn(process.env.MONGOD_TEST_BINARY || "mongod", [
  "--dbpath", data, "--port", String(port), "--bind_ip", "127.0.0.1", "--replSet", "niketonlocal",
  "--nounixsocket", "--wiredTigerCacheSizeGB", "0.25", "--logpath", path.join(scratch, "mongod.log"),
], { stdio: "ignore" });
let spawnError: Error | undefined;
mongod.once("error", (error) => { spawnError = error; });
let bootstrap: MongoClient | undefined, other: MongoClient | undefined, appClient: MongoClient | undefined;
const report = (label: string) => console.log(`PASS ${label}`);
const register = (email: string) => ({ firstName: "Test", lastName: "Customer", email, phone: "01700000000", passwordHash: "synthetic-hash" });
const identity = (subject: string, email: string) => ({ subjectHash: createHash("sha256").update(subject).digest("hex"), email, name: "Test Customer", firstName: "Test", lastName: "Customer" });

try {
  bootstrap = new MongoClient(uri, { serverSelectionTimeoutMS: 30_000 });
  await bootstrap.connect();
  await bootstrap.db("admin").command({ replSetInitiate: { _id: "niketonlocal", members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
  for (let i = 0; i < 100; i++) {
    const hello = await bootstrap.db("admin").command({ hello: 1 });
    if (hello.isWritablePrimary) break;
    if (i === 99) throw new Error("Local disposable replica set did not become primary.");
    await delay(200);
  }
  const raw = bootstrap.db(databaseName);
  // Ignore any caller-provided Atlas URI/DB. createMongoDatabase is only allowed
  // to see the fresh local instance and its random database name.
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = databaseName;
  delete process.env.NIKETON_PREPARE_TRANSACTION_INDEXES;
  const { createMongoDatabase, getMongo } = await import("../src/lib/db/mongo");

  // Exercise the linked-main incompatibility tripwire in a separate disposable
  // DB. Confirm that neither orders/products nor identity/index metadata are
  // touched on rejection; production data is never used in this test.
  const { assertMongoApplicationCompatibility } = await import("../src/lib/db/mongo-compatibility");
  const foreign = bootstrap.db(`${databaseName}_foreign`);
  const foreignProducts = foreign.collection("products");
  const foreignOrders = foreign.collection("orders");
  await foreignProducts.insertOne({ slug: "legacy-product", price: 123, stock: 4 });
  await foreignOrders.insertOne({ number: "LEGACY-ORDER", userId: "legacy-user", total: 123 });
  const beforeProduct = await foreignProducts.findOne({ slug: "legacy-product" });
  const beforeOrder = await foreignOrders.findOne({ number: "LEGACY-ORDER" });
  const beforeCollections = (await foreign.listCollections({}, { nameOnly: true }).toArray()).map((v) => v.name).sort();
  const beforeIndexes = await foreignProducts.indexes();
  await assert.rejects(assertMongoApplicationCompatibility(foreign), /incompatible.*identity format/i);
  assert.deepEqual(await foreignProducts.findOne({ slug: "legacy-product" }), beforeProduct);
  assert.deepEqual(await foreignOrders.findOne({ number: "LEGACY-ORDER" }), beforeOrder);
  assert.deepEqual((await foreign.listCollections({}, { nameOnly: true }).toArray()).map((v) => v.name).sort(), beforeCollections);
  assert.deepEqual(await foreignProducts.indexes(), beforeIndexes);
  await foreignProducts.deleteMany({});
  await foreignOrders.deleteMany({});
  await foreign.collection("users").insertOne({ synthetic: true });
  await assert.rejects(assertMongoApplicationCompatibility(foreign), /different store\/authentication system/i);
  assert.equal(await foreign.collection("users").countDocuments(), 1);
  await foreign.collection("users").deleteMany({});
  await foreignProducts.insertOne({ id: ["array-not-a-string"], slug: "invalid-identity" });
  await assert.rejects(assertMongoApplicationCompatibility(foreign), /incompatible.*identity format/i);
  await foreignProducts.deleteMany({});
  await foreignProducts.insertOne({ id: "valid-probe", slug: "valid-probe" });
  await assertMongoApplicationCompatibility(foreign);
  // Verify the real initialization entry point invokes the tripwire BEFORE any
  // index creation, not just that the helper can detect a foreign document.
  await raw.collection("users").insertOne({ synthetic: true });
  const collectionsBeforeInit = (await raw.listCollections({}, { nameOnly: true }).toArray()).map((v) => v.name).sort();
  const usersBeforeInit = await raw.collection("users").findOne({ synthetic: true });
  await assert.rejects(createMongoDatabase(), /different store\/authentication system/i);
  assert.deepEqual((await raw.listCollections({}, { nameOnly: true }).toArray()).map((v) => v.name).sort(), collectionsBeforeInit);
  assert.deepEqual(await raw.collection("users").findOne({ synthetic: true }), usersBeforeInit);
  assert(!(await raw.listCollections({ name: "admin_users" }).hasNext()), "initialization must not create an admin collection or index");
  await raw.collection("users").deleteMany({});
  report("foreign main-style data is rejected read-only before index creation; native IDs pass only a tripwire");

  await raw.collection("customers").insertMany([
    { _id: "legacy-a" as never, id: "legacy-a", email: "Old@example.test", passwordHash: "one" },
    { _id: "legacy-b" as never, id: "legacy-b", email: "old@example.test", googleSubjectHash: "two" },
  ]);
  await assert.rejects(createMongoDatabase(), /indexes could not be created/i);
  assert.equal(await raw.collection("customers").countDocuments(), 2, "Never auto-merge legacy duplicates");
  assert.equal((await raw.collection("customers").findOne({ id: "legacy-a" }))?.email, "Old@example.test");
  await raw.collection("customers").deleteMany({ id: { $in: ["legacy-a", "legacy-b"] } });
  await raw.collection("customers").insertOne({ _id: "legacy-invalid" as never, id: "legacy-invalid", email: " old@example.test ", passwordHash: "one" });
  await assert.rejects(createMongoDatabase(), /needs backup and review/i);
  assert.equal((await raw.collection("customers").findOne({ id: "legacy-invalid" }))?.email, " old@example.test ");
  await raw.collection("customers").deleteOne({ id: "legacy-invalid" });
  report("legacy case duplicates and untrimmed identities fail closed without data repair or merge");
  await raw.collection("categories").insertMany([
    { _id: "legacy-feature-a" as never, id: "legacy-feature-a", showInPrimaryNavigation: true },
    { _id: "legacy-feature-b" as never, id: "legacy-feature-b", showInPrimaryNavigation: true },
  ]);
  await assert.rejects(createMongoDatabase(), /primary-navigation category index/i);
  assert.equal(await raw.collection("categories").countDocuments({ showInPrimaryNavigation: true }), 2);
  await raw.collection("categories").deleteMany({ id: { $in: ["legacy-feature-a", "legacy-feature-b"] } });
  report("multiple legacy featured flags block index creation without changing categories");
  await raw.collection("orders").insertMany([
    { _id: "legacy-order-a" as never, id: "legacy-order-a", number: "LEGACY-123" },
    { _id: "legacy-order-b" as never, id: "legacy-order-b", number: "LEGACY-123" },
  ]);
  const defaultDb = await createMongoDatabase();
  assert(defaultDb && !defaultDb.orderTransactionIndexesReady);
  assert(!(await raw.collection("orders").indexes()).some((index) => index.name === "order_number_unique"));
  assert.equal(await raw.collection("orders").countDocuments({ number: "LEGACY-123" }), 2);
  report("held checkout does not create new order indexes by default");
  process.env.NIKETON_PREPARE_TRANSACTION_INDEXES = "1";
  await assert.rejects(createMongoDatabase(), /order indexes could not be created/i);
  assert.equal(await raw.collection("orders").countDocuments({ number: "LEGACY-123" }), 2);
  await raw.collection("orders").deleteMany({ id: { $in: ["legacy-order-a", "legacy-order-b"] } });
  await raw.collection("orders").insertMany([
    { _id: "legacy-key-a" as never, id: "legacy-key-a", number: "LEGACY-124", customerId: "old", idempotencyKey: "duplicate-key" },
    { _id: "legacy-key-b" as never, id: "legacy-key-b", number: "LEGACY-125", customerId: "old", idempotencyKey: "duplicate-key" },
  ]);
  await assert.rejects(createMongoDatabase(), /order indexes could not be created/i);
  assert.equal(await raw.collection("orders").countDocuments({ idempotencyKey: "duplicate-key" }), 2);
  await raw.collection("orders").deleteMany({ id: { $in: ["legacy-key-a", "legacy-key-b"] } });
  report("legacy duplicate order numbers or customer retry keys block indexes without changing history");

  const initializedDb = await createMongoDatabase();
  assert(initializedDb && initializedDb.driver === "mongo");
  const db: Database = initializedDb;
  appClient = (await getMongo())?.client;
  other = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  await other.connect();
  const second = other.db(databaseName);
  const indexes = await raw.collection("customers").indexes();
  const emailIndex = indexes.find((idx) => idx.name === "customer_registered_email_unique");
  assert(emailIndex?.unique && emailIndex?.collation?.strength === 2 && emailIndex?.partialFilterExpression);
  assert(indexes.find((idx) => idx.name === "customer_google_subject_unique")?.unique);
  report("real MongoDB created case-insensitive partial email and unique Google-subject indexes");
  await raw.collection("categories").insertMany([
    { _id: "feature-a" as never, id: "feature-a", showInPrimaryNavigation: false },
    { _id: "feature-b" as never, id: "feature-b", showInPrimaryNavigation: false },
  ]);
  const featured = await Promise.allSettled([
    db.update("categories", "feature-a", { showInPrimaryNavigation: true }),
    second.collection("categories").updateOne({ id: "feature-b" }, { $set: { showInPrimaryNavigation: true } }),
  ]);
  assert.equal(featured.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(await raw.collection("categories").countDocuments({ showInPrimaryNavigation: true }), 1);
  report("concurrent MongoDB clients cannot feature two navigation categories");

  await raw.collection("customers").insertMany([
    { _id: "guest" as never, id: "guest", email: "mixed@example.test", orderCount: 2 },
    { _id: "staff-shopper" as never, id: "staff-shopper", staffAdminId: "staff", email: "mixed@example.test" },
  ]);
  const competing = await Promise.all(Array.from({ length: 12 }, (_, i) => createAccountInDatabase(db, register(i % 2 ? "MIXED@example.test" : "mixed@example.test"))));
  assert.equal(competing.filter((result) => result.ok).length, 1);
  assert.equal((await raw.collection("customers").findOne({ id: "guest" }))?.orderCount, 2);
  assert.equal((await raw.collection("customers").findOne({ id: "staff-shopper" }))?.staffAdminId, "staff");
  await assert.rejects(second.collection("customers").insertOne({ id: "different-client", email: "MiXeD@example.test", passwordHash: "x" }), (error: unknown) => (error as { code?: number }).code === 11000);
  report("case-variant registration races have one winner across clients; guest/staff records remain separate");

  const email = "cross-provider@example.test";
  const [password, google] = await Promise.all([createAccountInDatabase(db, register(email)), findOrCreateGoogleCustomer(db, identity("cross-provider", email))]);
  assert.equal(Number(password.ok) + Number(google.ok), 1);
  const accounts = (await db.list<CustomerProfile>("customers")).filter((row) => row.email === email && (row.passwordHash || row.googleSubjectHash));
  assert.equal(accounts.length, 1); assert(!(accounts[0].passwordHash && accounts[0].googleSubjectHash));
  const subject = identity("same-google-subject", "subject@example.test");
  const logins = await Promise.all(Array.from({ length: 12 }, () => findOrCreateGoogleCustomer(db, subject)));
  assert(logins.every((result) => result.ok));
  assert.equal(new Set(logins.filter((result) => result.ok).map((result) => result.customer.id)).size, 1);
  assert.equal(logins.filter((result) => result.ok && result.created).length, 1);
  const a = await createAccountInDatabase(db, register("link-a@example.test"));
  const b = await createAccountInDatabase(db, register("link-b@example.test"));
  assert(a.ok && b.ok);
  const linkedSubject = identity("one-link-subject", "link-a@example.test");
  const links = await Promise.all([
    linkGoogleCustomer(db, a.customer.id, a.customer.passwordHash!, linkedSubject),
    linkGoogleCustomer(db, b.customer.id, b.customer.passwordHash!, { ...linkedSubject, email: "link-b@example.test" }),
  ]);
  assert.equal(links.filter((result) => result.ok).length, 1);
  report("Google/password signup and subject/link races retain a single unmerged identity");

  // Make security CAS writes use a second independent MongoClient; reads use
  // the normal application adapter. This is local synthetic data only.
  const otherDb: Database = { ...db,
    async compareAndUpdate<T extends Row>(collection: string, id: string, expected: Partial<T>, patch: Partial<T>, validUntil?: { field: string; after: string }): Promise<T | null> {
      const result = await second.collection(collection).findOneAndUpdate(mongoCompareFilter(id, expected, validUntil), { $set: { ...patch, id } }, { returnDocument: "after" });
      return result as unknown as T | null;
    },
  };
  const recovery = await createAccountInDatabase(db, register("mongo-recovery@example.test"));
  assert(recovery.ok);
  await db.update<CustomerProfile>("customers", recovery.customer.id, { emailVerified: true });
  const recoveryLink = await issueCustomerResetInDatabase(db, recovery.customer.email);
  assert(recoveryLink);
  const resets = await Promise.all(Array.from({ length: 10 }, (_, i) => consumeCustomerResetInDatabase(i % 2 ? db : otherDb, recoveryLink.token, `mongo-hash-${i}`)));
  assert.equal(resets.filter(Boolean).length, 1);
  const resetFinal = (await db.get<CustomerProfile>("customers", recovery.customer.id))!;
  assert(!sameSessionVersion(resetFinal.sessionVersion, recovery.customer.sessionVersion));
  assert.equal(resetFinal.passwordResetHash, null);
  report("customer reset token is single-use across two Mongo clients and rotates old sessions");

  const changeAccount = await createAccountInDatabase(db, register("mongo-change@example.test"));
  assert(changeAccount.ok);
  await db.update<CustomerProfile>("customers", changeAccount.customer.id, { emailVerified: true });
  const pendingReset = await issueCustomerResetInDatabase(db, changeAccount.customer.email);
  const beforeChange = (await db.get<CustomerProfile>("customers", changeAccount.customer.id))!;
  const pendingVerify = await issueCustomerEmailVerificationInDatabase(db, beforeChange, "mongo-changed@example.test");
  assert(pendingReset && pendingVerify);
  const verifies = await Promise.all(Array.from({ length: 10 }, (_, i) => consumeCustomerEmailVerificationInDatabase(i % 2 ? db : otherDb, pendingVerify.token)));
  assert.equal(verifies.filter(Boolean).length, 1);
  const changed = (await db.get<CustomerProfile>("customers", beforeChange.id))!;
  assert.equal(changed.email, "mongo-changed@example.test");
  assert(!sameSessionVersion(changed.sessionVersion, beforeChange.sessionVersion));
  assert.equal(await consumeCustomerResetInDatabase(db, pendingReset.token, "forbidden"), null);
  report("email proof is single-use across Mongo clients and invalidates old-email reset links");

  const googleRace = await createAccountInDatabase(db, register("mongo-email-google@example.test"));
  assert(googleRace.ok);
  const pendingEmail = await issueCustomerEmailVerificationInDatabase(db, googleRace.customer, "mongo-email-google-new@example.test");
  assert(pendingEmail);
  const [emailWinner, linkWinner] = await Promise.all([
    consumeCustomerEmailVerificationInDatabase(db, pendingEmail.token),
    linkGoogleCustomer(otherDb, googleRace.customer.id, googleRace.customer.passwordHash!, identity("mongo-email-google", googleRace.customer.email),
      googleRace.customer.googleLinkVersion, googleRace.customer.sessionVersion),
  ]);
  assert.equal(Number(Boolean(emailWinner)) + Number(linkWinner.ok), 1);
  const raceAccount = (await db.get<CustomerProfile>("customers", googleRace.customer.id))!;
  if (linkWinner.ok) {
    assert.equal(raceAccount.email, googleRace.customer.email);
    assert.equal(await issueCustomerEmailVerificationInDatabase(db, raceAccount, "mongo-email-google-new@example.test"), null);
  } else {
    assert.equal(raceAccount.email, "mongo-email-google-new@example.test");
    assert(!raceAccount.googleSubjectHash);
  }
  report("email change and Google linking cannot both win across Mongo clients");

  const racing = await createAccountInDatabase(db, register("mongo-pw-race@example.test"));
  assert(racing.ok);
  await db.update<CustomerProfile>("customers", racing.customer.id, { emailVerified: true });
  const racingReset = await issueCustomerResetInDatabase(db, racing.customer.email);
  const racingSnapshot = (await db.get<CustomerProfile>("customers", racing.customer.id))!;
  assert(racingReset);
  const raceOutcomes = await Promise.all([
    consumeCustomerResetInDatabase(db, racingReset.token, "reset-winner"),
    changeCustomerPasswordInDatabase(otherDb, racingSnapshot, "change-winner"),
  ]);
  assert.equal(raceOutcomes.filter(Boolean).length, 1);
  assert(!sameSessionVersion((await db.get<CustomerProfile>("customers", racing.customer.id))?.sessionVersion, racingSnapshot.sessionVersion));
  report("reset racing a password change has one Mongo CAS winner");

  await db.insert("cas_probes", { id: "cas", items: [{ product: "x", weight: { grams: 1000, status: "proposed" } }], nullable: null, total: 100, status: "unpaid" });
  const expected = { items: [{ product: "x", weight: { grams: 1000, status: "proposed" } }], nullable: null, missing: undefined, total: 100, status: "unpaid" };
  assert.equal(await db.compareAndUpdate("cas_probes", "cas", { nullable: undefined }, { total: 999 }), null);
  assert.equal(await db.compareAndUpdate("cas_probes", "cas", { missing: null }, { total: 999 }), null);
  assert.equal(await db.compareAndUpdate("cas_probes", "cas", { items: [{ product: "x", weight: { grams: 999, status: "proposed" } }] }, { total: 999 }), null);
  const changes = await Promise.all([
    db.compareAndUpdate("cas_probes", "cas", expected, { status: "paid" }),
    second.collection("cas_probes").findOneAndUpdate(mongoCompareFilter("cas", expected), { $set: { status: "failed" } }, { returnDocument: "after" }),
  ]);
  assert.equal(changes.filter(Boolean).length, 1);
  assert(["paid", "failed"].includes((await db.get("cas_probes", "cas"))?.status as string));
  report("exact nested/array and missing/null Mongo CAS allows one winner across clients");

  await raw.collection("transaction_probes").insertOne({ _id: "stock" as never, amount: 10 });
  const session = bootstrap.startSession();
  try {
    await assert.rejects(session.withTransaction(async () => {
      await raw.collection("transaction_probes").updateOne({ _id: "stock" as never }, { $inc: { amount: -1 } }, { session });
      await raw.collection("transaction_probes").insertOne({ _id: "synthetic-order" as never, amount: 1 }, { session });
      throw new Error("synthetic rollback");
    }), /synthetic rollback/);
    assert.equal((await raw.collection("transaction_probes").findOne({ _id: "stock" as never }))?.amount, 10);
    assert.equal(await raw.collection("transaction_probes").countDocuments({ _id: "synthetic-order" as never }), 0);
    await session.withTransaction(async () => {
      await raw.collection("transaction_probes").updateOne({ _id: "stock" as never }, { $inc: { amount: -1 } }, { session });
      await raw.collection("transaction_probes").insertOne({ _id: "synthetic-order" as never, amount: 1 }, { session });
    });
    assert.equal((await raw.collection("transaction_probes").findOne({ _id: "stock" as never }))?.amount, 9);
    assert.equal(await raw.collection("transaction_probes").countDocuments({ _id: "synthetic-order" as never }), 1);
  } finally { await session.endSession(); }
  report("synthetic replica-set transaction rollback and commit (not application checkout)");

  // Exercise the application's actual database adapter, not just the raw
  // driver. Every operation must share the same transaction session.
  assert(db.withTransaction, "Mongo adapter must expose a transaction runner");
  await db.insert("adapter_probes", { id: "balance", value: 10 });
  await assert.rejects(db.withTransaction(async (tx) => {
    assert.equal(tx.withTransaction, undefined, "nested transactions are not silently supported");
    assert.equal((await tx.get("adapter_probes", "balance"))?.value, 10);
    await tx.update("adapter_probes", "balance", { value: 9 });
    await tx.insert("adapter_probes", { id: "rollback-record", value: 1 });
    assert.equal(await tx.count("adapter_probes"), 2, "transaction reads its own writes");
    throw new Error("adapter rollback");
  }), /adapter rollback/);
  assert.equal((await db.get("adapter_probes", "balance"))?.value, 10);
  assert.equal(await db.get("adapter_probes", "rollback-record"), null);
  const final = await db.withTransaction(async (tx) => {
    await tx.compareAndUpdate("adapter_probes", "balance", { value: 10 }, { value: 11 });
    await tx.insert("adapter_probes", { id: "commit-record", value: 2 });
    return (await tx.get("adapter_probes", "balance"))?.value;
  });
  assert.equal(final, 11);
  assert.equal((await db.get("adapter_probes", "commit-record"))?.value, 2);
  await Promise.all(Array.from({ length: 8 }, () => db.withTransaction!(async (tx) => {
    const current = await tx.get("adapter_probes", "balance");
    assert(current && typeof current.value === "number");
    await tx.update("adapter_probes", "balance", { value: current.value + 1 });
  })));
  assert.equal((await db.get("adapter_probes", "balance"))?.value, 19, "write-conflict retries must not lose updates");
  report("transaction-bound application adapter rolls back, commits and retries concurrent writes");

  const { protectDatabase } = await import("../src/lib/db/protected-database");
  await db.insert("admin_users", { id: "txn-owner", email: "marufsalauddin76@gmail.com", role: "owner", active: true });
  const protectedDb = protectDatabase(db);
  assert(protectedDb.withTransaction);
  await assert.rejects(protectedDb.withTransaction(async (tx) => {
    await tx.update("admin_users", "txn-owner", { active: false });
  }), /protected super admin/i);
  assert.equal((await db.get("admin_users", "txn-owner"))?.active, true);
  report("owner write protections remain active within transaction callbacks");

  // Exercise the ACTUAL transaction checkout core, with synthetic fixtures on
  // this locally spawned replica set only. The production entry remains held.
  const { createOrderTransaction, createOrder, cancelOrderTransaction, updateOrderStatus } = await import("../src/lib/repositories/orders");
  await db.insert("settings", { id: "site", commerce: { currency: "BDT", currencySymbol: "৳", taxRate: 0, freeShippingThreshold: 0,
    defaultDeliveryFee: 0, minOrderValue: 0, codEnabled: true, orderPrefix: "NM" }, checkout: { termsRequired: false } });
  await db.insert("categories", { id: "txn-category", name: "Synthetic category", visible: true });
  await db.insert("products", { id: "txn-product", name: "Synthetic product", slug: "synthetic-product", categoryId: "txn-category",
    categoryLabel: "Synthetic category", image: "/images/category-placeholder.svg", unit: "pc", price: 100, stock: 3,
    soldCount: 0, status: "active", visibility: "visible" });
  await db.insert("delivery_areas", { id: "txn-area", name: "Synthetic area", fee: 0, minOrder: 0, active: true });
  await db.insert("payment_methods", { id: "txn-cod", label: "Cash on delivery", type: "cod", mode: "offline", active: true });
  for (const id of ["txn-shopper-a", "txn-shopper-b"]) await db.insert("customers", {
    id, name: "Synthetic Shopper", email: `${id}@example.test`, phone: "01700000000", address: "Synthetic test street",
    status: "active", orderCount: 0, totalSpent: 0, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await db.insert("orders", { id: "synthetic-old-order", number: "NM-1042" });
  const checkout = (key: string, customerId = "txn-shopper-a"): CheckoutInput => ({
    customerId, idempotencyKey: key, items: [{ productId: "txn-product", quantity: 1 }],
    customer: { name: "Synthetic Shopper", email: `${customerId}@example.test`, phone: "01700000000", address: "Synthetic test street" },
    areaId: "txn-area", paymentMethodId: "txn-cod", expectedTotal: 100, termsAccepted: true,
  });
  const noIndexes = await createOrderTransaction(defaultDb, checkout("no-index-guard-key"));
  assert(!noIndexes.ok && noIndexes.errors.some((error) => /reviewed order indexes/i.test(error)));
  assert.equal(await raw.collection("orders").countDocuments(), 1);
  report("experimental transaction refuses to run without its order indexes");
  const noApprovedTotal = await createOrderTransaction(db, { ...checkout("no-approved-total-key"), expectedTotal: undefined });
  assert(!noApprovedTotal.ok && noApprovedTotal.errors.some((error) => /review the total/i.test(error)));
  const site = await db.get<Row & { commerce: Record<string, unknown> }>("settings", "site");
  assert(site);
  await db.update("settings", "site", { commerce: { ...site.commerce, currency: "USD" } });
  const nonBdt = await createOrderTransaction(db, checkout("non-bdt-settings-key"));
  assert(!nonBdt.ok && nonBdt.errors.some((error) => /currency needs manual review/i.test(error)));
  assert.equal(await raw.collection("orders").countDocuments(), 1);
  await db.update("settings", "site", { commerce: site.commerce });
  report("transaction checkout refuses unapproved totals and non-BDT store settings without changing history");

  const beforeBadMoneyOrders = await raw.collection("orders").countDocuments();
  const beforeBadMoneyLedger = await raw.collection("stock_movements").countDocuments();
  for (const [i, invalidPrice] of [NaN, 0.001, Number.MAX_SAFE_INTEGER].entries()) {
    await db.update("products", "txn-product", { price: invalidPrice });
    const rejected = await createOrderTransaction(db, checkout(`invalid-price-key-${i}`));
    assert(!rejected.ok && rejected.errors.some((error) => /invalid price/i.test(error)));
  }
  await db.update("products", "txn-product", { price: 100, options: [{ name: "Size", values: [{ label: "Invalid", price: Infinity, stock: 3 }] }] });
  const invalidVariant = await createOrderTransaction(db, { ...checkout("invalid-variant-price-key"),
    items: [{ productId: "txn-product", quantity: 1, variantLabel: "Invalid" }] });
  assert(!invalidVariant.ok && invalidVariant.errors.some((error) => /variation price needs store review/i.test(error)));
  await db.update("products", "txn-product", { options: [], preparation: { enabled: true, groups: [
    { id: "cut", name: "Cut", type: "single", required: true, options: [{ id: "bad", label: "Bad", charge: -5 }] },
  ] } });
  const invalidPrep = await createOrderTransaction(db, { ...checkout("invalid-preparation-price-key"),
    items: [{ productId: "txn-product", quantity: 1, preparation: { choices: [{ group: "Cut", label: "Bad" }] } }] });
  assert(!invalidPrep.ok && invalidPrep.errors.some((error) => /charge needs store review/i.test(error)));
  await db.update("products", "txn-product", { preparation: { enabled: false, groups: [] } });
  await db.update("delivery_areas", "txn-area", { fee: -1 });
  const invalidArea = await createOrderTransaction(db, checkout("invalid-area-fee-key"));
  assert(!invalidArea.ok && invalidArea.errors.some((error) => /area.*charges need store review/i.test(error)));
  await db.update("delivery_areas", "txn-area", { fee: 0 });
  await db.update("settings", "site", { commerce: { ...site.commerce, taxRate: 101 } });
  const invalidTax = await createOrderTransaction(db, checkout("invalid-tax-rate-key"));
  assert(!invalidTax.ok && invalidTax.errors.some((error) => /tax settings need store review/i.test(error)));
  await db.update("settings", "site", { commerce: site.commerce });
  await db.update("customers", "txn-shopper-a", { totalSpent: NaN });
  const invalidCustomer = await createOrderTransaction(db, checkout("invalid-customer-aggregate-key"));
  assert(!invalidCustomer.ok && invalidCustomer.errors.some((error) => /account totals need store review/i.test(error)));
  await db.update("customers", "txn-shopper-a", { totalSpent: 0 });
  await db.insert("coupons", { id: "invalid-counter-coupon", code: "BADCOUNT", description: "Invalid synthetic coupon", type: "fixed", value: 10,
    minSubtotal: 0, maxDiscount: 0, usageLimit: 2, usedCount: 1.5, startsAt: "", endsAt: "", active: true, channels: [] });
  const invalidCoupon = await createOrderTransaction(db, { ...checkout("invalid-coupon-counter-key"), couponCode: "BADCOUNT", expectedTotal: 90 });
  assert(!invalidCoupon.ok && invalidCoupon.errors.some((error) => /coupon needs store review/i.test(error)));
  await db.insert("coupons", { id: "missing-counter-coupon", code: "MISSINGCOUNT", description: "Legacy synthetic coupon", type: "fixed", value: 10,
    minSubtotal: 0, maxDiscount: 0, usageLimit: 1, startsAt: "", endsAt: "", active: true, channels: [] });
  const missingCounter = await createOrderTransaction(db, { ...checkout("missing-coupon-counter-key"), couponCode: "MISSINGCOUNT", expectedTotal: 90 });
  assert(!missingCounter.ok && missingCounter.errors.some((error) => /coupon needs store review/i.test(error)));
  const { deleteUnusedCouponInDatabase: refuseUnknownCouponHistory } = await import("../src/lib/repositories/marketing");
  const noDeleteUnknown = await refuseUnknownCouponHistory(db, "missing-counter-coupon");
  assert(!noDeleteUnknown.ok && /history needs manual review/i.test(noDeleteUnknown.error));
  assert.equal((await db.get("coupons", "missing-counter-coupon"))?.usedCount, undefined);
  const newCouponConfig = getResource("coupons");
  assert(newCouponConfig);
  assert.equal(normalizeForSave(newCouponConfig, {}).usedCount, 0);
  assert.equal(normalizeForSave(newCouponConfig, {}, { id: "legacy-coupon" }).usedCount, undefined);
  assert.equal((await db.get("products", "txn-product"))?.stock, 3);
  assert.equal(await raw.collection("orders").countDocuments(), beforeBadMoneyOrders);
  assert.equal(await raw.collection("stock_movements").countDocuments(), beforeBadMoneyLedger);
  assert.equal((await db.get("coupons", "invalid-counter-coupon"))?.usedCount, 1.5);
  report("invalid price, preparation, delivery, tax, coupon and customer counters fail closed before order writes");

  const attempts = await Promise.all(Array.from({ length: 8 }, (_, i) => createOrderTransaction(db, checkout(`oversell-test-key-${i}`))));
  const sold = attempts.filter((result) => result.ok);
  assert.equal(sold.length, 3, "never oversell the three available units");
  assert.equal((await db.get("products", "txn-product"))?.stock, 0);
  assert.equal(await raw.collection("stock_movements").countDocuments({ reason: "order-placed" }), 3);
  assert.equal((await db.get("customers", "txn-shopper-a"))?.orderCount, 3);
  assert.equal((await db.get("customers", "txn-shopper-a"))?.totalSpent, 300);
  assert.equal(new Set(sold.filter((result) => result.ok).map((result) => result.order.number)).size, 3);
  assert(sold.every((result) => result.ok && Number(result.order.number.split("-").at(-1)) > 1042));
  report("actual transactional checkout resists parallel overselling and advances past historical numbers");

  await db.update("products", "txn-product", { stock: 4 });
  const retries = await Promise.all(Array.from({ length: 8 }, () => createOrderTransaction(db, checkout("identical-retry-key"))));
  assert(retries.every((result) => result.ok));
  assert.equal(new Set(retries.filter((result) => result.ok).map((result) => result.order.id)).size, 1);
  assert.equal((await db.get("products", "txn-product"))?.stock, 3);
  assert.equal(await raw.collection("orders").countDocuments({ customerId: "txn-shopper-a", idempotencyKey: "identical-retry-key" }), 1);
  const otherAccount = await createOrderTransaction(db, checkout("identical-retry-key", "txn-shopper-b"));
  assert(otherAccount.ok && otherAccount.order.customerId === "txn-shopper-b");
  assert.notEqual(otherAccount.order.id, retries.find((result) => result.ok)?.order.id);
  const beforeMismatch = {
    stock: await db.get("products", "txn-product"), customer: await db.get("customers", "txn-shopper-a"),
    orders: await raw.collection("orders").countDocuments(), ledger: await raw.collection("stock_movements").countDocuments(),
  };
  const changedInput = checkout("identical-retry-key");
  changedInput.customer.address = "Different synthetic street address";
  const mismatch = await createOrderTransaction(db, changedInput);
  assert(!mismatch.ok && mismatch.code === "IDEMPOTENCY_CONFLICT");
  assert.deepEqual(await db.get("products", "txn-product"), beforeMismatch.stock);
  assert.deepEqual(await db.get("customers", "txn-shopper-a"), beforeMismatch.customer);
  assert.equal(await raw.collection("orders").countDocuments(), beforeMismatch.orders);
  assert.equal(await raw.collection("stock_movements").countDocuments(), beforeMismatch.ledger);
  // Legacy attempts lack a verified request fingerprint: never silently claim
  // an old order corresponds to a changed/unverifiable new submission.
  await db.insert("orders", { id: "legacy-idempotency", number: "NM-99990", customerId: "txn-shopper-a", idempotencyKey: "legacy-unverifiable-key" });
  const legacyRetry = await createOrderTransaction(db, checkout("legacy-unverifiable-key"));
  assert(!legacyRetry.ok && legacyRetry.code === "IDEMPOTENCY_CONFLICT");
  assert.equal(await raw.collection("orders").countDocuments({ idempotencyKey: "legacy-unverifiable-key" }), 1);
  const firstIntent = checkout("competing-intents-key");
  const secondIntent = { ...firstIntent, customer: { ...firstIntent.customer, notes: "A different submitted request" } };
  const conflictingRace = await Promise.all([createOrderTransaction(db, firstIntent), createOrderTransaction(db, secondIntent)]);
  assert.equal(conflictingRace.filter((result) => result.ok).length, 1);
  assert.equal(conflictingRace.filter((result) => !result.ok && result.code === "IDEMPOTENCY_CONFLICT").length, 1);
  assert.equal(await raw.collection("orders").countDocuments({ customerId: "txn-shopper-a", idempotencyKey: "competing-intents-key" }), 1);
  report("retry keys bind to one request and customer, including concurrent changed-intent and unverifiable legacy retries");

  await db.update("products", "txn-product", { stock: 6 });
  await db.insert("coupons", { id: "txn-coupon", code: "SYNTH10", description: "Synthetic coupon", type: "fixed", value: 10,
    minSubtotal: 0, maxDiscount: 0, usageLimit: 2, usedCount: 0, startsAt: "", endsAt: "", active: true, channels: [] });
  const coupons = await Promise.all(Array.from({ length: 5 }, (_, i) => createOrderTransaction(db, {
    ...checkout(`coupon-retry-key-${i}`), couponCode: "SYNTH10", expectedTotal: 90,
  })));
  assert.equal(coupons.filter((result) => result.ok).length, 2);
  assert.equal((await db.get("coupons", "txn-coupon"))?.usedCount, 2);
  assert.equal((await db.get("products", "txn-product"))?.stock, 4);
  report("transactional checkout enforces coupon usage limits under concurrent requests");

  await db.insert("coupons", { id: "coupon-edit-race", code: "RACE10", description: "Old rules", type: "fixed", value: 10,
    minSubtotal: 0, maxDiscount: 0, usageLimit: 10, usedCount: 0, startsAt: "", endsAt: "", active: true, channels: [] });
  const couponConfig = getResource("coupons");
  const staleCoupon = await db.get("coupons", "coupon-edit-race");
  assert(couponConfig && staleCoupon);
  const couponValues = { description: "Updated rules" };
  const couponPatch = resourceUpdatePatch(couponConfig, couponValues, normalizeForSave(couponConfig, couponValues, staleCoupon));
  const [redeemed] = await Promise.all([
    createOrderTransaction(db, { ...checkout("admin-coupon-race-key"), couponCode: "RACE10", expectedTotal: 90 }),
    db.update("coupons", "coupon-edit-race", couponPatch),
  ]);
  assert(redeemed.ok);
  // A delayed save that began before the order must not revert the counter.
  await db.update("coupons", "coupon-edit-race", couponPatch);
  const editedCoupon = await db.get("coupons", "coupon-edit-race");
  assert.equal(editedCoupon?.usedCount, 1); assert.equal(editedCoupon?.description, "Updated rules");
  report("coupon admin rule patches preserve redemption counts across checkout and stale saves");
  const { deleteUnusedCouponInDatabase } = await import("../src/lib/repositories/marketing");
  const usedCouponDelete = await deleteUnusedCouponInDatabase(db, "coupon-edit-race");
  assert(!usedCouponDelete.ok && /has been used/i.test(usedCouponDelete.error));
  await db.insert("coupons", { id: "coupon-delete-race", code: "DELRACE10", description: "Synthetic coupon", type: "fixed", value: 10,
    minSubtotal: 0, maxDiscount: 0, usageLimit: 10, usedCount: 0, startsAt: "", endsAt: "", active: true, channels: [] });
  const [couponDeleted, couponRedeemed] = await Promise.all([
    deleteUnusedCouponInDatabase(db, "coupon-delete-race"),
    createOrderTransaction(db, { ...checkout("coupon-delete-race-key"), couponCode: "DELRACE10", expectedTotal: 90 }),
  ]);
  assert.equal(Number(couponDeleted.ok) + Number(couponRedeemed.ok), 1);
  if (couponDeleted.ok) assert.equal(await db.get("coupons", "coupon-delete-race"), null);
  else assert.equal((await db.get("coupons", "coupon-delete-race"))?.usedCount, 1);
  report("used coupons cannot be deleted and deletion cannot race past an order redemption");

  await db.update("products", "txn-product", { stock: 6, options: [{ name: "Size", values: [{ label: "Small", stock: 2, price: 100 }, { label: "Large", stock: 4, price: 100 }] }] });
  const variantAttempts = await Promise.all(Array.from({ length: 6 }, (_, i) => createOrderTransaction(db, {
    ...checkout(`variant-retry-key-${i}`), items: [{ productId: "txn-product", quantity: 1, variantLabel: "Small" }],
  })));
  assert.equal(variantAttempts.filter((result) => result.ok).length, 2);
  const variantProduct = await db.get<Row & { options: { values: { label: string; stock: number }[] }[] }>("products", "txn-product");
  assert.equal(variantProduct?.stock, 4);
  assert.equal(variantProduct?.options[0].values.find((value) => value.label === "Small")?.stock, 0);
  assert.equal(variantProduct?.options[0].values.find((value) => value.label === "Large")?.stock, 4);
  const splitVariant = await createOrderTransaction(db, { ...checkout("split-variant-key"), expectedTotal: 200,
    items: [{ productId: "txn-product", quantity: 1, variantLabel: "Small" }, { productId: "txn-product", quantity: 1, variantLabel: "Small" }] });
  assert(!splitVariant.ok);
  const noVariant = await createOrderTransaction(db, checkout("missing-variant-key"));
  assert(!noVariant.ok && noVariant.errors.some((error) => /variation/i.test(error)));
  await db.update("products", "txn-product", { options: [
    { name: "Size", values: [{ label: "Small", stock: 2, price: 100 }, { label: "Small", stock: 4, price: 100 }] },
  ] });
  const ambiguousVariant = await createOrderTransaction(db, { ...checkout("ambiguous-variant-key"),
    items: [{ productId: "txn-product", quantity: 1, variantLabel: "Small" }] });
  assert(!ambiguousVariant.ok && ambiguousVariant.errors.some((error) => /unambiguous/i.test(error)));
  await db.update("products", "txn-product", { options: [
    { name: "Size", values: [{ label: "Small", stock: 2, price: 100 }] },
    { name: "Pack", values: [{ label: "Box", stock: 2, price: 100 }] },
  ] });
  const multiGroup = await createOrderTransaction(db, { ...checkout("multigroup-variant-key"),
    items: [{ productId: "txn-product", quantity: 1, variantLabel: "Small" }] });
  assert(!multiGroup.ok && multiGroup.errors.some((error) => /combination/i.test(error)));
  assert.equal((await db.get("products", "txn-product"))?.stock, 4);
  report("variant stock cannot be oversold; missing, ambiguous and unsupported selections are refused");
  await db.update("products", "txn-product", { options: [] });

  const beforeStock = (await db.get("products", "txn-product"))?.stock;
  const beforeCustomer = await db.get("customers", "txn-shopper-a");
  const beforeCount = await db.count("orders");
  const beforeSequence = (await db.get("counters", "global-order-sequence"))?.value;
  const faultDb: Database = {
    ...db,
    withTransaction<T>(work: (transaction: Database) => Promise<T>) {
      return db.withTransaction!(async (tx) => work({
        ...tx,
        async insert<U extends Row>(name: string, row: Omit<U, "id"> & { id?: string }) {
          if (name === "stock_movements") throw new Error("synthetic ledger failure");
          return tx.insert<U>(name, row);
        },
      }));
    },
  };
  await assert.rejects(createOrderTransaction(faultDb, checkout("failure-injection-key")), /synthetic ledger failure/);
  assert.equal((await db.get("products", "txn-product"))?.stock, beforeStock);
  assert.equal(await db.count("orders"), beforeCount);
  assert.equal((await db.get("counters", "global-order-sequence"))?.value, beforeSequence);
  assert.equal((await db.get("customers", "txn-shopper-a"))?.orderCount, beforeCustomer?.orderCount);
  report("injected ledger failure rolls back order, stock, customer and sequence together");

  // Exercise failure AFTER every write in a two-product/coupon checkout, not
  // just before the first ledger entry. All persisted collections must match.
  await db.insert("products", { id: "rollback-product-b", name: "Synthetic second product", slug: "rollback-product-b",
    categoryId: "txn-category", categoryLabel: "Synthetic category", image: "/images/category-placeholder.svg",
    unit: "pc", price: 100, stock: 4, soldCount: 0, status: "active", visibility: "visible" });
  await db.insert("coupons", { id: "rollback-coupon", code: "ROLLBACK10", description: "Synthetic rollback coupon", type: "fixed", value: 10,
    minSubtotal: 0, maxDiscount: 0, usageLimit: 0, usedCount: 0, startsAt: "", endsAt: "", active: true, channels: [] });
  const rollbackInput: CheckoutInput = { ...checkout("every-write-fault-key"), expectedTotal: 190, couponCode: "ROLLBACK10",
    items: [{ productId: "txn-product", quantity: 1 }, { productId: "rollback-product-b", quantity: 1 }] };
  const stateSnapshot = async () => JSON.stringify(await Promise.all(
    ["orders", "products", "stock_movements", "customers", "coupons", "counters"].map((name) =>
      raw.collection(name).find().sort({ id: 1 }).toArray()),
  ));
  const initialSnapshot = await stateSnapshot();
  function failAfterWrite(failAt: number, trace: string[]): Database {
    return {
      ...db,
      withTransaction<T>(work: (transaction: Database) => Promise<T>) {
        return db.withTransaction!(async (tx) => {
          const mark = (label: string) => {
            trace.push(label);
            if (trace.length === failAt) throw new Error("synthetic after-write failure");
          };
          const observed: Database = {
            ...tx,
            async insert<U extends Row>(name: string, row: Omit<U, "id"> & { id?: string }) {
              const result = await tx.insert<U>(name, row); mark(`insert:${name}`); return result;
            },
            async update<U extends Row>(name: string, id: string, patch: Partial<U>) {
              const result = await tx.update<U>(name, id, patch); mark(`update:${name}`); return result;
            },
          };
          const result = await work(observed);
          if (failAt === 0) throw new Error("synthetic calibration rollback");
          return result;
        });
      },
    };
  }
  const writeTrace: string[] = [];
  await assert.rejects(createOrderTransaction(failAfterWrite(0, writeTrace), rollbackInput), /synthetic calibration rollback/);
  assert(writeTrace.includes("update:counters") && writeTrace.includes("insert:orders") &&
    writeTrace.includes("update:products") && writeTrace.includes("insert:stock_movements") &&
    writeTrace.includes("update:coupons") && writeTrace.includes("update:customers") && writeTrace.includes("update:orders"));
  assert.equal(await stateSnapshot(), initialSnapshot);
  for (let failAt = 1; failAt <= writeTrace.length; failAt++) {
    const trace: string[] = [];
    await assert.rejects(createOrderTransaction(failAfterWrite(failAt, trace), rollbackInput), /synthetic after-write failure/);
    assert.deepEqual(trace, writeTrace.slice(0, failAt));
    assert.equal(await stateSnapshot(), initialSnapshot, `write ${failAt} did not roll back`);
  }
  const lateValidationDb: Database = {
    ...db,
    withTransaction<T>(work: (transaction: Database) => Promise<T>) {
      return db.withTransaction!(async (tx) => {
        let customerReads = 0;
        return work({
          ...tx,
          async get<U extends Row>(name: string, id: string) {
            if (name === "customers" && id === "txn-shopper-a" && ++customerReads === 2) return null;
            return tx.get<U>(name, id);
          },
        });
      });
    },
  };
  const lateRejection = await createOrderTransaction(lateValidationDb, rollbackInput);
  assert(!lateRejection.ok && /account is not available/i.test(lateRejection.errors[0]));
  assert.equal(await stateSnapshot(), initialSnapshot);
  report(`all ${writeTrace.length} checkout write points and late business rejection roll back both products, coupon, customer, order and ledger`);

  const { adjustStockInDatabase } = await import("../src/lib/repositories/inventory");
  await db.insert("products", { id: "stock-race-product", name: "Synthetic stock-race product", slug: "stock-race-product",
    categoryId: "txn-category", categoryLabel: "Synthetic category", image: "/images/category-placeholder.svg",
    unit: "pc", price: 100, stock: 3, soldCount: 0, status: "active", visibility: "visible" });
  const stockCheckout = (key: string): CheckoutInput => ({ ...checkout(key), items: [{ productId: "stock-race-product", quantity: 1 }] });
  const stockRaces = await Promise.all([
    ...Array.from({ length: 6 }, (_, i) => createOrderTransaction(db, stockCheckout(`stock-vs-order-key-${i}`))),
    ...Array.from({ length: 6 }, () => adjustStockInDatabase(db, { productId: "stock-race-product",
      change: { type: "delta", value: 1 }, reason: "restock", actor: "synthetic-admin" })),
  ]);
  const successfulSales = stockRaces.slice(0, 6).filter((result) => result.ok).length;
  assert(stockRaces.slice(6).every((result) => result.ok));
  const raceStock = (await db.get("products", "stock-race-product"))?.stock as number;
  assert.equal(raceStock, 3 + 6 - successfulSales);
  const stockLedger = await raw.collection("stock_movements").find({ productId: "stock-race-product" }).toArray();
  assert.equal(3 + stockLedger.reduce((sum, row) => sum + Number(row.delta), 0), raceStock);
  const oldBalance = raceStock;
  const nextSale = await createOrderTransaction(db, stockCheckout("stale-absolute-order-key"));
  assert(nextSale.ok);
  const staleStockEdit = await adjustStockInDatabase(db, { productId: "stock-race-product", expectedStock: oldBalance,
    change: { type: "absolute", value: 20 }, reason: "admin-adjustment", actor: "synthetic-admin" });
  assert(!staleStockEdit.ok && /stock changed/i.test(staleStockEdit.error));
  assert.equal((await db.get("products", "stock-race-product"))?.stock, oldBalance - 1);
  const beforeFailedStock = await db.get("products", "stock-race-product");
  const ledgerBeforeStockFailure = await raw.collection("stock_movements").countDocuments({ productId: "stock-race-product" });
  const stockFault: Database = {
    ...db,
    withTransaction<T>(work: (transaction: Database) => Promise<T>) {
      return db.withTransaction!(async (tx) => work({
        ...tx,
        async insert<U extends Row>(name: string, row: Omit<U, "id"> & { id?: string }) {
          if (name === "stock_movements") throw new Error("synthetic stock ledger failure");
          return tx.insert<U>(name, row);
        },
      }));
    },
  };
  await assert.rejects(adjustStockInDatabase(stockFault, { productId: "stock-race-product",
    change: { type: "delta", value: 1 }, reason: "restock", actor: "synthetic-admin" }), /synthetic stock ledger failure/);
  assert.deepEqual(await db.get("products", "stock-race-product"), beforeFailedStock);
  assert.equal(await raw.collection("stock_movements").countDocuments({ productId: "stock-race-product" }), ledgerBeforeStockFailure);
  const zeroStock = await adjustStockInDatabase(db, { productId: "stock-race-product", expectedStock: oldBalance - 1,
    change: { type: "absolute", value: 0 }, reason: "admin-adjustment", actor: "synthetic-admin" });
  assert(zeroStock.ok && zeroStock.product.stock === 0);
  report("inventory-form delta/absolute adjustments stay atomic with checkout and ledger, rejecting stale absolute edits");

  const { saveProductInDatabase, updateProductFieldInDatabase, deleteProductInDatabase } = await import("../src/lib/catalogue/repository");
  await db.insert("products", { id: "edit-race-product", name: "Synthetic edit product", slug: "edit-race-product",
    description: "A synthetic product description.", categoryId: "txn-category", categoryLabel: "Synthetic category",
    image: "/images/category-placeholder.svg", unit: "pc", price: 100, stock: 3, soldCount: 0,
    status: "active", visibility: "visible", options: [] });
  const productInput = (product: Product): ProductInput => ({
    id: product.id, inventorySnapshot: { stock: product.stock ?? 0, soldCount: product.soldCount ?? 0, options: product.options ?? [] },
    name: product.name, slug: product.slug, description: product.description || "A synthetic product description.",
    categoryId: product.categoryId, brandId: "", productTypeId: "", image: product.image, imageMode: "contain", unit: "pc",
    price: 100, compareAtPrice: null, stock: product.stock ?? 0, rating: 0, reviewCount: 0, sku: "", status: "active", visibility: "visible",
    featured: false, attributes: [], images: [product.image], options: product.options ?? [], details: {},
    selling: { unit: "pc", minQuantity: 1, step: 1 }, preparation: { enabled: false, groups: [] },
  });
  const editCheckout = (key: string): CheckoutInput => ({ ...checkout(key), items: [{ productId: "edit-race-product", quantity: 1 }] });
  const editBefore = await db.get<Product>("products", "edit-race-product");
  assert(editBefore);
  const oldForm = productInput(editBefore);
  const firstEditSale = await createOrderTransaction(db, editCheckout("stale-product-form-sale"));
  assert(firstEditSale.ok);
  const staleFormResult = await saveProductInDatabase(db, { ...oldForm, name: "Synthetic renamed product" }, "synthetic-admin");
  assert(!staleFormResult.ok && staleFormResult.errors.some((error) => /inventory changed/i.test(error)));
  assert.equal((await db.get<Product>("products", "edit-race-product"))?.stock, 2);
  const freshEdit = await db.get<Product>("products", "edit-race-product");
  assert(freshEdit);
  const updatedForm = { ...productInput(freshEdit), stock: 5 };
  const [saveRace, saleRace] = await Promise.all([
    saveProductInDatabase(db, updatedForm, "synthetic-admin"),
    createOrderTransaction(db, editCheckout("product-form-race-sale")),
  ]);
  assert(saleRace.ok);
  const afterFormRace = await db.get<Product>("products", "edit-race-product");
  assert(afterFormRace);
  assert.equal(afterFormRace.stock, 2 + (saveRace.ok ? 3 : 0) - 1);
  if (!saveRace.ok) assert(saveRace.errors.some((error) => /inventory changed/i.test(error)));
  const [quickFlag, flagSale] = await Promise.all([
    updateProductFieldInDatabase(db, "edit-race-product", { flags: { featured: true } }, "synthetic-admin"),
    createOrderTransaction(db, editCheckout("flag-toggle-race-sale")),
  ]);
  assert(quickFlag.ok && flagSale.ok);
  const afterFlag = await db.get<Product>("products", "edit-race-product");
  assert(afterFlag && afterFlag.flags?.featured);
  assert.equal(afterFlag.stock, afterFormRace.stock! - 1);
  const staleQuickStock = await updateProductFieldInDatabase(db, "edit-race-product", { stock: 10 }, "synthetic-admin", afterFormRace.stock);
  assert(!staleQuickStock.ok && staleQuickStock.errors.some((error) => /stock changed/i.test(error)));
  assert.equal((await db.get<Product>("products", "edit-race-product"))?.stock, afterFlag.stock);
  report("admin product form, quick stock and flag changes do not overwrite concurrently sold stock");

  const beforeProductFailure = await db.get<Product>("products", "edit-race-product");
  assert(beforeProductFailure);
  await assert.rejects(saveProductInDatabase(stockFault, { ...productInput(beforeProductFailure), stock: beforeProductFailure.stock! + 1 },
    "synthetic-admin"), /synthetic stock ledger failure/);
  assert.deepEqual(await db.get<Product>("products", "edit-race-product"), beforeProductFailure);
  const openOrderDelete = await deleteProductInDatabase(db, "edit-race-product", "synthetic-admin");
  assert(!openOrderDelete.ok && openOrderDelete.errors.some((error) => /open order/i.test(error)));
  await db.insert("products", { id: "delete-race-product", name: "Synthetic delete race", slug: "delete-race-product",
    categoryId: "txn-category", categoryLabel: "Synthetic category", image: "/images/category-placeholder.svg",
    unit: "pc", price: 100, stock: 1, soldCount: 0, status: "active", visibility: "visible" });
  const [deleteRace, orderRace] = await Promise.all([
    deleteProductInDatabase(db, "delete-race-product", "synthetic-admin"),
    createOrderTransaction(db, { ...checkout("delete-vs-checkout-key"), items: [{ productId: "delete-race-product", quantity: 1 }] }),
  ]);
  assert.equal(Number(deleteRace.ok) + Number(orderRace.ok), 1);
  if (deleteRace.ok) assert.equal(await db.get("products", "delete-race-product"), null);
  else assert((await db.get("products", "delete-race-product")) && /open order/i.test(deleteRace.errors[0]));
  report("product stock and ledger roll back on failure; deletion cannot win against an open or concurrent order");

  // The owner selected manual review. Current orders lack a proven customer
  // accounting contribution, so all online cancellations must fail closed.
  await db.insert("products", { id: "cancel-product", name: "Synthetic return product", slug: "cancel-product", categoryId: "txn-category",
    categoryLabel: "Synthetic category", image: "/images/category-placeholder.svg", unit: "pc", price: 100, stock: 6,
    soldCount: 0, status: "active", visibility: "visible", options: [{ name: "Size", values: [
      { label: "Single", stock: 6, price: 100 }, { label: "Box", stock: 0, price: 100 },
    ] }] });
  const cancelCheckout = (key: string): CheckoutInput => ({ ...checkout(key),
    items: [{ productId: "cancel-product", quantity: 1, variantLabel: "Single" }] });
  const cancellable = await createOrderTransaction(db, cancelCheckout("cancel-race-key-01"));
  assert(cancellable.ok && cancellable.order.inventoryReservationVersion === 1 && cancellable.order.items[0].variantStockTracked);
  const unauthorized = await cancelOrderTransaction(db, cancellable.order.id, { kind: "customer", customerId: "txn-shopper-b" });
  const missing = await cancelOrderTransaction(db, "synthetic-missing-order", { kind: "customer", customerId: "txn-shopper-b" });
  assert(!unauthorized.ok && !missing.ok && unauthorized.error === missing.error);
  const beforeManualOrder = await db.get("orders", cancellable.order.id);
  const beforeManualProduct = await db.get("products", "cancel-product");
  const beforeManualCustomer = await db.get("customers", "txn-shopper-a");
  const beforeManualLedger = await raw.collection("stock_movements").countDocuments();
  const cancellations = await Promise.all(Array.from({ length: 6 }, () =>
    cancelOrderTransaction(db, cancellable.order.id, { kind: "customer", customerId: "txn-shopper-a" })));
  assert(cancellations.every((result) => !result.ok && /store review/i.test(result.error)));
  const forgedStaff = await cancelOrderTransaction(db, cancellable.order.id, { kind: "staff", staffId: "txn-owner" });
  assert(!forgedStaff.ok && /authenticated, permission-checked/i.test(forgedStaff.error));
  assert.deepEqual(await db.get("orders", cancellable.order.id), beforeManualOrder);
  assert.deepEqual(await db.get("products", "cancel-product"), beforeManualProduct);
  assert.deepEqual(await db.get("customers", "txn-shopper-a"), beforeManualCustomer);
  assert.equal(await raw.collection("stock_movements").countDocuments(), beforeManualLedger);
  const generalCancel = await updateOrderStatus(cancellable.order.id, { status: "cancelled" });
  assert(!generalCancel.ok && /manual review/i.test(generalCancel.error));
  assert.deepEqual(await db.get("orders", cancellable.order.id), beforeManualOrder);
  report("manual customer-accounting hold is read-only under retries; arbitrary staff IDs and general status cannot bypass it");

  await db.insert("coupons", { id: "manual-review-coupon", code: "MANUAL10", description: "Synthetic manual review", type: "fixed", value: 10,
    minSubtotal: 0, maxDiscount: 0, usageLimit: 10, usedCount: 0, startsAt: "", endsAt: "", active: true, channels: [] });
  const couponOrder = await createOrderTransaction(db, { ...cancelCheckout("manual-coupon-review-key"), couponCode: "MANUAL10", expectedTotal: 90 });
  assert(couponOrder.ok);
  const couponSnapshot = await db.get("coupons", "manual-review-coupon");
  const couponOrderSnapshot = await db.get("orders", couponOrder.order.id);
  const couponProductSnapshot = await db.get("products", "cancel-product");
  const couponCustomerSnapshot = await db.get("customers", "txn-shopper-a");
  const couponLedgerCount = await raw.collection("stock_movements").countDocuments();
  const couponCancellation = await cancelOrderTransaction(db, couponOrder.order.id, { kind: "customer", customerId: "txn-shopper-a" });
  assert(!couponCancellation.ok && /coupon order requires store review/i.test(couponCancellation.error));
  assert.deepEqual(await db.get("coupons", "manual-review-coupon"), couponSnapshot);
  assert.deepEqual(await db.get("orders", couponOrder.order.id), couponOrderSnapshot);
  assert.deepEqual(await db.get("products", "cancel-product"), couponProductSnapshot);
  assert.deepEqual(await db.get("customers", "txn-shopper-a"), couponCustomerSnapshot);
  assert.equal(await raw.collection("stock_movements").countDocuments(), couponLedgerCount);
  report("coupon cancellation requires manual review without changing coupon, stock, order, customer or ledger");

  await db.update("orders", cancellable.order.id, { paymentStatus: "paid", payment: { type: "cod", mode: "offline", reference: "synthetic-paid-reference" } });
  const paidBefore = await db.get("orders", cancellable.order.id);
  const paidCancellation = await cancelOrderTransaction(db, cancellable.order.id, { kind: "customer", customerId: "txn-shopper-a" });
  assert(!paidCancellation.ok && /payment needs manual review/i.test(paidCancellation.error));
  assert.deepEqual(await db.get("orders", cancellable.order.id), paidBefore);
  assert.deepEqual(await db.get("products", "cancel-product"), couponProductSnapshot);
  report("paid cancellations remain held and never fabricate a refund");

  // Race the held cancellation with synthetic payment/dispatch field updates.
  // This is NOT an end-to-end payment or real multi-instance action test.
  for (const competingAction of ["payment", "dispatch"] as const) {
    const placed = await createOrderTransaction(db, cancelCheckout(`cancel-${competingAction}-race-key`));
    assert(placed.ok);
    const current: Order | null = await db.get<Order>("orders", placed.order.id);
    assert(current);
    const stockBefore = (await db.get("products", "cancel-product"))?.stock as number;
    const competingPatch: Partial<Order> = competingAction === "payment"
      ? { paymentStatus: "paid", payment: { ...current.payment!, reference: "synthetic-evidence" }, updatedAt: new Date().toISOString() }
      : { status: "out_for_delivery", updatedAt: new Date().toISOString() };
    const [cancelResult, adminResult] = await Promise.all([
      cancelOrderTransaction(db, current.id, { kind: "customer", customerId: "txn-shopper-a" }),
      db.compareAndUpdate<Order>("orders", current.id,
        competingAction === "payment" ? paymentReviewExpectation(current) : orderFinancialExpectation(current), competingPatch),
    ]);
    assert(!cancelResult.ok && adminResult);
    assert.equal((await db.get("products", "cancel-product"))?.stock, stockBefore);
    assert.equal(await raw.collection("stock_movements").countDocuments({ reason: "order-cancelled", reference: current.number }), 0);
  }
  report("manual cancellation hold remains read-only while synthetic payment/dispatch updates race it");

  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  mutableEnv.NODE_ENV = "production";
  try {
    const held = await createOrder(checkout("production-held-key"));
    assert(!held.ok && held.errors.some((error) => /temporarily unavailable/i.test(error)));
    const heldCancellation = await updateOrderStatus("unused-production-test-id", { status: "cancelled" });
    assert(!heldCancellation.ok && /manual review/i.test(heldCancellation.error));
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
  }
  report("production checkout and cancellation holds remain enforced despite local transaction tests");
  console.log("ALL LOCAL MONGODB PROBES PASSED. Atlas and real services were not contacted.");
} catch (error) {
  if (spawnError) console.error("Cannot start local mongod. Install MongoDB 6.0+ or set MONGOD_TEST_BINARY to its path.");
  else console.error(error);
  process.exitCode = 1;
} finally {
  await Promise.all([bootstrap?.close(), other?.close(), appClient?.close()].filter(Boolean));
  if (mongod.exitCode === null && mongod.pid) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { mongod.kill("SIGKILL"); resolve(); }, 5000);
      mongod.once("exit", () => { clearTimeout(timer); resolve(); });
      mongod.kill("SIGTERM");
    });
  }
  await fs.rm(scratch, { recursive: true, force: true });
}
}
void main().catch(() => { console.error("Could not set up the disposable local MongoDB probe."); process.exitCode = 1; });

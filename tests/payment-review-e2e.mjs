/* Destructive synthetic payment-review tests. Marked disposable LOCAL store only. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const origin = new URL(base);
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/") throw new Error("Only a local HTTP test server is allowed.");
if (!process.env.E2E_DATA_DIR || !process.env.E2E_OWNER_PASSWORD) throw new Error("Set the isolated test directory and test owner password.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200);
const handshake = await safety.json();
assert.equal(handshake.isolated, true);
assert.equal(handshake.storeHash, createHash("sha256").update(data).digest("hex"));
const filename = path.join(data, "db.json");
const read = async () => JSON.parse(await fs.readFile(filename, "utf8"));
const mutate = async (fn) => {
  const doc = await read(); fn(doc.collections);
  const temp = `${filename}.synthetic-payment-test`;
  await fs.writeFile(temp, JSON.stringify(doc)); await fs.rename(temp, filename);
};
const getOrder = async (id) => (await read()).collections.orders.find((row) => row.id === id);
const fixture = (id, overrides = {}) => ({
  id, number: id.toUpperCase(), currency: "BDT", channel: "grocery",
  customer: { name: "Synthetic Customer", email: "synthetic@example.invalid", phone: "01700000000", address: "Synthetic test road", area: "Test" },
  items: [{ productId: "synthetic-product", name: "Synthetic Test Item", image: "/images/placeholder.png", unit: "pc", price: 100, quantity: 1, lineTotal: 100 }],
  subtotal: 100, discount: 0, checkoutDiscount: 0, deliveryFee: 0, tax: 0, taxRate: 0, total: 100,
  status: "pending", paymentStatus: "unpaid", paymentMethod: "Cash on delivery", payment: { type: "cod", mode: "offline" },
  timeline: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...overrides,
});
const open = async (page, id) => {
  await page.goto(`${base}/admin/orders/${id}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Verify payment", exact: true }) });
  await section.getByRole("button", { name: "Save payment status" }).waitFor({ timeout: 30_000 });
  return section;
};
const selectPaid = async (section) => { await section.locator('select[name="paymentStatus"]').selectOption("paid"); await section.locator('input[name="reference"]').fill("TEST-CHECKED-REFERENCE"); };
const log = (message) => console.log(`PASS ${message}`);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await context.newPage();
  await page.goto(`${base}/admin/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const login = page.locator("form").filter({ has: page.getByRole("button", { name: "Sign In", exact: true }) });
  await login.locator('input[name="email"]').fill("marufsalauddin76@gmail.com");
  await login.locator('input[name="password"]').fill(process.env.E2E_OWNER_PASSWORD);
  await login.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(/\/admin$/, { timeout: 45_000 });
  // Direct fixture injection is deliberately limited to the verified test-only
  // file store above. Do not inject/modify data in any real store.
  await mutate((collections) => {
    assert.equal(collections.orders?.length ?? 0, 0, "Use a fresh disposable store.");
    collections.orders = [
      fixture("payment-forged"), fixture("payment-stale"), fixture("payment-race"),
      fixture("payment-weight", { items: [{ productId: "weighed", name: "Synthetic Weighed Item", image: "", unit: "kg", price: 100, quantity: 1, lineTotal: 100,
        weight: { unitGrams: 1000, estimatedGrams: 1000, originalLineTotal: 100, actualGrams: 1100, actualLineTotal: 110, status: "proposed" } }] }),
      fixture("payment-refund", { paymentStatus: "paid", payment: { type: "wallet", mode: "manual-transfer", reference: "ORIGINAL-REF", paidAt: "2026-01-01T00:00:00.000Z", verifiedBy: "Test" } }),
      fixture("payment-usd", { currency: "USD" }),
    ];
  });

  let section = await open(page, "payment-forged");
  await selectPaid(section);
  await section.locator('input[name="reviewFingerprint"]').evaluate((input) => { input.value = "0".repeat(64); });
  const capturedRequest = page.waitForRequest((req) => req.method() === "POST" && Boolean(req.headers()["next-action"]), { timeout: 30_000 });
  await section.getByRole("button", { name: "Save payment status" }).click();
  const captured = await capturedRequest;
  await section.getByRole("alert").getByText(/stale or invalid/i).waitFor({ timeout: 30_000 });
  assert.equal((await getOrder("payment-forged")).paymentStatus, "unpaid");
  const anonymous = await browser.newContext();
  const headers = captured.headers();
  const replayHeaders = Object.fromEntries(["next-action", "content-type", "origin", "accept"].filter((key) => headers[key]).map((key) => [key, headers[key]]));
  const denied = await anonymous.request.post(captured.url(), { headers: replayHeaders, data: captured.postDataBuffer() });
  const deniedText = await denied.text();
  assert(!denied.ok() || /sign in again/i.test(deniedText), "anonymous server-action replay must fail authorization");
  assert.equal((await getOrder("payment-forged")).timeline.length, 0);
  await anonymous.close();
  log("forged review fingerprint and anonymous server-action replay are rejected");

  section = await open(page, "payment-stale");
  await selectPaid(section);
  await mutate((collections) => {
    const row = collections.orders.find((item) => item.id === "payment-stale");
    row.total = 110; row.subtotal = 110; row.items[0].price = 110; row.items[0].lineTotal = 110;
    row.updatedAt = "2026-10-01T00:00:00.000Z";
  });
  await section.getByRole("button", { name: "Save payment status" }).click();
  await section.getByRole("alert").getByText(/stale or invalid/i).waitFor({ timeout: 30_000 });
  assert.equal((await getOrder("payment-stale")).paymentStatus, "unpaid");
  assert.equal((await getOrder("payment-stale")).total, 110);
  log("an order changed after the review cannot be marked paid using a stale fingerprint");

  section = await open(page, "payment-weight");
  // Missing legacy order images show a neutral placeholder without modifying
  // the historic order snapshot or sending an empty src to the browser.
  const image = page.locator("li").filter({ hasText: "Synthetic Weighed Item" }).locator("img");
  assert.equal(await image.getAttribute("src"), "/images/category-placeholder.svg");
  assert.equal((await getOrder("payment-weight")).items[0].image, "");
  await selectPaid(section);
  await section.getByRole("button", { name: "Save payment status" }).click();
  await section.getByRole("alert").getByText(/Complete weighing/i).waitFor({ timeout: 30_000 });
  assert.equal((await getOrder("payment-weight")).paymentStatus, "unpaid");
  section = await open(page, "payment-usd"); await selectPaid(section);
  await section.getByRole("button", { name: "Save payment status" }).click();
  await section.getByRole("alert").getByText(/stale or invalid/i).waitFor({ timeout: 30_000 });
  assert.equal((await getOrder("payment-usd")).paymentStatus, "unpaid");
  log("unresolved weights and a non-BDT historical amount block payment verification");

  const otherPage = await context.newPage();
  const first = await open(page, "payment-race"), second = await open(otherPage, "payment-race");
  await selectPaid(first); await second.locator('select[name="paymentStatus"]').selectOption("failed");
  await Promise.all([first.getByRole("button", { name: "Save payment status" }).click(), second.getByRole("button", { name: "Save payment status" }).click()]);
  await Promise.all([first.locator('[role="status"], [role="alert"]').first().waitFor({ timeout: 30_000 }), second.locator('[role="status"], [role="alert"]').first().waitFor({ timeout: 30_000 })]);
  const raced = await getOrder("payment-race");
  assert(["paid", "failed"].includes(raced.paymentStatus));
  assert.equal(raced.timeline.length, 1, "only one concurrent decision may be recorded");
  assert.equal((await first.locator('[role="status"]').count()) + (await second.locator('[role="status"]').count()), 1);
  assert.equal((await first.locator('[role="alert"]').count()) + (await second.locator('[role="alert"]').count()), 1);
  await otherPage.close();
  log("conflicting concurrent decisions have one winner and a single timeline entry");

  section = await open(page, "payment-refund");
  await section.locator('select[name="paymentStatus"]').selectOption("refunded");
  await section.getByRole("button", { name: "Save payment status" }).click();
  await section.getByRole("alert").getByText(/separate reference and a verification note/i).waitFor({ timeout: 30_000 });
  assert.equal((await getOrder("payment-refund")).paymentStatus, "paid");
  await section.locator('input[name="refundReference"]').fill("REFUND-TEST-123");
  await section.locator('input[name="note"]').fill("Synthetic refund manually checked");
  await section.getByRole("button", { name: "Save payment status" }).click();
  await section.getByRole("status").getByText(/marked refunded/i).waitFor({ timeout: 30_000 });
  const refunded = await getOrder("payment-refund");
  assert.equal(refunded.paymentStatus, "refunded");
  assert.equal(refunded.payment.reference, "ORIGINAL-REF");
  assert.equal(refunded.payment.refundReference, "REFUND-TEST-123");
  log("manual refund requires separate evidence and retains the original transaction reference");
  await context.close();
  console.log("ALL SYNTHETIC PAYMENT REVIEW BROWSER CHECKS PASSED. No real payment was made.");
} finally { await browser.close(); }

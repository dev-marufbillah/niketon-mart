/** Synthetic checkout privacy test; only a verified disposable local file store. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const origin = new URL(base);
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/") throw new Error("Only a local test server is permitted.");
if (!process.env.E2E_DATA_DIR) throw new Error("Set the disposable store directory.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200);
const proof = await safety.json();
assert.equal(proof.isolated, true);
assert.equal(proof.storeHash, createHash("sha256").update(data).digest("hex"));

const run = randomBytes(6).toString("hex");
const password = `Synthetic-${randomBytes(18).toString("hex")}9`;
const addressA = `Customer A private street ${run}`;
const legacyStreet = `Old unscoped private street ${run}`;
const legacyAddress = { id: "legacy", label: "Old shared address", firstName: "Legacy", lastName: "Owner", phone: "01700000000", email: "legacy@example.invalid", company: "", address: legacyStreet, addressLine2: "", city: "Dhaka", postalCode: "", areaId: "" };
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  const go = async (url) => {
    await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1200);
  };
  const register = async (email, first) => {
    await go("/my-account/register");
    for (const [name, value] of Object.entries({ firstName: first, lastName: "Shopper", email, phone: "01700000000", password, confirmPassword: password })) {
      await page.locator(`input[name="${name}"]`).first().fill(value);
    }
    await page.locator('input[name="acceptTerms"]').check();
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
    await page.waitForURL(/\/my-account\/personal-information/, { timeout: 30_000 });
  };
  const add = async () => {
    await go("/product/fresh-rui-fish");
    // Ensure hydration before interacting; this selected option costs extra.
    const option = page.getByRole("radio", { name: /Curry cut/ });
    await option.click();
    await option.waitFor({ state: "visible" });
    assert.equal(await option.getAttribute("aria-checked"), "true");
    await page.getByRole("button", { name: "Add to Cart", exact: true }).click();
    await page.getByText("Estimated subtotal", { exact: false }).first().waitFor({ timeout: 20_000 });
  };

  await go("/");
  await page.evaluate((legacy) => {
    sessionStorage.setItem("nm.checkout.v2", JSON.stringify({ address: legacy.address, email: legacy.email, idempotencyKey: "legacy-unscoped-key" }));
    localStorage.setItem("nm.addresses.v1", JSON.stringify([legacy]));
  }, legacyAddress);
  await register(`customer-a-${run}@example.invalid`, "Alice");
  await add();
  await go("/checkout");
  assert.equal(await page.getByText(legacyStreet, { exact: false }).count(), 0);
  assert.notEqual(await page.locator('input[name="address"]').inputValue(), legacyStreet);
  await page.locator('input[name="address"]').fill(addressA);
  await page.locator('input[name="city"]').fill("Dhaka");
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  assert.equal(await page.locator('input[name="address"]').inputValue(), addressA, "same-account checkout draft survives reload");
  console.log("PASS checkout ignores legacy shared addresses and restores only the signed-in customer's own draft");

  await go("/my-account/logout");
  await page.getByRole("button", { name: /Yes, Logout/ }).click();
  await page.waitForURL(/\/my-account\/login\?signedOut=1/, { timeout: 30_000 });
  await register(`customer-b-${run}@example.invalid`, "Bob");
  await add();
  await go("/checkout");
  assert.notEqual(await page.locator('input[name="address"]').inputValue(), addressA, "another account must not see the first account's draft");
  assert.notEqual(await page.locator('input[name="address"]').inputValue(), legacyStreet, "another account must not inherit the old shared draft");
  assert.equal(await page.getByText(legacyStreet, { exact: false }).count(), 0);
  assert.equal(await page.getByText(addressA, { exact: false }).count(), 0);
  const state = await page.evaluate(() => ({ oldDraft: sessionStorage.getItem("nm.checkout.v2"), oldAddresses: localStorage.getItem("nm.addresses.v1") }));
  assert(state.oldDraft?.includes(legacyStreet) && state.oldAddresses?.includes(legacyStreet), "legacy local data is preserved without automatic reassignment");
  assert.deepEqual(errors, []);
  console.log("PASS switching accounts on one browser does not expose another customer's checkout draft or legacy addresses");
  console.log("ALL CHECKOUT PRIVACY BROWSER CHECKS PASSED; synthetic file store only.");
} finally {
  await browser.close();
}

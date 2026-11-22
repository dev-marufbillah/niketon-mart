/** Synthetic browser regression. Mutates ONLY a verified disposable local file store.
 * This does not test Mongo transactions, Atlas, real customers or real services. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const origin = new URL(base);
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/") throw new Error("Only a local test server is permitted.");
if (!process.env.E2E_DATA_DIR || !process.env.E2E_OWNER_PASSWORD) throw new Error("Set the disposable directory and synthetic owner password.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200, "The server did not enable its test-only handshake.");
const proof = await safety.json();
assert.equal(proof.isolated, true);
assert.equal(proof.storeHash, createHash("sha256").update(data).digest("hex"));
const filename = path.join(data, "db.json");
const read = async () => JSON.parse(await fs.readFile(filename, "utf8"));
const mutate = async (fn) => {
  const document = await read();
  fn(document.collections);
  const temporary = `${filename}.inventory-e2e`;
  await fs.writeFile(temporary, JSON.stringify(document));
  await fs.rename(temporary, filename);
};
const product = async (id) => (await read()).collections.products.find((row) => row.id === id);
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const go = async (url) => {
    await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.waitForTimeout(1300); // allow the local Next.js development bundle to hydrate
  };
  await go("/admin/login");
  const login = page.locator("form").filter({ has: page.getByRole("button", { name: "Sign In", exact: true }) });
  await login.locator('input[name="email"]').fill("marufsalauddin76@gmail.com");
  await login.locator('input[name="password"]').fill(process.env.E2E_OWNER_PASSWORD);
  await login.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(/\/admin$/, { timeout: 45_000 });

  await mutate((collections) => {
    assert.equal(collections.orders?.length ?? 0, 0, "Use a fresh disposable store.");
    const category = collections.categories.find((entry) => entry.visible && !entry.parentId);
    assert(category);
    const fixture = (id, name, options = []) => ({ id, slug: id, name, description: "A synthetic product for isolated browser testing.",
      categoryId: category.id, categoryLabel: category.name, image: "/images/category-placeholder.svg", imageMode: "contain",
      images: ["/images/category-placeholder.svg"], unit: "pc", price: 100, stock: 5, soldCount: 0, rating: 0, reviewCount: 0,
      status: "active", visibility: "visible", attributes: [], options, details: {}, selling: { unit: "pc", minQuantity: 1, step: 1 }, flags: {} });
    collections.products.push(fixture("e2e-inventory-product", "Synthetic Inventory Product"));
    collections.products.push(fixture("e2e-choice-product", "Synthetic Variation Product", [
      { name: "Size", values: [{ label: "Single", stock: 5, price: 100 }, { label: "Box", stock: 2, price: 150 }] },
    ]));
    collections.products.push(fixture("e2e-multigroup-product", "Synthetic Combination Product", [
      { name: "Size", values: [{ label: "Small", stock: 5, price: 100 }, { label: "Large", stock: 2, price: 150 }] },
      { name: "Pack", values: [{ label: "Bag", stock: 5 }, { label: "Box", stock: 2 }] },
    ]));
  });

  await go("/admin/catalogue/products/e2e-inventory-product");
  await page.getByLabel("Product name", { exact: true }).fill("Synthetic Inventory Updated");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.waitForURL(/\/admin\/catalogue\/products$/, { timeout: 45_000 });
  assert.equal((await product("e2e-inventory-product")).name, "Synthetic Inventory Updated");
  console.log("PASS admin product form saves an unchanged inventory snapshot");

  await go("/admin/catalogue/products/e2e-inventory-product");
  await page.getByLabel("Product name", { exact: true }).fill("This stale edit must not save");
  await mutate((collections) => { const row = collections.products.find((entry) => entry.id === "e2e-inventory-product"); row.stock = 4; row.soldCount = 1; });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("alert").getByText(/inventory changed since this form/i).waitFor({ timeout: 30_000 });
  assert.equal((await product("e2e-inventory-product")).stock, 4);
  assert.equal((await product("e2e-inventory-product")).name, "Synthetic Inventory Updated");
  console.log("PASS product form rejects a stale inventory snapshot with visible feedback");

  await go("/admin/catalogue/products");
  const quickStock = page.locator('[id="stock-e2e-inventory-product"]');
  await quickStock.focus();
  await mutate((collections) => { const row = collections.products.find((entry) => entry.id === "e2e-inventory-product"); row.stock = 3; row.soldCount = 2; });
  await quickStock.fill("10");
  await quickStock.blur();
  await page.getByText(/stock changed since the form was loaded/i).waitFor({ timeout: 30_000 });
  assert.equal((await product("e2e-inventory-product")).stock, 3);
  await page.waitForFunction(() => document.querySelector('[id="stock-e2e-inventory-product"]')?.value === "3", null, { timeout: 30_000 });
  console.log("PASS quick stock rejects a stale absolute value and refreshes the displayed balance");

  await go("/admin/inventory");
  const adjustment = page.locator("form").filter({ has: page.getByRole("button", { name: "Apply stock change" }) });
  await adjustment.locator('select[name="productId"]').selectOption("e2e-inventory-product");
  await adjustment.locator('select[name="type"]').selectOption("absolute");
  await adjustment.locator('input[name="value"]').fill("10");
  await mutate((collections) => { const row = collections.products.find((entry) => entry.id === "e2e-inventory-product"); row.stock = 2; row.soldCount = 3; });
  await adjustment.getByRole("button", { name: "Apply stock change" }).click();
  await adjustment.getByRole("alert").getByText(/stock changed since the form was loaded/i).waitFor({ timeout: 30_000 });
  assert.equal((await product("e2e-inventory-product")).stock, 2);
  await go("/admin/inventory");
  const fresh = page.locator("form").filter({ has: page.getByRole("button", { name: "Apply stock change" }) });
  await fresh.locator('select[name="productId"]').selectOption("e2e-inventory-product");
  await fresh.locator('select[name="type"]').selectOption("absolute");
  await fresh.locator('input[name="value"]').fill("0");
  await fresh.getByRole("button", { name: "Apply stock change" }).click();
  await fresh.getByRole("status").getByText(/stock updated/i).waitFor({ timeout: 30_000 });
  assert.equal((await product("e2e-inventory-product")).stock, 0);
  const movements = (await read()).collections.stock_movements.filter((row) => row.productId === "e2e-inventory-product");
  assert(movements.some((row) => row.delta === -2 && row.balance === 0));
  console.log("PASS inventory form rejects stale edits and can set zero with a ledger entry");

  await go("/home-grocery?q=Synthetic%20Variation%20Product");
  const card = page.locator('[data-product-id="e2e-choice-product"]').first();
  await card.getByRole("button", { name: /choose options for synthetic variation product/i }).click();
  await page.waitForURL(/\/product\/e2e-choice-product/, { timeout: 30_000 });
  assert.equal(await page.getByRole("group", { name: "Size" }).count(), 1);
  await go("/product/e2e-multigroup-product");
  await page.getByText(/price or options need store review/i).waitFor({ timeout: 30_000 });
  assert.equal(await page.getByRole("button", { name: "Add to Cart", exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Buy Now", exact: true }).isDisabled(), true);
  await go("/admin/catalogue/products/e2e-multigroup-product");
  await page.getByText(/multiple variation groups cannot be ordered/i).waitFor({ timeout: 30_000 });
  console.log("PASS variation quick-add opens choices and unsupported combinations are clearly held");
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log("ALL INVENTORY ADMIN BROWSER CHECKS PASSED; synthetic file store only.");
} finally {
  await browser.close();
}

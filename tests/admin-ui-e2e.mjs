/**
 * Admin UI regression for a marked, disposable local file store ONLY.
 * It creates synthetic staff, slides and orders in that store. Never point it
 * at MongoDB, Atlas, a deployed site or real business records.
 * Run with: node --import tsx tests/admin-ui-e2e.mjs
 */
import assert from "node:assert/strict";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { adminNav } from "../src/lib/admin/navigation.ts";
import { can } from "../src/lib/auth/permissions.ts";

const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const origin = new URL(base);
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("Only a local test server is permitted.");
if (!process.env.E2E_DATA_DIR || !process.env.E2E_OWNER_PASSWORD) throw new Error("Set E2E_DATA_DIR and E2E_OWNER_PASSWORD to disposable test values.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const response = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(response.status, 200, "The server did not enable the test-only safety handshake.");
const proof = await response.json();
assert.equal(proof.isolated, true);
assert.equal(proof.storeHash, createHash("sha256").update(data).digest("hex"));
const filename = path.join(data, "db.json");
const read = async () => JSON.parse(await fs.readFile(filename, "utf8"));
const mutate = async (fn) => {
  const document = await read();
  fn(document.collections);
  const temporary = `${filename}.admin-ui-e2e`;
  await fs.writeFile(temporary, JSON.stringify(document));
  await fs.rename(temporary, filename);
};
const staffPassword = randomBytes(24).toString("hex");
const salt = randomBytes(16);
const passwordHash = `scrypt$${salt.toString("hex")}$${scryptSync(staffPassword, salt, 64).toString("hex")}`;
const staffEmail = "admin-ui-inventory@example.invalid";
const now = new Date();
const syntheticOrder = (id, number, minutesAgo, status, paymentStatus, total) => {
  const at = new Date(now.getTime() - minutesAgo * 60_000).toISOString();
  return {
    id, number, currency: "BDT", channel: "grocery", isDemo: true,
    customer: { name: "Synthetic UI Customer", email: "ui-customer@example.invalid", phone: "00000000000", address: "Synthetic address", area: "Test area" },
    items: [{ productId: "e2e-ui-item", name: "Synthetic UI Item", image: "/images/category-placeholder.svg", unit: "pc", quantity: 1, price: total, lineTotal: total }],
    subtotal: total, discount: 0, deliveryFee: 0, tax: 0, total, status, paymentStatus, paymentMethod: "Cash on delivery",
    timeline: [], createdAt: at, updatedAt: at,
  };
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
const errors = [];
const newPage = async (viewport) => {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page };
};
const go = async (page, url) => {
  await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForTimeout(450); // allow the development client to hydrate
};
const login = async (page, email, password) => {
  await go(page, "/admin/login");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Sign In", exact: true }) });
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(password);
  await form.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(/\/admin$/, { timeout: 45_000 });
  await page.locator("main h1").waitFor({ timeout: 45_000 });
  await page.waitForTimeout(400);
};
const expectedNav = (subject) => adminNav.flatMap((group) => group.items.filter((item) => can(subject, item.permission)).map((item) => ({ href: item.href, label: item.label })));
const actualNav = async (page) => page.getByRole("navigation", { name: "Admin sections" }).locator("a").evaluateAll((links) => links.map((link) => ({ href: link.getAttribute("href"), label: link.children[1]?.textContent?.trim() })) );
const noPageOverflow = async (page, label) => {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(Math.max(dimensions.document, dimensions.body) <= dimensions.width + 1, `${label} overflows the page: ${JSON.stringify(dimensions)}`);
};

try {
  const owner = await newPage({ width: 1440, height: 900 });
  await login(owner.page, "marufsalauddin76@gmail.com", process.env.E2E_OWNER_PASSWORD);
  await mutate((collections) => {
    assert.equal(collections.orders?.length ?? 0, 0, "Use a fresh disposable store without orders.");
    assert(!collections.admin_users.some((row) => row.email === staffEmail), "Use a fresh disposable store without this fixture.");
    assert(collections.hero_slides?.length >= 1);
    collections.admin_users.push({ id: "e2e-admin-ui-inventory", name: "UI Inventory Manager", email: staffEmail, role: "inventory_manager", passwordHash, active: true, mustChangePassword: false, invitationStatus: "accepted", sessionVersion: randomBytes(12).toString("hex"), createdAt: now.toISOString(), updatedAt: now.toISOString() });
    collections.hero_slides.push({ ...collections.hero_slides[0], id: "e2e-admin-ui-slide", title: "Synthetic UI slide", order: 2 });
    collections.orders.push(syntheticOrder("e2e-admin-ui-old", "E2E-OLD", 15, "pending", "unpaid", 100));
    collections.orders.push(syntheticOrder("e2e-admin-ui-new", "E2E-NEW", 5, "delivered", "paid", 200));
  });

  await go(owner.page, "/admin/r/hero_slides/new");
  await owner.page.locator('input[name="mobileImage"]').waitFor();
  await owner.page.locator('select[name="imageFit"]').waitFor();
  await owner.page.locator('input[name="imageAlt"]').waitFor();
  await owner.page.locator('input[name="featureOne"]').waitFor();
  await go(owner.page, "/admin/homepage/hero");
  await owner.page.locator('input[name="autoplay"]').waitFor();
  await owner.page.locator('input[name="slideIntervalSeconds"]').waitFor();
  await go(owner.page, "/");
  await owner.page.getByRole("heading", { name: /Your One-Stop Shop for/ }).waitFor();
  await owner.page.getByRole("button", { name: "Next hero slide" }).click();
  await owner.page.getByRole("heading", { name: "Synthetic UI slide" }).waitFor();
  await owner.page.getByRole("button", { name: "Go to slide 1" }).click();
  await owner.page.getByRole("heading", { name: /Your One-Stop Shop for/ }).waitFor();
  console.log("PASS admin slide customization controls and storefront hero carousel");

  await go(owner.page, "/admin");
  assert.deepEqual(await actualNav(owner.page), expectedNav("owner"), "Owner navigation must retain every configured destination in order.");
  assert.equal(await owner.page.getByText("Order values include unpaid orders; they are not payments received.").count(), 1);
  const latest = owner.page.locator("section").filter({ has: owner.page.getByRole("heading", { name: "Latest orders" }) });
  assert.deepEqual(await latest.locator("li a").allTextContents().then((values) => values.map((value) => value.match(/E2E-(?:NEW|OLD)/)?.[0])), ["E2E-NEW", "E2E-OLD"]);
  await owner.page.getByRole("img", { name: /order value for the last/i }).waitFor();
  console.log("PASS owner dashboard uses real store data, clear order-value wording and newest-first orders");

  const navSearch = owner.page.getByRole("searchbox", { name: "Find an admin section" });
  await navSearch.fill("coupons");
  assert.equal(await owner.page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Coupons" }).count(), 1);
  assert.equal(await owner.page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Products", exact: true }).count(), 0);
  await navSearch.fill("no-such-admin-area");
  await owner.page.getByText(/no sections match/i).waitFor();
  await owner.page.getByRole("button", { name: "Clear search" }).click();
  assert.deepEqual(await actualNav(owner.page), expectedNav("owner"));
  console.log("PASS all owner navigation destinations, search, empty state and reset");

  await go(owner.page, "/admin/orders");
  await owner.page.getByLabel("Search orders").fill("E2E");
  await owner.page.getByRole("button", { name: "Search", exact: true }).click();
  await owner.page.waitForURL(/q=E2E/);
  await owner.page.getByRole("link", { name: "Pending", exact: true }).click();
  await owner.page.waitForURL(/status=pending/);
  assert(new URL(owner.page.url()).searchParams.get("q") === "E2E", "Changing status should preserve search.");
  assert.equal(await owner.page.getByRole("link", { name: "E2E-OLD", exact: true }).count(), 1);
  assert.equal(await owner.page.getByRole("link", { name: "E2E-NEW", exact: true }).count(), 0);
  await owner.page.getByRole("link", { name: "Unpaid only" }).click();
  await owner.page.waitForURL(/payment=unpaid/);
  assert.equal(new URL(owner.page.url()).searchParams.get("status"), "pending");
  await owner.page.getByRole("link", { name: "Unpaid only" }).click();
  await owner.page.waitForURL((url) => !url.searchParams.has("payment"));
  await owner.page.getByRole("link", { name: "Clear filters" }).click();
  await owner.page.waitForURL(/\/admin\/orders$/);
  console.log("PASS order search, status filters, unpaid toggle and clear filters");

  await go(owner.page, "/admin/inventory");
  await owner.page.getByRole("link", { name: /open products/i }).click();
  await owner.page.waitForURL(/stock=low/);
  assert.equal(await owner.page.getByLabel("Filter by status").inputValue(), "low");
  const lowNames = (await read()).collections.products.filter((row) => (row.stock ?? 0) <= 10).map((row) => row.name);
  const listedNames = await owner.page.locator('input[id^="stock-"]').evaluateAll((inputs) => inputs.map((input) => document.querySelector(`label[for="${input.id}"]`)?.textContent?.replace(/^Stock for /, "").trim()));
  assert.deepEqual(new Set(listedNames), new Set(lowNames));
  await owner.page.getByRole("button", { name: "Clear filters" }).click();
  assert.equal(await owner.page.getByLabel("Filter by status").inputValue(), "all");
  await owner.page.getByRole("searchbox", { name: "Search products" }).fill("Fresh Strawberry");
  assert.equal(await owner.page.locator('input[id^="stock-"]').count(), 1);
  console.log("PASS inventory-to-products low-stock filter, clear and product search");

  await go(owner.page, "/admin/settings");
  const settingsNav = owner.page.getByRole("navigation", { name: "Settings sections" });
  const settingsHrefs = await settingsNav.locator("a").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  assert.equal(settingsHrefs.length, 13);
  for (const href of settingsHrefs) assert.equal(await owner.page.locator(href).count(), 1, `Missing settings section ${href}`);
  await settingsNav.getByRole("link", { name: "Footer", exact: true }).click();
  assert.equal(new URL(owner.page.url()).hash, "#settings-footer");
  await owner.page.locator('input[name="tagline"]').fill("Synthetic test tagline");
  await owner.page.locator('input[name="phone"]').fill("01000000000"); // synthetic local fixture for required contact validation
  await owner.page.getByRole("button", { name: "Save settings", exact: true }).click();
  await owner.page.getByRole("status").filter({ hasText: /settings saved/i }).waitFor({ timeout: 45_000 });
  assert.equal((await read()).collections.settings.find((row) => row.id === "site").tagline, "Synthetic test tagline");
  console.log("PASS settings jump links and a real save in the disposable store");

  // A table with image-first columns should link the headline, not the image URL.
  await go(owner.page, "/admin/r/hero_slides");
  const table = owner.page.getByRole("region", { name: /hero slides table/i });
  assert.equal(await table.getByRole("link", { name: "Synthetic UI slide", exact: true }).count(), 1);
  assert.equal(await table.getByRole("link", { name: /\/images\// }).count(), 0);
  console.log("PASS resource table shows a readable headline link instead of an image URL");

  // Exercise representative pages at phone, tablet and desktop widths.
  const views = ["/admin", "/admin/orders", "/admin/catalogue/products", "/admin/inventory", "/admin/customers", "/admin/r/hero_slides", "/admin/settings"];
  for (const width of [320, 390, 768, 1440]) {
    await owner.page.setViewportSize({ width, height: 800 });
    for (const url of views) {
      await go(owner.page, url);
      await noPageOverflow(owner.page, `${url} at ${width}px`);
    }
  }
  console.log("PASS no whole-page horizontal overflow across 7 admin screens at 320, 390, 768 and 1440 pixels");

  await owner.page.setViewportSize({ width: 390, height: 844 });
  await go(owner.page, "/admin");
  const opener = owner.page.getByRole("button", { name: "Open admin menu" });
  await opener.click();
  const drawer = owner.page.getByRole("dialog", { name: "Admin navigation" });
  await drawer.waitFor();
  assert.equal(await owner.page.evaluate(() => document.body.style.overflow), "hidden");
  assert.equal(await owner.page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close admin menu");
  await owner.page.keyboard.press("Shift+Tab");
  assert.equal(await owner.page.evaluate(() => document.activeElement?.textContent?.trim()), "Sign out");
  await owner.page.keyboard.press("Tab");
  assert.equal(await owner.page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close admin menu");
  await owner.page.keyboard.press("Escape");
  assert.equal(await drawer.count(), 0);
  assert.equal(await owner.page.evaluate(() => document.body.style.overflow), "");
  assert.equal(await owner.page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Open admin menu");
  await opener.click();
  await drawer.getByRole("searchbox", { name: "Find an admin section" }).fill("hero slides");
  await drawer.getByRole("link", { name: "Hero slides" }).click();
  await owner.page.waitForURL(/\/admin\/r\/hero_slides$/);
  assert.equal(await drawer.count(), 0);
  assert.equal(await owner.page.evaluate(() => document.body.style.overflow), "");
  console.log("PASS mobile drawer focus trap, Escape, scroll lock, search and navigation close");

  const move = owner.page.getByRole("button", { name: "Move Synthetic UI slide up" });
  await move.waitFor();
  assert.equal(await move.isEnabled(), true);
  await move.click();
  await owner.page.waitForTimeout(1200);
  assert.equal((await read()).collections.hero_slides.find((row) => row.id === "e2e-admin-ui-slide").order, 1);
  console.log("PASS mobile resource reorder action writes to the disposable store");
  await go(owner.page, "/admin/orders");
  const oldCard = owner.page.locator("li").filter({ has: owner.page.getByRole("link", { name: "E2E-OLD", exact: true }) });
  assert.match(await oldCard.innerText(), /Synthetic UI Customer/);
  assert.match(await oldCard.innerText(), /unpaid/i);
  assert.match(await oldCard.innerText(), /Grocery/);
  console.log("PASS mobile order card retains customer, payment, channel and order details");

  const staff = await newPage({ width: 1366, height: 850 });
  await login(staff.page, staffEmail, staffPassword);
  assert.deepEqual(await actualNav(staff.page), expectedNav("inventory_manager"), "Staff navigation must match the role's server permissions.");
  assert.equal(await staff.page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Orders", exact: true }).count(), 0);
  assert.equal(await staff.page.getByRole("link", { name: "New product" }).count(), 0);
  await go(staff.page, "/admin/orders");
  await staff.page.waitForURL(/denied=orders.view/);
  await staff.page.getByRole("alert").getByText(/does not include access/i).waitFor();
  await go(staff.page, "/admin/catalogue/products/new");
  await staff.page.waitForURL(/denied=products.manage/);
  await go(staff.page, "/admin/inventory");
  await staff.page.getByRole("link", { name: /open products/i }).click();
  await staff.page.waitForURL(/stock=low/);
  await staff.page.getByText(/read only.*low or out of stock/i).waitFor();
  for (const name of lowNames) assert.equal(await staff.page.getByText(name, { exact: false }).count(), 1);
  await staff.page.getByRole("button", { name: "Sign out" }).click();
  await staff.page.waitForURL(/\/my-account\/login\?signedOut=1/);
  await go(staff.page, "/admin");
  await staff.page.waitForURL(/\/my-account\/login/);
  console.log("PASS restricted staff navigation, direct URL guards, read-only low-stock view and sign out");

  assert.deepEqual(errors, [], `Unexpected browser page errors: ${errors.join(" | ")}`);
  await owner.context.close();
  await staff.context.close();
  console.log("ALL ADMIN UI CHECKS PASSED — synthetic local file store only; no real services tested.");
} finally {
  await browser.close();
}

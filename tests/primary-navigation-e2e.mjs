/** Primary navigation browser checks. Run only against a marked disposable local store. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const url = new URL(base);
if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/" || url.username || url.password) {
  throw new Error("Only a local test server is allowed.");
}
if (!process.env.E2E_DATA_DIR || !process.env.E2E_OWNER_PASSWORD) throw new Error("Set the isolated test directory and owner password.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200);
const handshake = await safety.json();
assert.equal(handshake.isolated, true);
assert.equal(handshake.storeHash, createHash("sha256").update(data).digest("hex"));
const readDB = async () => JSON.parse(await fs.readFile(path.join(data, "db.json"), "utf8"));
const log = (message) => console.log(`PASS ${message}`);
const ready = async (page, target) => {
  await page.goto(`${base}${target}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(850);
};
const screenshotDir = process.env.E2E_SCREENSHOT_DIR;
if (screenshotDir) await fs.mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
const pageErrors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await ready(page, "/");
  const primary = page.locator('nav[aria-label="Primary"]');
  const menuLink = () => primary.getByRole("link", { name: "Dates", exact: true });
  assert.equal(await primary.getByRole("link", { name: "Blogs", exact: true }).count(), 0);
  assert.equal(await page.locator("footer").getByRole("link", { name: "Blog", exact: true }).count(), 1);
  assert.equal(await menuLink().getAttribute("href"), "/grocery?category=dates");
  assert.equal((await readDB()).collections.categories.find((category) => category.id === "dates").showInPrimaryNavigation, true);
  const before = await menuLink().evaluate((node) => `${getComputedStyle(node).transform} ${getComputedStyle(node).scale}`);
  await menuLink().hover(); await page.waitForTimeout(300);
  const after = await menuLink().evaluate((node) => `${getComputedStyle(node).transform} ${getComputedStyle(node).scale}`);
  assert.notEqual(before, after, "primary category link must gently zoom on hover");
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, "desktop-primary-nav.png") });
  await page.getByRole("button", { name: "Browse All Categories" }).click();
  const mega = page.locator("#category-mega-menu");
  const datesInMenu = mega.getByRole("link", { name: /Dates/ }).first();
  await datesInMenu.waitFor({ state: "visible" });
  const imageBefore = await datesInMenu.locator("img").evaluate((node) => `${getComputedStyle(node).transform} ${getComputedStyle(node).scale}`);
  await datesInMenu.hover(); await page.waitForTimeout(320);
  const imageAfter = await datesInMenu.locator("img").evaluate((node) => `${getComputedStyle(node).transform} ${getComputedStyle(node).scale}`);
  assert.notEqual(imageBefore, imageAfter, "category thumbnail must gently zoom on hover");
  if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, "category-menu.png") });
  await page.getByRole("button", { name: "Browse All Categories" }).click();
  log("Blog stays in the footer; live Dates link and both hover effects work");

  for (const width of [1024, 1100, 1280, 1366, 1600]) {
    await page.setViewportSize({ width, height: 850 });
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Primary"]');
      const list = nav.querySelector("ul");
      const item = [...list.querySelectorAll("a")].find((a) => a.textContent.trim() === "Dates");
      const category = nav.querySelector("button");
      const recent = [...nav.querySelectorAll("button")].find((b) => b.textContent.includes("Recently Viewed"));
      const ir = item.getBoundingClientRect(), lr = list.getBoundingClientRect();
      const cr = category.getBoundingClientRect(), rr = recent.getBoundingClientRect();
      return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth,
        listWidth: list.clientWidth, listScroll: list.scrollWidth, linkLeft: ir.left, linkRight: ir.right,
        listLeft: lr.left, listRight: lr.right, categoryRight: cr.right, recentLeft: rr.left };
    });
    assert(m.scrollWidth <= m.width + 1, `document overflows at ${width}: ${JSON.stringify(m)}`);
    assert(m.linkLeft >= m.listLeft - 1 && m.linkRight <= m.listRight + 1, `Dates is clipped at ${width}: ${JSON.stringify(m)}`);
    assert(m.categoryRight <= m.listLeft + 1 && m.listRight <= m.recentLeft + 1, `navigation overlaps at ${width}: ${JSON.stringify(m)}`);
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  await menuLink().click();
  await page.waitForURL(/\/grocery\?category=dates$/, { timeout: 30_000 });
  assert.equal(await page.locator('aside[aria-label="Product filters"]').getByLabel("Dates", { exact: true }).isChecked(), true);
  assert.equal(await page.locator("main article[data-product-id]").count(), 0, "an empty category must not invent products");
  log("Dates opens the real category filter without fabricated products; desktop nav stays contained");

  const reduced = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
  const rp = await reduced.newPage(); await ready(rp, "/");
  const reducedLink = rp.locator('nav[aria-label="Primary"]').getByRole("link", { name: "Dates", exact: true });
  const reducedBefore = await reducedLink.evaluate((node) => `${getComputedStyle(node).transform} ${getComputedStyle(node).scale}`);
  await reducedLink.hover(); await rp.waitForTimeout(320);
  const reducedAfter = await reducedLink.evaluate((node) => `${getComputedStyle(node).transform} ${getComputedStyle(node).scale}`);
  assert.equal(reducedBefore, reducedAfter, "reduced-motion setting must suppress zoom");
  await reduced.close();
  for (const width of [320, 360, 390, 767, 768]) {
    await page.setViewportSize({ width, height: 844 }); await ready(page, "/");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), `mobile overflow at ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const bottomNav = page.getByRole("navigation", { name: "Mobile quick navigation" });
  await bottomNav.waitFor({ state: "visible" });
  assert.deepEqual((await bottomNav.locator("li").allTextContents()).map((label) => label.trim()), ["Home", "Categories", "Bag", "Wishlist", "Account"]);
  assert.equal(await page.getByRole("button", { name: /^Open cart,/ }).count(), 0, "cart should not be duplicated in the mobile header");
  assert.equal(await page.getByRole("button", { name: /^Open wishlist,/ }).count(), 0, "wishlist should not be duplicated in the mobile header");
  assert.equal(await page.getByRole("link", { name: "My account", exact: true }).count(), 0, "account should not be duplicated in the mobile header");
  assert.equal(await page.getByRole("button", { name: "Open menu" }).count(), 0, "the categories menu is opened from the bottom navigation");
  assert.equal(await page.getByRole("link", { name: "Niketon Mart — home", exact: true }).count(), 1);
  const bottomNavLayout = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile quick navigation"]');
    const bag = nav.querySelector("[data-mobile-bag]").getBoundingClientRect();
    return { position: getComputedStyle(nav).position, bottom: (visualViewport?.height ?? innerHeight) - nav.getBoundingClientRect().bottom, bagWidth: bag.width, bagHeight: bag.height };
  });
  assert.equal(bottomNavLayout.position, "fixed");
  assert(bottomNavLayout.bottom <= 1, `mobile quick nav should sit at the safe-area bottom: ${JSON.stringify(bottomNavLayout)}`);
  assert(bottomNavLayout.bagWidth >= 54 && bottomNavLayout.bagHeight >= 54, `bag action should be the prominent control: ${JSON.stringify(bottomNavLayout)}`);
  await bottomNav.getByRole("button", { name: "Open categories", exact: true }).click();
  const mobile = page.getByRole("dialog", { name: "Menu" });
  const mobileNav = mobile.getByRole("navigation", { name: "Mobile" });
  assert.equal(await mobileNav.getByRole("link", { name: "Blogs", exact: true }).count(), 0);
  assert.equal(await mobileNav.getByRole("link", { name: "Categories", exact: true }).getAttribute("href"), "/categories");
  const mobileDates = mobileNav.getByRole("link", { name: "Dates", exact: true });
  assert.equal(await mobileDates.getAttribute("href"), "/grocery?category=dates");
  await mobileDates.click(); await page.waitForURL(/\/grocery\?category=dates$/, { timeout: 30_000 });
  // The role locator excludes hidden dialogs after navigation; inspect its wrapper directly.
  assert.equal(await page.locator('aside[role="dialog"][aria-label="Menu"]').locator("..").getAttribute("aria-hidden"), "true");
  log("mobile menu uses the same category, closes on navigation, and reduced motion is respected");

  await page.setViewportSize({ width: 1366, height: 768 });
  await ready(page, "/admin/login");
  const login = page.locator("form").filter({ has: page.getByRole("button", { name: "Sign In", exact: true }) });
  await login.locator('input[name="email"]').fill("marufsalauddin76@gmail.com");
  await login.locator('input[name="password"]').fill(process.env.E2E_OWNER_PASSWORD);
  await login.getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(/\/admin$/, { timeout: 30_000 });
  await ready(page, "/admin/catalogue/taxonomy");
  const section = page.locator("section").filter({ has: page.getByRole("heading", { name: "Categories", exact: true }) });
  const form = section.locator("form");
  // Child rows also contain their parent's name in a subtitle. Select the
  // exact row by its accessible movement control, not an ambiguous substring.
  const row = (name) => section.locator("li").filter({ has: page.getByRole("button", { name: `Move ${name} up`, exact: true }) });
  await row("Dates").getByRole("button", { name: "Edit", exact: true }).click();
  assert.equal(await form.getByLabel("Feature in primary navigation").isChecked(), true);
  await form.getByLabel("New category name").fill("Premium Dates");
  const saveRequest = page.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"]) && Boolean(request.postData()?.includes("showInPrimaryNavigation")), { timeout: 20_000 });
  await form.getByRole("button", { name: "Save", exact: true }).click();
  const captured = await saveRequest; await page.waitForTimeout(1200);
  const initialUpdated = (await readDB()).collections.categories.find((category) => category.id === "dates");
  assert.equal(initialUpdated.name, "Premium Dates"); assert.equal(initialUpdated.showInPrimaryNavigation, true);
  const headers = captured.headers();
  const replayHeaders = Object.fromEntries(["next-action", "content-type", "origin", "accept"].filter((key) => headers[key]).map((key) => [key, headers[key]]));
  const guest = await browser.newContext();
  const denied = await guest.request.post(captured.url(), { headers: replayHeaders, data: captured.postDataBuffer() });
  const deniedBody = await denied.text();
  assert(!denied.ok() || deniedBody.includes("sign in"), "anonymous action replay must fail");
  assert.deepEqual((await readDB()).collections.categories.find((category) => category.id === "dates"), initialUpdated);
  await guest.close();
  await ready(page, "/");
  assert.equal(await primary.getByRole("link", { name: "Premium Dates", exact: true }).getAttribute("href"), "/grocery?category=dates");
  assert.equal(await primary.getByRole("link", { name: "Dates", exact: true }).count(), 0);
  log("admin renaming persists and updates the public link; anonymous category writes are refused");

  await ready(page, "/admin/catalogue/taxonomy");
  await row("Fresh Fish").getByRole("button", { name: "Edit", exact: true }).click();
  await form.getByLabel("Feature in primary navigation").check();
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await form.getByRole("alert").getByText("Only one category", { exact: false }).waitFor();
  assert.notEqual((await readDB()).collections.categories.find((category) => category.id === "fish").showInPrimaryNavigation, true);
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await section.getByRole("button", { name: "Hide Premium Dates" }).click(); await page.waitForTimeout(1000);
  await ready(page, "/"); assert.equal(await primary.getByRole("link", { name: "Premium Dates", exact: true }).count(), 0);
  await ready(page, "/admin/catalogue/taxonomy");
  await section.getByRole("button", { name: "Show Premium Dates" }).click(); await page.waitForTimeout(1000);
  await ready(page, "/"); assert.equal(await primary.getByRole("link", { name: "Premium Dates", exact: true }).count(), 1);
  await ready(page, "/admin/catalogue/taxonomy");
  await row("Premium Dates").getByRole("button", { name: "Edit", exact: true }).click();
  await form.getByLabel("Feature in primary navigation").uncheck();
  await form.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(1000);
  await row("Fresh Fish").getByRole("button", { name: "Edit", exact: true }).click();
  await form.getByLabel("Feature in primary navigation").check();
  await form.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(1000);
  await ready(page, "/");
  const fish = primary.getByRole("link", { name: "Fresh Fish", exact: true });
  assert.equal(await fish.getAttribute("href"), "/fresh-market?category=fish");
  assert.equal(await primary.getByRole("link", { name: "Premium Dates", exact: true }).count(), 0);
  await fish.click(); await page.waitForURL(/\/fresh-market\?category=fish$/, { timeout: 30_000 });
  assert((await page.locator('main article[data-product-id]').count()) > 0);
  log("one-slot validation, hide/show, and switching the selected category work end to end");

  // Creating a new category with the primary flag is the path used on existing
  // or production databases, where the local Dates example is not seeded.
  await ready(page, "/admin/catalogue/taxonomy");
  await row("Fresh Fish").getByRole("button", { name: "Edit", exact: true }).click();
  await form.getByLabel("Feature in primary navigation").uncheck();
  await form.getByRole("button", { name: "Save", exact: true }).click(); await page.waitForTimeout(1000);
  const longName = `Dates ${"long ".repeat(14).trim()}`;
  await form.getByLabel("New category name").fill(longName);
  await form.getByLabel("Navigation group").selectOption("pantry");
  await form.getByLabel("Show on homepage").uncheck();
  await form.getByLabel("Feature in primary navigation").check();
  await form.getByRole("button", { name: "Add", exact: true }).click();
  await row(longName).waitFor({ timeout: 20_000 }); await page.waitForTimeout(600);
  const created = (await readDB()).collections.categories.find((category) => category.name === longName);
  assert(created?.showInPrimaryNavigation && created.showInNavigation && created.group === "pantry");
  await ready(page, "/");
  const createdLink = primary.getByRole("link", { name: longName, exact: true });
  assert.equal(await createdLink.getAttribute("href"), `/grocery?category=${encodeURIComponent(created.id)}`);
  assert.equal(await createdLink.getAttribute("title"), longName);
  for (const width of [1024, 1280, 1366]) {
    await page.setViewportSize({ width, height: 850 }); await page.waitForTimeout(200);
    const contained = await createdLink.evaluate((link) => {
      const list = link.closest("ul"), item = link.getBoundingClientRect(), bounds = list.getBoundingClientRect();
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && item.left >= bounds.left - 1 && item.right <= bounds.right + 1;
    });
    assert(contained, `a long admin category name overflows at ${width}`);
  }
  log("admin can create a featured category from scratch; long names stay contained");

  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log("ALL PRIMARY NAVIGATION CHECKS PASSED");
} finally {
  await browser.close();
}

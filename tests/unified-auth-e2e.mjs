/** Run only against a marked disposable local store. Never target deployment. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";
const url = new URL(base);
if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/") throw new Error("Only a local test server is allowed.");
if (!process.env.E2E_DATA_DIR || !process.env.E2E_OWNER_PASSWORD) throw new Error("Set the isolated test directory and owner password.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200);
const handshake = await safety.json();
assert.equal(handshake.isolated, true);
assert.equal(handshake.storeHash, createHash("sha256").update(data).digest("hex"));
const getDB = async () => JSON.parse(await fs.readFile(path.join(data, "db.json"), "utf8"));
const random = randomBytes(6).toString("hex");
const customerEmail = `shopper-${random}@example.invalid`;
const customerPassword = `Shop-${randomBytes(16).toString("hex")}9`;
const collisionPassword = `Customer-${randomBytes(16).toString("hex")}9`;
const ownerEmail = "marufsalauddin76@gmail.com";
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const screenshots = process.env.E2E_SCREENSHOT_DIR;
if (screenshots) await fs.mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
const errors = [];
const log = (s) => console.log(`PASS ${s}`);
const ready = async (p, pathname) => {
  await p.goto(`${base}${pathname}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await p.waitForTimeout(750);
};
const register = async (p, email, password, first = "Test") => {
  await p.locator('input[name="firstName"]').fill(first);
  await p.locator('input[name="lastName"]').fill("Shopper");
  await p.locator('input[name="email"]').first().fill(email);
  await p.locator('input[name="phone"]').fill("01700000000");
  await p.locator('input[name="password"]').fill(password);
  await p.locator('input[name="confirmPassword"]').fill(password);
  await p.locator('input[name="acceptTerms"]').check();
  await p.getByRole("button", { name: "Create Account", exact: true }).click();
};
const login = async (p, email, password) => {
  await p.getByRole("heading", { name: "Sign in", exact: true }).waitFor({ timeout: 30_000 });
  await p.locator('input[name="email"]').first().fill(email);
  await p.locator('input[name="password"]').fill(password);
  await p.getByRole("button", { name: "Sign In", exact: true }).click();
};
const logout = async (p) => {
  await ready(p, "/my-account/logout");
  await p.getByRole("button", { name: /Yes, Logout/ }).click();
  await p.waitForURL(/\/my-account\/login\?signedOut=1/, { timeout: 30_000 });
  await p.waitForTimeout(700);
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (message) => { if (message.type() === "error") console.error("BROWSER CONSOLE:", message.text().slice(0, 400)); });

  for (const target of ["/product/brown-bread", "/cart", "/wishlist", "/checkout"]) {
    const res = await ctx.request.get(`${base}${target}`, { maxRedirects: 0 });
    assert.equal(res.status(), 307, target);
    const dest = new URL(res.headers().location, base);
    assert.equal(dest.pathname, "/my-account/register");
    assert.equal(dest.searchParams.get("next"), target);
  }
  assert.equal((await ctx.request.get(`${base}/home-grocery`)).status(), 200);
  assert.equal((await ctx.request.get(`${base}/track-order`)).status(), 200);
  await ready(p, "/");
  assert.equal(await p.getByRole("link", { name: "Admin dashboard" }).count(), 0);
  await p.getByRole("button", { name: /Open cart/ }).click();
  await p.waitForURL(/\/my-account\/register\?next=%2Fcart/i, { timeout: 30_000 });
  await ready(p, "/");
  await p.getByRole("button", { name: /Open wishlist/ }).click();
  await p.waitForURL(/\/my-account\/register\?next=%2Fwishlist/i, { timeout: 30_000 });
  log("guest direct routes, cart and wishlist gates; catalogue and tracking remain public");

  await ready(p, "/");
  await p.getByRole("button", { name: "Browse All Categories" }).click();
  const mega = p.locator("#category-mega-menu");
  assert(await mega.isVisible());
  const firstCategory = mega.locator("li a").first();
  const before = await firstCategory.locator("img").evaluate((img) => `${getComputedStyle(img).transform} ${getComputedStyle(img).scale}`);
  await firstCategory.hover(); await p.waitForTimeout(400);
  const after = await firstCategory.locator("img").evaluate((img) => `${getComputedStyle(img).transform} ${getComputedStyle(img).scale}`);
  assert.notEqual(before, after, "category thumbnail must zoom on hover");
  if (screenshots) await p.screenshot({ path: path.join(screenshots, "after-categories.png") });
  await p.keyboard.press("Escape"); assert.equal(await mega.count(), 0);
  const search = p.locator('header input[aria-label="Search for products"]:visible').first();
  await search.focus();
  assert.equal(await p.getByText("Popular searches", { exact: true }).count(), 0);
  assert.equal(await p.getByRole("button", { name: "All Categories", exact: true }).count(), 0);
  await search.fill("GoodGrains");
  const suggestions = p.locator('header [id]').filter({ hasText: "Products" });
  await p.getByRole("button", { name: "View all results" }).first().waitFor({ timeout: 20_000 });
  const suggested = await p.locator('header a[href^="/product/"]:visible').evaluateAll((nodes) => nodes.map((node) => new URL(node.href).pathname));
  assert(suggested.length > 0, "brand suggestions should exist");
  if (screenshots) await p.screenshot({ path: path.join(screenshots, "after-search.png") });
  await search.press("Enter"); await p.waitForURL(/home-grocery\?q=GoodGrains/i);
  await p.locator('main article a[href^="/product/"]').first().waitFor({ state: "visible", timeout: 20_000 });
  const resultLinks = await p.locator('main article a[href^="/product/"]').evaluateAll((nodes) => nodes.map((node) => new URL(node.href).pathname));
  assert(suggested.some((href) => resultLinks.includes(href)), "full search must include suggested brand results");
  void suggestions;
  log("spacious category menu, hover zoom, clean search and consistent brand results");

  for (const width of [320, 360, 375, 390, 767, 768, 1024, 1366]) {
    await p.setViewportSize({ width, height: 844 }); await ready(p, "/");
    const size = await p.evaluate(() => ({ body: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
    assert(size.body <= size.view + 1, `horizontal overflow at ${width}: ${JSON.stringify(size)}`);
  }
  await p.setViewportSize({ width: 1366, height: 768 });
  log("mobile and desktop navigation widths do not overflow");

  await ready(p, "/");
  await p.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await p.waitForTimeout(200);
  const oldY = await p.evaluate(() => scrollY);
  await p.evaluate(() => {
    window.__accountFrames = [];
    document.addEventListener("click", (e) => {
      const a = e.target instanceof Element && e.target.closest("footer a");
      if (a?.textContent?.trim() === "My Account") window.__accountClicked = performance.now();
    }, { capture: true, once: true });
    const frame = () => {
      const clicked = window.__accountClicked;
      if (clicked) {
        const middle = document.elementFromPoint(innerWidth / 2, innerHeight * .65);
        window.__accountFrames.push({ ms: performance.now() - clicked, path: location.pathname, y: scrollY, footer: !!middle?.closest("footer"), loading: !!document.querySelector('[role="status"]')?.textContent?.includes("Loading your account") });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await p.locator("footer").getByRole("link", { name: "My Account", exact: true }).click();
  await p.waitForURL(/\/my-account\/login/, { timeout: 30_000 });
  await p.getByRole("heading", { name: "Sign in", exact: true }).waitFor(); await p.waitForTimeout(300);
  const frames = await p.evaluate(() => window.__accountFrames);
  assert(await p.evaluate(() => scrollY <= 1), "account should start at the top");
  const footerAfterClick = frames.filter((frame) => frame.ms > 200 && frame.footer && !frame.loading);
  assert.equal(footerAfterClick.length, 0, `footer remained visible after account click: ${JSON.stringify(footerAfterClick.slice(0, 2))}`);
  if (screenshots) await p.screenshot({ path: path.join(screenshots, "after-account.png") });
  await p.goBack({ waitUntil: "domcontentloaded" }); await p.waitForTimeout(800);
  assert(await p.evaluate(() => scrollY > 500), `Back should restore the previous footer position (was ${oldY})`);
  log("account navigation avoids footer flash and retains Back scroll position");

  await ready(p, "/home-grocery?q=brown%20bread");
  let card = p.locator('article[data-product-id="p-bread"]').first(); await card.waitFor({ state: "visible" });
  await card.getByRole("button", { name: "Add Brown Bread to cart" }).click();
  await p.waitForURL(/\/my-account\/register\?next=%2Fproduct%2Fbrown-bread/i, { timeout: 30_000 });
  await ready(p, "/home-grocery?q=brown%20bread");
  card = p.locator('article[data-product-id="p-bread"]').first(); await card.waitFor({ state: "visible" });
  await card.getByRole("button", { name: /Save Brown Bread to wishlist/ }).click();
  await p.waitForURL(/\/my-account\/register\?next=%2Fproduct%2Fbrown-bread/i, { timeout: 30_000 });
  await register(p, customerEmail, customerPassword);
  try { await p.waitForURL(/\/product\/brown-bread$/, { timeout: 45_000 }); }
  catch (error) { console.error("Signup return diagnostic:", p.url(), (await p.locator("main").innerText()).slice(0, 600), errors); throw error; }
  await p.getByRole("heading", { name: "Brown Bread", level: 1 }).waitFor();
  await p.waitForTimeout(1200);
  assert.equal(await p.getByRole("link", { name: "Admin dashboard" }).count(), 0);
  const wishlistRequest = p.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"]) && Boolean(request.postData()?.includes("expectedShopperId")), { timeout: 20_000 });
  await p.getByRole("button", { name: /Save Brown Bread to wishlist/ }).click();
  const savedRequest = await wishlistRequest;
  const replay = { url: savedRequest.url(), body: savedRequest.postDataBuffer(), headers: savedRequest.headers() };
  await p.waitForTimeout(1400);
  const shopper = (await getDB()).collections.customers.find((row) => row.email === customerEmail);
  assert(shopper?.passwordHash && !shopper.staffAdminId);
  const saved = (await getDB()).collections.wishlists.find((row) => row.ownerCustomerId === shopper.id);
  assert(saved?.items.some((item) => item.productId === "p-bread"), "account wishlist was not persisted");
  const anonymous = await browser.newContext();
  const replayHeaders = Object.fromEntries(["next-action", "content-type", "origin", "accept"].filter((key) => replay.headers[key]).map((key) => [key, replay.headers[key]]));
  const deniedWrite = await anonymous.request.post(replay.url, { headers: replayHeaders, data: replay.body });
  assert((await deniedWrite.text()).includes("Your session changed"), "guest replay of a wishlist write must be refused");
  assert.equal((await getDB()).collections.wishlists.find((row) => row.id === saved.id).items.length, saved.items.length);
  await anonymous.close();
  await p.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await p.getByRole("button", { name: /Open cart, 1 items/ }).waitFor();
  await logout(p);
  await ready(p, "/cart"); assert.match(p.url(), /\/my-account\/register/);
  await p.getByRole("link", { name: "Sign in", exact: true }).click();
  await p.waitForURL(/\/my-account\/login\?next=%2Fcart/i, { timeout: 30_000 });
  await login(p, customerEmail, customerPassword);
  await p.waitForURL(/\/cart$/, { timeout: 30_000 });
  await p.getByRole("button", { name: /Open cart, 1 items/ }).waitFor();
  log("customer signup returns to product, cart persists per browser, wishlist persists server-side");

  const second = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const q = await second.newPage(); q.on("pageerror", (e) => errors.push(e.message));
  await ready(q, "/my-account/login?next=%2Fwishlist"); await login(q, customerEmail, customerPassword);
  await q.waitForURL(/\/wishlist$/, { timeout: 30_000 });
  await q.locator('[data-wishlist-row="p-bread"]').waitFor({ timeout: 20_000 });
  await second.close();
  log("wishlist follows the authenticated customer to a second browser");

  await logout(p);
  await ready(p, "/my-account/register");
  await register(p, ownerEmail, collisionPassword, "Collision");
  await p.waitForURL(/\/my-account\/personal-information$/, { timeout: 30_000 });
  await p.waitForTimeout(900);
  assert.equal(await p.getByRole("link", { name: "Admin dashboard" }).count(), 0);
  assert.equal(await p.getByRole("button", { name: /Open cart, 0 items/ }).count(), 1);
  await ready(p, "/wishlist"); await p.getByText("Nothing saved yet").waitFor({ timeout: 20_000 });
  const wrongAccountWrite = await ctx.request.post(replay.url, { headers: replayHeaders, data: replay.body });
  assert((await wrongAccountWrite.text()).includes("Your session changed"), "a stale tab must not write the previous account's wishlist");
  assert.equal((await getDB()).collections.wishlists.find((row) => row.id === saved.id).items.length, saved.items.length);
  await ready(p, "/admin");
  assert.match(p.url(), /\/my-account\/login\?next=%2Fadmin/i);
  await login(p, ownerEmail, collisionPassword);
  await p.waitForURL(/\/my-account\/personal-information$/, { timeout: 30_000 });
  assert.equal(await p.getByRole("link", { name: "Admin dashboard" }).count(), 0);
  log("a customer claiming the owner's email has no admin access and sees no previous shopper data");

  await ready(p, "/admin/login"); await login(p, ownerEmail, ownerPassword);
  await p.waitForURL(/\/admin$/, { timeout: 30_000 });
  await p.getByText(/Welcome back/).first().waitFor();
  const staffCookies = await ctx.cookies();
  assert(staffCookies.some((cookie) => cookie.name === "nm_admin_session"));
  assert(!staffCookies.some((cookie) => cookie.name === "nm_customer_session"));
  await ready(p, "/");
  await p.getByRole("link", { name: "Admin dashboard" }).waitFor();
  assert.equal(await p.getByRole("button", { name: /Open cart, 0 items/ }).count(), 1);
  await ready(p, "/product/fresh-rui-fish");
  await p.getByRole("heading", { name: "Fresh Rui Fish", level: 1 }).waitFor();
  await p.getByRole("radio", { name: /Curry cut/ }).click();
  await p.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await p.getByRole("button", { name: /Open cart, 1 items/ }).waitFor();
  const staffShopper = (await getDB()).collections.customers.find((row) => row.staffAdminId === "usr_super_admin");
  assert(staffShopper && !staffShopper.passwordHash && staffShopper.id !== shopper.id);
  await p.setViewportSize({ width: 390, height: 844 }); await ready(p, "/");
  await p.getByRole("button", { name: "Open menu" }).click();
  await p.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Admin dashboard" }).waitFor();
  await p.getByRole("button", { name: "Close menu" }).click();
  await logout(p);
  const stale = await browser.newContext(); await stale.addCookies(staffCookies.filter((cookie) => cookie.name === "nm_admin_session"));
  const r = await stale.request.get(`${base}/admin`, { maxRedirects: 0 });
  assert.equal(r.status(), 307); assert.match(r.headers().location, /\/admin\/login|\/my-account\/login/);
  await stale.close();
  log("verified owner gets dashboard shortcut and a separate shopper profile; logout revokes staff session");

  assert.deepEqual(errors, []);
  await ctx.close();
  console.log("ALL UNIFIED AUTH/NAVIGATION CHECKS PASSED");
} finally {
  await browser.close();
}

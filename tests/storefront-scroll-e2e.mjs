/** Storefront scroll regression: use ONLY a verified isolated local test server. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const origin = new URL(base);
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/") throw new Error("Only a local test server is permitted.");
if (!process.env.E2E_DATA_DIR) throw new Error("Set the disposable test directory.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200);
const proof = await safety.json();
assert.equal(proof.isolated, true);
assert.equal(proof.storeHash, createHash("sha256").update(data).digest("hex"));

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on("pageerror", (error) => errors.push(error.message));
  const go = async (url) => {
    await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1200);
  };
  const primary = page.locator('nav[aria-label="Primary"]');
  const link = (label) => primary.getByRole("link", { name: label, exact: true });
  const bottom = async () => {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    await page.waitForTimeout(120);
    const state = await page.evaluate(() => ({ y: scrollY, footer: document.querySelector("footer").getBoundingClientRect().top < innerHeight }));
    assert(state.y > 300 && state.footer, `expected to start from the footer: ${JSON.stringify(state)}`);
  };
  const recordFrames = async () => page.evaluate(() => {
    window.__scrollFrames = [];
    window.__recordScrollFrames = true;
    const frame = () => {
      if (!window.__recordScrollFrames) return;
      const footer = document.querySelector("footer")?.getBoundingClientRect();
      window.__scrollFrames.push({ path: location.pathname, query: location.search, title: document.querySelector("main h1")?.textContent?.trim(), y: scrollY,
        footer: Boolean(footer && footer.top < innerHeight && footer.bottom > 0) });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const endFrames = async (title, matcher) => {
    await page.waitForTimeout(350);
    const frames = await page.evaluate(() => { window.__recordScrollFrames = false; return window.__scrollFrames; });
    const destination = frames.filter((frame) => frame.title === title && matcher(frame));
    assert(destination.length, `no destination paint frames for ${title}: ${JSON.stringify(frames.slice(-12))}`);
    assert(destination[0].y <= 3 && !destination[0].footer, `destination first painted at footer: ${JSON.stringify(destination.slice(0, 8))}`);
    assert(destination.slice(0, 6).every((frame) => frame.y <= 3 && !frame.footer), `destination jumped after first paint: ${JSON.stringify(destination.slice(0, 8))}`);
  };

  await go("/");
  await bottom(); await recordFrames();
  await link("Shop").click();
  await page.waitForURL(/\/home-grocery$/, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Shop", exact: true }).waitFor();
  await endFrames("Shop", (frame) => frame.path === "/home-grocery");
  console.log("PASS path navigation from footer paints the new page at the top");

  await bottom();
  await link("Shop").click();
  await page.waitForFunction(() => scrollY < 3, null, { timeout: 5000 });
  assert.match(page.url(), /\/home-grocery$/);
  console.log("PASS clicking the current page returns to the top without changing the route");

  await link("Grocery").click(); await page.waitForURL(/\/grocery$/, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Grocery", exact: true }).waitFor();
  await bottom(); await recordFrames();
  await link("Dates").click();
  await page.waitForURL(/\/grocery\?category=dates$/, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Dates", exact: true }).waitFor();
  await endFrames("Dates", (frame) => frame.path === "/grocery" && frame.query.includes("category=dates"));
  console.log("PASS same-path category-query navigation paints at the top");

  // URL-backed filter changes are not page navigation and must not reset scroll.
  await page.evaluate(() => window.scrollTo({ top: 250, behavior: "instant" }));
  await page.waitForTimeout(100);
  const beforeFilter = await page.evaluate(() => scrollY);
  await page.locator('#filters-category-dates-ajwa').check();
  await page.waitForURL(/category=dates-ajwa.*scope=dates/, { timeout: 30_000 });
  await page.waitForTimeout(400);
  const afterFilter = await page.evaluate(() => scrollY);
  assert(Math.abs(afterFilter - beforeFilter) <= 4, `filter unexpectedly reset scroll: ${beforeFilter} -> ${afterFilter}`);
  console.log("PASS in-place filter/query updates retain the shopper's scroll position");

  await bottom(); await recordFrames();
  await link("Grocery").click();
  await page.waitForURL(/\/grocery$/, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Grocery", exact: true }).waitFor();
  await endFrames("Grocery", (frame) => frame.path === "/grocery" && frame.query === "");
  console.log("PASS same-path query-to-plain navigation paints at the top");

  await page.evaluate(() => window.scrollTo({ top: 650, behavior: "instant" }));
  await page.waitForTimeout(150);
  const saved = await page.evaluate(() => scrollY);
  assert(saved > 300);
  await link("Dates").click();
  await page.getByRole("heading", { name: "Dates", exact: true }).waitFor();
  await page.waitForTimeout(300);
  await page.goBack({ waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/grocery$/, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Grocery", exact: true }).waitFor();
  await page.waitForTimeout(800);
  const restored = await page.evaluate(() => scrollY);
  assert(Math.abs(saved - restored) <= 40, `Back should restore the prior position, not force the top: ${saved} -> ${restored}`);
  await page.goForward({ waitUntil: "domcontentloaded" });
  await page.waitForURL(/category=dates/, { timeout: 30_000 });
  await page.getByRole("heading", { name: "Dates", exact: true }).waitFor();
  console.log("PASS browser Back/Forward keeps route state and restores the previous page position");

  // Search calls router.push rather than clicking a Link; this must also reset a
  // same-path query navigation from the footer.
  await go("/home-grocery?q=banana");
  await bottom();
  const search = page.locator("header").getByRole("search").first();
  await search.getByLabel("Search for products").fill("tomato");
  await search.getByLabel("Search for products").press("Enter");
  await page.waitForURL(/\/home-grocery\?q=tomato$/, { timeout: 30_000 });
  await page.waitForFunction(() => scrollY < 3, null, { timeout: 10_000 });
  console.log("PASS programmatic search navigation on the same page returns to top");

  await go("/about");
  await page.getByRole("link", { name: "Meet the team" }).click();
  await page.waitForURL(/\/about#about-team$/, { timeout: 10_000 });
  await page.waitForTimeout(400);
  let fragment = await page.evaluate(() => ({ y: scrollY, top: document.querySelector("#about-team").getBoundingClientRect().top, height: innerHeight }));
  assert(fragment.y > 300 && fragment.top >= -3 && fragment.top < fragment.height, `same-page fragment was overridden: ${JSON.stringify(fragment)}`);
  await link("Home").click(); await page.waitForURL(/\/$/, { timeout: 30_000 });
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => scrollY < 3));
  // An ordinary cross-page fragment link should also land on the target. The
  // temporary test anchor exists only in this browser document, not the app.
  await page.evaluate(() => {
    const a = document.createElement("a"); a.href = "/about#about-team"; a.textContent = "Test fragment"; a.id = "test-fragment";
    Object.assign(a.style, { position: "fixed", top: "0", left: "0", zIndex: "99999", background: "white" }); document.body.append(a);
  });
  await page.locator("#test-fragment").click();
  await page.waitForURL(/\/about#about-team$/, { timeout: 30_000 });
  await page.locator("#about-team").waitFor(); await page.waitForTimeout(700);
  fragment = await page.evaluate(() => ({ y: scrollY, top: document.querySelector("#about-team").getBoundingClientRect().top, height: innerHeight }));
  assert(fragment.y > 300 && fragment.top >= -3 && fragment.top < fragment.height, `cross-page fragment was overridden: ${JSON.stringify(fragment)}`);
  console.log("PASS deliberate same-page and cross-page fragment navigation is preserved");

  assert.deepEqual(errors, []);
  console.log("ALL STOREFRONT SCROLL CHECKS PASSED");
} finally { await browser.close(); }

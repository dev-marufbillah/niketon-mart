/* Synthetic local browser smoke only. Never run against a real database or Google account. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3107";
const url = new URL(base);
if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/") throw new Error("Local HTTP test server only.");
if (!process.env.E2E_DATA_DIR || !process.env.E2E_OWNER_PASSWORD) throw new Error("Marked isolated test store and test owner password are required.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200);
const handshake = await safety.json();
assert.equal(handshake.isolated, true);
assert.equal(handshake.storeHash, createHash("sha256").update(data).digest("hex"));

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const log = (s) => console.log(`PASS ${s}`);
const expectedClient = "niketon-fake-test.apps.googleusercontent.com";
const fakeSecret = "fake-only-not-a-real-google-secret";
try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  // The browser never sends anything to Google during this synthetic test.
  await context.route("https://accounts.google.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Fake consent for isolated test</h1>" }));
  const start = await context.request.get(`${base}/api/auth/google/start?next=%2Fadmin`, { maxRedirects: 0 });
  assert.equal(start.status(), 303);
  const auth = new URL(start.headers().location);
  assert.equal(auth.origin, "https://accounts.google.com");
  assert.equal(auth.searchParams.get("client_id"), expectedClient, "refuse to use real Google credentials");
  assert.equal(auth.searchParams.get("response_type"), "code");
  assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  assert(auth.searchParams.get("state") && auth.searchParams.get("nonce") && auth.searchParams.get("code_challenge"));
  assert.equal(auth.searchParams.get("redirect_uri"), `${base}/api/auth/google/callback`);
  const cookie = (await context.cookies(base)).find((entry) => entry.name === "nm_google_oauth");
  assert(cookie?.httpOnly && cookie.sameSite === "Lax");
  const rejected = await context.request.get(`${base}/api/auth/google/callback?code=not-real&state=wrong`, { maxRedirects: 0 });
  assert.equal(rejected.status(), 303);
  assert.match(rejected.headers().location, /google=invalid_flow/);
  assert(!(await context.cookies(base)).some((entry) => entry.name === "nm_customer_session" || entry.name === "nm_admin_session"));
  assert(!(await context.cookies(base)).some((entry) => entry.name === "nm_google_oauth"));
  log("synthetic Google start uses PKCE/state/nonce/HttpOnly and rejects invalid state without a session");

  const cancelledStart = await context.request.get(`${base}/api/auth/google/start?next=%2Fcart`, { maxRedirects: 0 });
  const cancelledState = new URL(cancelledStart.headers().location).searchParams.get("state");
  const cancelled = await context.request.get(`${base}/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(cancelledState)}`, { maxRedirects: 0 });
  assert.equal(cancelled.status(), 303); assert.match(cancelled.headers().location, /google=cancelled/);
  assert(!(await context.cookies(base)).some((entry) => entry.name === "nm_customer_session"));
  log("cancelled Google consent does not create a customer session");

  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto(`${base}/my-account/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const button = page.getByRole("link", { name: "Sign in with Google" });
    await button.waitFor({ state: "visible", timeout: 30_000 });
    assert(await button.locator("img").evaluate((img) => img.complete && img.naturalWidth > 0));
    assert((await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1, `horizontal overflow at ${width}px`);
    assert(!(await page.content()).includes(fakeSecret), "client secret must never appear in HTML");
  }
  log("Google's official button renders on desktop and mobile without horizontal overflow or secret leakage");

  const suffix = randomBytes(6).toString("hex"), email = `google-smoke-${suffix}@example.invalid`, password = `Test-${suffix}-Pass123`;
  await page.goto(`${base}/my-account/register`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("link", { name: "Sign in with Google" }).waitFor();
  await page.locator('input[name="firstName"]').fill("Test");
  await page.locator('input[name="lastName"]').fill("Customer");
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="phone"]').fill("01700000000");
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.locator('input[name="acceptTerms"]').check();
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await page.waitForURL(/\/my-account\/personal-information$/, { timeout: 60_000 });
  const connection = page.getByRole("heading", { name: "Google sign-in" }).locator("..");
  await connection.locator('input[name="currentPassword"]').fill("wrong-password");
  await connection.getByRole("button", { name: "Connect Google" }).click();
  await connection.getByRole("alert").waitFor({ timeout: 30_000 });
  assert.match(await connection.getByRole("alert").innerText(), /not your current password/);
  await connection.locator('input[name="currentPassword"]').fill(password);
  const consent = page.waitForRequest((req) => req.url().startsWith("https://accounts.google.com/") && req.url().includes("client_id="), { timeout: 45_000 });
  await connection.getByRole("button", { name: "Connect Google" }).click();
  const request = await consent;
  const linkUrl = new URL(request.url());
  assert.equal(linkUrl.searchParams.get("client_id"), expectedClient);
  assert.equal(linkUrl.searchParams.get("code_challenge_method"), "S256");
  const linkCookie = (await context.cookies(base)).find((entry) => entry.name === "nm_google_oauth");
  assert(linkCookie?.httpOnly);
  const payload = JSON.parse(Buffer.from(linkCookie.value.split(".")[0], "base64url").toString("utf8"));
  assert.equal(payload.mode, "link"); assert(payload.customerId && payload.passwordStamp);
  assert(!linkCookie.value.includes(password));
  const linkCancelled = await context.request.get(`${base}/api/auth/google/callback?error=access_denied&state=${encodeURIComponent(linkUrl.searchParams.get("state"))}`, { maxRedirects: 0 });
  assert.equal(linkCancelled.status(), 303);
  assert.match(linkCancelled.headers().location, /personal-information\?google=cancelled/);
  const store = JSON.parse(await fs.readFile(path.join(data, "db.json"), "utf8"));
  const user = store.collections.customers.find((entry) => entry.email === email);
  assert(user?.passwordHash && !user.googleSubjectHash && !user.staffAdminId);
  log("password registration still works; linking requires correct password; cancellation never binds Google");
  await context.close();

  const staff = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const staffPage = await staff.newPage();
  await staffPage.goto(`${base}/my-account/login?next=%2Fadmin`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await staffPage.locator('input[name="email"]').first().fill("marufsalauddin76@gmail.com");
  await staffPage.locator('input[name="password"]').fill(process.env.E2E_OWNER_PASSWORD);
  await staffPage.getByRole("button", { name: "Sign In", exact: true }).click();
  await staffPage.waitForURL(/\/admin$/, { timeout: 45_000 });
  const staffCookies = await staff.cookies(base);
  assert(staffCookies.some((entry) => entry.name === "nm_admin_session"));
  assert(!staffCookies.some((entry) => entry.name === "nm_customer_session"));
  log("staff password login still creates only the protected staff session");
  assert.deepEqual(pageErrors, []);
  await staff.close();
  console.log("ALL SYNTHETIC GOOGLE LOCAL SMOKES PASSED (no real Google login was performed)");
} finally { await browser.close(); }

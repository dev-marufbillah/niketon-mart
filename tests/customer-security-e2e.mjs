/** Browser integration with a marked disposable file store and LOOPBACK mock
 * mail only. The test refuses remote servers and never contacts a provider. */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const url = new URL(base);
if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/" || url.username || url.password) throw new Error("Only a local test server is allowed.");
if (!process.env.E2E_DATA_DIR || !process.env.E2E_OWNER_PASSWORD) throw new Error("Set disposable store and test-only owner password.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200);
const proof = await safety.json();
assert.equal(proof.isolated, true);
assert.equal(proof.storeHash, createHash("sha256").update(data).digest("hex"));
const db = async () => JSON.parse(await fs.readFile(path.join(data, "db.json"), "utf8"));
const mailbox = [];
const mail = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/emails") { res.writeHead(404); res.end(); return; }
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => { try { mailbox.push(JSON.parse(body)); res.writeHead(202); res.end("{}"); } catch { res.writeHead(400); res.end(); } });
});
await new Promise((resolve, reject) => { mail.once("error", reject); mail.listen(3666, "127.0.0.1", resolve); });
const lastLink = (kind) => {
  const entry = [...mailbox].reverse().find((item) => item.subject.toLowerCase().includes(kind));
  assert(entry, `Missing ${kind} mock email`);
  const found = entry.text.match(/http:\/\/localhost:3000\/my-account\/(?:verify-email|reset-password)#token=[a-f0-9]{64}/);
  assert(found, "Link must use the local origin and a token fragment");
  return found[0];
};
const run = randomBytes(6).toString("hex");
const initialEmail = `security-${run}@example.invalid`;
const changedEmail = `changed-${run}@example.invalid`;
const oldPassword = `Old-${randomBytes(12).toString("hex")}8`;
const newPassword = `New-${randomBytes(12).toString("hex")}9`;
const errors = [];
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
  const customerContext = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  const customer = await customerContext.newPage();
  customer.on("pageerror", (e) => errors.push(e.message));
  const ready = async (page, target) => {
    await page.goto(target.startsWith("http") ? target : `${base}${target}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(800);
  };
  const register = async () => {
    await ready(customer, "/my-account/register");
    for (const [name, value] of Object.entries({ firstName: "Security", lastName: "Shopper", email: initialEmail, phone: "01700000000", password: oldPassword, confirmPassword: oldPassword })) {
      await customer.locator(`input[name="${name}"]`).first().fill(value);
    }
    await customer.locator('input[name="acceptTerms"]').check();
    await customer.getByRole("button", { name: "Create Account", exact: true }).click();
    await customer.waitForURL(/\/my-account\/personal-information/, { timeout: 40_000 });
  };
  const login = async (page, email, password) => {
    await ready(page, "/my-account/login");
    await page.locator('input[name="email"]').first().fill(email);
    await page.locator('input[name="password"]').first().fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
  };
  const requestReset = async (page, email) => {
    await ready(page, "/my-account/forgot-password");
    await page.getByRole("textbox", { name: "Customer email" }).fill(email);
    await page.getByRole("button", { name: "Request reset link" }).click();
    await page.locator('form [role="status"]').waitFor({ timeout: 25_000 });
    return (await page.locator('form [role="status"]').innerText()).trim();
  };
  const verify = async (page, link) => {
    await ready(page, link);
    assert(!new URL(page.url()).hash, "fragment should be removed after hydration");
    await page.getByRole("button", { name: "Verify email", exact: true }).click();
  };
  const note = (label) => console.log(`PASS ${label}`);

  await register();
  assert.equal(mailbox.length, 1, "signup sends one verification to the mock provider");
  assert.deepEqual(mailbox[0].to, [initialEmail]);
  const verificationLink = lastLink("verify");
  const response = await customerContext.request.get(`${base}/my-account/verify-email`);
  assert.equal(response.headers()["referrer-policy"], "no-referrer");
  assert.match(response.headers()["cache-control"], /no-store/);
  await verify(customer, verificationLink);
  await customer.getByRole("status").filter({ hasText: "Email verified" }).waitFor();
  const afterVerify = (await db()).collections.customers.find((row) => row.email === initialEmail);
  assert.equal(afterVerify.emailVerified, true); assert.equal(afterVerify.emailVerificationHash, null);
  await verify(customer, verificationLink);
  await customer.getByRole("alert").filter({ hasText: "Invalid, expired or already used" }).waitFor();
  note("signup mock verification is fragment-only, no-store, single-use and sets verified status");

  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await login(second, initialEmail, oldPassword);
  await second.waitForURL(/\/my-account\/personal-information/, { timeout: 30_000 });
  const anonContext = await browser.newContext();
  const anon = await anonContext.newPage();
  const unknownResult = await requestReset(anon, `nobody-${run}@example.invalid`);
  const beforeResetMail = mailbox.length;
  const knownResult = await requestReset(anon, initialEmail);
  assert.equal(knownResult, unknownResult); assert.equal(mailbox.length, beforeResetMail + 1);
  const resetLink = lastLink("reset");
  await ready(anon, resetLink);
  assert(!new URL(anon.url()).hash, "fragment should be removed after hydration");
  await anon.locator('input[name="password"]').fill(newPassword);
  await anon.locator('input[name="confirm"]').fill(newPassword);
  await anon.getByRole("button", { name: "Reset password" }).click();
  await anon.getByRole("status").filter({ hasText: "Password reset" }).waitFor();
  const oldDevice = await secondContext.request.get(`${base}/my-account/personal-information`, { maxRedirects: 0 });
  const oldDeviceBody = await oldDevice.text();
  // A streamed App Router response can contain a meta redirect with HTTP 200.
  // Check both the absence of protected data and the actual browser redirect.
  assert(!oldDeviceBody.includes(initialEmail), "revoked session exposed account email");
  if (oldDevice.status() !== 200) {
    assert([303, 307, 308].includes(oldDevice.status()));
    assert.match(oldDevice.headers().location, /\/my-account\/login/);
  }
  await ready(second, "/my-account/personal-information");
  await second.waitForURL(/\/my-account\/login/, { timeout: 30_000 });
  assert(!(await anonContext.cookies(base)).some((cookie) => cookie.name === "nm_admin_session"));
  await login(second, initialEmail, oldPassword);
  await second.getByRole("alert").filter({ hasText: "could not be verified" }).waitFor();
  await login(second, initialEmail, newPassword);
  await second.waitForURL(/\/my-account\/personal-information/, { timeout: 30_000 });
  await ready(anon, resetLink);
  await anon.locator('input[name="password"]').fill(newPassword);
  await anon.locator('input[name="confirm"]').fill(newPassword);
  await anon.getByRole("button", { name: "Reset password" }).click();
  await anon.getByRole("alert").filter({ hasText: "Invalid, expired or already used" }).waitFor();
  note("generic reset request, single-use password update, old-device invalidation and staff isolation");

  // A link to the old verified email must stop working once a password-backed
  // email change is verified. The login address must not change before proof.
  await requestReset(anon, initialEmail);
  const staleReset = lastLink("reset");
  await ready(second, "/my-account/personal-information");
  assert.equal(await second.locator('form input[name="email"]').first().getAttribute("readonly"), "");
  const verifySection = second.locator("#verify-email");
  await verifySection.locator('input[name="email"]').fill(changedEmail);
  await verifySection.locator('input[name="currentPassword"]').fill("wrong-password9");
  await verifySection.getByRole("button", { name: "Send verification link" }).click();
  await verifySection.getByRole("alert").filter({ hasText: "not your current password" }).waitFor();
  await verifySection.locator('input[name="currentPassword"]').fill(newPassword);
  await verifySection.getByRole("button", { name: "Send verification link" }).click();
  await verifySection.getByRole("status").waitFor({ timeout: 25_000 });
  assert.equal((await db()).collections.customers.find((row) => row.email === initialEmail)?.email, initialEmail);
  assert.deepEqual(mailbox.at(-1).to, [changedEmail]);
  const newEmailLink = lastLink("verify");
  await verify(anon, newEmailLink);
  await anon.getByRole("status").filter({ hasText: "Email verified" }).waitFor();
  assert((await db()).collections.customers.find((row) => row.email === changedEmail));
  await ready(anon, staleReset);
  await anon.locator('input[name="password"]').fill(oldPassword);
  await anon.locator('input[name="confirm"]').fill(oldPassword);
  await anon.getByRole("button", { name: "Reset password" }).click();
  await anon.getByRole("alert").filter({ hasText: "Invalid, expired or already used" }).waitFor();
  await login(anon, changedEmail, newPassword);
  await anon.waitForURL(/\/my-account\/personal-information/, { timeout: 30_000 });
  note("email changes require current password and mailbox proof, then invalidate stale reset links");

  // Create pending digests and inspect the *actual serialized admin response*.
  const emailSection = anon.locator("#verify-email");
  await emailSection.locator('input[name="currentPassword"]').fill(newPassword);
  await emailSection.getByRole("button", { name: "Send verification link" }).click();
  await emailSection.getByRole("status").waitFor({ timeout: 25_000 });
  const resetRequester = await (await browser.newContext()).newPage();
  await requestReset(resetRequester, changedEmail);
  const stored = (await db()).collections.customers.find((row) => row.email === changedEmail);
  assert(stored.passwordHash && stored.sessionVersion && stored.passwordResetHash && stored.emailVerificationHash);
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await login(owner, "marufsalauddin76@gmail.com", process.env.E2E_OWNER_PASSWORD);
  await owner.waitForURL(/\/admin(?:\?|\/|$)/, { timeout: 30_000 });
  const adminResponse = await ownerContext.request.get(`${base}/admin/customers/${encodeURIComponent(stored.id)}`);
  assert.equal(adminResponse.status(), 200);
  const html = await adminResponse.text();
  for (const secret of [stored.passwordHash, stored.sessionVersion, stored.passwordResetHash, stored.emailVerificationHash]) {
    assert(!html.includes(secret), "admin response serialized a credential or token digest");
  }
  const guestAdmin = await (await browser.newContext()).request.get(`${base}/admin/customers/${encodeURIComponent(stored.id)}`, { maxRedirects: 0 });
  assert([302, 303, 307, 308].includes(guestAdmin.status()));
  note("admin customer detail response excludes credential/token digests and remains guarded");

  const responsive = await (await browser.newContext()).newPage();
  for (const width of [320, 768, 1366]) {
    await responsive.setViewportSize({ width, height: 860 });
    for (const route of ["/my-account/forgot-password", "/my-account/verify-email", "/my-account/reset-password"]) {
      await ready(responsive, route);
      assert((await responsive.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, `horizontal overflow at ${width} ${route}`);
    }
  }
  assert.deepEqual(errors, []);
  note("customer security pages fit mobile, tablet and desktop without horizontal overflow");
  console.log("ALL CUSTOMER SECURITY BROWSER CHECKS PASSED; disposable file store and loopback mock only.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => mail.close(resolve));
}

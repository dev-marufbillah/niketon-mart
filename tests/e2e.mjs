/** Browser regression suite. Run ONLY against the isolated development server
 * described in REMAINING_TASKS.md; it creates orders, accounts and uploads. */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import sharp from "sharp";
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const DATA = process.env.E2E_DATA_DIR || "/home/user/niketon-e2e-data";
const origin = new URL(BASE);
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/") {
  throw new Error("Refusing to run mutation tests against a non-local server.");
}
const realData = await fs.realpath(DATA);
assert.equal((await fs.readFile(path.join(realData, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable", "Missing disposable-store marker");
const safety = await fetch(`${origin.origin}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200, "The server has not enabled its isolated e2e safety handshake.");
const handshake = await safety.json();
assert.equal(handshake.storeHash, createHash("sha256").update(realData).digest("hex"), "Server and test do not use the same isolated file store.");
assert.equal(handshake.isolated, true);
const runId = `e2e-${randomBytes(8).toString("hex")}`;
const dbFile = path.join(DATA, "db.json");
const readDB = async () => JSON.parse(await fs.readFile(dbFile, "utf8"));
const modifyDB = async (fn) => { const db = await readDB(); fn(db.collections); const tmp = `${dbFile}.e2e.tmp`; await fs.writeFile(tmp, JSON.stringify(db)); await fs.rename(tmp, dbFile); };
const initial = await readDB();
assert(initial.collections.admin_users?.some((user) => user.id === "usr_super_admin" && user.email === "marufsalauddin76@gmail.com"), "Isolated owner was not bootstrapped");
assert.equal(initial.collections.orders?.length ?? 0, 0, "Use a fresh isolated store; orders already exist");
const testPassword = process.env.E2E_OWNER_PASSWORD;
assert(testPassword && testPassword.length >= 12, "Set E2E_OWNER_PASSWORD to the disposable server's owner password");
const invitedPassword = `Invite-${randomBytes(18).toString("base64url")}`;
const newPassword = `Reset-${randomBytes(18).toString("base64url")}`;
const customerPassword = `Shopper-${randomBytes(18).toString("base64url")}9`;
const mail = [];
const mockMail = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/emails") { res.writeHead(404).end(); return; }
  let text = ""; for await (const chunk of req) text += chunk;
  mail.push(JSON.parse(text)); res.writeHead(200, { "content-type": "application/json" }).end('{"id":"test-provider-accepted"}');
});
await new Promise((resolve, reject) => { mockMail.once("error", reject); mockMail.listen(3666, "127.0.0.1", resolve); });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
const results = [];
let context, page, owner, manager;
const errors = [];
// Optional focused run. Some checks depend on earlier steps; the full default
// suite is required for end-to-end coverage and always uses a disposable store.
const only = process.env.E2E_ONLY?.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
let skipped = 0;
async function step(name, fn) {
  if (only?.length && !only.some((part) => name.toLowerCase().includes(part))) { skipped += 1; return; }
  const before = new Set(browser.contexts());
  try { await fn(); results.push({ name, ok: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, ok: false, error: String(error.message).slice(0, 350) }); console.error(`FAIL ${name}: ${String(error.message).slice(0, 350)}`); }
  finally {
    // Failed assertions must not strand Chromium contexts and exhaust a small CI machine.
    for (const ctx of browser.contexts()) if (!before.has(ctx) && ctx !== manager && ctx !== context) await ctx.close().catch(()=>undefined);
  }
}
const waitReady = async (p) => { await p.waitForLoadState("domcontentloaded"); await p.waitForTimeout(1300); };
const goto = async (p, url) => { await p.goto(url.startsWith("http") ? url : `${BASE}${url}`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await waitReady(p); };
const waitText = (locator, text) => locator.getByText(text, { exact: false }).first().waitFor({ timeout: 20_000 });
async function adminLogin(p, email, password) {
  await goto(p, "/admin/login"); await p.getByRole("heading", { name: "Sign in", exact: true }).waitFor();
  const form = p.locator("form").filter({ has: p.getByRole("button", { name: "Sign In", exact: true }) });
  await form.locator('input[name="email"]').fill(email); await form.locator('input[name="password"]').fill(password);
  await form.getByRole("button", { name: "Sign In", exact: true }).click();
}
async function registerShopper(p, email) {
  await goto(p, "/my-account/register");
  await p.locator('input[name="firstName"]').fill("Test"); await p.locator('input[name="lastName"]').fill("Shopper");
  await p.locator('input[name="email"]').first().fill(email); await p.locator('input[name="phone"]').fill("01700000000");
  await p.locator('input[name="password"]').fill(customerPassword); await p.locator('input[name="confirmPassword"]').fill(customerPassword);
  await p.locator('input[name="acceptTerms"]').check(); await p.getByRole("button", { name: "Create Account", exact: true }).click();
  await p.waitForURL(/\/my-account\/personal-information/, { timeout: 30_000 }); await waitReady(p);
}
let inviteLink = "", resetLink = "", orderNumber = "", orderUrl = "", orderKey = "";
try {
  context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  page = await context.newPage(); page.on("pageerror", (error) => errors.push(error.message));
  await step("admin routes and uploads deny anonymous/expired sessions", async () => {
    const response = await context.request.post(`${BASE}/api/admin/media/upload`, { multipart: { file: { name: "bad.png", mimeType: "image/png", buffer: Buffer.from("bad") } } });
    assert.equal(response.status(), 403);
    await context.addCookies([{ name: "nm_admin_session", value: "expired-fake-token", url: BASE }]);
    await goto(page, "/admin/users"); assert.match(page.url(), /\/my-account\/login/);
    await context.clearCookies();
    const callback = await context.request.post(`${BASE}/api/payments/bkash/callback`, {data:{status:"paid",amount:1,signature:"forged"}});
    assert.equal(callback.status(),503);
  });
  await step("homepage natural scroll, sticky header and category rail at three widths", async () => {
    for (const vp of [{width:1366,height:768},{width:768,height:1024},{width:390,height:844}]) {
      await page.setViewportSize(vp); await goto(page, "/");
      const cat = page.locator('section[aria-labelledby="categories-title"]'); await cat.waitFor();
      const top = await page.evaluate(() => ({ top: Math.round(document.querySelector("header").getBoundingClientRect().top), sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      assert(top.top >= 0 && top.top <= 50, `unexpected initial header top ${top.top}`); assert(top.sw <= top.cw + 1);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let i = 1; i <= 9; i++) {
        await page.evaluate((y) => scrollTo({top:y,behavior:"instant"}), Math.round((height-vp.height)*i/9)); await page.waitForTimeout(90);
        const m = await page.evaluate(() => {
          const d=document.documentElement, h=document.querySelector("header").getBoundingClientRect(), c=document.querySelector('section[aria-labelledby="categories-title"]');
          const r=c.getBoundingClientRect(), prev=c.previousElementSibling?.getBoundingClientRect(), next=c.nextElementSibling?.getBoundingClientRect();
          return {sw:d.scrollWidth,cw:d.clientWidth,head:h.top,overlap:Boolean((prev && r.top < prev.bottom-2)||(next && next.top < r.bottom-2))};
        });
        assert(m.sw <= m.cw+1, `horizontal overflow at ${vp.width}`); assert(Math.abs(m.head) <= 1, `sticky header drift at ${vp.width}: ${m.head}`); assert(!m.overlap, `category overlap at ${vp.width}`);
      }
      await page.evaluate(() => scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"}));
      await page.waitForTimeout(200);
      assert(await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 4), `bottom was not reachable at width ${vp.width}`);
      const rail = await cat.locator("ul").evaluate((element) => { const y=scrollY, scrollable=element.scrollWidth>element.clientWidth+1; element.scrollLeft=180; return { scrollable, left:element.scrollLeft, sameY:scrollY===y }; });
      if(vp.width<1024) assert(rail.scrollable && rail.left>0 && rail.sameY, `rail did not scroll independently at ${vp.width}`);
    }
    await page.setViewportSize({width:1366,height:768}); await goto(page,"/");
    await page.locator('section[aria-labelledby="categories-title"] a[href*="category=fish"]').first().click();
    await page.waitForURL(/category=fish/);
    await page.locator('a[href^="/product/"]').first().waitFor({ state:"visible", timeout:20_000 });
  });
  await step("responsive home and product layouts with independent full-card links", async () => {
    const shopper = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const p = await shopper.newPage(); p.on("pageerror", (e) => errors.push(e.message));
    await registerShopper(p, `responsive-${runId}@example.invalid`);
    const freshCard = () => p.locator('#fresh-market article[data-product-id="p-prawns"]').first();
    const prepareCard = async (card) => {
      await card.waitFor({ state: "visible", timeout: 20_000 });
      await card.evaluate((el) => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 190, behavior: "instant" }));
      await p.waitForTimeout(250);
      const rect = await card.boundingBox(); assert(rect, "card has no bounds"); return rect;
    };
    const activateArea = async (card, xRatio, yRatio, button = "left") => {
      const rect = await prepareCard(card); const x = rect.x + rect.width * xRatio; const y = rect.y + rect.height * yRatio;
      const href = await card.locator("h3 a").getAttribute("href");
      const hit = await p.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href"), { x, y });
      assert.equal(hit, href, "the product surface must be a real link");
      await p.mouse.click(x, y, { button }); return href;
    };

    await goto(p, "/");
    const layout = await p.evaluate(() => {
      const featured = document.querySelector('#featured-products article[data-product-id]')?.getBoundingClientRect();
      const banners = [...document.querySelectorAll('#promotions article')].map((el) => el.getBoundingClientRect());
      const heroTitle = document.querySelector('#hero-title')?.getBoundingClientRect();
      const heroImage = document.querySelector('#top img')?.getBoundingClientRect();
      return { cardWidth: featured?.width, banners: banners.map((r) => ({left:r.left,right:r.right,top:r.top,bottom:r.bottom})), titleLeft: heroTitle?.left, imageLeft: heroImage?.left, width: innerWidth };
    });
    assert(layout.cardWidth <= 265, `desktop featured card is unexpectedly wide: ${layout.cardWidth}`);
    assert.equal(layout.banners.length, 2); assert(layout.banners.every((r) => r.left >= 0 && r.right <= layout.width));
    assert(layout.banners[0].right <= layout.banners[1].left, "desktop banners overlap");
    assert(layout.titleLeft < layout.imageLeft, "desktop hero order changed");

    let href = await activateArea(freshCard(), 0.5, 0.25);
    await p.waitForURL(`**${href}`, { timeout: 30_000 });
    await goto(p, "/"); href = await activateArea(freshCard(), 0.5, 0.98);
    await p.waitForURL(`**${href}`, { timeout: 30_000 });
    await goto(p, "/");
    const titleLink = freshCard().locator("h3 a"); href = await titleLink.getAttribute("href");
    await titleLink.focus(); await p.keyboard.press("Enter"); await p.waitForURL(`**${href}`, { timeout: 30_000 });
    await goto(p, "/");
    const popupPromise = shopper.waitForEvent("page", { timeout: 30_000 });
    href = await activateArea(freshCard(), 0.5, 0.25, "middle");
    const popup = await popupPromise; await popup.waitForLoadState("domcontentloaded");
    assert.equal(new URL(popup.url()).pathname, href); assert.equal(new URL(p.url()).pathname, "/"); await popup.close();

    const featured = p.locator('#featured-products article[data-product-id]').first(); await prepareCard(featured);
    const heart = featured.locator('button[aria-pressed]'); await heart.click();
    assert.equal(new URL(p.url()).pathname, "/"); assert.equal(await heart.getAttribute("aria-pressed"), "true");
    await heart.click(); assert.equal(await heart.getAttribute("aria-pressed"), "false");
    // Optioned products deliberately lead to their detail page now. Pick a
    // genuine quick-add product for the cart-overlay interaction test.
    await goto(p, "/home-grocery");
    const simpleCard = p.locator('article[data-product-id]').filter({ has: p.getByRole("button", { name: /^Add .* to cart$/ }) }).first();
    await prepareCard(simpleCard);
    const productName = (await simpleCard.locator("h3 a").innerText()).trim();
    await simpleCard.getByRole("button", { name: /^Add .* to cart$/ }).click();
    const cartButton = p.getByRole("button", { name: /Open cart, 1 items/ }); await cartButton.waitFor();
    assert.equal(new URL(p.url()).pathname, "/home-grocery"); await cartButton.click();
    const cart = p.getByRole("dialog", { name: "Your Cart" }); await waitText(cart, productName);
    await cart.getByRole("button", { name: "Close panel" }).click();

    await goto(p, "/");
    const rui = p.locator('#fresh-market article[data-product-id="p-rui-fish"]'); await prepareCard(rui);
    await rui.getByRole("button", { name: "Choose options for Fresh Rui Fish" }).click();
    await p.waitForURL(/\/product\/fresh-rui-fish$/, { timeout: 30_000 });
    await p.getByRole("radio", { name: /Curry cut/ }).click();
    assert.equal(await p.getByRole("radio", { name: /Curry cut/ }).getAttribute("aria-checked"), "true");
    const image = await p.locator('img[alt^="Fresh Rui Fish — image"]').first().boundingBox();
    assert(image && image.width <= 480 && image.height <= 360 && image.y + image.height < 768, "desktop product image does not fit");

    await goto(p, "/home-grocery?q=avocado");
    const soldOut = p.locator('article[data-product-id="p-avocado"]'); await prepareCard(soldOut);
    assert.equal(await soldOut.getByRole("button", { name: "Fresh Avocado is out of stock" }).isDisabled(), true);
    href = await activateArea(soldOut, 0.5, 0.25); await p.waitForURL(`**${href}`, { timeout: 30_000 });

    for (const { width, height, imageFirst } of [
      { width: 390, height: 844, imageFirst: true },
      { width: 767, height: 1024, imageFirst: true },
      { width: 768, height: 1024, imageFirst: false },
      { width: 1023, height: 900, imageFirst: false },
    ]) {
      await p.setViewportSize({ width, height }); await goto(p, "/");
      const hero = await p.evaluate(() => ({
        imageTop: document.querySelector('#top img')?.getBoundingClientRect().top,
        titleTop: document.querySelector('#hero-title')?.getBoundingClientRect().top,
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      }));
      assert(imageFirst ? hero.imageTop < hero.titleTop : hero.titleTop < hero.imageTop,
        `unexpected hero order at ${width}px`);
      assert(hero.sw <= hero.cw + 1, `horizontal overflow at ${width}px`);
    }
    await p.setViewportSize({ width: 390, height: 844 }); await goto(p, "/product/fresh-rui-fish");
    const mobileImage = await p.locator('img[alt^="Fresh Rui Fish — image"]').first().boundingBox();
    assert(mobileImage && Math.abs(mobileImage.width - mobileImage.height) < 2, "small-screen gallery aspect was changed");
    assert.deepEqual(errors, []); await shopper.close();
  });
  await step("English navigation, real category images, department pages and filters", async () => {
    await page.setViewportSize({width:1024,height:768}); await goto(page,"/");
    const primary=page.locator('nav[aria-label="Primary"]');
    for (const label of ["Home","Shop","Fresh Market","Grocery","Categories","About Us"]) assert.equal(await primary.getByRole("link",{name:label,exact:true}).count(),1,`missing ${label}`);
    assert.equal(await primary.getByRole("link",{name:"Blogs",exact:true}).count(),0);
    assert.equal(await page.locator("footer").getByRole("link",{name:"Blog",exact:true}).count(),1);
    assert.equal(await page.getByText("Check at checkout",{exact:true}).count(),0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth+1));
    await page.getByRole("button",{name:"Browse All Categories"}).click();
    const mega=page.locator("#category-mega-menu");
    assert((await mega.locator("li a").count())>0); assert.equal(await mega.locator("li a").count(),await mega.locator("li a img").count());
    const menuText=await mega.innerText();
    for(const c of (await readDB()).collections.categories) if(c.icon) assert(!menuText.includes(c.icon),`emoji still shown for ${c.name}`);
    await mega.getByRole("link",{name:/Fresh Fish/}).click(); await page.waitForURL(/\/fresh-market\?category=fish/); await waitReady(page);
    assert.equal(await page.locator('aside[aria-label="Product filters"]').getByLabel("Fresh Fish").isChecked(),true);
    const ids=await page.locator("main article[data-product-id]").evaluateAll((cards)=>cards.map((c)=>c.getAttribute("data-product-id")));
    const db=(await readDB()).collections; assert(ids.length>0); assert(ids.every((id)=>db.products.find((p)=>p.id===id)?.categoryId==="fish"));
    await page.getByRole("button",{name:"Browse All Categories"}).click(); await mega.getByRole("link",{name:/Fresh Vegetables/}).click();
    await page.waitForURL(/\/fresh-market\?category=vegetables/); await waitReady(page);
    assert.equal(await page.locator('aside[aria-label="Product filters"]').getByLabel("Fresh Vegetables").isChecked(),true);
    assert.equal(await page.locator('main article[data-product-id="p-rui-fish"]').count(),0);
    await page.locator("#shop-sort-desktop").selectOption("price-asc"); await page.waitForTimeout(400);
    assert.match(page.url(),/\/fresh-market\?category=vegetables&sort=price-asc/);
    await page.locator('aside[aria-label="Product filters"]').getByLabel("Fresh Vegetables").uncheck(); await page.waitForTimeout(400);
    await page.getByRole("button",{name:"Page 2"}).click(); await page.waitForTimeout(800);
    assert.match(page.url(),/\/fresh-market\?.*page=2/); assert(await page.evaluate(()=>scrollY>100),"pagination should scroll to results, not the page top");
    await primary.getByRole("link",{name:"Grocery",exact:true}).click(); await page.waitForURL(/\/grocery$/); await waitReady(page);
    assert.equal(await page.getByRole("heading",{name:"Grocery",level:1}).count(),1);
    const groceryIds=await page.locator("main article[data-product-id]").evaluateAll((cards)=>cards.map((c)=>c.getAttribute("data-product-id")));
    assert(groceryIds.length>0); assert(!groceryIds.includes("p-rui-fish"));
    assert(groceryIds.every((id)=>{ const product=db.products.find((p)=>p.id===id); const category=db.categories.find((c)=>c.id===product?.categoryId); return category && ["pantry","household","bakery"].includes(category.group); }));
    await primary.getByRole("link",{name:"Categories",exact:true}).click(); await page.waitForURL(/\/categories$/); await waitReady(page);
    assert.equal(await page.getByRole("heading",{name:"Categories",level:1}).count(),1); assert((await page.locator('main a[href*="category="] img').count())>0);
    await page.setViewportSize({width:390,height:844}); await goto(page,"/"); await page.getByRole("button",{name:"Open menu"}).click();
    const menu=page.getByRole("dialog",{name:"Menu"});
    for(const label of ["Fresh Market","Grocery","Categories"]) assert.equal(await menu.getByRole("link",{name:label,exact:true}).count(),1);
    assert((await menu.locator('a[href*="category="] img').count())>0);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth <= document.documentElement.clientWidth+1));
    await menu.getByRole("link",{name:/Fresh Fish/}).click(); await page.waitForURL(/\/fresh-market\?category=fish/); await page.waitForTimeout(600);
    assert.equal(await page.locator('[role="dialog"][aria-label="Menu"]').locator("..").getAttribute("aria-hidden"),"true");
    await page.setViewportSize({width:1366,height:768});
  });
  await step("drawer links, overlay locks and page-top navigation preserve anchors", async () => {
    const shopper=await browser.newContext({viewport:{width:1366,height:768}}); const p=await shopper.newPage(); p.on("pageerror",(e)=>errors.push(e.message));
    await registerShopper(p, `drawers-${runId}@example.invalid`);
    await goto(p,"/product/fresh-rui-fish");
    // The list is server-backed; wait until it has loaded before toggling it.
    await p.getByRole("button",{name:/Open wishlist/}).click();
    await p.getByRole("dialog",{name:"Wishlist"}).getByText("No saved products yet").waitFor({timeout:20_000});
    await p.getByRole("dialog",{name:"Wishlist"}).getByRole("button",{name:"Close panel"}).click();
    const wishlistSave = p.waitForResponse((response) => response.request().method() === "POST" && Boolean(response.request().headers()["next-action"]) && Boolean(response.request().postData()?.includes("expectedShopperId")), {timeout:20_000});
    await p.getByRole("button",{name:"Save Fresh Rui Fish to wishlist"}).click();
    await p.getByRole("button",{name:"Remove Fresh Rui Fish from wishlist"}).waitFor({timeout:20_000});
    assert.equal((await wishlistSave).ok(), true);
    await p.getByRole("radio",{name:/Curry cut/}).click(); await p.getByRole("button",{name:"Add to Cart",exact:true}).click();
    await p.getByRole("button",{name:/Open cart/}).click(); let cart=p.getByRole("dialog",{name:"Your Cart"}); await waitText(cart,"Estimated subtotal");
    assert.equal(await p.evaluate(()=>document.body.style.overflow),"hidden");
    await cart.getByRole("link",{name:"Proceed to Checkout"}).click(); await p.waitForURL(/\/checkout/); await p.waitForTimeout(800);
    assert.equal(await p.locator('[role="dialog"][aria-label="Your Cart"]').locator("..").getAttribute("aria-hidden"),"true"); assert.equal(await p.evaluate(()=>document.body.style.overflow),"");
    await p.getByRole("button",{name:/Open wishlist/}).click(); let wish=p.getByRole("dialog",{name:"Wishlist"}); await wish.getByRole("link",{name:"View full wishlist"}).click();
    await p.waitForURL(/\/wishlist$/); await p.waitForTimeout(700); assert.equal(await p.locator('[role="dialog"][aria-label="Wishlist"]').locator("..").getAttribute("aria-hidden"),"true");
    await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})); await p.getByRole("button",{name:/Open wishlist/}).click();
    wish=p.getByRole("dialog",{name:"Wishlist"}); await wish.getByRole("link",{name:"View full wishlist"}).click(); await p.waitForTimeout(500);
    assert.equal(await p.locator('[role="dialog"][aria-label="Wishlist"]').locator("..").getAttribute("aria-hidden"),"true"); assert(await p.evaluate(()=>scrollY<=1));
    await p.getByRole("button",{name:/Open cart/}).click(); cart=p.getByRole("dialog",{name:"Your Cart"}); await cart.getByRole("link",{name:"View shopping cart"}).click();
    await p.waitForURL(/\/cart$/); await p.waitForTimeout(700); assert.equal(await p.locator('[role="dialog"][aria-label="Your Cart"]').locator("..").getAttribute("aria-hidden"),"true");
    await goto(p,"/"); await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"}));
    await p.getByRole("link",{name:"My account",exact:true}).click(); await p.waitForURL(/\/my-account/); await p.waitForTimeout(900); assert(await p.evaluate(()=>scrollY<=1),"account must start at the top");
    await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})); await p.locator('nav[aria-label="Primary"]').getByRole("link",{name:"Home",exact:true}).click();
    await p.waitForURL(`${BASE}/`); await p.waitForTimeout(800); assert(await p.evaluate(()=>scrollY<=1),"home must start at the top");
    await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})); await p.locator('nav[aria-label="Primary"]').getByRole("link",{name:"Home",exact:true}).click(); await p.waitForTimeout(500); assert(await p.evaluate(()=>scrollY<=1),"same-page Home must scroll to top");
    await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})); await p.locator('nav[aria-label="Primary"]').getByRole("link",{name:"About Us",exact:true}).click();
    await p.waitForURL(/\/about$/); await p.waitForTimeout(700); assert(await p.evaluate(()=>scrollY<=1),"about must start at the top");
    if(await p.locator('#about-team').count()) { await p.getByRole("link",{name:"Meet the team"}).click(); await p.waitForTimeout(900); assert.match(p.url(),/#about-team/); assert(await p.evaluate(()=>scrollY>100),"in-page anchor must keep its intended scroll"); }
    await p.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:"instant"})); await p.locator('nav[aria-label="Primary"]').getByRole("link",{name:"Shop",exact:true}).click();
    await p.waitForURL(/\/home-grocery$/); await p.waitForTimeout(700); assert(await p.evaluate(()=>scrollY<=1),"shop must start at the top");
    // Same-path category navigation must save the prior scroll position before
    // the URL changes; query-only history must not poison the next path change.
    await p.locator('nav[aria-label="Primary"]').getByRole("link",{name:"Fresh Market",exact:true}).click(); await p.waitForURL(/\/fresh-market$/); await p.waitForTimeout(700);
    await p.evaluate(()=>scrollTo({top:800,behavior:"instant"})); await p.waitForTimeout(200);
    await p.getByRole("button",{name:"Browse All Categories"}).click(); await p.locator("#category-mega-menu").getByRole("link",{name:/Fresh Fish/}).click(); await p.waitForURL(/\/fresh-market\?category=fish/); await p.waitForTimeout(800);
    assert(await p.evaluate(()=>scrollY<=1),"category navigation should start at the top");
    await p.evaluate(()=>scrollTo({top:650,behavior:"instant"})); await p.goBack({waitUntil:"domcontentloaded"}); await p.waitForURL(/\/fresh-market$/); await p.waitForTimeout(800);
    assert(await p.evaluate(()=>scrollY>550),"query-only back should restore the previous scroll position");
    assert.equal(await p.locator('aside[aria-label="Product filters"]').getByLabel("Fresh Fish").isChecked(),false);
    await p.goForward({waitUntil:"domcontentloaded"}); await p.waitForURL(/\/fresh-market\?category=fish/); await p.waitForTimeout(800);
    assert(await p.evaluate(()=>scrollY>400),"query-only forward should restore its scroll position");
    assert.equal(await p.locator('aside[aria-label="Product filters"]').getByLabel("Fresh Fish").isChecked(),true);
    await p.locator('nav[aria-label="Primary"]').getByRole("link",{name:"About Us",exact:true}).click(); await p.waitForURL(/\/about$/); await p.waitForTimeout(700);
    assert(await p.evaluate(()=>scrollY<=1),"a normal navigation after query history must start at the top");
    await p.goBack({waitUntil:"domcontentloaded"}); await p.waitForURL(/\/fresh-market\?category=fish/); await p.waitForTimeout(800);
    assert(await p.evaluate(()=>scrollY>400),"path-changing back should restore its position");
    await p.locator('nav[aria-label="Primary"]').getByRole("link",{name:"Grocery",exact:true}).click(); await p.waitForURL(/\/grocery$/); await p.waitForTimeout(700);
    assert(await p.evaluate(()=>scrollY<=1),"a normal navigation after path history must start at the top");
    await p.setViewportSize({width:390,height:844}); await goto(p,"/"); await p.getByRole("button",{name:"Open menu"}).click();
    let menu=p.getByRole("dialog",{name:"Menu"}); assert.equal(await p.evaluate(()=>document.body.style.overflow),"hidden");
    await menu.getByRole("button",{name:/Cart \(/}).click(); await p.waitForTimeout(500); assert.equal(await p.evaluate(()=>document.body.style.overflow),"hidden","handoff to cart must retain lock");
    await p.getByRole("dialog",{name:"Your Cart"}).getByRole("button",{name:"Close panel"}).click(); await p.waitForTimeout(500); assert.equal(await p.evaluate(()=>document.body.style.overflow),"");
    await p.getByRole("button",{name:"Open menu"}).click(); menu=p.getByRole("dialog",{name:"Menu"}); await menu.getByRole("searchbox",{name:"Search for products"}).fill("fish"); await menu.getByRole("searchbox",{name:"Search for products"}).press("Enter");
    await p.waitForURL(/\/home-grocery\?q=fish/); await p.waitForTimeout(700); assert.equal(await p.locator('[role="dialog"][aria-label="Menu"]').locator("..").getAttribute("aria-hidden"),"true"); assert.equal(await p.evaluate(()=>document.body.style.overflow),"");
    await p.getByRole("button",{name:"Filters",exact:false}).click(); assert.equal(await p.evaluate(()=>document.body.style.overflow),"hidden"); await p.getByRole("button",{name:"Close filters"}).click(); await p.waitForTimeout(300); assert.equal(await p.evaluate(()=>document.body.style.overflow),"");
    assert.deepEqual(errors,[]); await shopper.close();
  });
  await step("SEO routes use configured origin and exclude private paths", async () => {
    const robots=await context.request.get(`${BASE}/robots.txt`); assert.equal(robots.status(),200); const text=await robots.text();
    assert(text.includes("Disallow: /admin")); assert(text.includes("Disallow: /order/")); assert(text.includes("/sitemap.xml"));
    const sitemap=await context.request.get(`${BASE}/sitemap.xml`); assert.equal(sitemap.status(),200); const xml=await sitemap.text();
    assert(!xml.includes("/product/fresh-rui-fish"), "sign-in-only product details do not belong in the public sitemap"); for(const path of ["/fresh-market","/grocery","/categories"]) assert(xml.includes(path)); assert(!xml.includes("/admin")); assert(!xml.includes("niketonmart.example.com"));
  });
  await step("public product and review payloads exclude private data and demo ratings", async () => {
    await modifyDB((db) => {
      const product = db.products.find((row) => row.id === "p-rui-fish");
      product.supplierSecret = "E2E-SUPPLIER-COST-SECRET"; product.purchaseCost = 987654321;
      product.preparation.groups[0].options[0].supplierCost = 987654321;
      db.homepage[0].copy.topPicks = { ...(db.homepage[0].copy.topPicks ?? {}), productIds: [product.id] };
      db.reviews.push({id:"e2e-review",productId:product.id,productName:product.name,name:"Test Reviewer",email:"private-reviewer@example.invalid",rating:4,title:"Genuine test review",body:"An isolated test review with a private email.",status:"approved",verifiedPurchase:true,verificationMethod:"account-session",orderNumber:"E2E-PRIVATE-ORDER",reported:false,createdAt:new Date().toISOString()});
    });
    const homeResponse = await page.goto(`${BASE}/`, { waitUntil:"domcontentloaded" }); const homeHtml=await homeResponse.text();
    assert(!homeHtml.includes("E2E-SUPPLIER-COST-SECRET") && !homeHtml.includes("987654321"), "Top Picks leaked private product data");
    await waitReady(page); assert.equal(await page.locator('#our-top-picks a[href="/product/fresh-rui-fish"]').count() > 0, true);
    const originalStatus = (await readDB()).collections.products.find((row) => row.id === "p-rui-fish").status;
    await modifyDB((db) => { delete db.products.find((row) => row.id === "p-rui-fish").status; });
    try {
      await goto(page, "/");
      assert.equal(await page.locator('#our-top-picks a[href="/product/fresh-rui-fish"]').count(), 1, "legacy published product should appear in Top Picks");
    } finally {
      await modifyDB((db) => { const product = db.products.find((row) => row.id === "p-rui-fish"); if (originalStatus === undefined) delete product.status; else product.status = originalStatus; });
    }
    await registerShopper(page, `payload-${runId}@example.invalid`);
    const response = await page.goto(`${BASE}/product/fresh-rui-fish`, { waitUntil:"domcontentloaded" }); const html=await response.text();
    assert(!html.includes("private-reviewer@example.invalid")); assert(!html.includes("E2E-PRIVATE-ORDER")); assert(!html.includes("E2E-SUPPLIER-COST-SECRET")); assert(!html.includes("987654321"));
    await waitReady(page); assert((await page.locator("body").innerText()).includes("(1 Review)"));
  });
  await step("owner login and immutable-owner management screen", async () => {
    owner=page; await adminLogin(owner,"marufsalauddin76@gmail.com",testPassword); await owner.waitForURL(/\/admin(?:\?.*)?$/, {timeout:30_000});
    await goto(owner,"/admin/users"); assert((await owner.locator("body").innerText()).includes("Protected"));
    await goto(owner,"/admin/users/usr_super_admin"); assert((await owner.locator("body").innerText()).includes("protected"));
    assert.equal(await owner.locator('input[name="role"]').count(),0); assert.equal(await owner.locator('input[name="password"]').count(),0);
    await goto(owner,"/admin/payments"); assert((await owner.getByText("Not implemented",{exact:true}).count()) > 0); assert.equal(await owner.getByText("Connected",{exact:true}).count(),0);
  });
  await step("admin page copy validates and persists to storefront and metadata", async () => {
    await goto(owner,"/admin/settings"); const form=owner.locator('form').filter({has:owner.locator('input[name="freshMarketPageTitle"]')});
    await form.locator('input[name="phone"]').fill("01700000001");
    await form.locator('input[name="freshMarketPageTitle"]').evaluate((input)=>input.removeAttribute("minlength"));
    await form.locator('input[name="freshMarketPageTitle"]').fill("A"); await form.getByRole("button",{name:"Save settings"}).click();
    await waitText(form,"Fresh Market page title must be 2–80 characters"); assert.notEqual((await readDB()).collections.settings.find((s)=>s.id==="site").cataloguePages?.freshMarket?.title,"A");
    await form.locator('input[name="phone"]').fill("01700000001"); await form.locator('input[name="freshMarketPageTitle"]').fill("Fresh Market Test Heading");
    await form.locator('textarea[name="freshMarketPageDescription"]').fill("Fresh Market test description."); await form.getByRole("button",{name:"Save settings"}).click(); await waitText(form,"Settings saved");
    const settings=(await readDB()).collections.settings.find((s)=>s.id==="site"); assert.equal(settings.cataloguePages.freshMarket.title,"Fresh Market Test Heading");
    await goto(owner,"/fresh-market"); assert.equal(await owner.getByRole("heading",{name:"Fresh Market Test Heading",level:1}).count(),1);
    assert.match(await owner.title(),/Fresh Market Test Heading/); assert.equal(await owner.locator('meta[name="description"]').getAttribute("content"),"Fresh Market test description.");
    await goto(owner,"/admin/settings"); assert.equal(await owner.locator('input[name="freshMarketPageTitle"]').inputValue(),"Fresh Market Test Heading");
  });
  await step("admin homepage updates are fresh across independent requests", async () => {
    const endpoint = `${BASE}/api/admin/home/top-picks`;
    const originalResponse = await context.request.get(endpoint); assert.equal(originalResponse.status(), 200);
    const original = (await originalResponse.json()).section;
    assert(original.productIds.includes("p-rui-fish"));
    const shopper = await browser.newContext({ viewport: { width: 1366, height: 768 } }); const p = await shopper.newPage();
    try {
      const denied = await shopper.request.put(endpoint, { data: { ...original, title: "Unauthorised change" } });
      assert.equal(denied.status(), 403);
      for (const title of ["Fresh Pick Check One", "Fresh Pick Check Two"]) {
        const input = title.endsWith("Two") ? { ...original, title, subtitle: "", ctaLabel: "", ctaHref: "" } : { ...original, title };
        const saved = await context.request.put(endpoint, { data: input }); assert.equal(saved.status(), 200);
        const reread = await context.request.get(endpoint); assert.equal(reread.status(), 200);
        const current = (await reread.json()).section;
        assert.equal(current.title, title, "admin API returned stale content");
        assert.equal(current.subtitle, input.subtitle); assert.equal(current.ctaLabel, input.ctaLabel);
        await goto(p, "/");
        assert.equal(await p.getByRole("heading", { name: title, exact: true }).count(), 1, "storefront returned stale homepage copy");
        assert.equal(await p.locator('#our-top-picks article[data-product-id="p-rui-fish"]').count(), 1);
        if (title.endsWith("Two")) {
          const headingRow = p.locator('#our-top-picks .container-page > div').first();
          assert.equal(await headingRow.getByRole("link").count(), 0, "a removed CTA must stay removed");
        }
      }
      // The existing admin editor uses the protected server action, not the API.
      await goto(owner, "/admin/home/our-top-picks");
      await owner.getByLabel("Section title").fill("Fresh Pick Check Editor");
      await owner.getByRole("button", { name: "Save changes" }).click(); await waitText(owner, "Saved — the homepage is up to date.");
      const afterEditor = await context.request.get(endpoint); assert.equal((await afterEditor.json()).section.title, "Fresh Pick Check Editor");
      await goto(p, "/"); assert.equal(await p.getByRole("heading", { name: "Fresh Pick Check Editor", exact: true }).count(), 1);
    } finally {
      const restored = await context.request.put(endpoint, { data: original }); assert.equal(restored.status(), 200);
      await shopper.close();
    }
  });
  await step("forged owner role is rejected by the server", async () => {
    await goto(owner,"/admin/users/new"); await owner.locator('input[name="name"]').fill("Forged Role"); await owner.locator('input[name="email"]').fill("forged@example.invalid");
    await owner.locator('select[name="role"]').evaluate((select) => { const option = new Option("Forged owner","owner"); select.add(option); select.value="owner"; });
    await owner.getByRole("button", {name:"Send invitation"}).click(); await waitText(owner,"Choose a non-owner admin role");
    assert.equal(mail.length,0); assert(!(await readDB()).collections.admin_users.some((user) => user.email==="forged@example.invalid"));
  });
  await step("invitation, password setup, replay prevention and role enforcement", async () => {
    await goto(owner,"/admin/users/new"); await owner.locator('input[name="name"]').fill("Test Product Manager"); await owner.locator('input[name="email"]').fill("manager@example.invalid");
    await owner.locator('select[name="role"]').selectOption("product_manager"); await owner.getByRole("button",{name:"Send invitation"}).click();
    await owner.waitForURL(/\/admin\/users\?invited=1/, {timeout:30_000}); assert.equal(mail.length,1);
    inviteLink=mail[0].text.match(/https?:\/\/\S+/)[0].replace("127.0.0.1","localhost"); const rawToken=new URLSearchParams(new URL(inviteLink).hash.slice(1)).get("token");
    let u=(await readDB()).collections.admin_users.find((row)=>row.email==="manager@example.invalid"); assert.equal(u.active,false); assert.equal(u.invitationStatus,"sent"); assert.notEqual(u.inviteHash,rawToken); assert(!JSON.stringify(u).includes(rawToken));
    manager=await browser.newContext({viewport:{width:1100,height:768}}); const m=await manager.newPage(); m.on("pageerror",(e)=>errors.push(e.message));
    await adminLogin(m,"manager@example.invalid",invitedPassword); await waitText(m,"could not be verified");
    await goto(m,inviteLink); await m.locator('input[name="password"]').fill(invitedPassword); await m.locator('input[name="confirm"]').fill(invitedPassword); await m.getByRole("button",{name:"Set password"}).click(); await waitText(m,"Password set");
    await m.goto(BASE+"/admin/login",{waitUntil:"domcontentloaded"}); // force a new document so the original fragment is read again
    await m.goto(inviteLink,{waitUntil:"domcontentloaded"}); await m.locator('input[name="password"]').fill(invitedPassword); await m.locator('input[name="confirm"]').fill(invitedPassword); await m.getByRole("button",{name:"Set password"}).click(); await waitText(m,"already used");
    await adminLogin(m,"manager@example.invalid",invitedPassword); await m.waitForURL(/\/admin(?:\?.*)?$/, {timeout:30_000});
    await goto(m,"/admin/users"); assert.match(m.url(),/denied=users.manage/); const blocked=await manager.request.get(`${BASE}/api/admin/home/top-picks`); assert.equal(blocked.status(),403);
    await goto(m,"/admin/settings"); assert.match(m.url(),/denied=settings.manage/);
    u=(await readDB()).collections.admin_users.find((row)=>row.email==="manager@example.invalid"); assert.equal(u.active,true); assert.equal(u.invitationStatus,"accepted"); assert.equal(u.inviteHash,null); assert(!JSON.stringify(u).includes(invitedPassword));
  });
  await step("admin reset link is single use and revokes prior sessions", async () => {
    const m=manager.pages()[0]; await goto(m,"/admin/forgot-password"); await m.locator('input[name="email"]').fill("manager@example.invalid"); await m.getByRole("button",{name:"Request reset link"}).click(); await waitText(m,"If an active account matches"); assert.equal(mail.length,2);
    resetLink=mail[1].text.match(/https?:\/\/\S+/)[0].replace("127.0.0.1","localhost");
    await goto(m,resetLink); await m.locator('input[name="password"]').fill(newPassword); await m.locator('input[name="confirm"]').fill(newPassword); await m.getByRole("button",{name:"Set password"}).click(); await waitText(m,"Password set");
    await goto(m,"/admin"); assert.match(m.url(),/\/my-account\/login/);
    await goto(m,resetLink); await m.locator('input[name="password"]').fill(newPassword); await m.locator('input[name="confirm"]').fill(newPassword); await m.getByRole("button",{name:"Set password"}).click(); await waitText(m,"already used");
    await adminLogin(m,"manager@example.invalid",newPassword); await m.waitForURL(/\/admin(?:\?.*)?$/, {timeout:30_000});
  });
  await step("expired invitations cannot activate an account", async () => {
    await goto(owner,"/admin/users/new"); await owner.locator('input[name="name"]').fill("Expired Invite"); await owner.locator('input[name="email"]').fill("expired@example.invalid");
    await owner.locator('select[name="role"]').selectOption("content_manager"); await owner.getByRole("button",{name:"Send invitation"}).click();
    await owner.waitForURL(/\/admin\/users\?invited=1/, {timeout:30_000}); assert.equal(mail.length,3);
    const link=mail[2].text.match(/https?:\/\/\S+/)[0].replace("127.0.0.1","localhost");
    await modifyDB((db)=>{db.admin_users.find((user)=>user.email==="expired@example.invalid").inviteExpiresAt="2000-01-01T00:00:00.000Z";});
    const m=manager.pages()[0]; await goto(m,link); await m.locator('input[name="password"]').fill(invitedPassword); await m.locator('input[name="confirm"]').fill(invitedPassword); await m.getByRole("button",{name:"Set password"}).click(); await waitText(m,"expired");
    assert.equal((await readDB()).collections.admin_users.find((user)=>user.email==="expired@example.invalid").active,false);
  });
  await step("expired reset and suspended administrator cannot sign in", async () => {
    const m=manager.pages()[0]; await goto(m,"/admin/forgot-password"); await m.locator('input[name="email"]').fill("manager@example.invalid"); await m.getByRole("button",{name:"Request reset link"}).click(); await waitText(m,"If an active account matches"); assert.equal(mail.length,4);
    const expiredLink=mail[3].text.match(/https?:\/\/\S+/)[0].replace("127.0.0.1","localhost");
    await modifyDB((db)=>{db.admin_users.find((u)=>u.email==="manager@example.invalid").resetExpiresAt="2000-01-01T00:00:00.000Z";});
    await goto(m,expiredLink); await m.locator('input[name="password"]').fill(invitedPassword); await m.locator('input[name="confirm"]').fill(invitedPassword); await m.getByRole("button",{name:"Set password"}).click(); await waitText(m,"expired");
    const id=(await readDB()).collections.admin_users.find((u)=>u.email==="manager@example.invalid").id;
    await goto(owner,`/admin/users/${id}`); await owner.locator('input[name="active"]').uncheck(); await owner.getByRole("button",{name:"Save account"}).click(); await owner.waitForURL(/saved=1/);
    await goto(m,"/admin"); assert.match(m.url(),/\/my-account\/login/); await adminLogin(m,"manager@example.invalid",newPassword); await waitText(m,"could not be verified");
    await manager.close(); manager=undefined;
    assert.equal((await readDB()).collections.admin_users.find((u)=>u.id===id).active,false);
  });
  await step("category creation, duplicate prevention, child relationship, visibility and reorder", async () => {
    await goto(owner,"/admin/catalogue/taxonomy"); const section=owner.locator("section").filter({has:owner.getByRole("heading",{name:"Categories",exact:true})});
    const form=section.locator("form");
    await form.getByLabel("New category name").fill("E2E Parent"); await form.getByLabel("New category slug").fill("e2e-parent"); await form.getByRole("button",{name:"Add",exact:true}).click(); await waitText(section,"E2E Parent");
    await form.getByLabel("New category name").fill("E2E Parent"); await form.getByLabel("New category slug").fill("different-slug"); await form.getByRole("button",{name:"Add",exact:true}).click(); await waitText(form,"already exists");
    await form.getByLabel("New category name").fill("E2E Child"); await form.getByLabel("New category slug").fill("e2e-child"); await form.getByLabel("Parent category").selectOption({label:"E2E Parent"}); await form.getByRole("button",{name:"Add",exact:true}).click(); await waitText(section,"E2E Child");
    let db=(await readDB()).collections; const parent=db.categories.find((r)=>r.slug==="e2e-parent"),child=db.categories.find((r)=>r.slug==="e2e-child"); assert.equal(child.parentId,parent.id);
    await section.locator("li").filter({hasText:"E2E Parent"}).first().getByRole("button",{name:"Edit"}).click();
    await form.getByLabel("Description").fill("Test category description"); await form.getByLabel("Show on homepage").uncheck(); await form.getByLabel("Show in category navigation").uncheck();
    await form.getByRole("button",{name:"Save",exact:true}).click(); await owner.waitForTimeout(900);
    db=(await readDB()).collections; assert.equal(db.categories.find((r)=>r.id===parent.id).showOnHome,false); assert.equal(db.categories.find((r)=>r.id===parent.id).showInNavigation,false);
    await goto(owner,"/"); assert.equal(await owner.locator('section[aria-labelledby="categories-title"]').getByText("E2E Parent").count(),0);
    await owner.getByRole("button",{name:"Browse All Categories"}).click(); assert.equal(await owner.locator("#category-mega-menu").getByText("E2E Parent").count(),0);
    await goto(owner,"/categories"); assert.equal(await owner.locator("main").getByText("E2E Parent").count(),0); assert.equal(await owner.locator("main").getByText("E2E Child").count(),0);
    await goto(owner,"/admin/catalogue/taxonomy"); const sectionAgain=owner.locator("section").filter({has:owner.getByRole("heading",{name:"Categories",exact:true})}); const formAgain=sectionAgain.locator("form");
    await sectionAgain.locator("li").filter({hasText:"E2E Parent"}).first().getByRole("button",{name:"Edit"}).click(); await formAgain.getByLabel("Show on homepage").check(); await formAgain.getByLabel("Show in category navigation").check(); await formAgain.getByRole("button",{name:"Save",exact:true}).click(); await owner.waitForTimeout(900);
    await sectionAgain.getByRole("button",{name:"Move E2E Parent up"}).click(); await owner.waitForTimeout(900); db=(await readDB()).collections; assert(db.categories.find((r)=>r.id===parent.id).order < parent.order);
    // Give isolated test products to the parent and child: the parent count
    // must include both exactly once, and hiding the parent must hide both.
    await modifyDB((collections)=>{
      const childProduct=collections.products.find((r)=>r.id==="p-rui-fish"); childProduct.categoryId=child.id; childProduct.categoryLabel=child.name;
      const parentProduct=collections.products.find((r)=>r.id==="p-hilsa"); parentProduct.categoryId=parent.id; parentProduct.categoryLabel=parent.name;
    });
    await goto(owner,`/home-grocery?category=${encodeURIComponent(parent.id)}`); assert((await owner.locator("body").innerText()).includes("Fresh Rui Fish"));
    await goto(owner,"/");
    assert.match(await owner.locator(`section[aria-labelledby="categories-title"] a[href="/home-grocery?category=${encodeURIComponent(parent.id)}"]`).first().innerText(), /2 Products/, "parent count must include direct and child products");
    await goto(owner,"/admin/catalogue/taxonomy"); const cat=owner.locator("section").filter({has:owner.getByRole("heading",{name:"Categories",exact:true})});
    const parentRow=cat.locator("li").filter({hasText:"E2E Parent"}).first(); await parentRow.getByRole("button",{name:"Delete E2E Parent"}).click(); await parentRow.getByRole("button",{name:"Delete",exact:true}).click(); await waitText(cat,"subcategory first");
    const childRow=cat.locator("li").filter({hasText:"E2E Child"}).first(); await childRow.getByRole("button",{name:"Delete E2E Child"}).click(); await childRow.getByRole("button",{name:"Delete",exact:true}).click(); await waitText(cat,"product still use this category");
    await cat.getByRole("button",{name:"Hide E2E Parent"}).click(); await owner.waitForTimeout(900);
    await goto(owner,`/home-grocery?category=${encodeURIComponent(child.id)}`); assert(!(await owner.locator("body").innerText()).includes("Fresh Rui Fish"));
    await goto(owner,"/"); assert.equal(await owner.locator('#our-top-picks a[href="/product/fresh-rui-fish"]').count(),0, "Top Picks must not expose a hidden category's product");
    await goto(owner,"/admin/catalogue/taxonomy"); const cat2=owner.locator("section").filter({has:owner.getByRole("heading",{name:"Categories",exact:true})}); await cat2.getByRole("button",{name:"Show E2E Parent"}).click(); await owner.waitForTimeout(900);
    const preserved=(await readDB()).collections.categories.find((r)=>r.id===parent.id); assert.equal(preserved.description,"Test category description"); assert.equal(preserved.showOnHome,true); assert.equal(preserved.showInNavigation,true);
    await goto(owner,"/");
    assert.match(await owner.locator(`section[aria-labelledby="categories-title"] a[href="/home-grocery?category=${encodeURIComponent(parent.id)}"]`).first().innerText(), /2 Products/);
    assert.equal(await owner.locator('#our-top-picks a[href="/product/fresh-rui-fish"]').count(),1, "Top Picks should reappear after unhiding its parent");
    await goto(owner,"/admin/catalogue/taxonomy");
    // Moving a parent in the existing admin must move its child products too,
    // even if the child's old stored group still says fresh.
    await cat2.locator("li").filter({hasText:"E2E Parent"}).first().getByRole("button",{name:"Edit"}).click(); await cat2.getByLabel("Navigation group").selectOption("pantry"); await cat2.locator("form").getByRole("button",{name:"Save",exact:true}).click(); await owner.waitForTimeout(700);
    await goto(owner,`/grocery?category=${encodeURIComponent(parent.id)}`); assert.equal(await owner.locator('main article[data-product-id="p-rui-fish"]').count(),1);
    await goto(owner,`/fresh-market?category=${encodeURIComponent(parent.id)}`); assert.equal(await owner.locator('main article[data-product-id="p-rui-fish"]').count(),0);
    await goto(owner,"/admin/catalogue/taxonomy"); const cat3=owner.locator("section").filter({has:owner.getByRole("heading",{name:"Categories",exact:true})}); await cat3.locator("li").filter({hasText:"E2E Parent"}).first().getByRole("button",{name:"Edit"}).click(); await cat3.getByLabel("Navigation group").selectOption("fresh"); await cat3.locator("form").getByRole("button",{name:"Save",exact:true}).click(); await owner.waitForTimeout(700);
    await modifyDB((collections)=>{
      for (const id of ["p-rui-fish", "p-hilsa"]) {
        const product=collections.products.find((r)=>r.id===id); product.categoryId="fish"; product.categoryLabel="Fresh Fish";
      }
    });
  });
  await step("authenticated image validation and local persistence", async () => {
    const bad=await context.request.post(`${BASE}/api/admin/media/upload`,{multipart:{folder:"e2e",file:{name:"fake.png",mimeType:"image/png",buffer:Buffer.from("not a png")}}}); assert.equal(bad.status(),415);
    const png=await sharp({create:{width:5,height:5,channels:3,background:"#f5c519"}}).png().toBuffer();
    const good=await context.request.post(`${BASE}/api/admin/media/upload`,{multipart:{folder:"e2e",file:{name:`${runId}.png`,mimeType:"image/png",buffer:png}}}); assert.equal(good.status(),200); const body=await good.json(); assert(body.url.startsWith("/uploads/e2e/"));
    const stored=(await readDB()).collections.media.find((m)=>m.id===body.id); assert.equal(stored.url,body.url); assert((await fs.stat(path.join(process.cwd(),"public",body.url))).size>0);
    const served=await context.request.get(`${BASE}${body.url}`); assert.equal(served.status(),200);
  });
  await step("category image upload and homepage persistence", async () => {
    await goto(owner,"/admin/catalogue/taxonomy"); const section=owner.locator("section").filter({has:owner.getByRole("heading",{name:"Categories",exact:true})});
    await section.locator("li").filter({hasText:"E2E Parent"}).first().getByRole("button",{name:"Edit"}).click();
    const png=await sharp({create:{width:8,height:8,channels:3,background:"#48a877"}}).png().toBuffer();
    await section.locator('input[type="file"]').setInputFiles({name:`${runId}.png`,mimeType:"image/png",buffer:png});
    await section.getByAltText("Category image preview").waitFor({timeout:20_000}); await section.locator("form").getByRole("button",{name:"Save",exact:true}).click(); await owner.waitForTimeout(1000);
    const category=(await readDB()).collections.categories.find((r)=>r.slug==="e2e-parent"); assert(category.image?.startsWith("/uploads/categories/"));
    await section.getByRole("button",{name:"Hide E2E Parent"}).click(); await owner.waitForTimeout(600); await section.getByRole("button",{name:"Show E2E Parent"}).click(); await owner.waitForTimeout(600);
    assert.equal((await readDB()).collections.categories.find((r)=>r.id===category.id).image, category.image);
    const originalImage = async (image) => { const src=await image.getAttribute("src"); const url=new URL(src,BASE); return url.pathname==="/_next/image" ? url.searchParams.get("url") : url.pathname; };
    await goto(owner,"/"); let homeImage=owner.locator('section[aria-labelledby="categories-title"] a').filter({hasText:"E2E Parent"}).locator("img"); assert.equal(await homeImage.count(),1); assert.equal(await originalImage(homeImage),category.image);
    await owner.getByRole("button",{name:"Browse All Categories"}).click(); let desktopImage=owner.locator('#category-mega-menu li a').filter({hasText:"E2E Parent"}).first().locator("img"); assert.equal(await originalImage(desktopImage),category.image);
    await goto(owner,"/categories"); assert.equal(await originalImage(owner.locator('main a').filter({hasText:"E2E Parent"}).first().locator("img")),category.image);
    await owner.setViewportSize({width:390,height:844}); await goto(owner,"/"); await owner.getByRole("button",{name:"Open menu"}).click();
    let mobileImage=owner.getByRole("dialog",{name:"Menu"}).locator('a[href*="category="]').filter({hasText:"E2E Parent"}).first().locator("img"); assert.equal(await originalImage(mobileImage),category.image);
    await owner.setViewportSize({width:1366,height:768}); await goto(owner,"/admin/catalogue/taxonomy"); const section2=owner.locator("section").filter({has:owner.getByRole("heading",{name:"Categories",exact:true})}); await section2.locator("li").filter({hasText:"E2E Parent"}).first().getByRole("button",{name:"Edit"}).click();
    const replacement=await sharp({create:{width:8,height:8,channels:3,background:"#bc6d23"}}).png().toBuffer();
    const file={name:`${runId}-replacement.png`,mimeType:"image/png",buffer:replacement};
    // A failed upload releases the form and allows the same file to be retried.
    await owner.route("**/api/admin/media/upload",async (route)=>{ await new Promise((resolve)=>setTimeout(resolve,600)); await route.fulfill({status:503,json:{error:"Temporary upload failure. Try again."}}); });
    const failedUpload=owner.waitForResponse((r)=>r.url().includes("/api/admin/media/upload") && r.request().method()==="POST");
    await section2.locator('input[type="file"]').setInputFiles(file); await section2.getByText(/Uploading/).first().waitFor();
    assert.equal(await section2.locator('form button[type="submit"]').isDisabled(),true);
    assert.equal(await section2.locator("li").filter({hasText:"E2E Parent"}).first().getByRole("button",{name:"Edit"}).isDisabled(),true);
    assert.equal((await failedUpload).status(),503); await waitText(section2,"Temporary upload failure.");
    assert.equal(await section2.locator('form button[type="submit"]').isEnabled(),true); assert.equal(await section2.locator('input[type="file"]').inputValue(),"");
    await owner.unroute("**/api/admin/media/upload");
    await owner.route("**/api/admin/media/upload",async (route)=>{ await new Promise((resolve)=>setTimeout(resolve,1000)); await route.continue(); });
    const uploadResponse=owner.waitForResponse((r)=>r.url().includes("/api/admin/media/upload") && r.request().method()==="POST"); await section2.locator('input[type="file"]').setInputFiles(file);
    await section2.getByText(/Uploading/).first().waitFor(); assert.equal(await section2.locator('form button[type="submit"]').isDisabled(),true);
    const uploaded=await uploadResponse; assert.equal(uploaded.status(),200); const replacementUrl=(await uploaded.json()).url; await owner.unroute("**/api/admin/media/upload");
    await owner.waitForFunction((url)=>{ const img=document.querySelector('img[alt="Category image preview"]'); const src=img?.getAttribute("src") ?? ""; return src.includes(url) || src.includes(encodeURIComponent(url)); },replacementUrl);
    // Conversely the uploader must be unavailable while its parent is saving.
    let releaseSave; const heldSave=new Promise((resolve)=>{releaseSave=resolve;});
    await owner.route("**/admin/catalogue/taxonomy",async (route)=>{ if(route.request().method()==="POST") await heldSave; await route.continue(); });
    const isSave=(r)=>new URL(r.url()).pathname==="/admin/catalogue/taxonomy" && r.request().method()==="POST";
    const saveResponse=owner.waitForResponse(isSave); const saveRequest=owner.waitForRequest((r)=>new URL(r.url()).pathname==="/admin/catalogue/taxonomy" && r.method()==="POST");
    const clickSave=section2.locator("form").getByRole("button",{name:"Save",exact:true}).click();
    try { await saveRequest; assert.equal(await section2.locator('input[type="file"]').isDisabled(),true); assert.equal(await section2.getByRole("button",{name:"Remove image"}).isDisabled(),true); }
    finally { releaseSave(); await clickSave.catch(()=>undefined); await owner.unroute("**/admin/catalogue/taxonomy"); }
    assert.equal((await saveResponse).status(),200); await owner.waitForTimeout(800);
    const changed=(await readDB()).collections.categories.find((r)=>r.id===category.id); assert.notEqual(changed.image,category.image);
    await goto(owner,"/"); await owner.getByRole("button",{name:"Browse All Categories"}).click(); desktopImage=owner.locator('#category-mega-menu li a').filter({hasText:"E2E Parent"}).first().locator("img"); assert.equal(await originalImage(desktopImage),changed.image);
    await owner.setViewportSize({width:390,height:844}); await goto(owner,"/"); await owner.getByRole("button",{name:"Open menu"}).click(); mobileImage=owner.getByRole("dialog",{name:"Menu"}).locator('a[href*="category="]').filter({hasText:"E2E Parent"}).first().locator("img"); assert.equal(await originalImage(mobileImage),changed.image); await owner.setViewportSize({width:1366,height:768});
  });
  await step("unused category and child can be deleted only after dependencies move", async () => {
    await goto(owner,"/admin/catalogue/taxonomy"); const section=owner.locator("section").filter({has:owner.getByRole("heading",{name:"Categories",exact:true})});
    for (const name of ["E2E Child","E2E Parent"]) {
      const row=section.locator("li").filter({hasText:name}).first(); await row.getByRole("button",{name:`Delete ${name}`}).click(); await row.getByRole("button",{name:"Delete",exact:true}).click(); await owner.waitForTimeout(900);
    }
    const categories=(await readDB()).collections.categories; assert(!categories.some((r)=>r.slug==="e2e-parent" || r.slug==="e2e-child"));
  });
  await step("checkout preserves preparation, zero-threshold delivery and rejects tampered total", async () => {
    await modifyDB((db)=>{db.settings.find((s)=>s.id==="site").commerce.freeShippingThreshold=0; db.settings.find((s)=>s.id==="site").commerce.taxRate=10;});
    // A separate customer must sign in before checkout, even while the owner is signed in elsewhere.
    const shopper=await browser.newContext({viewport:{width:1366,height:768}}); const p=await shopper.newPage(); p.on("pageerror",(e)=>errors.push(e.message));
    await registerShopper(p, `checkout-${runId}@example.invalid`);
    await goto(p,"/product/fresh-rui-fish"); await p.getByRole("radio",{name:/Curry cut/}).click(); assert.equal(await p.getByRole("radio",{name:/Curry cut/}).getAttribute("aria-checked"),"true");
    await p.getByPlaceholder("e.g. small pieces for a curry, keep the bones for stock").fill("small pieces please"); await p.getByRole("button",{name:"Add to Cart",exact:true}).click(); await waitText(p,"Estimated subtotal"); assert((await p.locator('[role="dialog"][aria-label="Your Cart"]').innerText()).includes("৳ 13"));
    await goto(p,"/checkout"); await p.locator('input[name="firstName"]').fill("Test"); await p.locator('input[name="lastName"]').fill("Shopper"); await p.locator('input[name="address"]').fill("House 12 Road 5 Test Lane"); await p.locator('input[name="city"]').fill("Dhaka"); await p.locator('input[name="phone"]').fill("01700000000"); await p.locator('input[name="email"]').first().fill("guest-checkout@example.invalid");
    await p.getByRole("button",{name:"Proceed to Payment"}).click(); await p.waitForURL(/step=payment/); await p.waitForTimeout(1500);
    const form=p.locator('form').filter({has:p.locator('input[name="expectedTotal"]')}); await form.locator('input[name="expectedTotal"]').evaluate((element)=>element.value="0.01");
    await form.getByRole("button",{name:/Place order/i}).click(); await waitText(p,"Prices or delivery charges changed"); assert.equal((await readDB()).collections.orders.length,0);
    // Supply forged prices and preparation charges while preserving the visible
    // total. The server must ignore these and use the catalogue configuration.
    await form.locator('input[name="items"]').evaluate((element)=>{ const items=JSON.parse(element.value); items[0].price=0.01; items[0].preparation.charge=-1000; for (const c of items[0].preparation.choices) c.charge=-1000; element.value=JSON.stringify(items); });
    await form.getByRole("button",{name:/Place order/i}).click(); await p.waitForURL(/\/order\//,{timeout:30_000});
    await p.locator("[data-private-order-link]").waitFor({timeout:20_000}); orderUrl = new URL(await p.locator("[data-private-order-link]").getAttribute("href"), BASE).href;
    orderKey=new URLSearchParams(new URL(orderUrl).hash.slice(1)).get("token"); assert(orderKey && orderKey.length===64); assert(!p.url().includes("t="));
    const order=(await readDB()).collections.orders[0]; orderNumber=order.number; assert.equal(order.currency,"BDT"); assert.equal(order.subtotal,13); assert.equal(order.tax,1.3); assert.equal(order.total,16.3); assert.equal(order.items[0].preparation.chargePerUnit,0.5); assert.equal(order.items[0].preparation.instructions,"small pieces please"); assert(order.items[0].preparation.options.some((o)=>o.label==="Curry cut" && o.charge===0.5));
    assert.equal(order.deliveryFee,2); assert.equal(order.accessToken,undefined); assert.equal(order.accessTokenHash,createHash("sha256").update(orderKey).digest("hex"));
    const orderCookies=await shopper.cookies(); assert(orderCookies.some((cookie)=>cookie.name.startsWith("nm_order_") && cookie.httpOnly && cookie.path===`/order/${orderNumber}`));
    const product=(await readDB()).collections.products.find((r)=>r.id==="p-rui-fish"); assert.equal(product.stock,39); assert.match(orderUrl,/#token=/);
    assert.equal(order.customerWasAuthenticated, true);
    // In the isolated fixture only, represent an older pre-signup guest order.
    // The real action no longer permits placing new orders as a guest.
    await modifyDB((db) => {
      const historical = db.orders.find((row) => row.id === order.id);
      const guestId = `legacy_guest_${runId}`;
      db.customers.push({id:guestId,name:"Test Shopper",email:"guest-checkout@example.invalid",phone:"01700000000",address:"House 12 Road 5 Test Lane",status:"active",notes:"",orderCount:1,totalSpent:historical.total,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      historical.customerId = guestId; historical.customerWasAuthenticated = false;
    });
    await shopper.close();
  });
  await step("guest order requires private token and is not claimed by email-only registration", async () => {
    assert(orderNumber && orderUrl,"checkout did not create a test order");
    const other=await browser.newContext(); const p=await other.newPage(); const requests=[]; p.on("request",(request)=>requests.push(request.url()));
    await goto(p,`/order/${orderNumber}`); let text=await p.locator("body").innerText(); assert(!text.includes("House 12 Road 5 Test Lane"));
    await goto(p,`/order/${orderNumber}/invoice`); assert((await p.locator("body").innerText()).includes("Invoice locked"));
    await registerShopper(p, "guest-checkout@example.invalid");
    await goto(p,"/my-account/orders"); text=await p.locator("body").innerText(); assert(!text.includes(orderNumber));
    await goto(p,orderUrl); await waitText(p,"House 12 Road 5 Test Lane"); assert(!p.url().includes("token=") && !p.url().includes("?t="));
    assert(!requests.some((url)=>url.includes(orderKey)), "Access key appeared in a network request URL");
    await goto(p,`/order/${orderNumber}/invoice`); assert((await p.locator("body").innerText()).includes("House 12 Road 5 Test Lane"));
    await other.close();
  });
  await step("signed-in checkout is visible only to its authenticated customer", async () => {
    const account=await browser.newContext({viewport:{width:1366,height:768}}); const p=await account.newPage();
    await registerShopper(p, "signed-owner@example.invalid");
    await goto(p,"/product/fresh-rui-fish"); await p.getByRole("radio",{name:/Curry cut/}).click(); await p.getByRole("button",{name:"Add to Cart",exact:true}).click(); await waitText(p,"Estimated subtotal");
    await goto(p,"/checkout"); await p.locator('input[name="firstName"]').fill("Signed"); await p.locator('input[name="lastName"]').fill("Customer"); await p.locator('input[name="address"]').fill("House 55 Test Road Dhaka"); await p.locator('input[name="city"]').fill("Dhaka"); await p.locator('input[name="phone"]').fill("01700000002"); await p.locator('input[name="email"]').first().fill("signed-owner@example.invalid");
    await p.getByRole("button",{name:"Proceed to Payment"}).click(); await p.waitForURL(/step=payment/); await p.waitForTimeout(1500); await p.getByRole("button",{name:/Place order/i}).click(); await p.waitForURL(/\/order\//,{timeout:30_000});
    const row=(await readDB()).collections.orders.find((r)=>r.customer.email==="signed-owner@example.invalid"); assert(row?.customerWasAuthenticated); assert(row.customerId);
    await account.clearCookies({name:/^nm_order_/}); await goto(p,`/order/${row.number}`); assert((await p.locator("body").innerText()).includes("House 55 Test Road"));
    await goto(p,"/my-account/orders"); assert((await p.locator("body").innerText()).includes(row.number));
    const stranger=await browser.newContext(); const q=await stranger.newPage(); await goto(q,`/order/${row.number}`); assert(!(await q.locator("body").innerText()).includes("House 55 Test Road"));
    await stranger.close(); await account.close();
  });
  await step("weight proposal preserves fixed preparation charge, rejects stale or forged approval, and requires customer confirmation", async () => {
    assert(orderNumber && orderUrl,"checkout did not create a test order");
    const orderId=(await readDB()).collections.orders.find((row)=>row.number===orderNumber).id;
    await goto(owner,`/admin/orders/${orderId}`); await owner.locator('input[name="grams:0"]').fill("1200"); await owner.getByRole("button",{name:"Save weights"}).click(); await waitText(owner,"waiting for the customer to approve");
    let row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.total,16.3); assert.equal(row.items[0].weight.actualLineTotal,15.5); assert.equal(row.items[0].weight.status,"proposed");
    assert.equal(await owner.getByRole("button",{name:"Apply the new total"}).count(),0);
    // Even a payment manager cannot mark a weight-proposed order paid.
    const payment = owner.locator("section").filter({has:owner.getByRole("heading",{name:"Verify payment"})});
    await payment.locator('input[name="reference"]').fill("E2E-REAL-CHECK"); await payment.locator('select[name="paymentStatus"]').selectOption("paid");
    await payment.getByRole("button",{name:"Save payment status"}).click(); await waitText(payment,"Complete weighing");
    assert.equal((await readDB()).collections.orders.find((r)=>r.id===orderId).paymentStatus,"unpaid");
    const guest=await browser.newContext(); const p=await guest.newPage(); await goto(p,orderUrl); await waitText(p,"New total if you agree:");
    assert((await p.locator("body").innerText()).includes("৳ 19.05"),"approval total must include incremental tax");
    const form=p.locator('form').filter({has:p.locator('input[name="fingerprint"]')});
    // Wait for the fragment-unlock refresh and hydration before modifying the live form.
    await p.waitForTimeout(2000); await form.locator('input[name="expectedTotal"]').evaluate((input)=>{input.value="1";input.setAttribute("value","1");});
    assert.equal(await form.locator('input[name="expectedTotal"]').inputValue(),"1"); await form.getByRole("button",{name:"Approve the new weight"}).click(); await waitText(p,"proposed weight or total changed");
    assert.equal((await readDB()).collections.orders.find((r)=>r.id===orderId).total,16.3);
    await goto(p,`/order/${orderNumber}`); await waitText(p,"New total if you agree:");
    // Store changes its proposal after the customer loaded the confirmation.
    await goto(owner,`/admin/orders/${orderId}`); await owner.locator('input[name="grams:0"]').fill("1300");
    // The old proposal already displays the same success text. Wait for the
    // new save response and persisted 1300g proposal, not that stale text.
    const reweighResponse=owner.waitForResponse((response)=>response.request().method()==="POST" && new URL(response.url()).pathname===`/admin/orders/${orderId}`);
    await owner.getByRole("button",{name:"Save weights"}).click(); assert.equal((await reweighResponse).status(),200);
    row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.items[0].weight.actualGrams,1300); assert.equal(row.items[0].weight.status,"proposed");
    await p.getByRole("button",{name:"Approve the new weight"}).click(); await waitText(p,"proposed weight or total changed");
    row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.total,16.3); assert.equal(row.items[0].weight.actualLineTotal,16.75);
    await goto(p,`/order/${orderNumber}`); await waitText(p,"New total if you agree:"); assert((await p.locator("body").innerText()).includes("৳ 20.43"));
    await p.getByRole("button",{name:"Approve the new weight"}).click(); await p.waitForTimeout(600);
    row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.items[0].weight.status,"approved"); assert.equal(row.total,20.43);
    await guest.close();
  });
  await step("reduction, reweigh and both waivers never restore a higher old amount", async () => {
    const orderId=(await readDB()).collections.orders.find((row)=>row.number===orderNumber).id;
    async function weigh(grams) {
      await goto(owner,`/admin/orders/${orderId}`); await owner.locator('input[name="grams:0"]').fill(String(grams));
      await owner.getByRole("button",{name:"Save weights"}).click(); await owner.waitForTimeout(900);
    }
    await weigh(800);
    let row=(await readDB()).collections.orders.find((r)=>r.id===orderId);
    assert.equal(row.items[0].lineTotal,10.5); assert.equal(row.items[0].weight.status,"approved"); assert.equal(row.total,13.55);
    await weigh(900); row=(await readDB()).collections.orders.find((r)=>r.id===orderId);
    assert.equal(row.items[0].lineTotal,10.5); assert.equal(row.items[0].weight.actualLineTotal,11.75); assert.equal(row.items[0].weight.difference,1.25); assert.equal(row.items[0].weight.status,"proposed"); assert.equal(row.total,13.55);
    const guest=await browser.newContext(); const p=await guest.newPage(); await goto(p,orderUrl); await waitText(p,"New total if you agree:");
    assert((await p.locator("body").innerText()).includes("৳ 14.93"));
    await p.getByRole("button",{name:"Keep my current amount"}).click(); await p.waitForTimeout(700);
    row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.items[0].lineTotal,10.5); assert.equal(row.items[0].weight.status,"waived"); assert.equal(row.total,13.55);
    await weigh(1000); row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.items[0].weight.status,"proposed");
    await goto(owner,`/admin/orders/${orderId}`); await owner.getByRole("button",{name:"Waive the difference"}).click(); await owner.waitForTimeout(700);
    row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.items[0].lineTotal,10.5); assert.equal(row.items[0].weight.status,"waived"); assert.equal(row.total,13.55);
    await guest.close();
  });
  await step("simultaneous customer approvals cannot apply the same increase twice", async () => {
    const orderId=(await readDB()).collections.orders.find((row)=>row.number===orderNumber).id;
    await goto(owner,`/admin/orders/${orderId}`); await owner.locator('input[name="grams:0"]').fill("1100"); await owner.getByRole("button",{name:"Save weights"}).click(); await waitText(owner,"waiting for the customer to approve");
    const before=(await readDB()).collections.orders.find((r)=>r.id===orderId); const prior=before.timeline.filter((e)=>e.status==="weight-approved").length;
    const guest=await browser.newContext(); const x=await guest.newPage(), y=await guest.newPage();
    await goto(x,orderUrl); await waitText(x,"New total if you agree:");
    await goto(y,`/order/${orderNumber}`); await waitText(y,"New total if you agree:");
    await Promise.all([x.getByRole("button",{name:"Approve the new weight"}).click(),y.getByRole("button",{name:"Approve the new weight"}).click()]);
    await x.waitForTimeout(1300);
    const row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.items[0].lineTotal,14.25); assert.equal(row.total,17.68);
    assert.equal(row.timeline.filter((e)=>e.status==="weight-approved").length,prior+1);
    await guest.close();
  });
  await step("weight reductions cap the frozen discount and waivers preserve the reduced amount", async () => {
    const signed=(await readDB()).collections.orders.find((r)=>r.customer.email==="signed-owner@example.invalid");
    await modifyDB((db)=>{const row=db.orders.find((r)=>r.id===signed.id); row.discount=12; row.checkoutDiscount=12; row.tax=0.1; row.total=3.1; });
    await goto(owner,`/admin/orders/${signed.id}`); await owner.locator('input[name="grams:0"]').fill("800"); await owner.getByRole("button",{name:"Save weights"}).click(); await owner.waitForTimeout(800);
    let row=(await readDB()).collections.orders.find((r)=>r.id===signed.id); assert.equal(row.subtotal,10.5); assert.equal(row.discount,10.5); assert.equal(row.checkoutDiscount,12); assert.equal(row.tax,0); assert.equal(row.total,2);
    await goto(owner,`/admin/orders/${signed.id}`); await owner.locator('input[name="grams:0"]').fill("1000"); await owner.getByRole("button",{name:"Save weights"}).click(); await waitText(owner,"waiting for the customer to approve");
    await goto(owner,`/admin/orders/${signed.id}`); await owner.getByRole("button",{name:"Waive the difference"}).click(); await owner.waitForTimeout(700);
    row=(await readDB()).collections.orders.find((r)=>r.id===signed.id); assert.equal(row.items[0].lineTotal,10.5); assert.equal(row.discount,10.5); assert.equal(row.checkoutDiscount,12); assert.equal(row.total,2);
  });
  await step("paid orders block both normal and forged weight edits", async () => {
    const orderId=(await readDB()).collections.orders.find((row)=>row.number===orderNumber).id;
    await modifyDB((db)=>{db.orders.find((r)=>r.id===orderId).paymentStatus="paid";});
    await goto(owner,`/admin/orders/${orderId}`); await waitText(owner,"Payment was recorded");
    const fieldset=owner.locator("fieldset").filter({has:owner.locator('input[name="grams:0"]')}); assert.equal(await owner.locator('input[name="grams:0"]').isDisabled(),true);
    // The server must reject it even if someone re-enables the disabled controls.
    await fieldset.evaluate((element)=>element.disabled=false); await owner.locator('input[name="grams:0"]').fill("900"); await owner.getByRole("button",{name:"Save weights"}).click();
    const weighingForm=owner.locator("form").filter({has:owner.locator('input[name="grams:0"]')}); await waitText(weighingForm,"Payment was recorded");
    const row=(await readDB()).collections.orders.find((r)=>r.id===orderId); assert.equal(row.items[0].lineTotal,14.25); assert.equal(row.total,17.68); assert.equal(row.paymentStatus,"paid");
  });
  await step("order managers cannot forge payment decisions", async () => {
    await goto(owner,"/admin/users/new"); await owner.locator('input[name="name"]').fill("Limited Order Manager"); await owner.locator('input[name="email"]').fill("orders-only@example.invalid");
    await owner.locator('select[name="role"]').selectOption("order_manager"); await owner.getByRole("button",{name:"Send invitation"}).click(); await owner.waitForURL(/\/admin\/users\?invited=1/, {timeout:30_000});
    const link=mail.at(-1).text.match(/https?:\/\/\S+/)[0].replace("127.0.0.1","localhost"); const ctx=await browser.newContext(); const p=await ctx.newPage();
    await goto(p,link); await p.locator('input[name="password"]').fill(invitedPassword); await p.locator('input[name="confirm"]').fill(invitedPassword); await p.getByRole("button",{name:"Set password"}).click(); await waitText(p,"Password set");
    await adminLogin(p,"orders-only@example.invalid",invitedPassword); await p.waitForURL(/\/admin(?:\?.*)?$/, {timeout:30_000});
    const orderId=(await readDB()).collections.orders.find((row)=>row.number===orderNumber).id; await goto(p,`/admin/orders/${orderId}`);
    assert.equal(await p.getByRole("heading",{name:"Verify payment"}).count(),0);
    const form=p.locator("form").filter({has:p.getByRole("button",{name:"Update order"})});
    await form.evaluate((element)=>{const forged=document.createElement("input"); forged.type="hidden"; forged.name="paymentStatus"; forged.value="unpaid"; element.append(forged);});
    await form.getByRole("button",{name:"Update order"}).click(); await waitText(p,"Payment decisions must be recorded");
    assert.equal((await readDB()).collections.orders.find((r)=>r.id===orderId).paymentStatus,"paid"); await ctx.close();
  });
  await step("refund records require a paid order and a separate verified reference", async () => {
    const signed=(await readDB()).collections.orders.find((r)=>r.customer.email==="signed-owner@example.invalid");
    const openForm=async()=>{ await goto(owner,`/admin/orders/${signed.id}`); return owner.locator("section").filter({has:owner.getByRole("heading",{name:"Verify payment"})}); };
    let form=await openForm();
    assert.equal(await form.locator('select[name="paymentStatus"]').inputValue(),"unpaid");
    await form.locator('select[name="paymentStatus"]').selectOption("refunded"); await form.locator('input[name="refundReference"]').fill("E2E-REFUND-1"); await form.locator('input[name="note"]').fill("Verified on test statement");
    await form.getByRole("button",{name:"Save payment status"}).click(); await waitText(form,"only for a paid order");
    assert.equal((await readDB()).collections.orders.find((r)=>r.id===signed.id).paymentStatus,"unpaid");
    await modifyDB((db)=>{const row=db.orders.find((r)=>r.id===signed.id); row.paymentStatus="paid"; row.payment.reference="E2E-PAYMENT-1";});
    form=await openForm(); await form.locator('select[name="paymentStatus"]').selectOption("refunded"); await form.getByRole("button",{name:"Save payment status"}).click();
    await form.locator('[role="alert"]').getByText("separate reference",{exact:false}).waitFor();
    assert.equal(await form.locator('select[name="paymentStatus"]').inputValue(),"refunded", "Validation must retain the selected decision");
    await form.locator('input[name="refundReference"]').fill("E2E-REFUND-1"); await form.locator('input[name="note"]').fill("Verified on test statement"); await form.getByRole("button",{name:"Save payment status"}).click(); await waitText(form,"Payment marked refunded");
    const row=(await readDB()).collections.orders.find((r)=>r.id===signed.id); assert.equal(row.paymentStatus,"refunded"); assert.equal(row.payment.reference,"E2E-PAYMENT-1"); assert.equal(row.payment.refundReference,"E2E-REFUND-1");
  });
  await step("browser page errors", async () => { assert.deepEqual(errors,[]); });
} finally {
  await browser.close(); await new Promise((resolve)=>mockMail.close(resolve));
  for (const folder of ["e2e", "categories"]) {
    const directory=path.join(process.cwd(),"public/uploads",folder);
    for (const name of await fs.readdir(directory).catch(()=>[])) if (name.includes(runId)) await fs.rm(path.join(directory,name),{force:true});
    await fs.rmdir(directory).catch(()=>undefined); // remove only an empty test folder
  }
}
console.log(`\n${results.filter((r)=>r.ok).length}/${results.length} checks passed${skipped ? `; ${skipped} skipped (focused run)` : ""}`);
if (only && results.length === 0) { console.error("No checks matched E2E_ONLY."); process.exitCode=1; }
for(const result of results.filter((r)=>!r.ok)) console.log(`  ${result.name}: ${result.error}`);
if(results.some((r)=>!r.ok)) process.exitCode=1;

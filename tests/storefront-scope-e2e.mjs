/** Admin-driven catalogue scope and responsive layout regression.
 * Destructive: run ONLY against a verified, fresh disposable local file store. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://localhost:3000";
const origin = new URL(base);
if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname) || origin.username || origin.password || origin.pathname !== "/") throw new Error("Only a local test server is permitted.");
if (!process.env.E2E_DATA_DIR || !process.env.E2E_OWNER_PASSWORD) throw new Error("Set the isolated test directory and synthetic owner password.");
const data = await fs.realpath(process.env.E2E_DATA_DIR);
assert.equal((await fs.readFile(path.join(data, ".niketon-e2e-disposable"), "utf8")).trim(), "niketon-mart-e2e-disposable");
const safety = await fetch(`${base}/api/e2e/safety`, { cache: "no-store" });
assert.equal(safety.status, 200);
const proof = await safety.json();
assert.equal(proof.isolated, true);
assert.equal(proof.storeHash, createHash("sha256").update(data).digest("hex"));

const readDB = async () => JSON.parse(await fs.readFile(path.join(data, "db.json"), "utf8"));
const waitForDB = async (predicate, label) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const value = predicate((await readDB()).collections);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for disposable database: ${label}`);
};
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--renderer-process-limit=4"] });
const errors = [];
try {
  let adminContext = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  let admin = await adminContext.newPage(); admin.on("pageerror", (error) => errors.push(error.message));
  const go = async (page, target) => {
    await page.bringToFront();
    await page.goto(`${base}${target}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1000);
  };
  await go(admin, "/admin/login");
  const login = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Sign In", exact: true }) });
  await login.locator('input[name="email"]').fill("marufsalauddin76@gmail.com");
  await login.locator('input[name="password"]').fill(process.env.E2E_OWNER_PASSWORD);
  await login.getByRole("button", { name: "Sign In", exact: true }).click();
  await admin.waitForURL(/\/admin$/, { timeout: 30_000 });
  assert(!(await readDB()).collections.categories.some((c) => c.name.startsWith("E2E Scope")), "Use a fresh disposable store, not one from an earlier run.");
  await go(admin, "/admin/catalogue/taxonomy");
  const panel = (name) => admin.locator("section").filter({ has: admin.getByRole("heading", { name, exact: true }) });
  const categories = panel("Categories"), form = categories.locator("form");
  const createCategory = async (name, group, parent) => {
    await form.getByLabel("New category name").fill(name);
    if (parent) await form.getByLabel("Parent category (optional)").selectOption(parent);
    else await form.getByLabel("Navigation group").selectOption(group);
    await form.getByRole("button", { name: "Add", exact: true }).click();
    const created = await waitForDB((c) => c.categories.find((entry) => entry.name === name), name);
    await categories.getByRole("button", { name: `Hide ${name}`, exact: true }).waitFor({ timeout: 30_000 });
    return created;
  };
  const fresh = await createCategory("E2E Scope Fresh", "fresh");
  const freshChild = await createCategory("E2E Scope Fresh Child", "fresh", fresh.id);
  const grocery = await createCategory("E2E Scope Grocery", "pantry");
  const groceryChild = await createCategory("E2E Scope Grocery Child", "pantry", grocery.id);
  assert.equal(freshChild.parentId, fresh.id); assert.equal(groceryChild.parentId, grocery.id);
  assert.equal(fresh.group, "fresh"); assert.equal(grocery.group, "pantry");

  const addTaxonomy = async (panelName, kind, collection, name) => {
    const p = panel(panelName), f = p.locator("form");
    await f.getByLabel(`New ${kind} name`).fill(name);
    await f.getByRole("button", { name: "Add", exact: true }).click();
    const row = await waitForDB((c) => c[collection].find((entry) => entry.name === name), name);
    await p.getByRole("button", { name: `Hide ${name}`, exact: true }).waitFor({ timeout: 30_000 });
    return row;
  };
  const freshBrand = await addTaxonomy("Brands", "brand", "brands", "E2E Scope Fresh Brand");
  const groceryBrand = await addTaxonomy("Brands", "brand", "brands", "E2E Scope Grocery Brand");
  const datesBrand = await addTaxonomy("Brands", "brand", "brands", "E2E Scope Dates Brand");
  const freshType = await addTaxonomy("Product types", "productType", "product_types", "E2E Scope Fresh Type");
  const groceryType = await addTaxonomy("Product types", "productType", "product_types", "E2E Scope Grocery Type");
  const datesType = await addTaxonomy("Product types", "productType", "product_types", "E2E Scope Dates Type");
  // The seed normally keeps Dates off the homepage; enable its real category
  // record to verify that the homepage and primary navigation share its scope.
  const datesRow = categories.locator("li").filter({ has: admin.getByRole("button", { name: "Move Dates up", exact: true }) });
  await datesRow.getByRole("button", { name: "Edit", exact: true }).click();
  await form.getByLabel("Show on homepage").check();
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await waitForDB((c) => c.categories.find((entry) => entry.id === "dates" && entry.showOnHome === true), "Dates home flag");
  console.log("PASS real admin forms create parent/child categories, distinct brands/types, and homepage visibility");

  const createProduct = async (name, categoryId, brandId, typeId, price) => {
    await go(admin, "/admin/catalogue/products/new");
    const f = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Create product", exact: true }) });
    await f.getByLabel("Product name").fill(name);
    await f.getByLabel("Description", { exact: false }).fill("Synthetic product created in an isolated browser regression store.");
    await f.getByLabel("Category / subcategory").selectOption(categoryId);
    await f.getByLabel("Brand").selectOption(brandId);
    await f.getByLabel("Product type").selectOption(typeId);
    await f.getByLabel(/Sale price/).fill(String(price));
    await f.getByLabel("Stock (units)").fill("4");
    const image = f.getByLabel("Add image by path or URL");
    await image.fill("/images/category-placeholder.svg"); await image.press("Enter");
    await f.getByRole("button", { name: "Create product", exact: true }).click();
    await admin.waitForURL(/\/admin\/catalogue\/products$/, { timeout: 30_000 });
    return waitForDB((c) => c.products.find((entry) => entry.name === name), name);
  };
  const freshProduct = await createProduct("E2E Scope Dynamic Fresh", freshChild.id, freshBrand.id, freshType.id, 210);
  const groceryProduct = await createProduct("E2E Scope Dynamic Grocery", groceryChild.id, groceryBrand.id, groceryType.id, 340);
  const datesProduct = await createProduct("E2E Scope Dynamic Dates", "dates-ajwa", datesBrand.id, datesType.id, 520);
  console.log("PASS real admin product forms persist three products in their selected categories, brands and types");
  // Keep just one heavy storefront/admin renderer alive on small CI machines.
  // These are synthetic local credentials, and the session remains in memory.
  const adminStorage = await adminContext.storageState();
  await adminContext.close();

  const guest = await browser.newContext({ viewport: { width: 1366, height: 850 } });
  let page = await guest.newPage(); page.on("pageerror", (error) => errors.push(error.message));
  await go(page, "/");
  const featured = page.locator('section[aria-labelledby="categories-title"]');
  const rail = featured.getByRole("list", { name: /Browse featured categories/ });
  assert.equal(await featured.locator('a[href="/grocery?category=dates"]').count(), 1, "homepage featured Dates must open the scoped family");
  assert.match(await featured.getByRole("link", { name: /E2E Scope Fresh/ }).innerText(), /1 Product\b/);
  assert.match(await featured.getByRole("link", { name: /E2E Scope Grocery/ }).innerText(), /1 Product\b/);
  for (const width of [1024, 1280, 1366, 1600]) {
    await page.setViewportSize({ width, height: 850 }); await page.waitForTimeout(200);
    const geometry = await rail.evaluate((ul) => {
      const r = ul.getBoundingClientRect();
      const boxes = [...ul.querySelectorAll(":scope > li > a")].map((a) => {
        const b = a.getBoundingClientRect(), image = a.querySelector("img").getBoundingClientRect();
        return { x: b.left, right: b.right, y: b.top, width: b.width, image: image.width };
      });
      const rows = [...new Set(boxes.map((b) => Math.round(b.y)))].map((y) => boxes.filter((b) => Math.round(b.y) === y).sort((a, b) => a.x - b.x));
      return { width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, left: r.left, right: r.right, boxes, rows };
    });
    assert(geometry.scrollWidth <= geometry.width + 1, `document overflow at ${width}`);
    assert(geometry.rows.length >= 2, `featured cards did not wrap at ${width}`);
    assert(geometry.boxes.every((box) => box.width >= 169 && box.image >= 111), `desktop cards are not enlarged at ${width}`);
    for (const row of geometry.rows) {
      assert(Math.abs((row[0].x + row.at(-1).right) / 2 - (geometry.left + geometry.right) / 2) < 3, `row not centered at ${width}`);
      for (let i = 1; i < row.length; i++) assert(row[i].x >= row[i - 1].right, `card overlap at ${width}`);
    }
  }
  if (process.env.E2E_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await page.setViewportSize({ width: 1366, height: 850 });
    await featured.screenshot({ path: path.join(process.env.E2E_SCREENSHOT_DIR, "featured-categories-desktop.png") });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  const mobile = await rail.evaluate((ul) => {
    const card = ul.querySelector(":scope > li > a"), img = card.querySelector("img");
    return { card: card.getBoundingClientRect().width, image: img.getBoundingClientRect().width, rail: ul.clientWidth, railScroll: ul.scrollWidth,
      width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  assert(Math.abs(mobile.card - 118) < 1 && Math.abs(mobile.image - 104) < 1, `mobile rail treatment changed: ${JSON.stringify(mobile)}`);
  assert(mobile.railScroll > mobile.rail && mobile.scrollWidth <= mobile.width + 1, `mobile rail should scroll without document overflow: ${JSON.stringify(mobile)}`);
  await page.setViewportSize({ width: 1366, height: 850 });
  console.log("PASS larger, centered, non-overlapping desktop rows and the unchanged mobile horizontal rail");

  const publicProducts = (collections, mode) => {
    const map = new Map(collections.categories.map((category) => [category.id, category]));
    const allowed = (category) => category && category.visible !== false && (!category.parentId || (map.has(category.parentId) && !map.get(category.parentId).parentId && map.get(category.parentId).visible !== false));
    return collections.products.filter((product) => {
      const category = map.get(product.categoryId);
      if (!allowed(category) || (product.status ?? "active") !== "active" || (product.visibility ?? "visible") !== "visible") return false;
      const root = category.parentId ? map.get(category.parentId) : category;
      const group = ["fresh", "pantry", "household", "bakery"].includes(root.group) ? root.group : "fresh";
      if (mode === "fresh") return group === "fresh";
      if (mode === "grocery") return group !== "fresh";
      if (mode === "dates") return category.id === "dates" || category.parentId === "dates";
      return true;
    }).map((product) => product.id).sort();
  };
  const collect = async (route, expected) => {
    const ids = [];
    for (let number = 1; number <= Math.max(1, Math.ceil(expected.length / 36)); number++) {
      const join = route.includes("?") ? "&" : "?";
      await go(page, `${route}${join}per=36&page=${number}`);
      ids.push(...await page.locator("main article[data-product-id]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-product-id"))));
    }
    assert.deepEqual(ids.sort(), expected, `${route} must include exactly the correct public products across all pages`);
  };
  const collections = (await readDB()).collections;
  await collect("/home-grocery", publicProducts(collections, "shop"));
  await collect("/fresh-market", publicProducts(collections, "fresh"));
  await collect("/grocery", publicProducts(collections, "grocery"));
  await collect("/grocery?scope=dates", publicProducts(collections, "dates"));
  console.log("PASS Shop, Fresh Market, Grocery and Dates contain exactly their visible products across pagination");

  const filters = () => page.locator('aside[aria-label="Product filters"]');
  const group = (name) => filters().getByRole("group", { name, exact: true });
  const has = async (groupName, label) => (await group(groupName).getByLabel(new RegExp(label)).count()) > 0;
  const cards = async () => (await page.locator("main article[data-product-id]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-product-id")))).sort();
  await go(page, "/home-grocery?q=E2E+Scope+Dynamic");
  assert.deepEqual(await cards(), [freshProduct.id, groceryProduct.id, datesProduct.id].sort());
  for (const name of ["Fresh", "Grocery", "Dates"]) assert(await has("Brand", `E2E Scope ${name} Brand`) && await has("Product Type", `E2E Scope ${name} Type`));
  await go(page, "/fresh-market?q=E2E+Scope+Dynamic");
  assert.deepEqual(await cards(), [freshProduct.id]);
  assert(await has("Brand", "E2E Scope Fresh Brand") && await has("Product Type", "E2E Scope Fresh Type"));
  assert(!(await has("Brand", "E2E Scope Grocery Brand")) && !(await has("Brand", "E2E Scope Dates Brand")));
  assert(!(await has("Product Type", "E2E Scope Grocery Type")) && !(await has("Category", "E2E Scope Grocery")));
  assert(await has("Category", "E2E Scope Fresh Child"));
  await go(page, "/grocery?q=E2E+Scope+Dynamic");
  assert.deepEqual(await cards(), [groceryProduct.id, datesProduct.id].sort());
  assert(await has("Brand", "E2E Scope Grocery Brand") && await has("Brand", "E2E Scope Dates Brand"));
  assert(!(await has("Brand", "E2E Scope Fresh Brand")) && !(await has("Product Type", "E2E Scope Fresh Type")));
  assert(await has("Category", "E2E Scope Grocery Child") && !(await has("Category", "E2E Scope Fresh Child")));
  await go(page, "/grocery?category=dates&q=E2E+Scope+Dynamic");
  assert.deepEqual(await cards(), [datesProduct.id]);
  assert(await has("Brand", "E2E Scope Dates Brand") && await has("Product Type", "E2E Scope Dates Type"));
  assert(!(await has("Brand", "E2E Scope Grocery Brand")) && !(await has("Category", "E2E Scope Grocery")));
  assert(await has("Category", "Dates › Ajwa"));
  assert.equal(await filters().getByLabel("Minimum price").getAttribute("min"), "520");
  assert.equal(await filters().getByLabel("Maximum price").getAttribute("max"), "521");
  assert.equal(await page.getByRole("region", { name: "Dates subcategories" }).count(), 0);
  const wrongScope = await guest.request.get(`${base}/grocery?scope=${encodeURIComponent(fresh.id)}`);
  assert.equal(wrongScope.status(), 404, "a cross-department scope must not widen");
  console.log("PASS relevant category, brand, type and price facets stay inside each department/family");

  await page.close();
  adminContext = await browser.newContext({ viewport: { width: 1366, height: 850 }, storageState: adminStorage });
  admin = await adminContext.newPage(); admin.on("pageerror", (error) => errors.push(error.message));
  await go(admin, "/admin/catalogue/taxonomy");
  const updatedCategories = admin.locator("section").filter({ has: admin.getByRole("heading", { name: "Categories", exact: true }) });
  const updatedForm = updatedCategories.locator("form");
  const rootRow = updatedCategories.locator("li").filter({ has: admin.getByRole("button", { name: `Move ${fresh.name} up`, exact: true }) });
  await rootRow.getByRole("button", { name: "Edit", exact: true }).click();
  await updatedForm.getByLabel("Navigation group").selectOption("pantry");
  await updatedForm.getByRole("button", { name: "Save", exact: true }).click();
  await waitForDB((c) => c.categories.find((entry) => entry.id === fresh.id && entry.group === "pantry"), "move parent group");
  await adminContext.close();
  page = await guest.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await go(page, "/fresh-market?q=E2E+Scope+Dynamic");
  assert.deepEqual(await cards(), []);
  assert(!(await has("Category", "E2E Scope Fresh")) && !(await has("Brand", "E2E Scope Fresh Brand")));
  await go(page, "/grocery?q=E2E+Scope+Dynamic");
  assert.deepEqual(await cards(), [freshProduct.id, groceryProduct.id, datesProduct.id].sort());
  assert(await has("Category", "E2E Scope Fresh Child") && await has("Brand", "E2E Scope Fresh Brand") && await has("Product Type", "E2E Scope Fresh Type"));
  await go(page, "/home-grocery?q=E2E+Scope+Dynamic");
  assert.deepEqual(await cards(), [freshProduct.id, groceryProduct.id, datesProduct.id].sort());
  console.log("PASS changing a parent group moves its child, product and facets without losing them from Shop");

  assert.deepEqual(errors, []);
  await guest.close();
  console.log("ALL STOREFRONT SCOPE CHECKS PASSED");
} finally { await browser.close(); }

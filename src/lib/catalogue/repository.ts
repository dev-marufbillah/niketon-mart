import "server-only";

import { revalidatePath } from "next/cache";
import { cache } from "react";
import { isDeepStrictEqual } from "node:util";
import { ensureDatabase } from "@/lib/db";
import { makeId, type Database, type Row } from "@/lib/db/types";
import { toPublicProduct } from "@/lib/catalogue/public-product";
import { isAllowedImageReference } from "@/lib/catalogue/image-reference";
import { isSafeTakaAmount } from "@/lib/utils/currency";
import { summariseReviews, type Review } from "@/lib/reviews/model";
import type {
  Brand,
  Category,
  Product,
  ProductOptionGroup,
  ProductType,
} from "@/lib/types/domain";
import type {
  CatalogueSnapshot,
  FacetOption,
  MutationResult,
  ProductInput,
  ShopFacets,
} from "@/lib/catalogue/types";

/**
 * Catalogue repository.
 * Every storefront surface and every admin screen reads products, categories,
 * brands and product types through this module so visibility, stock and
 * taxonomy rules live in exactly one place. All data comes from the database.
 */

const LOW_STOCK_THRESHOLD = 10;

export function availabilityForStock(stock: number): Product["availability"] {
  if (stock <= 0) return "out_of_stock";
  if (stock <= LOW_STOCK_THRESHOLD) return "low_stock";
  return "in_stock";
}

function revalidateCatalogue(slug?: string) {
  // The shared storefront layout also contains the live category menu.
  revalidatePath("/", "layout");
  revalidatePath("/home-grocery");
  revalidatePath("/fresh-market");
  revalidatePath("/grocery");
  revalidatePath("/categories");
  revalidatePath("/admin/catalogue");
  revalidatePath("/admin/catalogue/products");
  revalidatePath("/admin/home/our-top-picks");
  if (slug) revalidatePath(`/product/${slug}`);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const isPublished = (product: Product) =>
  (product.status ?? "active") === "active" && (product.visibility ?? "visible") === "visible";

async function readCollections(transaction?: Database) {
  const db = transaction ?? await ensureDatabase();
  if (transaction) {
    // Mongo sessions must not issue concurrent commands within a transaction.
    const products = await db.list<Product>("products");
    const categories = await db.list<Category>("categories");
    const brands = await db.list<Brand>("brands");
    const productTypes = await db.list<ProductType>("product_types");
    return { products, categories, brands, productTypes };
  }
  const [products, categories, brands, productTypes] = await Promise.all([
    db.list<Product>("products"),
    db.list<Category>("categories"),
    db.list<Brand>("brands"),
    db.list<ProductType>("product_types"),
  ]);
  return { products, categories, brands, productTypes };
}

function sortCategories(categories: Category[]): Category[] {
  return categories.map((category, index) => ({ category, index }))
    .sort((a, b) => (a.category.order ?? a.index) - (b.category.order ?? b.index) || a.index - b.index)
    .map(({ category }) => category);
}

/** Only public, active categories and allowlisted product fields reach the client. */
export async function getStorefrontCatalogue(): Promise<CatalogueSnapshot> {
  const { products, categories, brands, productTypes } = await readCollections();
  const db = await ensureDatabase();
  const genuineReviews = (await db.list<Review>("reviews", { where: { status: "approved" } }))
    .filter((review) => !review.isDemo);
  const byProduct = new Map<string, Review[]>();
  for (const review of genuineReviews) byProduct.set(review.productId, [...(byProduct.get(review.productId) ?? []), review]);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const visibleCategories = sortCategories(categories).filter((category) => {
    if (!(category.visible ?? true)) return false;
    if (!category.parentId) return true;
    const parent = byId.get(category.parentId);
    return Boolean(parent && !parent.parentId && (parent.visible ?? true));
  });
  const categoryIds = new Set(visibleCategories.map((category) => category.id));
  const visibleProducts = products.filter((product) => isPublished(product) && categoryIds.has(product.categoryId)).map((product) => {
    const rating = summariseReviews(byProduct.get(product.id) ?? []);
    return { ...toPublicProduct(product), rating: rating.average, reviewCount: rating.total };
  });
  // Count each public product once for its own category and, when present, its
  // visible parent. Avoid rescanning every product for every category/child.
  const counts = new Map<string, number>();
  for (const product of visibleProducts) {
    counts.set(product.categoryId, (counts.get(product.categoryId) ?? 0) + 1);
    const parentId = byId.get(product.categoryId)?.parentId;
    if (parentId && categoryIds.has(parentId)) counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
  }

  return {
    products: visibleProducts,
    categories: visibleCategories.map(({ id, slug, name, icon, group, parentId, visible, order, description, image, showOnHome, showInNavigation, showInPrimaryNavigation, familyFiltersOnly }) => ({
      id, slug, name, icon, group, parentId, visible, order, description, image, showOnHome, showInNavigation, showInPrimaryNavigation, familyFiltersOnly,
      productCount: counts.get(id) ?? 0,
    })),
    brands: brands.filter((brand) => brand.visible ?? true).map(({ id, slug, name, visible }) => ({ id, slug, name, visible })),
    productTypes: productTypes.filter((type) => type.visible ?? true).map(({ id, slug, name, visible }) => ({ id, slug, name, visible })),
  };
}

/** Render-only request memoization: no shared TTL or cross-request catalogue cache. */
export const getRenderStorefrontCatalogue = cache(getStorefrontCatalogue);

/** Admin snapshot: everything, including drafts and hidden records. */
export async function getAdminCatalogue(): Promise<CatalogueSnapshot & { updatedAt: string }> {
  const { products, categories, brands, productTypes } = await readCollections();
  const usage = (predicate: (product: Product) => boolean) => products.filter(predicate).length;

  return {
    products,
    categories: sortCategories(categories).map((category) => ({
      ...category,
      productCount: usage((product) => product.categoryId === category.id),
    })),
    brands: brands.map((brand) => ({
      ...brand,
      productCount: usage((product) => product.brandId === brand.id),
    })),
    productTypes: productTypes.map((type) => ({
      ...type,
      productCount: usage((product) => product.productTypeId === type.id),
    })),
    updatedAt: new Date().toISOString(),
  };
}

export async function getProductIds(): Promise<Set<string>> {
  const db = await ensureDatabase();
  const products = await db.list<Product>("products");
  return new Set(products.map((product) => product.id));
}

export function buildShopFacets(snapshot: CatalogueSnapshot): ShopFacets {
  const countBy = (predicate: (product: Product) => boolean) =>
    snapshot.products.filter(predicate).length;

  const categories: FacetOption[] = snapshot.categories.map((category) => {
    const parent = category.parentId ? snapshot.categories.find((entry) => entry.id === category.parentId) : undefined;
    return {
      value: category.id,
      label: parent ? `${parent.name} › ${category.name}` : category.name,
      parentId: parent?.id,
      count: category.productCount ?? countBy((product) => product.categoryId === category.id),
    };
  });

  const brands: FacetOption[] = snapshot.brands
    .map((brand) => ({
      value: brand.id,
      label: brand.name,
      count: countBy((product) => product.brandId === brand.id),
    }))
    .filter((brand) => brand.count > 0);

  const productTypes: FacetOption[] = snapshot.productTypes
    .map((type) => ({
      value: type.id,
      label: type.name,
      count: countBy((product) => product.productTypeId === type.id),
    }))
    .filter((type) => type.count > 0);

  const prices = snapshot.products.map((product) => product.price);
  const min = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const max = prices.length ? Math.ceil(Math.max(...prices)) : 100;

  const ratings = [5, 4, 3, 2, 1].map((value) => ({
    value,
    count: countBy((product) => product.rating >= value),
  }));

  return {
    categories,
    brands,
    productTypes,
    price: { min, max: max === min ? min + 1 : max },
    ratings,
    stock: {
      in: countBy((product) => (product.stock ?? 0) > 0),
      out: countBy((product) => (product.stock ?? 0) <= 0),
    },
  };
}

export async function getShopData() {
  const snapshot = await getRenderStorefrontCatalogue();
  return { ...snapshot, facets: buildShopFacets(snapshot) };
}

export async function getStorefrontProductBySlug(slug: string) {
  const snapshot = await getRenderStorefrontCatalogue();
  const product = snapshot.products.find((entry) => entry.slug === slug);
  if (!product) return null;
  return {
    product,
    related: snapshot.products
      .filter((entry) => entry.categoryId === product.categoryId && entry.id !== product.id)
      .slice(0, 4),
    category: snapshot.categories.find((entry) => entry.id === product.categoryId) ?? null,
    brand: snapshot.brands.find((entry) => entry.id === product.brandId) ?? null,
    productType: snapshot.productTypes.find((entry) => entry.id === product.productTypeId) ?? null,
  };
}

/** Share metadata and page product lookup within the same server render. */
export const getRenderStorefrontProductBySlug = cache(getStorefrontProductBySlug);

function productsInOrder(products: Product[], ids: string[]): Product[] {
  const index = new Map(products.map((product) => [product.id, product]));
  return ids.map((id) => index.get(id)).filter((product): product is Product => Boolean(product));
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  // Non-render callers receive a fresh read; this can also be used by actions.
  const { products } = await getStorefrontCatalogue();
  return productsInOrder(products, ids);
}

/** Homepage merchandising rails share this render's live catalogue. */
export async function getFeaturedProducts(ids: string[] = []): Promise<Product[]> {
  const { products } = await getRenderStorefrontCatalogue();
  return ids.length > 0 ? productsInOrder(products, ids) : products.filter((product) => product.flags?.featured);
}

export async function getDealsOfTheDay(ids: string[] = []): Promise<Product[]> {
  const { products } = await getRenderStorefrontCatalogue();
  return ids.length > 0 ? productsInOrder(products, ids) : products.filter((product) => product.flags?.dealOfTheDay);
}

export async function getBestSellerProducts(): Promise<Product[]> {
  const { products } = await getRenderStorefrontCatalogue();
  return products.filter((product) => product.flags?.bestSeller);
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                   */
/* -------------------------------------------------------------------------- */

function validateProduct(
  input: ProductInput,
  existingRows: Product[],
  categories: Category[],
  brands: Brand[],
  types: ProductType[],
  existing?: Product,
): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  const slug = slugify(input.slug || input.name);

  if (name.length < 2) errors.push("Product name must be at least 2 characters.");
  if (name.length > 90) errors.push("Product name must be 90 characters or fewer.");
  if (!slug) errors.push("A URL slug is required.");
  if (existingRows.some((product) => product.slug === slug && product.id !== existing?.id)) {
    errors.push(`The slug “${slug}” is already used by another product.`);
  }
  if (!categories.some((category) => category.id === input.categoryId)) errors.push("Choose a valid category.");
  if (input.brandId && !brands.some((brand) => brand.id === input.brandId)) errors.push("Choose a valid brand.");
  if (input.productTypeId && !types.some((type) => type.id === input.productTypeId)) {
    errors.push("Choose a valid product type.");
  }
  if (!isSafeTakaAmount(input.price) || input.price <= 0) errors.push("Price must be positive and use at most two decimal places.");
  if (!(input.price < 100000)) errors.push("Price looks too high.");
  if (input.compareAtPrice !== null && !isSafeTakaAmount(input.compareAtPrice)) errors.push("Compare-at price must use a valid BDT amount.");
  if (input.compareAtPrice !== null && input.compareAtPrice <= input.price) {
    errors.push("Compare-at price must be higher than the sale price.");
  }
  if (!Number.isFinite(input.stock) || input.stock < 0) errors.push("Stock cannot be negative.");
  if (!input.unit.trim()) errors.push("Unit or weight is required.");
  if (!input.image.trim()) errors.push("A product image is required.");
  const imageReferences: unknown[] = [input.image, ...(input.images ?? []),
    ...(input.options ?? []).flatMap((group) => group.values.map((value) => value.image).filter(Boolean))];
  if (imageReferences.some((reference) => typeof reference !== "string" || (reference.trim() && !isAllowedImageReference(reference, !process.env.VERCEL)))) {
    errors.push("Use an uploaded image or an approved image path; temporary browser or embedded images are not supported.");
  }
  if (input.rating < 0 || input.rating > 5) errors.push("Rating must be between 0 and 5.");
  if (input.reviewCount < 0) errors.push("Review count cannot be negative.");
  if (input.description.trim().length < 10) errors.push("Add a description of at least 10 characters.");

  // Selling units: a product can only step in whole units, and the minimum has
  // to be reachable by that step (a 0.5 step with a 0 minimum is a typo).
  const minQuantity = Number(input.selling?.minQuantity ?? 1);
  const step = Number(input.selling?.step ?? 1);
  if (!Number.isFinite(minQuantity) || minQuantity < 1) errors.push("Minimum quantity must be at least 1.");
  if (!Number.isFinite(step) || step < 1) errors.push("Quantity step must be at least 1.");
  if (minQuantity > 1000) errors.push("Minimum quantity looks too high.");

  // Preparation: every group needs a name and options, charges cannot be
  // negative, and a single-choice group can only have one default.
  (input.preparation?.groups ?? []).forEach((group, groupIndex) => {
    const label = group.name.trim() || `Group ${groupIndex + 1}`;
    const options = (group.options ?? []).filter((option) => option.label.trim());
    if (!group.name.trim()) errors.push(`Group ${groupIndex + 1} needs a name.`);
    if (options.length === 0) errors.push(`${label}: add at least one option.`);
    const defaults = options.filter((option) => option.isDefault).length;
    if (group.type === "single" && defaults > 1) errors.push(`${label}: only one option can be the default.`);
    for (const option of options) {
      if (!isSafeTakaAmount(option.charge)) errors.push(`${label} → ${option.label}: enter a non-negative charge with at most two decimals.`);
      if (Number(option.charge) > 100) errors.push(`${label} → ${option.label}: that extra charge looks too high.`);
    }
  });
  if (input.preparation?.enabled && (input.preparation.groups ?? []).length === 0) {
    errors.push("Add at least one preparation group, or switch preparation off.");
  }
  const instructionLimit = Number(input.preparation?.maxInstructionLength ?? 160);
  if (input.preparation?.allowInstructions && (!Number.isFinite(instructionLimit) || instructionLimit < 20)) {
    errors.push("Allow at least 20 characters for preparation instructions.");
  }

  // Variations: each group needs a name and at least two distinct options, and
  // option prices (when given) must make sense.
  (input.options ?? []).forEach((group, groupIndex) => {
    const label = group.name.trim() || `Variation ${groupIndex + 1}`;
    const values = group.values.filter((value) => value.label.trim());
    if (values.length === 0) return;
    if (values.length < 2) errors.push(`${label}: add at least two options, or remove the group.`);
    const labels = new Set<string>();
    for (const value of values) {
      if (labels.has(value.label.trim().toLowerCase())) {
        errors.push(`${label}: “${value.label}” appears twice.`);
      }
      labels.add(value.label.trim().toLowerCase());
      if (value.price != null && (!isSafeTakaAmount(value.price) || value.price <= 0)) {
        errors.push(`${label} → ${value.label}: price must be positive with at most two decimals.`);
      }
      if (typeof value.stock === "number" && value.stock < 0) {
        errors.push(`${label} → ${value.label}: stock cannot be negative.`);
      }
    }
  });
  return errors;
}

/** Variations as the admin entered them — empty groups and blanks removed. */
function cleanOptions(options: ProductOptionGroup[] = []): ProductOptionGroup[] {
  return options
    .map((group) => ({
      name: group.name.trim(),
      values: group.values
        .map((value) => ({
          label: value.label.trim(),
          ...(typeof value.price === "number" && value.price > 0 ? { price: Number(value.price) } : {}),
          ...(typeof value.compareAtPrice === "number" && value.compareAtPrice > 0
            ? { compareAtPrice: Number(value.compareAtPrice) }
            : {}),
          ...(typeof value.stock === "number" ? { stock: Math.max(0, Math.floor(value.stock)) } : {}),
          ...(value.image ? { image: value.image.trim() } : {}),
          ...(value.isDefault ? { isDefault: true } : {}),
        }))
        .filter((value) => value.label),
    }))
    .filter((group) => group.name && group.values.length > 0);
}

/** Preparation as the admin entered it — blank groups and options removed. */
function cleanPreparation(preparation: ProductInput["preparation"]) {
  if (!preparation?.enabled) return undefined;
  const groups = (preparation.groups ?? [])
    .map((group, groupIndex) => ({
      id: group.id?.trim() || `group-${groupIndex + 1}`,
      name: group.name.trim(),
      type: group.type === "multiple" ? ("multiple" as const) : ("single" as const),
      ...(group.required ? { required: true } : {}),
      options: (group.options ?? [])
        .filter((option) => option.label.trim())
        .map((option, optionIndex) => ({
          id: option.id?.trim() || `option-${optionIndex + 1}`,
          label: option.label.trim(),
          charge: Math.max(0, Math.round((Number(option.charge) || 0) * 100) / 100),
          ...(option.isDefault ? { isDefault: true } : {}),
          ...(option.note?.trim() ? { note: option.note.trim() } : {}),
        })),
    }))
    .filter((group) => group.name && group.options.length > 0);
  if (groups.length === 0) return undefined;
  return {
    enabled: true as const,
    ...(preparation.presetId ? { presetId: preparation.presetId } : {}),
    groups,
    ...(preparation.allowInstructions ? { allowInstructions: true } : {}),
    maxInstructionLength: Math.min(300, Math.max(20, Math.floor(Number(preparation.maxInstructionLength) || 160))),
    ...(preparation.note?.trim() ? { note: preparation.note.trim() } : {}),
  };
}

function cleanSelling(selling: ProductInput["selling"], fallbackUnit: string) {
  const minQuantity = Math.max(1, Math.floor(Number(selling?.minQuantity) || 1));
  const step = Math.max(1, Math.floor(Number(selling?.step) || 1));
  const unitGrams = Math.round(Number(selling?.unitGrams));
  return {
    unit: selling?.unit?.trim() || fallbackUnit,
    minQuantity,
    step,
    ...(Number.isFinite(unitGrams) && unitGrams >= 1 && unitGrams <= 50_000 ? { unitGrams } : {}),
    ...(selling?.estimatedWeight?.trim() ? { estimatedWeight: selling.estimatedWeight.trim() } : {}),
    ...(selling?.variableWeight ? { variableWeight: true } : {}),
  };
}

function cleanDetails(details: ProductInput["details"]) {
  const cleanPairs = (pairs: { label: string; value: string }[] = []) =>
    pairs.filter((pair) => pair.label?.trim() && pair.value?.trim());
  return {
    features: (details.features ?? []).map((feature) => feature.trim()).filter(Boolean),
    specifications: cleanPairs(details.specifications),
    nutrition: cleanPairs(details.nutrition),
    weight: details.weight?.trim() ?? "",
    dimensions: details.dimensions?.trim() ?? "",
    ingredients: details.ingredients?.trim() ?? "",
    storage: details.storage?.trim() ?? "",
    usage: details.usage?.trim() ?? "",
  };
}

type ProductSaveResult =
  | { ok: true; data: Product; message?: string; previousSlug?: string }
  | { ok: false; errors: string[] };

/** The caller must enforce products.manage. Mongo writes and their inventory
 * movement commit together; no cache or network side effects run in the callback. */
export async function saveProductInDatabase(db: Database, input: ProductInput, actor = "admin"): Promise<ProductSaveResult> {
  if (db.driver === "mongo") {
    if (!db.withTransaction) return { ok: false, errors: ["A transaction-capable database is required for product changes."] };
    return db.withTransaction((transaction) => saveProductOnce(transaction, input, actor));
  }
  return saveProductOnce(db, input, actor);
}

async function saveProductOnce(db: Database, input: ProductInput, actor: string): Promise<ProductSaveResult> {
  const { products, categories, brands, productTypes } = await readCollections(db);
  const existing = input.id ? products.find((product) => product.id === input.id) : undefined;
  if (input.id && !existing) return { ok: false, errors: ["That product no longer exists."] };
  if (existing && (!input.inventorySnapshot || !Array.isArray(input.inventorySnapshot.options) ||
      !isDeepStrictEqual(input.inventorySnapshot, {
        stock: existing.stock ?? 0, soldCount: existing.soldCount ?? 0, options: existing.options ?? [],
      }))) {
    return { ok: false, errors: ["Inventory changed since this form was opened. Refresh and review stock and variations before saving."] };
  }

  const errors = validateProduct(input, products, categories, brands, productTypes, existing);
  if (errors.length) return { ok: false, errors };

  const category = categories.find((entry) => entry.id === input.categoryId)!;
  const slug = slugify(input.slug || input.name);
  const stock = Math.floor(input.stock);

  const product = {
    ...(existing ?? {
      createdAt: new Date().toISOString(),
      soldCount: 0,
      reviewCount: 0,
    }),
    id: existing?.id ?? `p-${slug}`,
    name: input.name.trim(),
    slug,
    description: input.description.trim(),
    categoryId: category.id,
    categoryLabel: category.name,
    brandId: input.brandId || undefined,
    productTypeId: input.productTypeId || undefined,
    image: input.image.trim(),
    imageMode: input.imageMode,
    unit: input.unit.trim(),
    price: Number(input.price),
    compareAtPrice: input.compareAtPrice === null ? undefined : Number(input.compareAtPrice),
    stock,
    availability: availabilityForStock(stock),
    rating: Number(input.rating),
    reviewCount: Math.floor(input.reviewCount),
    sku: input.sku.trim() || existing?.sku || `SKU-${slug}`,
    status: input.status,
    visibility: input.visibility,
    attributes: input.attributes.filter((attribute) => attribute.label.trim() && attribute.value.trim()),
    images:
      input.images.length > 0
        ? input.images.map((path) => path.trim()).filter(Boolean)
        : [input.image.trim()],
    options: cleanOptions(input.options),
    details: cleanDetails(input.details),
    preparation: cleanPreparation(input.preparation),
    selling: cleanSelling(input.selling, input.unit.trim()),
    flags: { ...existing?.flags, featured: input.featured },
  } as Product;

  if (existing) {
    if (!(await db.update("products", existing.id, product))) throw new Error("Product disappeared during saving.");
  } else {
    await db.insert("products", product);
  }

  // Every stock-changing edit is written to the same transaction's ledger.
  if (!existing || (existing.stock ?? 0) !== stock) {
    await recordStockMovement({
      productId: product.id,
      productName: product.name,
      delta: stock - (existing?.stock ?? 0),
      balance: stock,
      reason: existing ? "admin-edit" : "product-created",
      actor,
    }, db);
  }
  return { ok: true, data: product, message: existing ? "Product updated." : "Product created.", previousSlug: existing?.slug };
}

export async function saveProduct(input: ProductInput, actor = "admin"): Promise<MutationResult<Product>> {
  const result = await saveProductInDatabase(await ensureDatabase(), input, actor);
  if (result.ok) {
    revalidateCatalogue(result.data.slug);
    if (result.previousSlug && result.previousSlug !== result.data.slug) revalidatePath(`/product/${result.previousSlug}`);
  }
  return result;
}

type ProductFieldPatch = Partial<Pick<Product, "visibility" | "status" | "flags">> & { stock?: number };

/** The caller must enforce products.manage. Non-stock quick toggles patch only
 * their own fields; they never write a stale copy of stock or soldCount. */
export async function updateProductFieldInDatabase(
  db: Database, id: string, patch: ProductFieldPatch, actor = "admin", expectedStock?: number,
): Promise<MutationResult<Product>> {
  if (patch.stock !== undefined) {
    if (Object.keys(patch).some((key) => key !== "stock")) return { ok: false, errors: ["Save stock separately from other changes."] };
    const { adjustStockInDatabase } = await import("@/lib/repositories/inventory");
    const result = await adjustStockInDatabase(db, { productId: id, expectedStock,
      change: { type: "absolute", value: patch.stock }, reason: "admin-adjustment", actor });
    return result.ok ? { ok: true, data: result.product, message: "Product updated." } : { ok: false, errors: [result.error] };
  }
  const existing = await db.get<Product>("products", id);
  if (!existing) return { ok: false, errors: ["That product no longer exists."] };
  if (patch.visibility !== undefined && !["visible", "hidden"].includes(patch.visibility)) {
    return { ok: false, errors: ["Invalid visibility."] };
  }
  if (patch.status !== undefined && !["active", "draft"].includes(patch.status)) {
    return { ok: false, errors: ["Invalid product status."] };
  }
  if (patch.flags && Object.entries(patch.flags).some(([key, value]) =>
      !["featured", "bestSeller", "dealOfTheDay", "weeklySpecial"].includes(key) || typeof value !== "boolean")) {
    return { ok: false, errors: ["Invalid product flag."] };
  }
  const changes: Partial<Product> = {
    ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.flags ? { flags: { ...existing.flags, ...patch.flags } } : {}),
  };
  const updated = await db.update<Product>("products", id, changes);
  return updated ? { ok: true, data: updated, message: "Product updated." }
    : { ok: false, errors: ["That product no longer exists."] };
}

export async function updateProductField(
  id: string, patch: ProductFieldPatch, actor = "admin", expectedStock?: number,
): Promise<MutationResult<Product>> {
  const result = await updateProductFieldInDatabase(await ensureDatabase(), id, patch, actor, expectedStock);
  if (result.ok) revalidateCatalogue(result.data.slug);
  return result;
}

type ProductDeleteResult =
  | { ok: true; data: { id: string }; message: string; previousSlug: string }
  | { ok: false; errors: string[] };

/** The caller must enforce products.manage. Open orders retain a product until
 * they are closed; hiding a product remains possible without deleting it. */
export async function deleteProductInDatabase(db: Database, id: string, actor = "admin"): Promise<ProductDeleteResult> {
  const remove = async (tx: Database): Promise<ProductDeleteResult> => {
    const existing = await tx.get<Product>("products", id);
    if (!existing) return { ok: false, errors: ["That product no longer exists."] };
    const orders = await tx.list<Row & { status?: string; items?: { productId?: string }[] }>("orders");
    const inOpenOrder = orders.some((order) => !["cancelled", "delivered", "refunded"].includes(order.status ?? "") &&
      Array.isArray(order.items) && order.items.some((item) => item?.productId === id));
    if (inOpenOrder) return { ok: false, errors: ["This product is in an open order. Hide it instead and close or review those orders before deleting it."] };
    if (!(await tx.remove("products", id))) throw new Error("Product disappeared during deletion.");
    await recordStockMovement({
      productId: id, productName: existing.name, delta: -(existing.stock ?? 0), balance: 0,
      reason: "product-deleted", actor,
    }, tx);
    return { ok: true, data: { id }, message: `${existing.name} deleted.`, previousSlug: existing.slug };
  };
  if (db.driver === "mongo") {
    if (!db.withTransaction) return { ok: false, errors: ["A transaction-capable database is required for product changes."] };
    return db.withTransaction(remove);
  }
  return remove(db);
}

export async function deleteProduct(id: string, actor = "admin"): Promise<MutationResult<{ id: string }>> {
  const result = await deleteProductInDatabase(await ensureDatabase(), id, actor);
  if (result.ok) revalidateCatalogue(result.previousSlug);
  return result;
}

export async function setProductStock(id: string, stock: number, actor = "admin", expectedStock?: number) {
  return updateProductField(id, { stock }, actor, expectedStock);
}

export async function saveCategory(input: {
  id?: string;
  name: string;
  slug: string;
  icon: string;
  visible: boolean;
  group?: Category["group"];
  parentId?: string;
  description?: string;
  image?: string;
  showOnHome?: boolean;
  showInNavigation?: boolean;
  showInPrimaryNavigation?: boolean;
  familyFiltersOnly?: boolean;
}): Promise<MutationResult<Category>> {
  const db = await ensureDatabase();
  const categories = await db.list<Category>("categories");
  const name = typeof input?.name === "string" ? input.name.trim() : "";
  const slug = slugify(typeof input?.slug === "string" && input.slug.trim() ? input.slug : name);
  const icon = typeof input?.icon === "string" ? input.icon.trim() : "";
  const existing = input?.id ? categories.find((category) => category.id === input.id) : undefined;
  const parentId = typeof input?.parentId === "string" ? input.parentId.trim() || undefined : existing?.parentId;
  const description = typeof input.description === "string" ? input.description.trim() : existing?.description ?? "";
  const image = typeof input.image === "string" ? input.image.trim() : existing?.image ?? "";
  const showOnHome = typeof input.showOnHome === "boolean" ? input.showOnHome : existing?.showOnHome ?? true;
  const showInNavigation = typeof input.showInNavigation === "boolean" ? input.showInNavigation : existing?.showInNavigation ?? true;
  const showInPrimaryNavigation = typeof input.showInPrimaryNavigation === "boolean"
    ? input.showInPrimaryNavigation : existing?.showInPrimaryNavigation ?? false;
  // A featured link always uses family filters. Preserve that preference when
  // an existing featured category is later removed from the navigation slot.
  const familyFiltersOnly = showInPrimaryNavigation ? true : typeof input.familyFiltersOnly === "boolean"
    ? input.familyFiltersOnly : existing?.familyFiltersOnly ?? Boolean(existing?.showInPrimaryNavigation);
  const parent = parentId ? categories.find((category) => category.id === parentId) : undefined;
  const group = parent?.group ?? input?.group ?? existing?.group ?? "fresh";
  const errors: string[] = [];
  if (input?.id && !existing) errors.push("That category no longer exists; refresh and try again.");
  if (name.length < 2 || name.length > 80) errors.push("Category name must be 2–80 characters.");
  if (!slug) errors.push("A slug is required.");
  if (icon.length > 16) errors.push("Category icon is too long.");
  if (description.length > 500) errors.push("Category description must be 500 characters or fewer.");
  if (image && !isAllowedImageReference(image, !process.env.VERCEL)) errors.push("Upload an image through the media library or use an approved image path.");
  if (typeof input?.visible !== "boolean") errors.push("Choose whether the category is visible.");
  if (input?.showInPrimaryNavigation !== undefined && typeof input.showInPrimaryNavigation !== "boolean") errors.push("Choose a valid primary navigation setting.");
  if (input?.familyFiltersOnly !== undefined && typeof input.familyFiltersOnly !== "boolean") errors.push("Choose a valid category family display setting.");
  if (showInPrimaryNavigation && categories.some((category) => category.id !== input?.id && category.showInPrimaryNavigation === true)) {
    errors.push("Only one category can be featured in primary navigation. Unfeature the current category first.");
  }
  if (!["fresh", "pantry", "household", "bakery"].includes(group)) errors.push("Choose a valid menu group.");
  if (parentId && (!parent || parent.parentId || parentId === input?.id)) {
    errors.push("Choose an existing top-level parent category; nested or circular categories are not allowed.");
  }
  if (parentId && input?.id && categories.some((category) => category.parentId === input.id)) {
    errors.push("Move this category's subcategories before making it a subcategory.");
  }
  if (categories.some((category) => category.slug.toLowerCase() === slug && category.id !== input?.id)) {
    errors.push(`The slug “${slug}” is already used by another category.`);
  }
  if (categories.some((category) => category.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase() && category.id !== input?.id)) {
    errors.push(`A category named “${name}” already exists.`);
  }
  if (errors.length) return { ok: false, errors };

  const category: Category = {
    ...(existing ?? {}),
    id: existing?.id ?? makeId("cat"),
    name,
    slug,
    icon: icon || "🛒",
    description, image, showOnHome, showInNavigation, showInPrimaryNavigation, familyFiltersOnly,
    group,
    parentId,
    order: existing?.order ?? categories.length,
    visible: input.visible,
  };

  try {
    if (existing) await db.update("categories", existing.id, category);
    else await db.insert("categories", category);
  } catch (error) {
    // Another admin can feature a category after the preliminary scan. The
    // unique index/queue picks one winner; report that collision, not a 500.
    const current = showInPrimaryNavigation ? await db.list<Category>("categories") : [];
    if (current.some((entry) => entry.id !== category.id && entry.showInPrimaryNavigation === true)) {
      return { ok: false, errors: ["Only one category can be featured in primary navigation. Unfeature the current category first."] };
    }
    throw error;
  }

  // Keep the denormalised label on products in sync.
  const products = await db.list<Product>("products", { where: { categoryId: category.id } });
  await Promise.all(
    products.map((product) => db.update("products", product.id, { categoryLabel: category.name })),
  );

  revalidateCatalogue();
  return { ok: true, data: category, message: existing ? "Category updated." : "Category created." };
}

export async function saveBrand(input: {
  id?: string;
  name: string;
  slug: string;
  visible: boolean;
}): Promise<MutationResult<Brand>> {
  const db = await ensureDatabase();
  const brands = await db.list<Brand>("brands");
  const name = input.name.trim();
  const slug = slugify(input.slug || input.name);
  if (name.length < 2) return { ok: false, errors: ["Brand name must be at least 2 characters."] };
  if (brands.some((brand) => brand.slug === slug && brand.id !== input.id)) {
    return { ok: false, errors: [`The slug “${slug}” is already used by another brand.`] };
  }
  const existing = input.id ? brands.find((brand) => brand.id === input.id) : undefined;
  const brand = {
    ...(existing ?? {}),
    id: existing?.id ?? slug,
    name,
    slug,
    visible: input.visible,
  } as Brand;
  if (existing) await db.update("brands", existing.id, brand);
  else await db.insert("brands", brand);
  revalidateCatalogue();
  return { ok: true, data: brand, message: existing ? "Brand updated." : "Brand created." };
}

export async function saveProductType(input: {
  id?: string;
  name: string;
  slug: string;
  visible: boolean;
}): Promise<MutationResult<ProductType>> {
  const db = await ensureDatabase();
  const types = await db.list<ProductType>("product_types");
  const name = input.name.trim();
  const slug = slugify(input.slug || input.name);
  if (name.length < 2) return { ok: false, errors: ["Product type name must be at least 2 characters."] };
  if (types.some((type) => type.slug === slug && type.id !== input.id)) {
    return { ok: false, errors: [`The slug “${slug}” is already used by another product type.`] };
  }
  const existing = input.id ? types.find((type) => type.id === input.id) : undefined;
  const type = {
    ...(existing ?? {}),
    id: existing?.id ?? slug,
    name,
    slug,
    visible: input.visible,
  } as ProductType;
  if (existing) await db.update("product_types", existing.id, type);
  else await db.insert("product_types", type);
  revalidateCatalogue();
  return { ok: true, data: type, message: existing ? "Product type updated." : "Product type created." };
}

/** Change display order through the existing taxonomy administration. */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<MutationResult<{ id: string }>> {
  if (direction !== "up" && direction !== "down") return { ok: false, errors: ["Choose a valid direction."] };
  const db = await ensureDatabase();
  const categories = sortCategories(await db.list<Category>("categories"));
  const index = categories.findIndex((category) => category.id === id);
  if (index < 0) return { ok: false, errors: ["That category no longer exists."] };
  const target = index + (direction === "up" ? -1 : 1);
  if (target < 0 || target >= categories.length) return { ok: false, errors: ["That category is already at the end."] };
  [categories[index], categories[target]] = [categories[target], categories[index]];
  for (const [order, category] of categories.entries()) await db.update("categories", category.id, { order });
  revalidateCatalogue();
  return { ok: true, data: { id }, message: "Category order saved." };
}

export async function deleteCategory(id: string): Promise<MutationResult<{ id: string }>> {
  const db = await ensureDatabase();
  const category = await db.get<Category>("categories", id);
  if (!category) return { ok: false, errors: ["That category no longer exists."] };
  const children = (await db.list<Category>("categories")).filter((row) => row.parentId === id);
  if (children.length) return { ok: false, errors: [`Move or remove ${children.length} subcategor${children.length === 1 ? "y" : "ies"} first.`] };
  const inUse = (await db.list<Product>("products", { where: { categoryId: id } })).length;
  if (inUse > 0) {
    return { ok: false, errors: [`${inUse} product${inUse > 1 ? "s" : ""} still use this category. Move them first.`] };
  }
  await db.remove("categories", id);
  revalidateCatalogue();
  return { ok: true, data: { id }, message: `${category.name} deleted.` };
}

export async function deleteBrand(id: string): Promise<MutationResult<{ id: string }>> {
  const db = await ensureDatabase();
  const brand = await db.get<Brand>("brands", id);
  if (!brand) return { ok: false, errors: ["That brand no longer exists."] };
  const inUse = (await db.list<Product>("products", { where: { brandId: id } })).length;
  if (inUse > 0) return { ok: false, errors: [`${inUse} product${inUse > 1 ? "s" : ""} still use this brand.`] };
  await db.remove("brands", id);
  revalidateCatalogue();
  return { ok: true, data: { id }, message: `${brand.name} deleted.` };
}

export async function deleteProductType(id: string): Promise<MutationResult<{ id: string }>> {
  const db = await ensureDatabase();
  const type = await db.get<ProductType>("product_types", id);
  if (!type) return { ok: false, errors: ["That product type no longer exists."] };
  const inUse = (await db.list<Product>("products", { where: { productTypeId: id } })).length;
  if (inUse > 0) return { ok: false, errors: [`${inUse} product${inUse > 1 ? "s" : ""} still use this type.`] };
  await db.remove("product_types", id);
  revalidateCatalogue();
  return { ok: true, data: { id }, message: `${type.name} deleted.` };
}

export async function getCatalogueStats() {
  const { products, categories, brands, productTypes } = await readCollections();
  return {
    products: products.length,
    published: products.filter((product) => isPublished(product)).length,
    drafts: products.filter((product) => (product.status ?? "active") !== "active").length,
    hidden: products.filter((product) => (product.visibility ?? "visible") !== "visible").length,
    outOfStock: products.filter((product) => (product.stock ?? 0) <= 0).length,
    lowStock: products.filter((product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= LOW_STOCK_THRESHOLD).length,
    categories: categories.length,
    brands: brands.length,
    productTypes: productTypes.length,
    updatedAt: new Date().toISOString(),
  };
}

/* Inventory ledger is imported lazily to avoid a circular import at module load. */
async function recordStockMovement(input: {
  productId: string;
  productName: string;
  delta: number;
  balance: number;
  reason: string;
  actor: string;
  reference?: string;
  note?: string;
}, transaction?: Database) {
  const { addStockMovement } = await import("@/lib/repositories/inventory");
  await addStockMovement(input, transaction);
}

export type { Row };

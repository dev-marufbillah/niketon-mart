import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Database } from "@/lib/db/types";
import type { Category, Product } from "@/lib/types/domain";
import { getSettings } from "@/lib/repositories/settings";
import { validateCoupon, type CouponLine } from "@/lib/repositories/marketing";
import { validatePreparation } from "@/lib/preparation/model";
import { buildLineWeight, type LineWeight } from "@/lib/weights/weight";
import { formatPrice, toPoisha, round2, isSafeTakaAmount } from "@/lib/utils/currency";
import { calculateCheckoutMoney, validCommerceRules } from "@/lib/checkout/money";

/**
 * Cart pricing
 * ------------
 * ONE implementation of "what does this basket cost", shared by the cart page
 * (live quote), the checkout page (live quote) and `createOrder` (the order that
 * is actually written). The browser only ever sends product ids, quantities and
 * the variation labels it picked — every price, stock ceiling, discount,
 * delivery fee and tax amount below is read from the database.
 */

/** What the browser sends about a preparation choice — labels only, no prices. */
export type PreparationRequest = {
  choices: { group: string; label: string }[];
  instructions?: string;
};

export type QuoteInput = {
  items: {
    productId: string;
    quantity: number;
    variantLabel?: string;
    preparation?: PreparationRequest;
  }[];
  couponCode?: string;
  /** Chosen delivery area at checkout; the cart quotes the cheapest area. */
  areaId?: string;
  channel?: "grocery" | "basket";
  /** Ignore the minimum-order rule (used by the cart page to show a warning). */
  enforceMinimum?: boolean;
};

export type QuoteLine = {
  productId: string;
  name: string;
  slug: string;
  sku?: string;
  image: string;
  unit: string;
  /** Base price of the chosen unit (product or variation). */
  unitPrice: number;
  unitPriceBase: number;
  compareAtPrice?: number;
  variantLabel?: string;
  quantity: number;
  /** Server-recomputed preparation charge per unit. */
  preparationCharge: number;
  /** Base price + preparation — what one unit really costs. */
  totalUnitPrice: number;
  /**
   * Set when the product is sold by an estimated weight: the shopper approves an
   * estimate and the packer's scale decides the final line price.
   */
  weight?: LineWeight;
  /** Validated preparation snapshot, ready to store on the order item. */
  preparation?: {
    signature: string;
    options: { group: string; label: string; charge: number }[];
    instructions?: string;
    chargePerUnit: number;
  };
  lineTotal: number;
  /** Units available right now for this product/variation. */
  available: number;
  inStock: boolean;
  /** Requested quantity exceeds what is in stock — the shopper must adjust. */
  shortOnStock: boolean;
  categoryId: string;
  active: boolean;
};

export type Quote = {
  ok: boolean;
  lines: QuoteLine[];
  errors: string[];
  subtotal: number;
  discount: number;
  couponCode?: string;
  couponDescription?: string;
  freeShippingCoupon: boolean;
  deliveryFee: number;
  /** True when delivery is free because the basket passed the threshold. */
  freeShipping: boolean;
  /** Cheapest active delivery area fee — what the cart quotes before an area is picked. */
  shippingFrom: number;
  tax: number;
  total: number;
  itemCount: number;
  settings: {
    currencySymbol: string;
    freeShippingThreshold: number;
    minOrderValue: number;
    taxRate: number;
    defaultDeliveryFee: number;
  };
  /** Total needed to unlock free delivery, 0 when already unlocked. */
  freeShippingRemaining: number;
  belowMinimum: boolean;
};

const round = round2;

/** Validates ids/variants against the catalogue and prices every line. */
export async function priceCartLines(
  items: QuoteInput["items"],
  transaction?: Database,
): Promise<{ lines: QuoteLine[]; errors: string[]; subtotal: number }> {
  const db = transaction ?? await ensureDatabase();
  // A MongoDB transaction session must not issue parallel operations.
  const products = await db.list<Product>("products");
  const categories = await db.list<Category>("categories");
  const categoryIndex = new Map(categories.map((category) => [category.id, category]));
  const visibleCategories = new Set(categories.filter((category) => {
    if (!(category.visible ?? true)) return false;
    if (!category.parentId) return true;
    const parent = categoryIndex.get(category.parentId);
    return Boolean(parent && !parent.parentId && (parent.visible ?? true));
  }).map((category) => category.id));
  const index = new Map(products.map((product) => [product.id, product]));
  const errors: string[] = [];
  const lines: QuoteLine[] = [];

  for (const item of items) {
    if (!item || typeof item.productId !== "string") continue;
    const product = index.get(item.productId);
    if (!product) {
      errors.push("A product in your basket is no longer available.");
      continue;
    }
    if (product.visibility === "hidden" || (product.status ?? "active") !== "active" || !visibleCategories.has(product.categoryId)) {
      errors.push(`${product.name} is no longer sold.`);
      continue;
    }
    if (!isSafeTakaAmount(product.price) || product.price <= 0) {
      errors.push(`${product.name} has an invalid price. Contact the store.`);
      continue;
    }

    const quantity = Number(item.quantity);
    const minimum = Number(product.selling?.minQuantity ?? 1);
    const step = Number(product.selling?.step ?? 1);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000 ||
        !Number.isSafeInteger(minimum) || minimum < 1 || !Number.isSafeInteger(step) || step < 1 ||
        quantity < minimum || (quantity - minimum) % step !== 0) {
      errors.push(`${product.name}: choose at least ${minimum}, increasing by ${step} whole units.`);
      continue;
    }

    const groups = (product.options ?? []).filter((group) => group.values.length > 0);
    if (groups.length > 1) {
      errors.push(`${product.name}: variation combinations need store review before ordering.`);
      continue;
    }
    if (groups.length === 1 && !item.variantLabel) {
      errors.push(`${product.name}: choose a variation before ordering.`);
      continue;
    }
    const matches = item.variantLabel ? groups.flatMap((group) => group.values).filter((value) => value.label === item.variantLabel) : [];
    if (item.variantLabel && matches.length !== 1) {
      errors.push(matches.length > 1
        ? `${product.name}: choose one unambiguous variation before ordering.`
        : `That option of ${product.name} is no longer available.`);
      continue;
    }
    const optionValue = matches[0];
    if (optionValue?.price != null && (!isSafeTakaAmount(optionValue.price) || optionValue.price <= 0)) {
      errors.push(`${product.name}: variation price needs store review.`);
      continue;
    }

    const unitPrice = optionValue?.price ?? product.price;
    const compareAtPrice =
      optionValue?.compareAtPrice && optionValue.compareAtPrice > unitPrice
        ? optionValue.compareAtPrice
        : product.compareAtPrice && product.compareAtPrice > unitPrice
          ? product.compareAtPrice
          : undefined;
    const baseStock = Number.isFinite(product.stock) ? Math.max(0, Number(product.stock)) : 0;
    const available = typeof optionValue?.stock === "number" && Number.isFinite(optionValue.stock)
      ? Math.min(baseStock, Math.max(0, optionValue.stock))
      : baseStock;

    // Preparation is re-derived from the product row that was just loaded. The
    // browser's charges are ignored; a stale option (the admin renamed it) is an
    // error the shopper has to fix rather than a silently different price.
    const preparationResult = validatePreparation(product.preparation, item.preparation);
    if (preparationResult.errors.length) {
      for (const error of preparationResult.errors) errors.push(`${product.name}: ${error}`);
      continue;
    }
    const preparationCharge = preparationResult.chargePerUnit;
    if (!isSafeTakaAmount(preparationCharge)) {
      errors.push(`${product.name}: preparation charges need store review.`);
      continue;
    }
    const unitPoisha = toPoisha(unitPrice) + toPoisha(preparationCharge);
    const linePoisha = unitPoisha * quantity;
    if (!Number.isSafeInteger(unitPoisha) || !Number.isSafeInteger(linePoisha) ||
        !isSafeTakaAmount(unitPoisha / 100) || !isSafeTakaAmount(linePoisha / 100)) {
      errors.push(`${product.name}: the basket amount needs store review.`);
      continue;
    }
    const totalUnitPrice = unitPoisha / 100;
    const preparation = preparationResult.choices.length || preparationResult.instructions
      ? {
          signature: [
            ...preparationResult.choices.map((choice) => `${choice.group}=${choice.label}`),
            preparationResult.instructions
              ? `notes=${preparationResult.instructions.trim().toLowerCase()}`
              : "",
          ]
            .filter(Boolean)
            .join("|"),
          options: preparationResult.choices,
          ...(preparationResult.instructions ? { instructions: preparationResult.instructions } : {}),
          chargePerUnit: preparationCharge,
        }
      : undefined;

    const lineWeight = buildLineWeight(product.selling, quantity);
    lines.push({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      image: product.image,
      unit: optionValue?.label ?? product.unit,
      unitPrice,
      unitPriceBase: unitPrice,
      preparationCharge,
      totalUnitPrice,
      ...(preparation ? { preparation } : {}),
      compareAtPrice,
      variantLabel: item.variantLabel,
      quantity,
      lineTotal: linePoisha / 100,
      ...(lineWeight ? { weight: lineWeight } : {}),
      available,
      inStock: available > 0,
      shortOnStock: available < quantity,
      categoryId: product.categoryId,
      active: true,
    });
  }

  // Multiple preparation/variant lines can refer to the same product. Check
  // their combined demand, not each row separately, against both stock pools.
  const totals = new Map<string, number>();
  const variantTotals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
    if (line.variantLabel) {
      const key = JSON.stringify([line.productId, line.variantLabel]);
      variantTotals.set(key, (variantTotals.get(key) ?? 0) + line.quantity);
    }
  }
  for (const line of lines) {
    const product = index.get(line.productId)!;
    const baseStock = Math.max(0, Number(product.stock ?? 0));
    const option = line.variantLabel ? (product.options ?? []).flatMap((group) => group.values).find((value) => value.label === line.variantLabel) : undefined;
    const variantQty = line.variantLabel ? (variantTotals.get(JSON.stringify([line.productId, line.variantLabel])) ?? 0) : 0;
    line.shortOnStock = (totals.get(line.productId) ?? 0) > baseStock ||
      (typeof option?.stock === "number" && variantQty > option.stock);
    if (line.shortOnStock) errors.push(`${line.name}${line.variantLabel ? ` (${line.variantLabel})` : ""} has insufficient stock for the quantities in your basket.`);
  }
  let subtotalPoisha = 0;
  for (const line of lines) {
    const lineAmount = toPoisha(line.lineTotal);
    if (!Number.isSafeInteger(lineAmount) || !Number.isSafeInteger(subtotalPoisha + lineAmount)) {
      errors.push("The basket total needs store review before checkout.");
      subtotalPoisha = 0;
      break;
    }
    subtotalPoisha += lineAmount;
  }
  return { lines, errors: Array.from(new Set(errors)), subtotal: subtotalPoisha / 100 };
}

/** Full money breakdown for a basket: prices, coupon, shipping, tax, total. */
export async function quoteCart(input: QuoteInput): Promise<Quote> {
  const settings = await getSettings();
  const commerce = settings.commerce;
  const db = await ensureDatabase();

  const { lines, errors, subtotal } = await priceCartLines(input.items);
  const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
  const rulesValid = validCommerceRules(commerce);
  if (!rulesValid) errors.push("Delivery or tax settings need store review before checkout.");
  // Sanitized presentation values prevent malformed historical settings from
  // crashing the cart. The errors above still block checkout.
  const freeThreshold = rulesValid ? commerce.freeShippingThreshold : 0;
  const defaultFee = rulesValid ? commerce.defaultDeliveryFee : 0;
  const minimum = rulesValid ? commerce.minOrderValue : 0;
  const taxRate = rulesValid ? commerce.taxRate : 0;

  const couponLines: CouponLine[] = lines.map((line) => ({ 
    productId: line.productId,
    categoryId: line.categoryId,
    lineTotal: line.lineTotal,
  }));

  let discount = 0;
  let couponCode: string | undefined;
  let couponDescription: string | undefined;
  let freeShippingCoupon = false;

  if (input.couponCode?.trim()) {
    const check = await validateCoupon(
      input.couponCode,
      subtotal,
      input.channel ?? "grocery",
      couponLines,
    );
    if (check.ok) {
      discount = check.discount;
      couponCode = check.code;
      couponDescription = check.description;
      freeShippingCoupon = check.freeShipping;
    } else {
      errors.push(check.error);
    }
  }

  // The cart has no delivery area yet, so it quotes the cheapest active area
  // (or the site default when no areas exist). Checkout quotes the real one.
  const areas = await db.list<{ id: string; name: string; fee: number; active: boolean }>("delivery_areas");
  const activeAreas = areas.filter((area) => area.active);
  const chosenArea = input.areaId ? activeAreas.find((area) => area.id === input.areaId) : undefined;
  if (input.areaId && !chosenArea) errors.push("Choose an available delivery area.");
  const areaFees = activeAreas.map((area) => area.fee ?? defaultFee);
  const validAreaFees = areaFees.every(isSafeTakaAmount);
  if (!validAreaFees) errors.push("A delivery area's charges need store review.");
  const shippingFrom = validAreaFees && areaFees.length ? Math.min(...areaFees) : defaultFee;
  const chosenFee = chosenArea?.fee ?? shippingFrom;
  const areaFee = isSafeTakaAmount(chosenFee) ? chosenFee : 0;

  const freeShipping = freeShippingCoupon || (freeThreshold > 0 && subtotal >= freeThreshold);
  const deliveryFee = subtotal === 0 ? 0 : freeShipping ? 0 : areaFee;
  const calculated = calculateCheckoutMoney(subtotal, discount, deliveryFee, taxRate);
  if (!calculated.ok) errors.push("The basket total needs store review before checkout.");
  const tax = calculated.ok ? calculated.tax : 0;
  const total = calculated.ok ? calculated.total : 0;
  const belowMinimum = subtotal > 0 && subtotal < minimum;

  if (belowMinimum && input.enforceMinimum) {
    errors.push(`Minimum order is ${formatPrice(minimum)}.`);
  }

  return {
    ok: errors.length === 0,
    lines,
    errors,
    subtotal,
    discount: round(discount),
    couponCode,
    couponDescription,
    freeShippingCoupon,
    deliveryFee,
    freeShipping,
    shippingFrom: round(shippingFrom),
    tax,
    total,
    itemCount,
    settings: {
      currencySymbol: commerce.currencySymbol,
      freeShippingThreshold: freeThreshold,
      minOrderValue: minimum,
      taxRate,
      defaultDeliveryFee: defaultFee,
    },
    freeShippingRemaining:
      subtotal > 0 && subtotal < freeThreshold
        ? round(freeThreshold - subtotal)
        : 0,
    belowMinimum,
  };
}

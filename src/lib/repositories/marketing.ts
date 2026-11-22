import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Database, Row } from "@/lib/db/types";
import { formatPrice, isSafeTakaAmount, toPoisha } from "@/lib/utils/currency";

/**
 * Coupons and newsletter subscribers.
 * Coupon rules are enforced on the server at checkout — the browser never
 * decides a discount amount.
 */

export type CouponAppliesTo = "all" | "categories" | "products";

export type Coupon = Row & {
  code: string;
  description: string;
  type: "percent" | "fixed" | "free-shipping";
  value: number;
  minSubtotal: number;
  maxDiscount: number;
  usageLimit: number;
  usedCount: number;
  startsAt: string;
  endsAt: string;
  active: boolean;
  channels: string[];
  /** Which products the discount may be spent on (defaults to everything). */
  appliesTo?: CouponAppliesTo;
  categoryIds?: string[];
  productIds?: string[];
};

/** One basket line as the coupon engine needs to see it. */
export type CouponLine = {
  productId: string;
  categoryId: string;
  lineTotal: number;
};

export type Subscriber = Row & {
  email: string;
  source: string;
  status: "subscribed" | "unsubscribed";
  createdAt: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export async function listCoupons() {
  const db = await ensureDatabase();
  const coupons = await db.list<Coupon>("coupons");
  return coupons.sort((a, b) => (a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1);
}

export type CouponCheck =
  | { ok: true; code: string; discount: number; freeShipping: boolean; description: string }
  | { ok: false; error: string };

/**
 * Validates a coupon against a basket.
 *
 * `lines` is optional so older callers can still check a code against a bare
 * subtotal, but when lines are supplied the product/category restriction is
 * enforced and the discount is calculated on the *eligible* part of the basket
 * only — never on items the coupon does not cover.
 */
export async function validateCoupon(
  rawCode: string,
  subtotal: number,
  channel: string,
  lines?: CouponLine[],
  transaction?: Database,
): Promise<CouponCheck> {
  const db = transaction ?? await ensureDatabase();
  const code = rawCode.trim().toUpperCase();
  const coupons = await db.list<Coupon>("coupons", { where: { code } });
  const coupon = coupons[0];

  if (!coupon) return { ok: false, error: "That coupon code is not recognised." };
  if (coupons.length !== 1) return { ok: false, error: "This coupon needs store review before it can be used." };
  // A missing/null counter is not proof of zero previous redemptions. Legacy
  // coupons require review instead of silently bypassing their usage limit.
  const usageLimit = coupon.usageLimit;
  const usedCount = coupon.usedCount;
  const minimum = coupon.minSubtotal ?? 0;
  const maximum = coupon.maxDiscount ?? 0;
  const value = coupon.value ?? 0;
  if (!isSafeTakaAmount(subtotal) || !isSafeTakaAmount(minimum) || !isSafeTakaAmount(maximum) ||
      !Number.isSafeInteger(usageLimit) || usageLimit < 0 || !Number.isSafeInteger(usedCount) || usedCount < 0 || usedCount >= Number.MAX_SAFE_INTEGER ||
      !["percent", "fixed", "free-shipping"].includes(coupon.type) ||
      (coupon.channels != null && (!Array.isArray(coupon.channels) || coupon.channels.some((channel) => typeof channel !== "string"))) ||
      !isSafeTakaAmount(value) || (coupon.type === "percent" && (value <= 0 || value > 100)) ||
      (coupon.type === "fixed" && value <= 0)) {
    return { ok: false, error: "This coupon needs store review before it can be used." };
  }
  if (coupon.active !== true) return { ok: false, error: "That coupon is no longer active." };
  if (coupon.endsAt && coupon.endsAt < today()) return { ok: false, error: "That coupon has expired." };
  if (coupon.startsAt && coupon.startsAt > today()) return { ok: false, error: "That coupon is not active yet." };
  if (usageLimit > 0 && usedCount >= usageLimit) {
    return { ok: false, error: "That coupon has reached its usage limit." };
  }
  if (coupon.channels?.length && !coupon.channels.includes(channel)) {
    return { ok: false, error: "That coupon does not apply to this order type." };
  }
  if (subtotal < (coupon.minSubtotal ?? 0)) {
    return { ok: false, error: `That coupon needs a subtotal of at least ${formatPrice(coupon.minSubtotal)}.` };
  }

  // Product / category restrictions: the discount applies to the eligible lines
  // only, so a "Fruit 20% off" code can never discount a basket of cleaning spray.
  const appliesTo = coupon.appliesTo ?? "all";
  if (!["all", "categories", "products"].includes(appliesTo) ||
      (appliesTo !== "all" && !Array.isArray(lines)) ||
      (coupon.categoryIds != null && (!Array.isArray(coupon.categoryIds) || coupon.categoryIds.some((id) => typeof id !== "string"))) ||
      (coupon.productIds != null && (!Array.isArray(coupon.productIds) || coupon.productIds.some((id) => typeof id !== "string")))) {
    return { ok: false, error: "This coupon needs store review before it can be used." };
  }
  let eligibleSubtotal = subtotal;
  if (appliesTo !== "all" && lines) {
    const categoryIds = coupon.categoryIds ?? [];
    const productIds = coupon.productIds ?? [];
    const eligible = lines.filter((line) =>
      appliesTo === "categories" ? categoryIds.includes(line.categoryId) : productIds.includes(line.productId),
    );
    if (eligible.length === 0) {
      return {
        ok: false,
        error: "That coupon does not apply to anything in your basket.",
      };
    }
    let eligiblePoisha = 0;
    for (const line of eligible) {
      if (!isSafeTakaAmount(line.lineTotal) || !Number.isSafeInteger(eligiblePoisha + toPoisha(line.lineTotal))) {
        return { ok: false, error: "This coupon needs store review before it can be used." };
      }
      eligiblePoisha += toPoisha(line.lineTotal);
    }
    if (eligiblePoisha > toPoisha(subtotal)) return { ok: false, error: "This coupon needs store review before it can be used." };
    eligibleSubtotal = eligiblePoisha / 100;
  }

  if (coupon.type === "free-shipping") {
    return { ok: true, code: coupon.code, discount: 0, freeShipping: true, description: coupon.description };
  }

  const basePoisha = toPoisha(appliesTo === "all" ? subtotal : eligibleSubtotal);
  const numerator = coupon.type === "percent" ? basePoisha * toPoisha(value) : 0;
  if (!Number.isSafeInteger(numerator)) return { ok: false, error: "This coupon needs store review before it can be used." };
  const rawPoisha = coupon.type === "percent" ? Math.round(numerator / 10_000) : Math.min(toPoisha(value), basePoisha);
  const cappedPoisha = maximum > 0 ? Math.min(rawPoisha, toPoisha(maximum)) : rawPoisha;
  const discount = Math.min(cappedPoisha, basePoisha) / 100;
  if (!isSafeTakaAmount(discount)) return { ok: false, error: "This coupon needs store review before it can be used." };
  return { ok: true, code: coupon.code, discount, freeShipping: false, description: coupon.description };
}

export async function recordCouponUse(code: string, transaction?: Database) {
  const db = transaction ?? await ensureDatabase();
  const coupons = await db.list<Coupon>("coupons", { where: { code } });
  const coupon = coupons[0];
  if (coupon) await db.update("coupons", coupon.id, { usedCount: (coupon.usedCount ?? 0) + 1 });
}

/** Internal deletion primitive. The action must first enforce marketing.manage.
 * Never remove a coupon with recorded uses or historical orders; disable it
 * instead. Mongo deletion and the checkout redemption write conflict safely. */
export async function deleteUnusedCouponInDatabase(db: Database, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const remove = async (tx: Database): Promise<{ ok: true } | { ok: false; error: string }> => {
    const coupon = await tx.get<Coupon>("coupons", id);
    if (!coupon) return { ok: false, error: "That coupon no longer exists." };
    const uses = coupon.usedCount;
    if (!Number.isSafeInteger(uses) || uses < 0 || typeof coupon.code !== "string" || !coupon.code.trim()) {
      return { ok: false, error: "This coupon's history needs manual review. Disable it instead." };
    }
    const code = coupon.code.trim().toUpperCase();
    const orders = await tx.list<Row & { couponCode?: string }>("orders");
    if (uses > 0 || orders.some((order) => typeof order.couponCode === "string" && order.couponCode.trim().toUpperCase() === code)) {
      return { ok: false, error: "This coupon has been used in an order. Disable it instead of deleting its history." };
    }
    if (!(await tx.remove("coupons", id))) throw new Error("Coupon disappeared during deletion.");
    return { ok: true };
  };
  if (db.driver === "mongo") {
    if (!db.withTransaction) return { ok: false, error: "A transaction-capable database is required to delete coupons." };
    return db.withTransaction(remove);
  }
  return remove(db);
}

export async function listSubscribers() {
  const db = await ensureDatabase();
  const rows = await db.list<Subscriber>("subscribers");
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function addSubscriber(email: string, source = "website") {
  const db = await ensureDatabase();
  const normalised = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalised)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }
  const existing = (await db.list<Subscriber>("subscribers", { where: { email: normalised } }))[0];
  if (existing) {
    if (existing.status === "unsubscribed") {
      await db.update("subscribers", existing.id, { status: "subscribed" });
      return { ok: true as const, message: "Welcome back — you are subscribed again." };
    }
    return { ok: true as const, message: "You are already on the list." };
  }
  await db.insert<Subscriber>("subscribers", {
    email: normalised,
    source,
    status: "subscribed",
    createdAt: new Date().toISOString(),
  });
  return { ok: true as const, message: "Subscribed. Your email has been saved." };
}

export async function getMarketingOverview() {
  const [coupons, subscribers] = await Promise.all([listCoupons(), listSubscribers()]);
  return {
    coupons,
    subscribers,
    stats: {
      activeCoupons: coupons.filter((coupon) => coupon.active).length,
      redemptions: coupons.reduce((total, coupon) => total + (coupon.usedCount ?? 0), 0),
      subscribers: subscribers.filter((subscriber) => subscriber.status === "subscribed").length,
    },
  };
}

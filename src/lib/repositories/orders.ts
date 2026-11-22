import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Database, Row } from "@/lib/db/types";
import type { Product } from "@/lib/types/domain";
import { getSettings } from "@/lib/repositories/settings";
import { addStockMovement } from "@/lib/repositories/inventory";
import { upsertCustomerFromOrder } from "@/lib/repositories/customers";
import { validateCoupon } from "@/lib/repositories/marketing";
import { hasManualTransferDetails, paymentMode, type PaymentMethod } from "@/lib/repositories/operations";
import { createPaymentSession, isProviderConfigured } from "@/lib/payments/providers";
import { randomBytes } from "node:crypto";
import { hashOrderAccessKey } from "@/lib/auth/order-access-key";
import { priceCartLines } from "@/lib/checkout/quote";
import { checkoutIntentFingerprint } from "@/lib/checkout/idempotency";
import { calculateCheckoutMoney, validCommerceRules } from "@/lib/checkout/money";
import { priceForWeighedLine, summariseWeights } from "@/lib/weights/weight";
import { recountWeightOrder, weightApprovalSnapshot } from "@/lib/weights/approval";
import { weightAdjustmentHoldReason, orderFinancialExpectation, hasUnresolvedWeights } from "@/lib/weights/finance";
import { hasValidPaymentReviewAmount, matchesPaymentReview, paymentReviewExpectation } from "@/lib/payments/review-snapshot";
import { formatPrice, toPoisha, isSafeTakaAmount } from "@/lib/utils/currency";
import {
  orderStatuses,
  paymentStatuses,
  channelLabels,
  type OrderChannel,
  type OrderStatus,
  type PaymentStatus,
} from "@/lib/orders/constants";

export { orderStatuses, paymentStatuses, channelLabels };
export type { OrderChannel, OrderStatus, PaymentStatus };

/**
 * Orders
 * ------
 * Prices are always recalculated from the database at checkout — the client
 * sends product ids and quantities only. Stock is decremented with a ledger
 * entry per line, and the order timeline records every status change.
 */

/**
 * Preparation snapshot stored on the order item.
 *
 * Everything is copied at checkout: the labels, the extra charge and the
 * shopper's instructions. Editing a product's preparation options later never
 * rewrites history — the packing slip and the invoice keep showing what was
 * actually ordered and paid for.
 */
export type OrderItemPreparation = {
  options: { group: string; label: string; charge: number }[];
  instructions?: string;
  /** Extra charge per unit at the time of ordering. */
  chargePerUnit: number;
  signature: string;
};

/**
 * Scale reading for a line sold by estimated weight.
 *
 * `estimatedGrams` is what the shopper approved. `actualGrams` is what the
 * packer weighed. `status` is the audit trail: an increase waits as
 * "proposed" until the customer confirms it, a decrease is applied straight
 * away. `difference` is always kept, even when it was waived, so the shop can
 * see what it did or did not charge.
 */
export type OrderItemWeight = {
  unitGrams: number;
  estimatedGrams: number;
  /** Immutable amount for this line at checkout; never the reweigh comparison baseline. */
  originalLineTotal: number;
  estimateLabel?: string;
  actualGrams?: number;
  /** Line total once the actual weight is known (price per unit × grams). */
  actualLineTotal?: number;
  /** Change from the line amount in force immediately before this reading. */
  difference?: number;
  status: "estimated" | "proposed" | "approved" | "waived";
  weighedAt?: string;
  weighedBy?: string;
  settledAt?: string;
  note?: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  sku?: string;
  image: string;
  unit: string;
  /** Selected variation ("1 kg"), when the product has variations. */
  variantLabel?: string;
  /** Whether this specific variation had its own stock pool at reservation. */
  variantStockTracked?: boolean;
  /** How the item is cut/cleaned, when the product offers preparation. */
  preparation?: OrderItemPreparation;
  /** Extra preparation charge included in `price` (per unit). */
  preparationCharge?: number;
  /** Present when the line is sold by an estimated weight. */
  weight?: OrderItemWeight;
  price: number;
  quantity: number;
  lineTotal: number;
};

export type OrderAddress = {
  line1: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  area: string;
  areaId?: string;
};

export type OrderPayment = {
  /** "cod" | "card" | "wallet" | "gateway" */
  type: string;
  mode: "offline" | "manual-transfer" | "gateway";
  provider?: string;
  /** Reference the customer typed (transfer ID) or the gateway's transaction id. */
  reference?: string;
  /** Gateway session reference, matched by the verified callback. */
  sessionReference?: string;
  paidAt?: string;
  verifiedBy?: string;
  /** A manually recorded refund; no gateway refund is initiated by this app. */
  refundReference?: string;
  refundedAt?: string;
  refundedBy?: string;
};

export type OrderCancellationReview = {
  id: string;
  orderId: string;
  at: string;
  staffId: string;
  staffName: string;
  note: string;
  couponDecision?: "retain" | "release";
  customerDecision?: "leave" | "reconcile";
  reconciledOrderCount?: number;
  reconciledTotalSpent?: number;
};

export type Order = Row & {
  number: string;
  /** Currency is snapshotted for historical integrity; never reinterpret a legacy order. */
  currency: "BDT";
  channel: OrderChannel;
  customerId?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    area: string;
    notes?: string;
    company?: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
    areaId?: string;
  };
  /** Snapshot of the delivery address as entered (never re-read from the customer). */
  deliveryAddress?: OrderAddress;
  /** Present only when the shopper asked for a different billing address. */
  billingAddress?: OrderAddress;
  payment?: OrderPayment;
  paymentMethodId?: string;
  /** Legacy plaintext key, retained only for existing orders. */
  accessToken?: string;
  /** New order keys are stored as one-way hashes. */
  accessTokenHash?: string;
  /** True only when checkout was associated with an authenticated session. */
  customerWasAuthenticated?: boolean;
  /** Protects against double-submits / refresh replays. */
  idempotencyKey?: string;
  /** Server-computed request fingerprint; never send this or the retry key to a client. */
  idempotencyFingerprint?: string;
  /** Only orders reserved atomically by the transaction core carry this marker. */
  inventoryReservationVersion?: 1;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  /** Absolute checkout discount frozen for weight changes, before any subtotal cap. */
  checkoutDiscount?: number;
  couponCode?: string;
  deliveryFee: number;
  tax: number;
  /** Tax percentage captured at checkout, so a weight change re-taxes correctly. */
  taxRate?: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  deliveryPartnerId?: string;
  deliverySlot?: string;
  /** Snapshot of the area's delivery promise at the time of ordering ("Same day"). */
  deliveryEta?: string;
  timeline: { at: string; status: string; note?: string; actor: string }[];
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CheckoutInput = {
  items: {
    productId: string;
    quantity: number;
    variantLabel?: string;
    preparation?: { choices: { group: string; label: string }[]; instructions?: string };
  }[];
  /**
   * Signed-in customer id. Resolved from the session inside the checkout action —
   * never accepted from the browser — and used to scope "My orders".
   */
  customerId?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    notes?: string;
    company?: string;
    addressLine2?: string;
    city?: string;
    postalCode?: string;
  };
  areaId: string;
  paymentMethodId: string;
  couponCode?: string;
  channel?: OrderChannel;
  deliverySlot?: string;
  /** Reference the customer typed after sending a transfer. */
  paymentReference?: string;
  /** Optional billing address when it differs from the delivery address. */
  billingAddress?: { line1: string; line2?: string; city?: string; postalCode?: string };
  /** Sent by the checkout so a repeated submit returns the same order. */
  idempotencyKey?: string;
  /** Client confirmation only: never used as an authoritative price. */
  expectedTotal?: number;
  termsAccepted?: boolean;
};

/** Change the matching variant stock as well as the parent product stock. */
function changeVariantStock(product: Product, items: OrderItem[], direction: 1 | -1) {
  const options = product.options?.map((group) => ({ ...group, values: group.values.map((value) => ({ ...value })) }));
  for (const item of items) {
    if (!item.variantLabel || !options) continue;
    const option = options.flatMap((group) => group.values).find((value) => value.label === item.variantLabel);
    if (option && typeof option.stock === "number") option.stock = Math.max(0, option.stock + direction * item.quantity);
  }
  return options;
}

export type CheckoutResult =
  | { ok: true; order: Order; guestAccessKey?: string; redirectUrl?: string }
  | { ok: false; errors: string[]; code?: "IDEMPOTENCY_CONFLICT" };

/** A key reused with a changed request (or an unverifiable legacy order) must
 * not silently report a different purchase as the one the shopper submitted. */
function existingCheckoutResult(order: Order, input: CheckoutInput): CheckoutResult {
  if (order.idempotencyFingerprint && order.idempotencyFingerprint === checkoutIntentFingerprint(input)) {
    return { ok: true, order };
  }
  return {
    ok: false,
    code: "IDEMPOTENCY_CONFLICT",
    errors: ["This checkout attempt may already have created a different order. Check My Orders before starting a new attempt."],
  };
}

/** Public server entry. The production hold remains in place until real Atlas
 * staging, all competing stock mutations, and an independent review are done. */
export async function createOrder(input: CheckoutInput): Promise<CheckoutResult> {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return { ok: false, errors: ["Checkout is temporarily unavailable. Please contact the store."] };
  }
  const db = await ensureDatabase();
  const result = db.withTransaction
    ? await createOrderTransaction(db, input)
    : await createOrderInDatabase(db, input, false);
  if (result.ok) {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/home-grocery"); revalidatePath("/admin");
    revalidatePath("/admin/orders"); revalidatePath("/admin/payments");
  }
  return result;
}

class CheckoutRejected extends Error {
  constructor(readonly result: Extract<CheckoutResult, { ok: false }>) { super("Checkout validation failed"); }
}

/** Transactional checkout core for isolated tests and future staging. Only the
 * database adapter is used inside the callback: no email, payments or cache
 * changes. The driver may retry the callback after a write conflict. */
export async function createOrderTransaction(db: Database, input: CheckoutInput): Promise<CheckoutResult> {
  if (db.driver !== "mongo" || !db.withTransaction || !db.orderTransactionIndexesReady) {
    return { ok: false, errors: ["Checkout needs a transaction-capable MongoDB replica set with reviewed order indexes."] };
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.withTransaction(async (tx) => {
        const result = await createOrderInDatabase(tx, input, true);
        // Any validation discovered after a write must roll back the whole
        // transaction instead of committing a partial order or reservation.
        if (!result.ok) throw new CheckoutRejected(result);
        return result;
      });
    } catch (error) {
      if (error instanceof CheckoutRejected) return error.result;
      if ((error as { code?: number })?.code === 11000) {
        // Another instance may have won an idempotent retry or the first
        // creation of the sequence counter. Never return a different account's
        // order, and never swallow an unrelated persistent index collision.
        const key = input.idempotencyKey?.trim();
        if (key && input.customerId) {
          const existing = (await db.list<Order>("orders", { where: { customerId: input.customerId, idempotencyKey: key } }))[0];
          if (existing) return existingCheckoutResult(existing, input);
        }
        if (attempt < 2) continue;
      }
      throw error;
    }
  }
  return { ok: false, errors: ["Checkout could not be completed. Please try again."] };
}

async function nextOrderNumber(db: Database, prefix: string): Promise<string> {
  const key = "global-order-sequence";
  let counter = await db.get<Row & { value: number }>("counters", key);
  if (!counter) {
    // Bootstrap from actual historical suffixes, not collection size, so
    // deleted orders and changed prefixes cannot cause reused numbers.
    const historical = await db.list<Order>("orders");
    let maximum = 1000;
    for (const order of historical) {
      const match = typeof order.number === "string" ? /-(\d+)$/.exec(order.number) : null;
      if (!match) continue;
      const number = Number(match[1]);
      if (!Number.isSafeInteger(number)) throw new Error("Historical order numbers require backup and review before the sequence can be initialized.");
      maximum = Math.max(maximum, number);
    }
    counter = await db.insert<Row & { value: number }>("counters", { id: key, value: maximum });
  }
  if (!Number.isSafeInteger(counter.value) || counter.value < 1000 || counter.value >= Number.MAX_SAFE_INTEGER - 1) {
    throw new Error("The order sequence requires manual review.");
  }
  const value = counter.value + 1;
  if (!(await db.update("counters", key, { value }))) throw new Error("The order sequence could not be updated.");
  return `${prefix}-${value}`;
}

async function createOrderInDatabase(db: Database, input: CheckoutInput, transactional: boolean): Promise<CheckoutResult> {
  if (transactional && (!input.customerId || !/^[A-Za-z0-9_-]{12,128}$/.test(input.idempotencyKey?.trim() ?? ""))) {
    return { ok: false, errors: ["Sign in and refresh checkout before placing your order."] };
  }
  let transactionalCustomer: (Row & { status?: string; orderCount?: number; totalSpent?: number }) | null = null;
  if (transactional && input.customerId) {
    const profile = await db.get<Row & { status?: string; orderCount?: number; totalSpent?: number }>("customers", input.customerId);
    if (!profile || profile.status === "blocked") return { ok: false, errors: ["Your account is not available for checkout."] };
    if (!Number.isSafeInteger(profile.orderCount) || (profile.orderCount ?? -1) < 0 ||
        (profile.orderCount ?? Number.MAX_SAFE_INTEGER) >= Number.MAX_SAFE_INTEGER || !isSafeTakaAmount(profile.totalSpent)) {
      return { ok: false, errors: ["Your account totals need store review before checkout."] };
    }
    transactionalCustomer = profile;
    const approved = input.expectedTotal;
    if (!isSafeTakaAmount(approved)) {
      return { ok: false, errors: ["Refresh your basket to review the total before placing the order."] };
    }
    const storedSettings = await db.get<Row & { commerce?: { currency?: string } }>("settings", "site");
    if (storedSettings?.commerce?.currency !== "BDT") {
      return { ok: false, errors: ["The store currency needs manual review before checkout."] };
    }
  }
  const settings = await getSettings(db);
  if (!validCommerceRules(settings.commerce)) {
    return { ok: false, errors: ["Delivery or tax settings need store review before checkout."] };
  }
  const errors: string[] = [];

  /* ---------------------------------------------------------------- *
   * 0. Idempotency — a double-click, a refresh or a retried submit must
   *    never create a second order. The key is generated once per
   *    checkout attempt by the browser and stored on the order.
   * ---------------------------------------------------------------- */
  const idempotencyKey = input.idempotencyKey?.trim();
  if (idempotencyKey) {
    const existing = (
      await db.list<Order>("orders", { where: { customerId: input.customerId, idempotencyKey } })
    ).filter((order) => order.idempotencyKey === idempotencyKey && order.customerId === input.customerId)[0];
    if (existing) return existingCheckoutResult(existing, input);
  }

  /* ---------------------------------------------------------------- *
   * 1. Customer details
   * ---------------------------------------------------------------- */
  if (!input.customer.name?.trim()) errors.push("Enter your full name.");
  if ((input.customer.name ?? "").trim().length > 120) errors.push("Your name is too long.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.customer.email ?? "")) {
    errors.push("Enter a valid email address.");
  }
  if ((input.customer.phone ?? "").replace(/\D/g, "").length < 7) {
    errors.push("Enter a valid phone number.");
  }
  if ((input.customer.address ?? "").trim().length < 8) {
    errors.push("Enter a full street address (house, road, area).");
  }
  if (!Array.isArray(input.items) || input.items.length === 0) errors.push("Your cart is empty.");
  if (settings.checkout.termsRequired && !input.termsAccepted) errors.push("Please accept the terms before placing your order.");

  /* ---------------------------------------------------------------- *
   * 2. Delivery area + slot (both admin-managed)
   * ---------------------------------------------------------------- */
  const area = await db.get<Row & { id: string; name: string; fee: number; minOrder: number; active: boolean; slots?: string[] }>(
    "delivery_areas",
    input.areaId,
  );
  if (!area || !area.active) errors.push("Choose a delivery area.");
  if (area && (!isSafeTakaAmount(area.fee ?? settings.commerce.defaultDeliveryFee) || !isSafeTakaAmount(area.minOrder ?? 0))) {
    errors.push("This delivery area's charges need store review.");
  }

  const areaSlots = (area?.slots ?? []).filter(Boolean);
  if (input.deliverySlot) {
    if (!areaSlots.includes(input.deliverySlot)) {
      errors.push("That delivery time is not available for the chosen area.");
    }
  }

  /* ---------------------------------------------------------------- *
   * 3. Payment method — re-checked here, never trusted from the form
   * ---------------------------------------------------------------- */
  const method = await db.get<PaymentMethod>("payment_methods", input.paymentMethodId);
  const mode = method ? paymentMode(method) : "offline";
  if (!method || !method.active) {
    errors.push("Choose an available payment method.");
  } else {
    if (method.type === "cod" && !settings.commerce.codEnabled) {
      errors.push("Cash on delivery is not available right now.");
    }
    if (mode === "manual-transfer" && !hasManualTransferDetails(method)) {
      errors.push("That payment method is not available right now.");
    }
    if (mode === "offline" && method.type === "card" && !method.instructions?.trim()) {
      errors.push("Card on delivery is not configured right now.");
    }
    if (mode === "gateway" && !isProviderConfigured(method.provider)) {
      errors.push("That online payment provider is not connected yet.");
    }
    if (mode === "manual-transfer") {
      const reference = (input.paymentReference ?? "").trim();
      if (reference.length < 6) {
        errors.push("Enter the transaction ID from your payment app so we can match your payment.");
      }
    }
  }

  if (errors.length || !area || !method) return { ok: false, errors };

  /* ---------------------------------------------------------------- *
   * 4. Lines, prices and stock — from the shared pricing module
   * ---------------------------------------------------------------- */
  const { lines, errors: lineErrors, subtotal } = await priceCartLines(input.items, db);
  const products = await db.list<Product>("products");
  errors.push(...lineErrors);
  if (errors.length) return { ok: false, errors };

  const index = new Map(products.map((product) => [product.id, product]));
  if (transactional) {
    // A missing or ambiguous option must never fall back to the cheaper base
    // price/stock pool. The present cart serialises a single label, so multiple
    // variation groups need a proper combination model before launch.
    for (const line of lines) {
      const product = index.get(line.productId)!;
      const groups = (product.options ?? []).filter((group) => group.values.length > 0);
      if (!Number.isSafeInteger(product.stock) || (product.stock ?? -1) < 0) {
        errors.push(`${line.name}: stock needs store review.`);
      }
      if (groups.length > 1) {
        errors.push(`${line.name}: its variation combinations need store review before ordering.`);
      } else if (groups.length === 1) {
        const matches = groups[0].values.filter((value) => value.label === line.variantLabel);
        if (!line.variantLabel || matches.length !== 1) {
          errors.push(`${line.name}: choose one unambiguous variation before ordering.`);
        } else if (matches[0].stock !== undefined && (!Number.isSafeInteger(matches[0].stock) || matches[0].stock! < 0)) {
          errors.push(`${line.name}: variation stock needs store review.`);
        }
      }
    }
    if (errors.length) return { ok: false, errors: Array.from(new Set(errors)) };
  }
  const items: OrderItem[] = lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    sku: line.sku,
    image: line.image,
    unit: line.unit,
    variantLabel: line.variantLabel,
    ...(transactional && line.variantLabel ? {
      variantStockTracked: typeof index.get(line.productId)?.options?.flatMap((group) => group.values)
        .find((value) => value.label === line.variantLabel)?.stock === "number",
    } : {}),
    ...(line.preparation ? { preparation: line.preparation } : {}),
    ...(line.preparationCharge ? { preparationCharge: line.preparationCharge } : {}),
    ...(line.weight
      ? {
          weight: {
            unitGrams: line.weight.unitGrams,
            estimatedGrams: line.weight.estimatedGrams,
            originalLineTotal: line.lineTotal,
            ...(line.weight.estimateLabel ? { estimateLabel: line.weight.estimateLabel } : {}),
            status: "estimated" as const,
          },
        }
      : {}),
    // `price` is the full per-unit price the shopper paid, preparation included.
    price: line.totalUnitPrice,
    quantity: line.quantity,
    lineTotal: line.lineTotal,
  }));

  if (subtotal < (settings.commerce.minOrderValue ?? 0)) {
    return {
      ok: false,
      errors: [`Minimum order value is ${formatPrice(settings.commerce.minOrderValue)}.`],
    };
  }
  if (Number(area.minOrder ?? 0) > 0 && subtotal < Number(area.minOrder)) {
    return {
      ok: false,
      errors: [
        `Orders to ${area.name} start at ${formatPrice(area.minOrder)}. Add more to your cart or choose another area.`,
      ],
    };
  }

  /* ---------------------------------------------------------------- *
   * 5. Coupon (re-validated against the final basket)
   * ---------------------------------------------------------------- */
  let discount = 0;
  let couponCode: string | undefined;
  let freeShippingCoupon = false;
  if (input.couponCode?.trim()) {
    const coupon = await validateCoupon(
      input.couponCode,
      subtotal,
      input.channel ?? "grocery",
      lines.map((line) => ({
        productId: line.productId,
        categoryId: line.categoryId,
        lineTotal: line.lineTotal,
      })),
      db,
    );
    if (!coupon.ok) return { ok: false, errors: [coupon.error] };
    discount = coupon.discount;
    couponCode = coupon.code;
    freeShippingCoupon = coupon.freeShipping;
  }

  const freeShipping = freeShippingCoupon || (settings.commerce.freeShippingThreshold > 0 && subtotal >= settings.commerce.freeShippingThreshold);
  const deliveryFee = freeShipping ? 0 : Number(area.fee ?? settings.commerce.defaultDeliveryFee);
  const calculated = calculateCheckoutMoney(subtotal, discount, deliveryFee, settings.commerce.taxRate);
  if (!calculated.ok) return { ok: false, errors: ["The basket total needs store review before checkout."] };
  const { tax, total } = calculated;
  if (transactionalCustomer) {
    const combined = toPoisha(transactionalCustomer.totalSpent!) + toPoisha(total);
    if (!Number.isSafeInteger(combined) || !isSafeTakaAmount(combined / 100)) {
      return { ok: false, errors: ["Your account totals need store review before checkout."] };
    }
  }
  if (input.expectedTotal !== undefined && toPoisha(input.expectedTotal) !== toPoisha(total)) {
    return { ok: false, errors: ["Prices or delivery charges changed. Refresh prices and review the new total before placing your order."] };
  }

  /* ---------------------------------------------------------------- *
   * 6. Persist — one write, then stock + ledger + customer
   * ---------------------------------------------------------------- */
  const prefix = settings.commerce.orderPrefix?.trim();
  if (!prefix || !/^[A-Za-z0-9_-]{1,30}$/.test(prefix)) return { ok: false, errors: ["The store order-number prefix needs review."] };
  if (transactional && mode === "gateway") return { ok: false, errors: ["Online payment is not integrated. Choose another payment method."] };
  const number = transactional
    ? await nextOrderNumber(db, prefix)
    : `${prefix}-${String(1001 + await db.count("orders"))}`;
  const now = new Date().toISOString();

  const addressLine2 = input.customer.addressLine2?.trim() || undefined;
  const city = input.customer.city?.trim() || undefined;
  const postalCode = input.customer.postalCode?.trim() || undefined;
  const billing = input.billingAddress?.line1?.trim()
    ? {
        line1: input.billingAddress.line1.trim(),
        line2: input.billingAddress.line2?.trim() || undefined,
        city: input.billingAddress.city?.trim() || undefined,
        postalCode: input.billingAddress.postalCode?.trim() || undefined,
        area: area.name,
        areaId: area.id,
      }
    : undefined;

  const paymentStatus: PaymentStatus =
    mode === "manual-transfer" ? "awaiting_verification" : "unpaid";
  const accessToken = randomBytes(32).toString("hex");

  const order = await db.insert<Order>("orders", {
    number,
    currency: "BDT",
    channel: input.channel ?? "grocery",
    ...(input.customerId ? { customerId: input.customerId } : {}),
    customer: {
      name: input.customer.name.trim(),
      email: input.customer.email.trim().toLowerCase(),
      phone: input.customer.phone.trim(),
      // The single line kept for older admin screens and exports.
      address: [input.customer.address.trim(), addressLine2, city, postalCode]
        .filter(Boolean)
        .join(", "),
      area: area.name,
      notes: input.customer.notes?.trim(),
      company: input.customer.company?.trim() || undefined,
      addressLine2,
      city,
      postalCode,
      areaId: area.id,
    },
    deliveryAddress: {
      line1: input.customer.address.trim(),
      line2: addressLine2,
      city,
      postalCode,
      area: area.name,
      areaId: area.id,
    },
    billingAddress: billing,
    items,
    subtotal,
    discount,
    checkoutDiscount: discount,
    couponCode,
    deliveryFee,
    tax,
    taxRate: Number(settings.commerce.taxRate ?? 0),
    total,
    status: "pending",
    paymentStatus,
    paymentMethod: method.label,
    paymentMethodId: method.id,
    payment: {
      type: method.type,
      mode,
      provider: method.provider,
      reference: mode === "manual-transfer" ? input.paymentReference?.trim() : undefined,
    },
    deliverySlot: input.deliverySlot || undefined,
    deliveryEta: area.eta,
    accessTokenHash: hashOrderAccessKey(accessToken),
    customerWasAuthenticated: Boolean(input.customerId),
    idempotencyKey: idempotencyKey || undefined,
    ...(idempotencyKey ? { idempotencyFingerprint: checkoutIntentFingerprint(input) } : {}),
    ...(transactional ? { inventoryReservationVersion: 1 as const } : {}),
    timeline: [
      { at: now, status: "pending", note: "Order placed", actor: "customer" },
      ...(mode === "manual-transfer"
        ? [
            {
              at: now,
              status: "pending",
              note: `Awaiting payment verification (transaction ${input.paymentReference?.trim()})`,
              actor: "customer",
            },
          ]
        : []),
    ],
    createdAt: now,
    updatedAt: now,
  });

  // Aggregate lines by product so different cuts of the same item do not each
  // overwrite stock from the same stale starting balance. The file/Mongo
  // abstraction is not yet a cross-process transaction (see deployment audit).
  const itemsByProduct = new Map<string, OrderItem[]>();
  for (const item of items) itemsByProduct.set(item.productId, [...(itemsByProduct.get(item.productId) ?? []), item]);
  for (const [productId, productItems] of itemsByProduct) {
    const product = index.get(productId)!;
    const quantity = productItems.reduce((sum, item) => sum + item.quantity, 0);
    const balance = Math.max(0, (product.stock ?? 0) - quantity);
    const options = changeVariantStock(product, productItems, -1);
    await db.update("products", product.id, {
      stock: balance,
      availability: balance <= 0 ? "out_of_stock" : balance <= 10 ? "low_stock" : "in_stock",
      soldCount: (product.soldCount ?? 0) + quantity,
      ...(options ? { options } : {}),
    });
    let runningBalance = product.stock ?? 0;
    for (const item of productItems) {
      runningBalance -= item.quantity;
      await addStockMovement({ productId: product.id, productName: product.name, delta: -item.quantity,
        balance: runningBalance, reason: "order-placed", reference: order.number, actor: "customer" }, db);
    }
  }

  if (couponCode) {
    const { recordCouponUse } = await import("@/lib/repositories/marketing");
    await recordCouponUse(couponCode, db);
  }

  /**
   * Who owns the order?
   *
   * A signed-in shopper owns it outright: the id comes from the session (via the
   * checkout action), so "My orders" can list it and nobody else's. A guest order
   * is attached to the customer record that matches the email, exactly as before.
   */
  let customerId: string;
  if (input.customerId) {
    const { recordOrderForCustomer } = await import("@/lib/repositories/customers");
    const updated = await recordOrderForCustomer(input.customerId, order, db);
    if (transactional && !updated) return { ok: false, errors: ["Your account is not available for checkout."] };
    customerId = updated?.id ?? input.customerId;
  } else {
    customerId = (await upsertCustomerFromOrder(order, db)).id;
  }
  const saved = (await db.update<Order>("orders", order.id, { customerId }))!;

  /* ---------------------------------------------------------------- *
   * 7. Online gateway — start the hosted checkout session
   * ---------------------------------------------------------------- */
  // The order already exists and is unpaid. The shopper is sent to the
  // provider's own page; only a signature-verified callback can mark it paid.
  if (mode === "gateway" && method.provider) {
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000").replace(
      /\/$/,
      "",
    );
    const session = await createPaymentSession({
      provider: method.provider,
      orderNumber: saved.number,
      amount: saved.total,
      currency: settings.commerce.currency,
      description: `${settings.siteName} order ${saved.number}`,
      callbackUrl: `${base}/api/payments/${method.provider}/callback`,
    });

    if (session.ok) {
      const withSession = (await db.update<Order>("orders", saved.id, {
        payment: { ...(saved.payment ?? { type: method.type, mode }), sessionReference: session.reference },
        updatedAt: new Date().toISOString(),
      }))!;
      return { ok: true, order: withSession, guestAccessKey: accessToken, redirectUrl: session.redirectUrl };
    }

    // The provider refused to open a session — tell the shopper instead of
    // pretending the order was paid.
    return { ok: false, errors: [session.error] };
  }

  return { ok: true, order: saved, guestAccessKey: accessToken };
}

export async function listOrders(filter: { status?: string; channel?: string; search?: string } = {}) {
  const db = await ensureDatabase();
  const rows = await db.list<Order>("orders");
  const search = filter.search?.trim().toLowerCase();
  return rows
    .filter((order) => (filter.status ? order.status === filter.status : true))
    .filter((order) => (filter.channel ? order.channel === filter.channel : true))
    .filter((order) =>
      search
        ? `${order.number} ${order.customer.name} ${order.customer.email} ${order.customer.phone}`
            .toLowerCase()
            .includes(search)
        : true,
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getOrder(id: string) {
  const db = await ensureDatabase();
  return db.get<Order>("orders", id);
}

/** Finds the order a provider callback refers to (session reference or typed ID). */
export async function findOrderByPaymentReference(reference: string) {
  if (!reference) return null;
  const db = await ensureDatabase();
  const orders = await db.list<Order>("orders");
  return (
    orders.find(
      (order) =>
        order.payment?.sessionReference === reference || order.payment?.reference === reference,
    ) ?? null
  );
}

export async function getOrderByNumber(number: string) {
  const db = await ensureDatabase();
  const rows = await db.list<Order>("orders", { where: { number } });
  return rows[0] ?? null;
}

export type CancellationReviewInput = {
  reviewedUpdatedAt: string;
  expectedCustomerUpdatedAt?: string;
  note: string;
  couponDecision?: "retain" | "release";
  customerDecision?: "leave" | "reconcile";
  reconciledOrderCount?: number;
  reconciledTotalSpent?: number;
};
export type CancellationResult = { ok: true; order: Order } | { ok: false; error: string };
class CancellationRejected extends Error {
  constructor(readonly reason: string) { super("Cancellation validation failed"); }
}

/** Performs a reviewed cancellation and all dependent record updates atomically. */
export async function cancelOrderTransaction(
  db: Database,
  id: string,
  staff: { id: string; name: string },
  review: CancellationReviewInput,
): Promise<CancellationResult> {
  if (db.driver !== "mongo" || !db.withTransaction || !db.orderTransactionIndexesReady) {
    return { ok: false, error: "A transaction-capable MongoDB database is required for cancellation review." };
  }
  if (!staff.id.trim() || !staff.name.trim()) {
    return { ok: false, error: "An authenticated staff identity is required for cancellation review." };
  }
  if (review.note.trim().length < 8 || review.note.trim().length > 500) {
    return { ok: false, error: "Enter a review note between 8 and 500 characters." };
  }
  try {
    return await db.withTransaction(async (tx) => {
      const order = await tx.get<Order>("orders", id);
      if (!order) throw new CancellationRejected("That order is not available for review.");
      if (await tx.get<OrderCancellationReview & Row>("order_review_records", `${id}:cancellation`)) {
        throw new CancellationRejected("A cancellation review record already exists for this order.");
      }
      if (order.updatedAt !== review.reviewedUpdatedAt) {
        throw new CancellationRejected("The order changed after you opened the review. Refresh and check it again.");
      }
      if (order.status === "cancelled") throw new CancellationRejected("This order is already cancelled.");
      if (!["pending", "confirmed", "processing"].includes(order.status)) {
        throw new CancellationRejected("This order is closed or already with the courier.");
      }
      if (order.currency !== "BDT" || !hasValidPaymentReviewAmount(order)) {
        throw new CancellationRejected("This order's financial snapshot needs review before cancellation.");
      }
      const unpaidOffline = order.payment?.mode === "offline" && order.paymentStatus === "unpaid";
      const refundRecorded = order.paymentStatus === "refunded" &&
        Boolean(order.payment?.refundReference?.trim() && order.payment.refundedAt);
      if (!unpaidOffline && !refundRecorded) {
        throw new CancellationRejected("Payment or refund must be independently reconciled before cancellation.");
      }
      if (hasUnresolvedWeights(order)) {
        throw new CancellationRejected("Complete the weight review before cancelling this order.");
      }
      if (order.inventoryReservationVersion !== 1 || !Array.isArray(order.items) || !order.items.length) {
        throw new CancellationRejected("This order's historical stock reservation needs manual review.");
      }
      if (order.couponCode && !["retain", "release"].includes(review.couponDecision ?? "")) {
        throw new CancellationRejected("Choose whether this order's coupon use is retained or released.");
      }
      if (order.customerId && !["leave", "reconcile"].includes(review.customerDecision ?? "")) {
        throw new CancellationRejected("Choose whether to retain or reconcile the customer's order totals.");
      }
      if (review.customerDecision === "reconcile" &&
          (!Number.isSafeInteger(review.reconciledOrderCount) || (review.reconciledOrderCount ?? -1) < 0 ||
           !isSafeTakaAmount(review.reconciledTotalSpent))) {
        throw new CancellationRejected("Enter the verified customer order count and BDT total spent.");
      }

      const customer = order.customerId ? await tx.get<Row & { orderCount?: number; totalSpent?: number }>("customers", order.customerId) : null;
      if (order.customerId && !customer) throw new CancellationRejected("The linked customer record needs review.");
      if (review.customerDecision === "reconcile" && customer) {
        if (!review.expectedCustomerUpdatedAt || customer.updatedAt !== review.expectedCustomerUpdatedAt) {
          throw new CancellationRejected("The customer record changed after review. Refresh the customer details and reconcile again.");
        }
        const updatedCustomer = await tx.update("customers", customer.id, {
          orderCount: review.reconciledOrderCount,
          totalSpent: review.reconciledTotalSpent,
          updatedAt: new Date().toISOString(),
        });
        if (!updatedCustomer) throw new CancellationRejected("The customer record changed. Refresh and try again.");
      }

      if (order.couponCode && review.couponDecision === "release") {
        const coupons = await tx.list<Row & { code?: string; usedCount?: number }>("coupons", {
          where: { code: order.couponCode.trim().toUpperCase() },
        });
        if (coupons.length !== 1 || !Number.isSafeInteger(coupons[0].usedCount) || (coupons[0].usedCount ?? 0) < 1) {
          throw new CancellationRejected("Coupon usage cannot be safely released; retain it or reconcile the coupon record.");
        }
        const updatedCoupon = await tx.update("coupons", coupons[0].id, { usedCount: coupons[0].usedCount! - 1 });
        if (!updatedCoupon) throw new CancellationRejected("The coupon changed. Refresh and try again.");
      }

      const byProduct = new Map<string, OrderItem[]>();
      for (const item of order.items) {
        if (!item.productId || !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
            (item.variantLabel && typeof item.variantStockTracked !== "boolean")) {
          throw new CancellationRejected("This order's stock reservation needs manual review.");
        }
        byProduct.set(item.productId, [...(byProduct.get(item.productId) ?? []), item]);
      }
      const restorations: { product: Product; items: OrderItem[]; quantity: number; balance: number; options: Product["options"] }[] = [];
      for (const [productId, items] of byProduct) {
        const product = await tx.get<Product>("products", productId);
        const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
        if (!product || !Number.isSafeInteger(quantity) || !Number.isSafeInteger(product.stock) ||
            (product.stock ?? -1) < 0 || !Number.isSafeInteger(product.soldCount) ||
            (product.soldCount ?? -1) < quantity || !Number.isSafeInteger((product.stock ?? 0) + quantity)) {
          throw new CancellationRejected("This product's inventory needs manual review before cancellation.");
        }
        const options = product.options?.map((group) => ({ ...group, values: group.values.map((value) => ({ ...value })) }));
        for (const item of items) {
          if (!item.variantStockTracked) continue;
          const matches = (options ?? []).flatMap((group) => group.values).filter((value) => value.label === item.variantLabel);
          if (matches.length !== 1 || !Number.isSafeInteger(matches[0].stock) || (matches[0].stock ?? -1) < 0 ||
              !Number.isSafeInteger((matches[0].stock ?? 0) + item.quantity)) {
            throw new CancellationRejected("A reserved variation changed and needs manual inventory review.");
          }
          matches[0].stock = matches[0].stock! + item.quantity;
        }
        restorations.push({ product, items, quantity, balance: product.stock! + quantity, options });
      }

      const now = new Date().toISOString();
      const actor = `admin:${staff.name}`;
      const updated = await tx.update<Order>("orders", id, {
        status: "cancelled",
        timeline: [...order.timeline, {
          at: now, status: "cancelled",
          note: "Cancelled after store review; inventory restored.",
          actor: "store",
        }],
        updatedAt: now,
      });
      if (!updated) throw new CancellationRejected("The order changed. Refresh and try again.");
      for (const { product, items, quantity, balance, options } of restorations) {
        const saved = await tx.update<Product>("products", product.id, {
          stock: balance, soldCount: product.soldCount! - quantity,
          availability: balance <= 10 ? "low_stock" : "in_stock", ...(options ? { options } : {}),
        });
        if (!saved) throw new CancellationRejected("This product's inventory needs manual review before cancellation.");
        let running = product.stock!;
        for (const item of items) {
          running += item.quantity;
          await addStockMovement({ productId: product.id, productName: product.name, delta: item.quantity,
            balance: running, reason: "order-cancelled", reference: order.number, actor }, tx);
        }
      }
      await tx.insert<OrderCancellationReview & Row>("order_review_records", {
        id: `${id}:cancellation`,
        orderId: id,
        at: now,
        staffId: staff.id,
        staffName: staff.name,
        note: review.note.trim(),
        ...(order.couponCode ? { couponDecision: review.couponDecision } : {}),
        ...(order.customerId ? {
          customerDecision: review.customerDecision,
          ...(review.customerDecision === "reconcile" ? {
            reconciledOrderCount: review.reconciledOrderCount,
            reconciledTotalSpent: review.reconciledTotalSpent,
          } : {}),
        } : {}),
      });
      return { ok: true, order: updated };
    });
  } catch (error) {
    if (error instanceof CancellationRejected) return { ok: false, error: error.reason };
    throw error;
  }
}

export async function getOrderCancellationReview(orderId: string) {
  const db = await ensureDatabase();
  return db.get<OrderCancellationReview & Row>("order_review_records", `${orderId}:cancellation`);
}

export async function updateOrderStatus(
  id: string,
  patch: { status?: OrderStatus; deliveryPartnerId?: string; note?: string },
  actor = "admin",
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  // The owner chose manual review for coupons and customer accounting. This
  // general status path cannot do that review or restore stock atomically, so
  // refuse cancellation in every environment, before any database writes.
  if (patch.status === "cancelled") {
    return { ok: false, error: "Use the permission-checked cancellation review workflow; no changes were made." };
  }
  const db = await ensureDatabase();
  const order = await getOrder(id);
  if (!order) return { ok: false, error: "Order not found." };
  if (["cancelled", "refunded", "delivered"].includes(order.status) && patch.status && patch.status !== order.status) {
    return { ok: false, error: "A closed order cannot be reopened here. Review it manually." };
  }
  if (patch.status === "refunded" && order.paymentStatus !== "refunded") {
    return { ok: false, error: "Record the actual refund in payment verification first." };
  }
  if ((patch.status === "out_for_delivery" || patch.status === "delivered") && hasUnresolvedWeights(order)) {
    return { ok: false, error: "Complete weighing and any customer weight decision before dispatch or delivery." };
  }
  const now = new Date().toISOString();
  const updated = await db.compareAndUpdate<Order>("orders", id, orderFinancialExpectation(order), {
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.deliveryPartnerId ? { deliveryPartnerId: patch.deliveryPartnerId } : {}),
    timeline: [...order.timeline, { at: now, status: patch.status ?? "updated", note: patch.note, actor }],
    updatedAt: now,
  });
  if (!updated) return { ok: false, error: "The order changed while it was being saved. Refresh and try again." };
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/admin/orders"); revalidatePath(`/admin/orders/${id}`); revalidatePath(`/order/${order.number}`);
  return { ok: true, order: updated };
}

/**
 * Records a payment decision for an order.
 *
 * Used by the admin payments screen (mark verified / failed / refunded) and by
 * the verified provider callback. Idempotent: repeating the same status is a
 * no-op, so a duplicated webhook can never double-apply anything.
 */
export async function markPayment(
  id: string,
  input: {
    status: PaymentStatus;
    actor: string;
    reference?: string;
    note?: string;
    provider?: string;
    reviewFingerprint: string;
  },
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const db = await ensureDatabase();
  const order = await getOrder(id);
  if (!order) return { ok: false, error: "Order not found." };
  if (!hasValidPaymentReviewAmount(order) || !matchesPaymentReview(order, input.reviewFingerprint)) {
    return { ok: false, error: "The displayed payment total is stale or invalid. Refresh and verify the current order." };
  }
  if (order.paymentStatus === input.status) return { ok: true, order };
  if (input.status === "paid" && (hasUnresolvedWeights(order) || ["cancelled", "refunded"].includes(order.status))) {
    return { ok: false, error: "Complete weighing and any customer decision before marking this order paid." };
  }
  if (["paid", "refunded"].includes(order.paymentStatus) && !(order.paymentStatus === "paid" && input.status === "refunded")) {
    return { ok: false, error: "A recorded payment cannot be reopened here. Reconcile it manually." };
  }
  if (input.status === "refunded" && (order.paymentStatus !== "paid" || (input.reference?.trim().length ?? 0) < 4 || (input.note?.trim().length ?? 0) < 8)) {
    return { ok: false, error: "Record a refund only for a paid order after the real refund, with its separate reference and a verification note." };
  }

  const now = new Date().toISOString();
  const payment: OrderPayment = {
    type: order.payment?.type ?? "cod",
    mode: order.payment?.mode ?? "offline",
    provider: input.provider ?? order.payment?.provider,
    reference: input.status === "refunded" ? order.payment?.reference : input.reference?.trim() || order.payment?.reference,
    sessionReference: order.payment?.sessionReference,
    paidAt: input.status === "paid" ? now : order.payment?.paidAt,
    verifiedBy: input.status === "paid" ? input.actor : order.payment?.verifiedBy,
    refundReference: input.status === "refunded" ? input.reference?.trim() : order.payment?.refundReference,
    refundedAt: input.status === "refunded" ? now : order.payment?.refundedAt,
    refundedBy: input.status === "refunded" ? input.actor : order.payment?.refundedBy,
  };

  const updated = await db.compareAndUpdate<Order>("orders", id, paymentReviewExpectation(order), {
    paymentStatus: input.status,
    payment,
    timeline: [
      ...order.timeline,
      {
        at: now,
        status: input.status,
        note: input.note ?? `Payment marked ${input.status.replace(/_/g, " ")}`,
        actor: input.actor,
      },
    ],
    updatedAt: now,
  });
  if (!updated) return { ok: false, error: "The order changed while payment was being recorded. Refresh and verify the current total." };

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true, order: updated };
}

/** Payment transactions for the admin payments screen. */
export async function listPaymentRecords(filter: { status?: string; search?: string } = {}) {
  const orders = await listOrders({ search: filter.search });
  return orders
    .filter((order) => (filter.status ? order.paymentStatus === filter.status : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getOrderStats() {
  const db = await ensureDatabase();
  const orders = await db.list<Order>("orders");
  const active = orders.filter((order) => order.status !== "cancelled" && order.status !== "refunded");
  const revenue = active.reduce((total, order) => total + order.total, 0);
  const today = new Date().toISOString().slice(0, 10);

  return {
    orders,
    total: orders.length,
    revenue,
    averageOrderValue: active.length ? revenue / active.length : 0,
    pending: orders.filter((order) => order.status === "pending").length,
    inProgress: orders.filter((order) => ["confirmed", "processing", "out_for_delivery"].includes(order.status)).length,
    completed: orders.filter((order) => order.status === "delivered").length,
    cancelled: orders.filter((order) => order.status === "cancelled").length,
    todayCount: orders.filter((order) => order.createdAt.slice(0, 10) === today).length,
    todayRevenue: orders
      .filter((order) => order.createdAt.slice(0, 10) === today && order.status !== "cancelled")
      .reduce((total, order) => total + order.total, 0),
    unpaid: orders.filter((order) => order.paymentStatus === "unpaid" && order.status !== "cancelled").length,
  };
}

/** Aggregates used by the dashboard and reports. */
export async function getSalesAnalytics() {
  const db = await ensureDatabase();
  const orders = await db.list<Order>("orders");
  const counted = orders.filter((order) => order.status !== "cancelled" && order.status !== "refunded");

  const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    byDay.set(date, { date, orders: 0, revenue: 0 });
  }
  counted.forEach((order) => {
    const date = order.createdAt.slice(0, 10);
    const entry = byDay.get(date);
    if (entry) {
      entry.orders += 1;
      entry.revenue += order.total;
    }
  });

  const productSales = new Map<string, { productId: string; name: string; quantity: number; revenue: number; image: string }>();
  counted.forEach((order) =>
    order.items.forEach((item) => {
      const entry =
        productSales.get(item.productId) ??
        { productId: item.productId, name: item.name, quantity: 0, revenue: 0, image: item.image };
      entry.quantity += item.quantity;
      entry.revenue += item.lineTotal;
      productSales.set(item.productId, entry);
    }),
  );

  const byChannel = new Map<string, number>();
  counted.forEach((order) => byChannel.set(order.channel, (byChannel.get(order.channel) ?? 0) + order.total));

  const products = await db.list<Product>("products");

  return {
    series: Array.from(byDay.values()),
    bestSellers: Array.from(productSales.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5),
    byChannel: Array.from(byChannel.entries()).map(([channel, revenue]) => ({ channel, revenue })),
    topRated: products
      .filter((product) => (product.stock ?? 0) > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5),
    lowStock: products
      .filter((product) => (product.stock ?? 0) <= 10)
      .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0))
      .slice(0, 6),
    orders,
  };
}

/* -------------------------------------------------------------------------- */
/* Weighed lines                                                               */
/* -------------------------------------------------------------------------- */

export type WeightReading = { index: number; grams: number };

/**
 * Compare each reading with the currently charged line, not the original
 * checkout line. A reduction applies immediately; any later increase is held
 * until the customer approves that exact tax-inclusive total.
 */
export async function recordWeightReadings(
  orderId: string,
  readings: WeightReading[],
  actor: string,
): Promise<{ ok: true; order: Order; applied: number; proposed: number } | { ok: false; errors: string[] }> {
  const db = await ensureDatabase();
  const order = await getOrder(orderId);
  if (!order) return { ok: false, errors: ["Order not found."] };
  const hold = weightAdjustmentHoldReason(order);
  if (hold) return { ok: false, errors: [hold] };
  if (!readings.length) return { ok: false, errors: ["Enter at least one weight."] };

  const errors: string[] = [];
  const seen = new Set<number>();
  const items: OrderItem[] = order.items.map((item) => item.weight ? { ...item, weight: { ...item.weight } } : { ...item });
  const touched: { item: OrderItem; grams: number; status: "approved" | "proposed"; difference: number }[] = [];

  for (const reading of readings) {
    if (!Number.isSafeInteger(reading.index) || seen.has(reading.index)) {
      errors.push("Each order line may be weighed only once per submission.");
      continue;
    }
    seen.add(reading.index);
    const item = items[reading.index];
    if (!item) { errors.push("One of the lines no longer exists on this order."); continue; }
    if (!item.weight) { errors.push(`${item.name} is not sold by weight.`); continue; }
    const grams = Number(reading.grams);
    if (!Number.isSafeInteger(grams) || grams < 1 || grams > 50_000) {
      errors.push(`Enter a whole-number weight for ${item.name} in grams (1–50,000).`);
      continue;
    }
    let actualLineTotal: number;
    try {
      actualLineTotal = priceForWeighedLine(item.price, item.preparationCharge ?? item.preparation?.chargePerUnit ?? 0, item.quantity, grams, item.weight.unitGrams);
    } catch {
      errors.push(`${item.name} has an invalid price or weight snapshot. Review it manually.`);
      continue;
    }
    const difference = (toPoisha(actualLineTotal) - toPoisha(item.lineTotal)) / 100;
    const status = difference > 0 ? "proposed" : "approved";
    item.weight = {
      ...item.weight, actualGrams: grams, actualLineTotal, difference, status,
      weighedAt: new Date().toISOString(), weighedBy: actor,
      settledAt: status === "approved" ? new Date().toISOString() : undefined,
    };
    if (status === "approved") item.lineTotal = actualLineTotal;
    touched.push({ item, grams, status, difference });
  }
  if (errors.length) return { ok: false, errors };

  const money = recountWeightOrder(order, items);
  // Defensive invariant: automatic weighing must never raise the amount due.
  if (!Number.isFinite(money.total) || toPoisha(money.total) > toPoisha(order.total)) {
    return { ok: false, errors: ["The revised order needs a manual financial review; no amount was changed."] };
  }
  const applied = touched.filter((entry) => entry.status === "approved").reduce((sum, entry) => sum + toPoisha(entry.difference), 0) / 100;
  const proposed = touched.filter((entry) => entry.status === "proposed").reduce((sum, entry) => sum + toPoisha(entry.difference), 0) / 100;
  const note = touched.map(({ item, grams, status, difference }) => {
    const label = `${item.name}: weighed ${grams} g (${formatWeightShort(grams)})`;
    if (status === "proposed") return `${label} — +${formatPrice(difference)} awaiting customer approval`;
    return `${label} — ${difference === 0 ? "no change" : `${difference > 0 ? "+" : ""}${formatPrice(difference)} applied`}`;
  }).join("; ");

  const updated = await db.compareAndUpdate<Order>("orders", orderId, orderFinancialExpectation(order), {
    items, ...money,
    timeline: [...order.timeline, { at: new Date().toISOString(), status: "weight-recorded", note, actor }],
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return { ok: false, errors: ["The order changed while weights were being saved. Refresh and try again."] };
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/admin/orders"); revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/my-account/orders"); revalidatePath(`/order/${order.number}`); revalidatePath(`/order/${order.number}/invoice`);
  return { ok: true, order: updated, applied, proposed };
}

/** Apply an exact customer-approved proposal or keep the current line amounts. */
export async function settleWeightProposals(
  orderId: string,
  decision: "approve" | "waive",
  actor: string,
  approval?: { fingerprint: string; total: number },
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const db = await ensureDatabase();
  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: "Order not found." };
  if (decision !== "approve" && decision !== "waive") return { ok: false, error: "Invalid weight decision." };
  const hold = weightAdjustmentHoldReason(order);
  if (hold) return { ok: false, error: hold };
  const proposed = order.items.filter((item) => item.weight?.status === "proposed");
  if (!proposed.length) return { ok: false, error: "There is no weight change waiting for a decision." };
  const snapshot = weightApprovalSnapshot(order);
  if ((decision === "approve" && !approval) || (approval &&
      (approval.fingerprint !== snapshot.fingerprint || !Number.isFinite(approval.total) || toPoisha(approval.total) !== toPoisha(snapshot.total)))) {
    return { ok: false, error: "The proposed weight or total changed. Refresh and review the current amount before deciding." };
  }
  const amount = proposed.reduce((sum, item) => sum + toPoisha(item.weight!.actualLineTotal!) - toPoisha(item.lineTotal), 0) / 100;
  const items: OrderItem[] = order.items.map((item) => {
    if (item.weight?.status !== "proposed") return item;
    const difference = (toPoisha(item.weight.actualLineTotal!) - toPoisha(item.lineTotal)) / 100;
    const next: OrderItemWeight = { ...item.weight, difference, status: decision === "approve" ? "approved" : "waived", settledAt: new Date().toISOString() };
    return { ...item, weight: next, lineTotal: decision === "approve" ? next.actualLineTotal! : item.lineTotal };
  });
  // Waiving never rewrites the historical money fields. Approval applies only
  // the exact total the customer saw, using the frozen discount and tax rate.
  const money = decision === "approve" ? recountWeightOrder(order, items) : undefined;
  if (money && (toPoisha(money.total) !== toPoisha(snapshot.total) || toPoisha(money.total) < toPoisha(order.total))) {
    return { ok: false, error: "The proposed total needs a manual review; no amount was changed." };
  }
  const updated = await db.compareAndUpdate<Order>("orders", orderId, orderFinancialExpectation(order), {
    items, ...(money ?? {}),
    timeline: [...order.timeline, {
      at: new Date().toISOString(), status: decision === "approve" ? "weight-approved" : "weight-kept",
      note: decision === "approve" ? `Customer approved the adjusted weight (+${formatPrice(amount)} before tax).`
        : `The +${formatPrice(amount)} weight difference was waived; the current amount was retained.`, actor,
    }],
    updatedAt: new Date().toISOString(),
  });
  if (!updated) return { ok: false, error: "The order changed while your decision was being saved. Refresh and review it again." };
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/admin/orders"); revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/order/${order.number}`); revalidatePath(`/order/${order.number}/invoice`); revalidatePath("/my-account/orders");
  return { ok: true, order: updated };
}

/** "1250" → "1.25 kg" — used in timeline notes, which are plain strings. */
function formatWeightShort(grams: number): string {
  return grams >= 1000 ? `${Math.round((grams / 1000) * 100) / 100} kg` : `${Math.round(grams)} g`;
}

/** Roll-up used by the admin dashboard / order screens. */
export function orderWeightSummary(order: Order) {
  return summariseWeights(order.items);
}

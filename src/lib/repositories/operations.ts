import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import { getSettings } from "@/lib/repositories/settings";
import { isProviderConfigured, missingProviderConfig } from "@/lib/payments/providers";

/**
 * Delivery areas, delivery partners and payment methods — everything the
 * checkout reads. All of it is admin-managed; nothing here invents a fee, a
 * slot or a payment option the store has not configured.
 */

export type DeliveryArea = Row & {
  name: string;
  fee: number;
  minOrder: number;
  eta: string;
  active: boolean;
  /** Bookable delivery windows (admin-defined). Empty = no slot picking. */
  slots?: string[];
  /** Optional note shown under the area, e.g. "No Sunday deliveries". */
  note?: string;
};

export type DeliveryPartner = Row & {
  name: string;
  phone: string;
  zone: string;
  active: boolean;
};

export type PaymentMode = "offline" | "manual-transfer" | "gateway";

export type PaymentMethod = Row & {
  label: string;
  description: string;
  type: "cod" | "card" | "wallet" | "gateway";
  instructions: string;
  active: boolean;
  order: number;
  /** How the money is actually collected. */
  mode?: PaymentMode;
  /** Gateway key — only meaningful when mode is "gateway". */
  provider?: string;
};

/** A payment method plus whether it can be used right now, and why not. */
export type CheckoutMethod = PaymentMethod & {
  /** Always resolved — legacy rows without a mode fall back to over-the-counter. */
  mode: PaymentMode;
  available: boolean;
  reason?: string;
  /** The customer must type the transfer reference before the order is placed. */
  requiresReference: boolean;
  /** Shown to the customer, and stored on the order for the admin to verify. */
  paymentStatusOnCreate: "unpaid" | "awaiting_verification";
};

export async function getDeliveryAreas(includeInactive = false): Promise<DeliveryArea[]> {
  const db = await ensureDatabase();
  const rows = await db.list<DeliveryArea>("delivery_areas");
  return rows
    .filter((row) => includeInactive || row.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDeliveryPartners(includeInactive = false): Promise<DeliveryPartner[]> {
  const db = await ensureDatabase();
  const rows = await db.list<DeliveryPartner>("delivery_partners");
  return rows
    .filter((row) => includeInactive || row.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPaymentMethods(includeInactive = false): Promise<PaymentMethod[]> {
  const db = await ensureDatabase();
  const rows = await db.list<PaymentMethod>("payment_methods");
  return rows
    .filter((row) => includeInactive || row.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/** Legacy rows created before payment modes existed default to over-the-counter. */
export function paymentMode(method: PaymentMethod): PaymentMode {
  if (method.mode) return method.mode;
  return method.type === "wallet" ? "manual-transfer" : "offline";
}

/** A seeded example merchant number must never be presented as a real payment destination. */
export function hasManualTransferDetails(method: PaymentMethod): boolean {
  const instructions = method.instructions?.trim() ?? "";
  return Boolean(instructions) && !/01711[-\s]?0{6}/.test(instructions);
}

/**
 * Every payment method with its live availability.
 *
 * A method is offered to shoppers only when it is enabled, the store allows it
 * (cash-on-delivery toggle), and — for online methods — the provider really is
 * connected. `createOrder` re-runs this check, so a tampered form cannot buy
 * with a disabled or unconfigured method.
 */
export async function getCheckoutMethods(): Promise<CheckoutMethod[]> {
  const [settings, methods] = await Promise.all([getSettings(), getPaymentMethods()]);
  const codEnabled = settings.commerce.codEnabled;

  return methods.map((method) => {
    const mode = paymentMode(method);
    const base = {
      ...method,
      mode,
      requiresReference: mode === "manual-transfer",
      paymentStatusOnCreate: (mode === "manual-transfer"
        ? "awaiting_verification"
        : "unpaid") as CheckoutMethod["paymentStatusOnCreate"],
    };

    if (!method.active) {
      return { ...base, available: false, reason: "Turned off by the store." };
    }
    if (method.type === "cod" && !codEnabled) {
      return { ...base, available: false, reason: "Cash on delivery is switched off in site settings." };
    }
    if (mode === "manual-transfer" && !hasManualTransferDetails(method)) {
      return {
        ...base,
        available: false,
        reason: "Add a real merchant number and instructions before enabling this method.",
      };
    }
    if (mode === "offline" && method.type === "card" && !method.instructions?.trim()) {
      return { ...base, available: false, reason: "Configure the card-on-delivery instructions before enabling this method." };
    }
    if (mode === "gateway") {
      if (!isProviderConfigured(method.provider)) {
        return {
          ...base,
          available: false,
          reason: `Payment provider not connected (missing ${missingProviderConfig(method.provider).join(", ")}).`,
        };
      }
    }
    return { ...base, available: true };
  });
}

/** Methods a shopper may actually choose right now. */
export async function getAvailableCheckoutMethods(): Promise<CheckoutMethod[]> {
  return (await getCheckoutMethods()).filter((method) => method.available);
}

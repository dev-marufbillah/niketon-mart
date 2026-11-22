import "server-only";


/**
 * Gateway descriptors only. No real hosted checkout/session creation or
 * provider-specific settlement verification is implemented yet. Credentials
 * alone must never cause any gateway to be offered or any order marked paid.
 * Implement the official provider protocol and tests before enabling one.
 */

export type GatewayKey = "sslcommerz" | "bkash" | "stripe" | "custom-hmac";

export type ProviderDefinition = {
  key: GatewayKey;
  label: string;
  /** Every one of these env vars must be set for payments to be accepted. */
  envKeys: string[];
  /** Shown in the admin panel to explain how to switch it on. */
  setupHint: string;
  /** URL parameters the provider appends to the callback. */
  callbackFields: string[];
};

export const paymentProviders: Record<GatewayKey, ProviderDefinition> = {
  sslcommerz: {
    key: "sslcommerz",
    label: "SSLCommerz",
    envKeys: ["SSLCOMMERZ_STORE_ID", "SSLCOMMERZ_STORE_PASSWORD", "PAYMENT_CALLBACK_SECRET"],
    setupHint:
      "Not implemented: integrate and test the official SSLCommerz checkout and verification protocol before use.",
    callbackFields: ["tran_id", "status", "amount", "signature"],
  },
  bkash: {
    key: "bkash",
    label: "bKash Checkout",
    envKeys: ["BKASH_APP_KEY", "BKASH_APP_SECRET", "PAYMENT_CALLBACK_SECRET"],
    setupHint:
      "Not implemented: integrate and test the official bKash checkout and verification protocol before use.",
    callbackFields: ["paymentID", "status", "amount", "signature"],
  },
  stripe: {
    key: "stripe",
    label: "Stripe",
    envKeys: ["STRIPE_SECRET_KEY", "PAYMENT_CALLBACK_SECRET"],
    setupHint:
      "Not implemented: integrate and test the official Stripe checkout and verification protocol before use.",
    callbackFields: ["session_id", "status", "amount", "signature"],
  },
  "custom-hmac": {
    key: "custom-hmac",
    label: "Custom provider (HMAC signed callbacks)",
    envKeys: ["PAYMENT_CALLBACK_SECRET"],
    setupHint:
      "Not implemented: build and test a provider-specific checkout and authenticated settlement protocol before use.",
    callbackFields: ["tran_id", "status", "amount", "signature"],
  },
};

/** Fail closed until a real provider-specific integration is implemented and tested. */
export function isProviderConfigured(_key: string | undefined): boolean {
  return false;
}

/** Admin-only setup status (names, never credential values). */
export function missingProviderConfig(key: string | undefined): string[] {
  const provider = key ? paymentProviders[key as GatewayKey] : undefined;
  if (!provider) return ["provider and verified integration"];
  return ["provider-specific integration and verification", ...provider.envKeys.filter((name) => !process.env[name]?.trim())];
}

export type PaymentSessionResult =
  | { ok: true; reference: string; redirectUrl: string }
  | { ok: false; error: string };

/** Never invent a gateway redirect: this is intentionally unavailable. */
export async function createPaymentSession(_input: {
  provider: string;
  orderNumber: string;
  amount: number;
  currency: string;
  description: string;
  callbackUrl: string;
}): Promise<PaymentSessionResult> {
  return { ok: false, error: "Online payment is not integrated. Choose another payment method." };
}

export type CallbackVerdict =
  | { ok: true; status: "paid" | "failed" | "pending"; reference: string; amount?: number }
  | { ok: false; error: string };

/** Provider-specific callback verification is not implemented; reject all callbacks. */
export function verifyCallback(_input: {
  provider: string;
  reference: string;
  status: string;
  amount?: number;
  signature: string;
}): CallbackVerdict {
  return { ok: false, error: "Online payment is not integrated." };
}

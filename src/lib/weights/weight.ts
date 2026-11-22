import type { ProductSelling } from "@/lib/types/domain";
import { toPoisha } from "@/lib/utils/currency";

/**
 * Sold-by-weight maths
 * --------------------
 * Fresh fish, poultry and some fruit are ordered by an *estimate*: the shopper
 * picks "1 kg" and the packer puts a whole fish on the scale. This module holds
 * the pure conversions shared by the product page, the cart, the checkout, the
 * order record and the admin weighing panel, so the same number is shown
 * everywhere.
 *
 * The rule that matters: the amount the shopper approved is never replaced
 * silently. A weight recorded by the shop either lowers the line (applied and
 * visible on the order) or raises it (held as a proposal until the customer
 * approves it on their order page).
 */

export type LineWeight = {
  variable: true;
  /** Grams in one selling unit ("1 kg" → 1000, "500 g" → 500). */
  unitGrams: number;
  /** quantity × unitGrams — what the shopper is expecting. */
  estimatedGrams: number;
  /** The product's human estimate ("800 g – 1.2 kg per fish"), when set. */
  estimateLabel?: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** "1 kg", "500 g", "1.5 kg", "1 L" → grams. Returns null for pieces/packets. */
export function gramsFromUnitLabel(label?: string | null): number | null {
  if (!label) return null;
  const text = label.trim().toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kgs?|kilograms?|gm?s?|grams?|litres?|liters?|l|ml)\b/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2];
  if (!unit) return null;
  if (unit.startsWith("kg") || unit.startsWith("kilogram")) return Math.round(amount * 1000);
  if (unit === "l" || unit.startsWith("litre") || unit.startsWith("liter")) return Math.round(amount * 1000);
  if (unit === "ml") return Math.round(amount);
  // g / gm / gms / gram / grams
  return Math.round(amount);
}

/** Weight of one selling unit in grams: the explicit value wins over the label. */
export function resolveUnitGrams(selling?: ProductSelling | null): number | null {
  const explicit = Number(selling?.unitGrams);
  if (Number.isFinite(explicit) && explicit >= 1 && explicit <= 50_000) return Math.round(explicit);
  return gramsFromUnitLabel(selling?.unit);
}

/**
 * The weight metadata stored on a quote line / order line, or null when the
 * product is not sold by an adjustable weight.
 */
export function buildLineWeight(selling: ProductSelling | undefined | null, quantity: number): LineWeight | null {
  if (!selling?.variableWeight) return null;
  const unitGrams = resolveUnitGrams(selling);
  if (!unitGrams) return null;
  const count = Math.max(1, Math.floor(Number(quantity) || 1));
  return {
    variable: true,
    unitGrams,
    estimatedGrams: unitGrams * count,
    ...(selling.estimatedWeight?.trim() ? { estimateLabel: selling.estimatedWeight.trim() } : {}),
  };
}

/** "1.25 kg" / "750 g" — how a weight is written on screen and on the slip. */
export function formatGrams(grams?: number | null): string {
  if (!Number.isFinite(Number(grams)) || Number(grams) <= 0) return "—";
  const value = Number(grams);
  if (value >= 1000) {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(round2(value / 1000))} kg`;
  }
  return `${Math.round(value)} g`;
}

/** Price for the variable-weight portion, excluding per-unit preparation. */
export function priceForGrams(pricePerUnit: number, actualGrams: number, unitGrams: number): number {
  if (!(unitGrams > 0) || !(actualGrams > 0)) return 0;
  return round2((Number(pricePerUnit) * Number(actualGrams)) / Number(unitGrams));
}

export type WeightItemLike = {
  weight?: {
    unitGrams: number;
    estimatedGrams: number;
    actualGrams?: number;
    actualLineTotal?: number;
    difference?: number;
    status: string;
  };
};

/** Reweigh only the product portion; preparation is a fixed fee per ordered unit. */
export function priceForWeighedLine(pricePerUnit: number, preparationPerUnit: number, quantity: number, actualGrams: number, unitGrams: number): number {
  if (![pricePerUnit, preparationPerUnit].every((n) => Number.isFinite(n) && n >= 0) ||
      ![quantity, actualGrams, unitGrams].every((n) => Number.isSafeInteger(n) && n > 0) ||
      preparationPerUnit > pricePerUnit) throw new RangeError("Invalid weight or price snapshot");
  const price = toPoisha(pricePerUnit);
  const prep = toPoisha(preparationPerUnit);
  if (![price, prep].every(Number.isSafeInteger)) throw new RangeError("Price is outside the supported range");
  const denominator = BigInt(unitGrams);
  const variable = BigInt(price - prep) * BigInt(actualGrams);
  const result = (variable + denominator / 2n) / denominator + BigInt(prep) * BigInt(quantity);
  if (result > BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 100))) throw new RangeError("Price is outside the supported range");
  return Number(result) / 100;
}

/** Order-level roll-up used by the admin list, the order page and the emails. */
export function summariseWeights(items: WeightItemLike[]) {
  const weighed = items.filter((item) => item.weight);
  const pending = weighed.filter((item) => !item.weight?.actualGrams || item.weight?.status === "estimated").length;
  const proposed = weighed.filter((item) => item.weight?.status === "proposed");
  const approved = weighed.filter((item) => item.weight?.status === "approved");
  const waived = weighed.filter((item) => item.weight?.status === "waived");
  const appliedDifference = round2(
    approved.reduce((total, item) => total + (item.weight?.difference ?? 0), 0),
  );
  const proposedDifference = round2(
    proposed.reduce((total, item) => total + (item.weight?.difference ?? 0), 0),
  );

  return {
    /** Number of lines sold by weight (0 → the order has no weighing step). */
    lines: weighed.length,
    /** Lines still waiting for the packer's scale. */
    pending,
    proposed,
    approved,
    waived,
    /** Money already added to / taken off the order. Negative = cheaper. */
    appliedDifference,
    /** Money waiting for the customer's approval. */
    proposedDifference,
    /** True when at least one line still has no recorded weight. */
    awaitingWeighing: pending > 0,
    /** True when the customer has a decision to make. */
    awaitingCustomer: proposed.length > 0,
  };
}

export function weightStatusLabel(status?: string): string {
  switch (status) {
    case "proposed":
      return "Waiting for customer approval";
    case "approved":
      return "Adjusted and confirmed";
    case "waived":
      return "Kept at the current amount";
    default:
      return "Waiting to be weighed";
  }
}

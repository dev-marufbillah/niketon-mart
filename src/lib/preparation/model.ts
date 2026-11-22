import type {
  CartPreparation,
  PreparationGroup,
  Product,
  ProductPreparation,
} from "@/lib/types/domain";
import { isSafeTakaAmount } from "@/lib/utils/currency";

/**
 * Preparation & cutting rules
 * ---------------------------
 * One implementation of "what did the shopper ask for, and what does it cost",
 * shared by the product page (live price), the cart, checkout and the order
 * writer. Nothing here reads the database, so the same code runs in the browser
 * and on the server; the server always re-runs it against the product row it
 * loaded itself and ignores whatever the browser claims.
 */

export const DEFAULT_MAX_INSTRUCTIONS = 160;
export const INSTRUCTION_HARD_LIMIT = 300;

/** Groups the admin actually filled in (no options = not offered). */
export function activePreparationGroups(
  preparation: ProductPreparation | undefined,
): PreparationGroup[] {
  if (!preparation?.enabled) return [];
  return (preparation.groups ?? []).filter((group) => group.options.length > 0);
}

export function preparationEnabled(product: Pick<Product, "preparation">): boolean {
  return activePreparationGroups(product.preparation).length > 0;
}

/**
 * The selection a product page starts with: the admin's default option in every
 * single-choice group that has one. Multiple-choice groups start empty.
 */
export function defaultPreparationSelections(
  preparation: ProductPreparation | undefined,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const group of activePreparationGroups(preparation)) {
    if (group.type === "multiple") {
      const defaults = group.options.filter((option) => option.isDefault).map((option) => option.label);
      result[group.id] = defaults;
      continue;
    }
    const chosen = group.options.find((option) => option.isDefault) ?? group.options[0];
    result[group.id] = chosen ? [chosen.label] : [];
  }
  return result;
}

/** Sum of the per-unit charges for the chosen options. */
export function preparationCharge(
  preparation: ProductPreparation | undefined,
  selections: Record<string, string[]>,
): number {
  let total = 0;
  for (const group of activePreparationGroups(preparation)) {
    for (const option of group.options) {
      if (selections[group.id]?.includes(option.label)) total += Number(option.charge) || 0;
    }
  }
  return Math.round(total * 100) / 100;
}

export type PreparationChoice = { group: string; label: string; charge: number };

/**
 * Flattens a UI selection into the ordered choice list stored on the cart line.
 * The signature is stable across reloads: groups are sorted by id and labels
 * within a group are sorted alphabetically.
 */
export function buildPreparation(
  preparation: ProductPreparation | undefined,
  selections: Record<string, string[]>,
  instructions?: string,
): { choices: PreparationChoice[]; signature: string; chargePerUnit: number } {
  const choices: PreparationChoice[] = [];
  for (const group of activePreparationGroups(preparation)) {
    const picked = (selections[group.id] ?? [])
      .map((label) => group.options.find((option) => option.label === label))
      .filter((option): option is NonNullable<typeof option> => Boolean(option))
      .sort((a, b) => a.label.localeCompare(b.label));
    for (const option of picked) {
      choices.push({ group: group.name, label: option.label, charge: Number(option.charge) || 0 });
    }
  }
  const signature = [
    ...choices.map((choice) => `${choice.group}=${choice.label}`),
    instructions?.trim() ? `notes=${instructions.trim().toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join("|");

  return {
    choices,
    signature: signature || "none",
    chargePerUnit: Math.round(choices.reduce((sum, choice) => sum + choice.charge, 0) * 100) / 100,
  };
}

/** Builds the payload stored on the cart line — used by the product page. */
export function toCartPreparation(
  preparation: ProductPreparation | undefined,
  selections: Record<string, string[]>,
  instructions?: string,
): CartPreparation | undefined {
  if (!activePreparationGroups(preparation).length) return undefined;
  const built = buildPreparation(preparation, selections, instructions);
  const notes = instructions?.trim().slice(0, maxInstructionLength(preparation));
  return {
    signature: built.signature,
    options: built.choices,
    instructions: notes || undefined,
    chargePerUnit: built.chargePerUnit,
  };
}

export function maxInstructionLength(preparation: ProductPreparation | undefined): number {
  const configured = Number(preparation?.maxInstructionLength ?? 0);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_INSTRUCTIONS;
  return Math.min(INSTRUCTION_HARD_LIMIT, Math.floor(configured));
}

export type PreparationValidation = {
  /** Missing required groups, unknown options, too-long instructions. */
  errors: string[];
  /** Server-recomputed charge per unit — never the one the browser sent. */
  chargePerUnit: number;
  choices: PreparationChoice[];
  instructions?: string;
};

/**
 * Validates a selection sent by the browser against the product configuration
 * that was just loaded from the database.
 *
 * `requested` maps a group name (as shown to the shopper) to the option labels
 * they picked. Group names are what the cart serialises, so renaming a group
 * after the order was placed cannot silently apply the wrong charge — the
 * checkout simply rejects the stale line and asks the shopper to re-add it.
 */
export function validatePreparation(
  preparation: ProductPreparation | undefined,
  requested:
    | { choices: { group: string; label: string }[]; instructions?: string }
    | undefined,
): PreparationValidation {
  const groups = activePreparationGroups(preparation);
  const errors: string[] = [];
  const choices: PreparationChoice[] = [];

  if (!groups.length) {
    if (requested?.choices.length || requested?.instructions?.trim()) {
      errors.push("Preparation is no longer offered for this product. Please update your basket.");
    }
    return { errors, chargePerUnit: 0, choices };
  }

  const byName = new Map(groups.map((group) => [group.name, group]));
  const picked = new Map<string, string[]>();
  for (const choice of requested?.choices ?? []) {
    if (!choice || typeof choice.group !== "string" || typeof choice.label !== "string") continue;
    if (!byName.has(choice.group)) {
      errors.push(`A preparation option (${choice.group}) is no longer offered. Choose it again.`);
      continue;
    }
    const list = picked.get(choice.group) ?? [];
    if (list.includes(choice.label)) {
      errors.push(`${choice.group}: the same option was selected more than once.`);
      continue;
    }
    list.push(choice.label);
    picked.set(choice.group, list);
  }

  for (const group of groups) {
    const labels = picked.get(group.name) ?? [];
    // Label lookups are case-sensitive on purpose: the admin controls the text.
    const matched = labels.filter((label) => group.options.some((option) => option.label === label));
    const unknown = labels.filter((label) => !group.options.some((option) => option.label === label));
    if (unknown.length) {
      errors.push(`“${unknown[0]}” is not available for ${group.name}. Choose again.`);
    }
    if (group.type === "single" && matched.length > 1) {
      errors.push(`${group.name}: choose one option.`);
    }
    if (group.required && matched.length === 0) {
      errors.push(`${group.name}: choose an option before adding this product.`);
    }
    for (const label of matched) {
      const option = group.options.find((entry) => entry.label === label)!;
      if (!isSafeTakaAmount(option.charge)) {
        errors.push(`${group.name}: that preparation charge needs store review.`);
        continue;
      }
      choices.push({ group: group.name, label, charge: option.charge });
    }
  }

  const limit = maxInstructionLength(preparation);
  const instructions = (requested?.instructions ?? "").trim();
  if (instructions && !preparation?.allowInstructions) {
    errors.push("Custom preparation instructions are not available for this product.");
  }
  if (instructions.length > limit) {
    errors.push(`Preparation instructions must be ${limit} characters or fewer.`);
  }

  return {
    errors,
    chargePerUnit: Math.round(choices.reduce((sum, choice) => sum + choice.charge, 0) * 100) / 100,
    choices,
    instructions: instructions || undefined,
  };
}

/** Human summary used in the cart, checkout, emails and admin order screens. */
export function preparationSummary(preparation: CartPreparation | undefined): string | undefined {
  if (!preparation) return undefined;
  const labels = preparation.options.map((option) => option.label);
  if (preparation.options.some((option) => option.charge > 0)) {
    const paid = preparation.options
      .filter((option) => option.charge > 0)
      .map((option) => `${option.label} +${option.charge}`);
    return [...labels, `(${paid.join(", ")})`].join(" · ");
  }
  return labels.join(" · ") || undefined;
}

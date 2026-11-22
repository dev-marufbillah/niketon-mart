import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import type { PreparationGroup, Product } from "@/lib/types/domain";
import { activePreparationGroups } from "@/lib/preparation/model";

/**
 * Preparation presets
 * -------------------
 * A preset is a reusable answer to "how is this kind of product cut?". Applying
 * one copies its groups onto a product; the product then owns its own copy, so
 * editing a preset later never silently changes what a shopper already bought.
 */

export type PreparationPreset = Row & {
  name: string;
  category: "fish" | "meat" | "poultry" | "vegetables" | "general";
  description: string;
  groups: PreparationGroup[];
  visible: boolean;
  order: number;
};

export const presetCategories = [
  { value: "fish", label: "Fish" },
  { value: "meat", label: "Meat" },
  { value: "poultry", label: "Poultry" },
  { value: "vegetables", label: "Vegetables" },
  { value: "general", label: "General" },
] as const;

export async function listPresets(includeHidden = false): Promise<PreparationPreset[]> {
  const db = await ensureDatabase();
  const rows = await db.list<PreparationPreset>("preparation_presets");
  return rows
    .filter((row) => includeHidden || row.visible)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getPreset(id: string): Promise<PreparationPreset | null> {
  const db = await ensureDatabase();
  return db.get<PreparationPreset>("preparation_presets", id);
}

export type PresetInput = {
  id?: string;
  name: string;
  category: PreparationPreset["category"];
  description: string;
  groups: PreparationGroup[];
  visible: boolean;
  order?: number;
};

function cleanGroups(groups: PreparationGroup[]): PreparationGroup[] {
  return groups
    .map((group, groupIndex) => ({
      id: group.id?.trim() || `group-${groupIndex + 1}`,
      name: group.name.trim(),
      type: group.type === "multiple" ? ("multiple" as const) : ("single" as const),
      required: Boolean(group.required),
      options: (group.options ?? [])
        .filter((option) => option.label.trim())
        .map((option, optionIndex) => ({
          id: option.id?.trim() || `${group.id || groupIndex}-${optionIndex + 1}`,
          label: option.label.trim(),
          charge: Math.max(0, Number(option.charge) || 0),
          ...(option.isDefault ? { isDefault: true } : {}),
          ...(option.note?.trim() ? { note: option.note.trim() } : {}),
        })),
    }))
    .filter((group) => group.name && group.options.length > 0);
}

export function validatePreset(input: PresetInput): string[] {
  const errors: string[] = [];
  if (input.name.trim().length < 3) errors.push("Give the preset a name of at least 3 characters.");
  if (!input.groups.some((group) => group.name.trim() && group.options.some((o) => o.label.trim()))) {
    errors.push("Add at least one group with one option.");
  }
  for (const group of input.groups) {
    const options = group.options.filter((option) => option.label.trim());
    if (!group.name.trim() && options.length) errors.push("Every group needs a name.");
    if (group.type === "single") {
      const defaults = options.filter((option) => option.isDefault).length;
      if (defaults > 1) errors.push(`${group.name || "A group"}: only one option can be the default.`);
    }
    for (const option of options) {
      if (Number(option.charge) < 0) errors.push(`${group.name} → ${option.label}: charge cannot be negative.`);
    }
  }
  return errors;
}

export async function savePreset(
  input: PresetInput,
): Promise<{ ok: true; data: PreparationPreset } | { ok: false; errors: string[] }> {
  const errors = validatePreset(input);
  if (errors.length) return { ok: false, errors };

  const db = await ensureDatabase();
  const groups = cleanGroups(input.groups);
  const existing = input.id ? await db.get<PreparationPreset>("preparation_presets", input.id) : null;

  if (existing) {
    const updated = await db.update<PreparationPreset>("preparation_presets", existing.id, {
      name: input.name.trim(),
      category: input.category,
      description: input.description.trim(),
      groups,
      visible: input.visible,
      order: input.order ?? existing.order ?? 0,
    });
    return { ok: true, data: updated ?? existing };
  }

  const count = await db.count("preparation_presets");
  const created = await db.insert<PreparationPreset>("preparation_presets", {
    name: input.name.trim(),
    category: input.category,
    description: input.description.trim(),
    groups,
    visible: input.visible,
    order: input.order ?? count + 1,
  });
  return { ok: true, data: created };
}

export async function deletePreset(
  id: string,
): Promise<{ ok: true; message: string } | { ok: false; errors: string[] }> {
  const db = await ensureDatabase();
  const preset = await db.get<PreparationPreset>("preparation_presets", id);
  if (!preset) return { ok: false, errors: ["That preset no longer exists."] };
  await db.remove("preparation_presets", id);
  // Products hold their own copy, so deleting a preset never changes what a
  // shopper can buy or what an existing order was charged.
  return { ok: true, message: `Deleted “${preset.name}”. Products keep their own copy.` };
}

/* ------------------------------------------------------------------ overview */

export type PreparationOverviewProduct = {
  id: string;
  name: string;
  slug: string;
  categoryLabel: string;
  categoryId: string;
  prepEnabled: boolean;
  groupCount: number;
  optionCount: number;
  allowsInstructions: boolean;
  maxCharge: number;
  stock: number;
};

export type PreparationOverview = {
  products: PreparationOverviewProduct[];
  stats: {
    total: number;
    prepared: number;
    groups: number;
    options: number;
    chargeable: number;
    presets: number;
  };
};

export async function getPreparationOverview(): Promise<PreparationOverview> {
  const db = await ensureDatabase();
  const [products, presets] = await Promise.all([
    db.list<Product>("products"),
    db.list<PreparationPreset>("preparation_presets"),
  ]);

  const rows: PreparationOverviewProduct[] = products
    .map((product) => {
      const groups = activePreparationGroups(product.preparation);
      const options = groups.flatMap((group) => group.options);
      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        categoryLabel: product.categoryLabel,
        categoryId: product.categoryId,
        prepEnabled: groups.length > 0,
        groupCount: groups.length,
        optionCount: options.length,
        allowsInstructions: Boolean(product.preparation?.allowInstructions),
        maxCharge: options.reduce((max, option) => Math.max(max, Number(option.charge) || 0), 0),
        stock: product.stock ?? 0,
      };
    })
    .sort((a, b) => Number(b.prepEnabled) - Number(a.prepEnabled) || a.name.localeCompare(b.name));

  return {
    products: rows,
    stats: {
      total: rows.length,
      prepared: rows.filter((row) => row.prepEnabled).length,
      groups: rows.reduce((sum, row) => sum + row.groupCount, 0),
      options: rows.reduce((sum, row) => sum + row.optionCount, 0),
      chargeable: rows.filter((row) => row.maxCharge > 0).length,
      presets: presets.length,
    },
  };
}

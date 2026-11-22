import { emptyValueFor, type FieldDef } from "@/lib/admin/fields";
import type { ResourceConfig } from "@/lib/admin/resources";
import { isSafeTakaAmount } from "@/lib/utils/currency";

/**
 * Form parsing & validation shared by every resource screen.
 * Values arrive as strings; they are coerced to the field's type here and
 * validated on the server — the browser is never trusted.
 */

export type ParsedForm = {
  values: Record<string, unknown>;
  errors: string[];
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseValue(field: FieldDef, raw: FormDataEntryValue | null): unknown {
  switch (field.type) {
    case "boolean":
      return raw === "on" || raw === "true";
    case "number": {
      const value = Number(String(raw ?? "").replace(/,/g, ""));
      return Number.isFinite(value) ? value : 0;
    }
    case "price": {
      const value = Number(String(raw ?? "").replace(/[^0-9.-]/g, ""));
      return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
    }
    case "tags": {
      const value = String(raw ?? "");
      if (!value.trim()) return [];
      if (value.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return [];
        }
      }
      return value
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    case "product-picker":
    case "category-picker":
    case "repeater":
    case "blocks": {
      const value = String(raw ?? "").trim();
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    case "readonly":
      return undefined;
    default:
      return String(raw ?? "").trim();
  }
}

/**
 * Parses a set of field definitions out of a form.
 * Shared by the generic resource form and the purpose-built page-section editor.
 */
export function parseFields(fields: FieldDef[], formData: FormData): ParsedForm {
  const values: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of fields) {
    if (field.type === "readonly") continue;
    const raw = formData.get(field.name);
    const value = parseValue(field, raw);
    const rawText = String(raw ?? "").trim();
    if (field.type === "number" && rawText && !Number.isFinite(Number(rawText.replace(/,/g, "")))) {
      errors.push(`${field.label} must be a valid number.`);
    }
    if (field.type === "price" && rawText) {
      const cleaned = rawText.replace(/[^0-9.-]/g, "");
      if (!/\d/.test(cleaned) || !isSafeTakaAmount(Number(cleaned))) {
        errors.push(`${field.label} must be a non-negative BDT amount with at most two decimals.`);
      }
    }

    if (field.required) {
      const missing =
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "") ||
        (Array.isArray(value) && value.length === 0);
      if (missing) errors.push(`${field.label} is required.`);
    }

    if (field.type === "number" && typeof value === "number") {
      if (field.min !== undefined && value < field.min) {
        errors.push(`${field.label} must be at least ${field.min}.`);
      }
      if (field.max !== undefined && value > field.max) {
        errors.push(`${field.label} must be ${field.max} or less.`);
      }
    }

    // A blank "defaults to today" date is filled in rather than rejected.
    if (field.type === "date" && field.defaultToday && !String(value ?? "").trim()) {
      values[field.name] = new Date().toISOString().slice(0, 10);
      continue;
    }

    values[field.name] = value;
  }

  // An untouched checkbox never posts; default unchecked fields explicitly.
  for (const field of fields) {
    if (field.type === "boolean" && values[field.name] === undefined) {
      values[field.name] = emptyValueFor(field);
    }
  }

  return { values, errors };
}

export function parseResourceForm(config: ResourceConfig, formData: FormData): ParsedForm {
  return parseFields(config.fields, formData);
}

export function validateResource(
  config: ResourceConfig,
  values: Record<string, unknown>,
  existingRows: Record<string, unknown>[],
  editingId?: string,
): string[] {
  const errors: string[] = [];

  // Slug-style fields: derive when empty, then check uniqueness.
  for (const field of config.fields) {
    if (field.name !== "slug" && field.name !== "code") continue;
    const raw = String(values[field.name] ?? "").trim();
    if (field.name === "slug" && !raw && typeof values.title === "string") {
      values.slug = slugify(values.title);
    }
    if (field.name === "slug" && !raw && typeof values.name === "string") {
      values.slug = slugify(values.name);
    }
    if (field.name === "code") values.code = (raw || slugify(String(values.code ?? ""))).toUpperCase();
  }

  if (config.uniqueField) {
    const incoming = String(values[config.uniqueField] ?? "").trim().toLowerCase();
    if (incoming) {
      const clash = existingRows.find(
        (row) =>
          row.id !== editingId &&
          String(row[config.uniqueField!] ?? "").trim().toLowerCase() === incoming,
      );
      if (clash) {
        errors.push(
          `“${values[config.uniqueField]}” is already used by another ${config.singular}. Choose a different one.`,
        );
      }
    }
  }

  if (typeof values.slug === "string" && values.slug && !/^[a-z0-9-]+$/.test(values.slug)) {
    errors.push("Slug may only contain lowercase letters, numbers and hyphens.");
  }

  if (typeof values.email === "string" && values.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email)) {
      errors.push("Enter a valid email address.");
    } else {
      values.email = values.email.toLowerCase();
    }
  }

  for (const key of ["image", "mobileImage", "heroImage", "avatar"]) {
    const value = values[key];
    if (typeof value === "string" && value && !/^(https?:\/\/|\/)/.test(value)) {
      errors.push("Images must be an upload or a URL starting with / or https://.");
    }
  }

  for (const key of ["href", "ctaHref", "primaryHref", "secondaryHref"]) {
    const value = values[key];
    if (typeof value === "string" && value && !/^(https?:\/\/|\/|mailto:|tel:)/.test(value)) {
      errors.push(`Links must start with /, https://, mailto: or tel: (${key}).`);
    }
  }

  if (config.validate) errors.push(...config.validate(values));
  return errors;
}

export function normalizeForSave(
  config: ResourceConfig,
  values: Record<string, unknown>,
  existing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...(existing ?? {}), ...values };
  if (config.orderField && (output[config.orderField] === undefined || output[config.orderField] === 0)) {
    output[config.orderField] =
      typeof existing?.[config.orderField] === "number" ? existing[config.orderField] : 1;
  }
  output.updatedAt = new Date().toISOString();
  if (!existing) {
    output.createdAt = new Date().toISOString();
    // Only a newly created coupon has a provably empty redemption history.
    // Never initialise or overwrite a missing legacy counter during edits.
    if (config.collection === "coupons") output.usedCount = 0;
  }
  return output;
}

/** Do not write an old redemption counter back when editing coupon rules. */
export function resourceUpdatePatch(
  config: ResourceConfig,
  values: Record<string, unknown>,
  normalized: Record<string, unknown>,
): Record<string, unknown> {
  if (config.collection === "coupons") return { ...values, updatedAt: normalized.updatedAt };
  return normalized;
}

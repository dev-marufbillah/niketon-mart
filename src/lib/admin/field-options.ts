import "server-only";

import type { FieldDef, FieldOption } from "@/lib/admin/fields";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";

/**
 * Dynamic select options
 * ----------------------
 * A field can point at another collection (`optionsFrom`) so the blog editor can
 * offer the live category list, the FAQ editor the live category list, and so on.
 * Resolution happens on the server before the form is rendered, which also means
 * the saved value is re-checked against the database in `assertOptionExists`.
 */

type OptionRow = Row & Record<string, unknown>;

export async function resolveFieldOptions(fields: FieldDef[]): Promise<FieldDef[]> {
  const needed = fields.filter((field) => field.optionsFrom);
  if (needed.length === 0) return fields;

  const db = await ensureDatabase();
  const cache = new Map<string, OptionRow[]>();
  for (const field of needed) {
    const collection = field.optionsFrom!.collection;
    if (!cache.has(collection)) {
      cache.set(collection, await db.list<OptionRow>(collection));
    }
  }

  return fields.map((field) => {
    if (!field.optionsFrom) return field;
    const rows = cache.get(field.optionsFrom.collection) ?? [];
    const valueField = field.optionsFrom.valueField ?? "id";
    const labelField = field.optionsFrom.labelField ?? "name";
    const groupField = field.optionsFrom.groupField;

    const options: FieldOption[] = rows
      .slice()
      .sort((a, b) => {
        const left = Number(a.order ?? 0);
        const right = Number(b.order ?? 0);
        if (left !== right) return left - right;
        return String(a[labelField] ?? "").localeCompare(String(b[labelField] ?? ""));
      })
      .map((row) => {
        const label = String(row[labelField] ?? row[valueField] ?? "");
        const group = groupField ? String(row[groupField] ?? "") : "";
        return {
          value: String(row[valueField] ?? ""),
          label: group ? `${group} · ${label}` : label,
        };
      })
      .filter((option) => option.value);

    return { ...field, options };
  });
}

/** Server-side check that a submitted option value still exists. */
export async function assertOptionExists(
  field: FieldDef,
  value: unknown,
): Promise<string | null> {
  if (!field.optionsFrom) return null;
  const submitted = String(value ?? "").trim();
  if (!submitted) return null;
  const db = await ensureDatabase();
  const rows = await db.list<OptionRow>(field.optionsFrom.collection);
  const valueField = field.optionsFrom.valueField ?? "id";
  const exists = rows.some((row) => String(row[valueField] ?? "") === submitted);
  return exists ? null : `${field.label}: that choice no longer exists. Pick another one.`;
}

/** Copy a select's label into its mirror field (e.g. categoryId → category). */
export async function applyOptionMirrors(
  fields: FieldDef[],
  values: Record<string, unknown>,
): Promise<void> {
  const mirrored = fields.filter((field) => field.optionsFrom?.mirrorTo);
  if (mirrored.length === 0) return;
  const db = await ensureDatabase();

  for (const field of mirrored) {
    const mirrorTo = field.optionsFrom!.mirrorTo!;
    const value = String(values[field.name] ?? "").trim();
    if (!value) {
      values[mirrorTo] = "";
      continue;
    }
    const rows = await db.list<OptionRow>(field.optionsFrom!.collection);
    const row = rows.find((entry) => String(entry[field.optionsFrom!.valueField ?? "id"] ?? "") === value);
    values[mirrorTo] = row ? String(row[field.optionsFrom!.labelField ?? "name"] ?? "") : String(values[mirrorTo] ?? "");
  }
}

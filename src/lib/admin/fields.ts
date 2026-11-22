/**
 * Field definitions
 * -----------------
 * A tiny schema language shared by the generic resource editor, the homepage
 * section editor and the settings screen. Every module describes *its own*
 * fields with this type — no feature is forced into a generic form.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "price"
  | "boolean"
  | "select"
  | "date"
  | "image"
  | "url"
  | "tags"
  | "product-picker"
  | "category-picker"
  | "repeater"
  | "blocks"
  | "readonly";

export type FieldOption = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  placeholder?: string;
  options?: FieldOption[];
  /**
   * Pull the options from another collection instead of hardcoding them.
   * Resolved on the server before the form renders (see field-options.ts).
   */
  optionsFrom?: {
    collection: string;
    /** Field used as the stored value (default `id`). */
    valueField?: string;
    /** Field used as the label (default `name`). */
    labelField?: string;
    /** Optional field that groups the options under a heading. */
    groupField?: string;
    /** Copy the label into this field when the record is saved. */
    mirrorTo?: string;
  };
  /** Block types allowed in a `blocks` field, in menu order. */
  blockTypes?: string[];
  /** `date` only: start at today instead of leaving the field empty. */
  defaultToday?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** 1–3 columns in the 3-column form grid (default 1). */
  span?: 1 | 2 | 3;
  /** Fields for `repeater`. */
  itemFields?: FieldDef[];
  /** Label for the repeater's add button. */
  addLabel?: string;
  defaultValue?: unknown;
  group?: string;
  /** Only show this field when another field has a given value. */
  showWhen?: { field: string; equals: string };
};

export type ColumnType = "text" | "image" | "price" | "boolean" | "date" | "badge" | "number";

export type ColumnDef = {
  name: string;
  label: string;
  type?: ColumnType;
  /** Hide from the small-screen card layout. */
  secondary?: boolean;
};

export function emptyValueFor(field: FieldDef): unknown {
  // A date that should start at "today" (new blog posts) rather than blank.
  if (field.type === "date" && field.defaultToday) {
    return field.defaultValue ?? new Date().toISOString().slice(0, 10);
  }
  switch (field.type) {
    case "boolean":
      return field.defaultValue ?? false;
    case "number":
    case "price":
      return field.defaultValue ?? 0;
    case "tags":
    case "product-picker":
    case "category-picker":
    case "repeater":
      return field.defaultValue ?? [];
    default:
      return field.defaultValue ?? "";
  }
}

export function defaultsFor(fields: FieldDef[], source: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = { ...source };
  for (const field of fields) {
    if (values[field.name] === undefined) values[field.name] = emptyValueFor(field);
  }
  return values;
}

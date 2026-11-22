"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  FieldInput,
  type PickerCategory,
  type PickerMedia,
  type PickerProduct,
} from "@/components/admin/field-input";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { defaultsFor, type FieldDef } from "@/lib/admin/fields";
import {
  createResourceAction,
  deleteResourceAction,
  updateResourceAction,
  type ResourceFormState,
} from "@/lib/admin/resource-actions";

function SaveBar({ label, errors }: { label: string; errors?: string[] }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#dce8df] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-20px_rgba(24,64,41,0.4)] backdrop-blur sm:-mx-6 sm:px-6">
      <p className="min-w-0 text-[11.5px] leading-relaxed text-[#5d7365]">
        {errors?.length ? <span aria-hidden="true" className="text-red-700">Could not save: {errors[0]}{errors.length > 1 ? " See the full list at the top." : ""}</span> : "Storefront visibility depends on this record’s settings."}
      </p>
      <button type="submit" disabled={pending} className="inline-flex h-10 shrink-0 items-center rounded-xl bg-brand-600 px-5 text-[13px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving…" : label}</button>
    </div>
  );
}

export function ResourceForm({
  resourceKey,
  id,
  fields,
  initial,
  products,
  media,
  categories = [],
  singular,
  backHref,
}: {
  resourceKey: string;
  id?: string;
  fields: FieldDef[];
  initial: Record<string, unknown>;
  products: PickerProduct[];
  media: PickerMedia[];
  categories?: PickerCategory[];
  singular: string;
  backHref: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => defaultsFor(fields, initial));
  const action = id
    ? updateResourceAction.bind(null, resourceKey, id)
    : createResourceAction.bind(null, resourceKey);
  const [state, formAction] = useActionState<ResourceFormState, FormData>(action, null);

  const set = (name: string, value: unknown) =>
    setValues((current) => ({ ...current, [name]: value }));

  const isVisible = (field: FieldDef) =>
    !field.showWhen || String(values[field.showWhen.field] ?? field.showWhen.equals) === field.showWhen.equals;
  const visibleFields = fields.filter(isVisible);
  const hiddenFields = fields.filter((field) => !isVisible(field));

  return (
    <form action={formAction} noValidate>
      {state?.errors?.length ? (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5">
          <p className="text-[12.5px] font-bold text-red-700">
            {state.errors.length === 1 ? "One thing needs fixing:" : `${state.errors.length} things need fixing:`}
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[12px] text-red-600">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {hiddenFields.map((field) => (
            <input
              key={field.name}
              type="hidden"
              name={field.name}
              value={Array.isArray(values[field.name]) ? JSON.stringify(values[field.name]) : String(values[field.name] ?? "")}
            />
          ))}
          {visibleFields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => set(field.name, value)}
              products={products}
              media={media}
              categories={categories}
            />
          ))}
        </div>
      </div>

      <SaveBar label={id ? `Save ${singular}` : `Create ${singular}`} errors={state?.errors} />

      <div className="mt-2 flex items-center justify-between gap-3 pb-2">
        <Link
          href={backHref}
          className="text-[12.5px] font-semibold text-ink-500 hover:text-ink-800"
        >
          ← Back to list
        </Link>
        {id ? (
          <ConfirmDialog
            action={deleteResourceAction.bind(null, resourceKey, id)}
            title={`Delete this ${singular}?`}
            description={`This permanently removes it from the website. This action cannot be undone.`}
            triggerLabel={`Delete ${singular}`}
          />
        ) : null}
      </div>
    </form>
  );
}

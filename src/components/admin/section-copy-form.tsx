"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { FieldInput, type PickerMedia, type PickerProduct } from "@/components/admin/field-input";
import { defaultsFor, type FieldDef } from "@/lib/admin/fields";
import { saveSectionCopyAction, type HomepageFormState } from "@/lib/admin/settings-actions";
import type { HomeSectionKey } from "@/lib/content/section-schema";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center rounded-full bg-brand-600 px-5 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save section"}
    </button>
  );
}

export function SectionCopyForm({
  sectionKey,
  fields,
  initial,
  products,
  media,
}: {
  sectionKey: HomeSectionKey;
  fields: FieldDef[];
  initial: Record<string, unknown>;
  products: PickerProduct[];
  media: PickerMedia[];
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => defaultsFor(fields, initial));
  const [state, action] = useActionState<HomepageFormState, FormData>(
    saveSectionCopyAction.bind(null, sectionKey),
    null,
  );

  const set = (name: string, value: unknown) => setValues((current) => ({ ...current, [name]: value }));

  return (
    <form action={action}>
      {state?.errors?.length ? (
        <ul role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700">
          {state.success}
        </p>
      ) : null}

      <div className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => set(field.name, value)}
              products={products}
              media={media}
            />
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 mt-4 flex items-center justify-between gap-3 border-t border-line bg-surface-2/95 py-3 backdrop-blur">
        <p className="text-[11.5px] text-ink-400">
          Hidden sections keep their content — switch them back on any time.
        </p>
        <SaveButton />
      </div>
    </form>
  );
}

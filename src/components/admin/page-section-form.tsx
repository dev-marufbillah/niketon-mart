"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { FieldInput, type PickerMedia } from "@/components/admin/field-input";
import type { FieldDef } from "@/lib/admin/fields";
import {
  savePageMetaAction,
  savePageSectionAction,
  togglePageSectionAction,
  movePageSectionAction,
  type PageFormState,
} from "@/lib/admin/page-actions";

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function Feedback({ state }: { state: PageFormState }) {
  if (state?.errors?.length) {
    return (
      <ul role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">
        {state.errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    );
  }
  if (state?.success) {
    return (
      <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-[12px] font-semibold text-brand-700">
        {state.success}
      </p>
    );
  }
  return null;
}

/** Page-level settings: title, sub-heading, SEO text and the publish switch. */
export function PageMetaForm({
  page,
  initial,
}: {
  page: string;
  initial: { title: string; subtitle: string; seoTitle: string; seoDescription: string; published: boolean };
}) {
  const [state, action] = useActionState<PageFormState, FormData>(savePageMetaAction.bind(null, page), null);
  const [published, setPublished] = useState(initial.published);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Page title</span>
          <input
            name="title"
            defaultValue={initial.title}
            required
            className="h-9 w-full rounded-xl border border-line bg-white px-3 text-[12.5px] outline-none focus:border-brand-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Sub-heading</span>
          <input
            name="subtitle"
            defaultValue={initial.subtitle}
            className="h-9 w-full rounded-xl border border-line bg-white px-3 text-[12.5px] outline-none focus:border-brand-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">SEO title</span>
          <input
            name="seoTitle"
            defaultValue={initial.seoTitle}
            className="h-9 w-full rounded-xl border border-line bg-white px-3 text-[12.5px] outline-none focus:border-brand-500"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">SEO description</span>
          <input
            name="seoDescription"
            defaultValue={initial.seoDescription}
            className="h-9 w-full rounded-xl border border-line bg-white px-3 text-[12.5px] outline-none focus:border-brand-500"
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5">
        <input
          type="checkbox"
          name="published"
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
          className="size-4 accent-brand-600"
        />
        <span className="text-[12.5px] font-semibold text-ink-800">
          Published — visible on the website
          <span className="mt-0.5 block text-[11px] font-normal text-ink-400">
            Unpublish to take the page offline without deleting its content.
          </span>
        </span>
      </label>

      <Feedback state={state} />
      <Save label="Save page settings" />
    </form>
  );
}

/** One content block: its own fields, its own save button. */
export function PageSectionForm({
  page,
  sectionKey,
  label,
  description,
  fields,
  data,
  visible,
  media,
  isFirst,
  isLast,
}: {
  page: string;
  sectionKey: string;
  label: string;
  description: string;
  fields: FieldDef[];
  data: Record<string, unknown>;
  visible: boolean;
  media: PickerMedia[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [state, action] = useActionState<PageFormState, FormData>(
    savePageSectionAction.bind(null, page, sectionKey),
    null,
  );
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...data }));
  const [shown] = useState(visible);

  return (
    <section className={`rounded-2xl bg-white ring-1 ring-line ${shown ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-[13px] font-extrabold text-ink-900">
            {label}
            {shown ? null : <span className="ml-2 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500">HIDDEN</span>}
          </h3>
          <p className="truncate text-[11px] text-ink-400">{description}</p>
        </div>
        <div className="flex items-center gap-1">
          <form action={movePageSectionAction.bind(null, page, sectionKey, -1)}>
            <button
              type="submit"
              disabled={isFirst}
              aria-label={`Move ${label} up`}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-800 disabled:opacity-30"
            >
              <ArrowUp size={14} />
            </button>
          </form>
          <form action={movePageSectionAction.bind(null, page, sectionKey, 1)}>
            <button
              type="submit"
              disabled={isLast}
              aria-label={`Move ${label} down`}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-800 disabled:opacity-30"
            >
              <ArrowDown size={14} />
            </button>
          </form>
          <form action={togglePageSectionAction.bind(null, page, sectionKey)}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-semibold text-ink-500 hover:bg-surface hover:text-ink-800"
            >
              {shown ? <EyeOff size={13} /> : <Eye size={13} />}
              {shown ? "Hide" : "Show"}
            </button>
          </form>
        </div>
      </div>

      <form action={action} className="space-y-3 p-4">
        <input type="hidden" name="__visible" value={shown ? "on" : ""} />
        <div className="grid gap-3 sm:grid-cols-3">
          {fields.map((field) => (
            <FieldInput
              key={field.name}
              field={field}
              value={values[field.name]}
              onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
              media={media}
            />
          ))}
        </div>
        <Feedback state={state} />
        <Save label={`Save ${label.toLowerCase()}`} />
      </form>
    </section>
  );
}

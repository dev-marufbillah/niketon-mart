"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import type { PreparationGroup } from "@/lib/types/domain";
import type { PreparationPreset } from "@/lib/preparation/repository";
import { deletePresetAction, savePresetAction } from "@/lib/admin/preparation-actions";
import { PreparationGroupsEditor } from "@/components/admin/preparation-editor";
import { cn } from "@/lib/utils/cn";

const input =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none";
const label = "mb-1.5 block text-[12px] font-semibold text-ink-700";

const categories = [
  { value: "fish", label: "Fish" },
  { value: "meat", label: "Meat" },
  { value: "poultry", label: "Poultry" },
  { value: "vegetables", label: "Vegetables" },
  { value: "general", label: "General" },
] as const;

const blank = () => ({
  id: undefined as string | undefined,
  name: "",
  category: "fish" as PreparationPreset["category"],
  description: "",
  groups: [] as PreparationGroup[],
  visible: true,
});

/**
 * Preset library: create, edit, hide and delete the reusable cutting/cleaning
 * configurations. Products copy a preset when it is applied; deleting a preset
 * therefore never changes a product or an old order.
 */
export function PreparationManager({ presets }: { presets: PreparationPreset[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState<ReturnType<typeof blank> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const start = (preset?: PreparationPreset) => {
    setError(null);
    setNotice(null);
    setDraft(
      preset
        ? {
            id: preset.id,
            name: preset.name,
            category: preset.category,
            description: preset.description,
            groups: preset.groups,
            visible: preset.visible,
          }
        : blank(),
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    const result = await savePresetAction({
      id: draft.id,
      name: draft.name,
      category: draft.category,
      description: draft.description,
      groups: draft.groups,
      visible: draft.visible,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.errors.join(" "));
      return;
    }
    setNotice(`${draft.id ? "Updated" : "Created"} “${result.data.name}”.`);
    setDraft(null);
    startTransition(() => router.refresh());
  };

  const toggleVisible = async (preset: PreparationPreset) => {
    setBusy(true);
    const result = await savePresetAction({
      id: preset.id,
      name: preset.name,
      category: preset.category,
      description: preset.description,
      groups: preset.groups,
      visible: !preset.visible,
    });
    setBusy(false);
    if (!result.ok) setError(result.errors.join(" "));
    else startTransition(() => router.refresh());
  };

  const remove = async (preset: PreparationPreset) => {
    setBusy(true);
    const result = await deletePresetAction(preset.id);
    setBusy(false);
    setConfirmDelete(null);
    if (!result.ok) {
      setError(result.errors.join(" "));
      return;
    }
    setNotice(result.message);
    startTransition(() => router.refresh());
  };

  return (
    <div className="space-y-3">
      {notice ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-[12px] font-semibold text-brand-800">
          <Check size={14} /> {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}

      {draft ? (
        <form onSubmit={submit} className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[14px] font-extrabold text-ink-900">
              {draft.id ? "Edit preset" : "New preset"}
            </h2>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex size-8 items-center justify-center rounded-lg bg-surface text-ink-500 hover:bg-ink-900/5"
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={label}>Preset name</span>
              <input
                required
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Large fish — curry or steak cut"
                className={input}
              />
            </label>
            <label>
              <span className={label}>Used for</span>
              <select
                value={draft.category}
                onChange={(event) =>
                  setDraft({ ...draft, category: event.target.value as PreparationPreset["category"] })
                }
                className={input}
              >
                {categories.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-3 block">
            <span className={label}>Description</span>
            <textarea
              rows={2}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="What this covers and for which products."
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] leading-relaxed text-ink-800 focus:border-brand-500 focus:outline-none"
            />
          </label>

          <div className="mt-4">
            <h3 className="mb-2 text-[13px] font-extrabold text-ink-900">Groups &amp; options</h3>
            <PreparationGroupsEditor
              groups={draft.groups}
              onChange={(groups) => setDraft({ ...draft, groups })}
            />
          </div>

          <label className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-700">
            <input
              type="checkbox"
              checked={draft.visible}
              onChange={(event) => setDraft({ ...draft, visible: event.target.checked })}
              className="size-4 rounded border-ink-300 accent-brand-600"
            />
            Available in the product form
          </label>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {draft.id ? "Save preset" : "Create preset"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="inline-flex h-10 items-center rounded-full bg-surface px-4 text-[13px] font-semibold text-ink-700 hover:bg-ink-900/5"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => start()}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[13px] font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={15} /> New preset
        </button>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {presets.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-[12.5px] text-ink-500 ring-1 ring-line">
            No presets yet. Create one, then apply it to a product from the product form.
          </p>
        ) : (
          presets.map((preset) => (
            <section
              key={preset.id}
              className={cn("rounded-2xl bg-white p-4 ring-1 ring-line", !preset.visible && "opacity-70")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-ink-900">{preset.name}</p>
                  <p className="mt-0.5 text-[11.5px] capitalize text-ink-400">
                    {preset.category} · {preset.groups.length} group{preset.groups.length === 1 ? "" : "s"} ·{" "}
                    {preset.groups.reduce((sum, group) => sum + group.options.length, 0)} options
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleVisible(preset)}
                    disabled={busy}
                    aria-label={preset.visible ? "Hide preset" : "Show preset"}
                    className="inline-flex size-8 items-center justify-center rounded-lg bg-surface text-ink-600 hover:bg-ink-900/5"
                  >
                    {preset.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => start(preset)}
                    aria-label={`Edit ${preset.name}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg bg-surface text-ink-600 hover:bg-ink-900/5"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(preset.id)}
                    aria-label={`Delete ${preset.name}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg bg-surface text-ink-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {preset.description ? (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-500">{preset.description}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {preset.groups.map((group) => (
                  <span
                    key={group.id}
                    className="rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-semibold text-ink-600"
                  >
                    {group.name}
                    {group.required ? " *" : ""}
                  </span>
                ))}
              </div>
              {confirmDelete === preset.id ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5">
                  <p className="text-[11.5px] text-red-700">
                    Delete this preset? Products keep their own copy of the options.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => remove(preset)}
                      className="inline-flex h-7 items-center rounded-full bg-red-600 px-3 text-[11.5px] font-bold text-white"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(null)}
                      className="inline-flex h-7 items-center rounded-full bg-white px-3 text-[11.5px] font-semibold text-ink-700 ring-1 ring-line"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          ))
        )}
      </div>
    </div>
  );
}

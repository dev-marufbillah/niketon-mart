"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { PreparationGroup, ProductPreparation } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";
import { activePreparationGroups } from "@/lib/preparation/model";

const input =
  "h-9 w-full rounded-lg border border-line bg-white px-2.5 text-[12.5px] text-ink-800 focus:border-brand-500 focus:outline-none";
const smallLabel = "mb-1 block text-[11px] font-semibold text-ink-600";

const newId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 7)}${Date.now().toString(36).slice(-3)}`;

/**
 * Group / option editor shared by the product form and the preset manager.
 *
 * A group is one question ("Cutting", "Bone", "Cleaning"); an option is one
 * answer with the extra charge it adds per unit. `single` groups render as radio
 * buttons on the product page, `multiple` as checkboxes.
 */
export function PreparationGroupsEditor({
  groups,
  onChange,
}: {
  groups: PreparationGroup[];
  onChange: (groups: PreparationGroup[]) => void;
}) {
  const update = (index: number, patch: Partial<PreparationGroup>) => {
    const next = groups.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= groups.length) return;
    const next = groups.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {groups.length === 0 ? (
        <p className="rounded-xl bg-surface px-3 py-4 text-center text-[12px] text-ink-500">
          No options yet. Add a group such as “Cutting”, then add the answers a shopper can pick.
        </p>
      ) : null}

      {groups.map((group, groupIndex) => (
        <div key={group.id} className="rounded-xl border border-line bg-white p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[150px] flex-1">
              <span className={smallLabel}>Group name</span>
              <input
                value={group.name}
                onChange={(event) => update(groupIndex, { name: event.target.value })}
                placeholder="Cutting"
                className={input}
              />
            </label>
            <label className="w-[128px]">
              <span className={smallLabel}>Choose</span>
              <select
                value={group.type}
                onChange={(event) =>
                  update(groupIndex, { type: event.target.value === "multiple" ? "multiple" : "single" })
                }
                className={input}
              >
                <option value="single">One option</option>
                <option value="multiple">Several</option>
              </select>
            </label>
            <label className="flex h-9 items-center gap-1.5 whitespace-nowrap text-[12px] text-ink-700">
              <input
                type="checkbox"
                checked={Boolean(group.required)}
                onChange={(event) => update(groupIndex, { required: event.target.checked })}
                className="size-3.5 rounded border-ink-300 accent-brand-600"
              />
              Required
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(groupIndex, -1)}
                disabled={groupIndex === 0}
                aria-label="Move group up"
                className="inline-flex size-8 items-center justify-center rounded-lg bg-surface text-ink-600 hover:bg-ink-900/5 disabled:opacity-40"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => move(groupIndex, 1)}
                disabled={groupIndex === groups.length - 1}
                aria-label="Move group down"
                className="inline-flex size-8 items-center justify-center rounded-lg bg-surface text-ink-600 hover:bg-ink-900/5 disabled:opacity-40"
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => onChange(groups.filter((_, index) => index !== groupIndex))}
                aria-label={`Remove ${group.name || "group"}`}
                className="inline-flex size-8 items-center justify-center rounded-lg bg-surface text-ink-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {group.options.map((option, optionIndex) => {
              const setOption = (patch: Partial<(typeof group.options)[number]>) => {
                const options = group.options.slice();
                options[optionIndex] = { ...options[optionIndex], ...patch };
                update(groupIndex, { options });
              };
              return (
                <div key={option.id} className="flex items-center gap-1.5">
                  <input
                    aria-label={`Option ${optionIndex + 1} label`}
                    value={option.label}
                    onChange={(event) => setOption({ label: event.target.value })}
                    placeholder="Curry cut"
                    className={cn(input, "flex-1")}
                  />
                  <div className="relative w-[96px]" title="Extra charge per unit">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-ink-400">
                      +&nbsp;
                    </span>
                    <input
                      aria-label={`Option ${optionIndex + 1} extra charge`}
                      type="number"
                      min={0}
                      step="0.25"
                      value={option.charge ?? 0}
                      onChange={(event) => setOption({ charge: Number(event.target.value) })}
                      className={cn(input, "pl-4 text-right")}
                    />
                  </div>
                  <label
                    className="flex h-9 items-center gap-1 whitespace-nowrap text-[11px] text-ink-600"
                    title="Pre-selected when the shopper opens the product"
                  >
                    <input
                      type={group.type === "multiple" ? "checkbox" : "radio"}
                      name={`default-${group.id}`}
                      checked={Boolean(option.isDefault)}
                      onChange={() => {
                        const options = group.options.map((entry, index) => ({
                          ...entry,
                          ...(index === optionIndex
                            ? { isDefault: true }
                            : group.type === "single"
                              ? { isDefault: false }
                              : {}),
                        }));
                        update(groupIndex, { options });
                      }}
                      className="size-3.5 accent-brand-600"
                    />
                    default
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      update(groupIndex, {
                        options: group.options.filter((_, index) => index !== optionIndex),
                      })
                    }
                    aria-label="Remove option"
                    className="inline-flex size-8 items-center justify-center rounded-lg bg-surface text-ink-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() =>
              update(groupIndex, {
                options: [
                  ...group.options,
                  { id: newId("opt"), label: "", charge: 0 },
                ],
              })
            }
            className="mt-2 inline-flex h-7 items-center gap-1 rounded-full bg-brand-50 px-2.5 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-100"
          >
            <Plus size={12} /> Add option
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() =>
          onChange([
            ...groups,
            { id: newId("grp"), name: "", type: "single", required: true, options: [{ id: newId("opt"), label: "", charge: 0 }] },
          ])
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 text-[12.5px] font-semibold text-white hover:bg-brand-700"
      >
        <Plus size={14} /> Add group
      </button>
    </div>
  );
}

/**
 * Full product-level configuration: on/off, starting from a preset, the groups
 * themselves and the free-text instruction box.
 */
export function ProductPreparationEditor({
  value,
  presets,
  onChange,
}: {
  value: ProductPreparation;
  presets: { id: string; name: string; category: string; groups: PreparationGroup[] }[];
  onChange: (value: ProductPreparation) => void;
}) {
  const [presetId, setPresetId] = useState(value.presetId ?? "");
  const groups = value.groups ?? [];
  const summary = useMemo(() => {
    const active = activePreparationGroups(value);
    const options = active.flatMap((group) => group.options);
    return {
      groups: active.length,
      options: options.length,
      max: options.reduce((max, option) => Math.max(max, Number(option.charge) || 0), 0),
    };
  }, [value]);

  const applyPreset = () => {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) return;
    onChange({
      ...value,
      enabled: true,
      presetId: preset.id,
      groups: preset.groups.map((group) => ({
        ...group,
        id: group.id || newId("grp"),
        options: group.options.map((option) => ({ ...option, id: option.id || newId("opt") })),
      })),
    });
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-ink-800">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
          className="size-4 rounded border-ink-300 accent-brand-600"
        />
        Offer cutting / cleaning / preparation for this product
      </label>
      <p className="text-[11.5px] leading-relaxed text-ink-400">
        Leave this off for packaged goods. When it is on, the product page asks the shopper how they want it
        prepared and the extra charge is added per unit.
      </p>

      {value.enabled ? (
        <>
          <div className="rounded-xl bg-surface p-3">
            <span className={smallLabel}>Start from a preset (optional)</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={presetId}
                onChange={(event) => setPresetId(event.target.value)}
                className={cn(input, "max-w-[260px] flex-1")}
              >
                <option value="">Choose a preset…</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyPreset}
                disabled={!presetId}
                className="inline-flex h-9 items-center rounded-full bg-brand-600 px-3.5 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                Apply preset
              </button>
              <p className="text-[11px] text-ink-500">
                Applying replaces the groups below with the preset’s copy — the product keeps its own version.
              </p>
            </div>
          </div>

          <PreparationGroupsEditor groups={groups} onChange={(next) => onChange({ ...value, groups: next })} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-[12.5px] text-ink-700">
              <input
                type="checkbox"
                checked={Boolean(value.allowInstructions)}
                onChange={(event) => onChange({ ...value, allowInstructions: event.target.checked })}
                className="size-3.5 rounded border-ink-300 accent-brand-600"
              />
              Let shoppers add cutting instructions
            </label>
            <label>
              <span className={smallLabel}>Instruction limit (characters)</span>
              <input
                type="number"
                min={40}
                max={300}
                value={value.maxInstructionLength ?? 160}
                onChange={(event) => onChange({ ...value, maxInstructionLength: Number(event.target.value) })}
                className={input}
              />
            </label>
          </div>

          <label>
            <span className={smallLabel}>Note shown above the options (optional)</span>
            <input
              value={value.note ?? ""}
              onChange={(event) => onChange({ ...value, note: event.target.value })}
              placeholder="Cleaned and cut after you order, packed on ice."
              className={input}
            />
          </label>

          <p className="text-[11.5px] text-ink-500">
            {summary.groups} group{summary.groups === 1 ? "" : "s"} · {summary.options} option
            {summary.options === 1 ? "" : "s"} · highest extra charge {summary.max}
          </p>
        </>
      ) : null}
    </div>
  );
}

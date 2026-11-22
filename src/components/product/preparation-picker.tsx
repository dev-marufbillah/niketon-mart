"use client";

import { Check, ChevronDown, Scissors } from "lucide-react";
import { useState } from "react";
import type { Product, ProductPreparation } from "@/lib/types/domain";
import { activePreparationGroups, maxInstructionLength, preparationCharge } from "@/lib/preparation/model";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * "How do you want it cut?" — the fresh-market step on the product page.
 *
 * Shows only the groups the admin configured for this product, adds the extra
 * charge to the price the shopper sees, and lets them type instructions when the
 * product allows it. Nothing here is trusted later: checkout re-validates every
 * choice against the product record and recomputes the charge.
 */
export function PreparationPicker({
  product,
  selections,
  onChange,
  instructions,
  onInstructionsChange,
  note,
}: {
  product: Product;
  selections: Record<string, string[]>;
  onChange: (selections: Record<string, string[]>) => void;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  /** Shop-wide note from settings; the product's own note wins. */
  note?: string;
}) {
  const [open, setOpen] = useState(true);
  const preparation: ProductPreparation | undefined = product.preparation;
  const groups = activePreparationGroups(preparation);
  const charge = preparationCharge(preparation, selections);
  const limit = maxInstructionLength(preparation);

  if (groups.length === 0) return null;

  const toggle = (groupId: string, label: string, type: "single" | "multiple") => {
    const current = selections[groupId] ?? [];
    if (type === "single") {
      onChange({ ...selections, [groupId]: [label] });
      return;
    }
    onChange({
      ...selections,
      [groupId]: current.includes(label) ? current.filter((entry) => entry !== label) : [...current, label],
    });
  };

  return (
    <section className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/40 p-4" aria-labelledby="prep-heading">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="prep-body"
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-600 text-white">
            <Scissors size={14} />
          </span>
          <span>
            <span id="prep-heading" className="block text-[14px] font-extrabold text-ink-900">
              Preparation &amp; cutting
            </span>
            <span className="block text-[11.5px] text-ink-500">
              {charge > 0 ? `+${formatPrice(charge)} per ${product.selling?.unit ?? product.unit}` : "Included"}
            </span>
          </span>
        </span>
        <ChevronDown size={16} className={cn("shrink-0 text-ink-400 transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div id="prep-body" className="mt-3 space-y-3.5">
          {groups.map((group) => (
            <div key={group.id} role="group" aria-label={group.name}>
              <p className="mb-1.5 text-[12px] font-semibold text-ink-700">
                {group.name}
                {group.required ? <span className="ml-1 text-[10.5px] font-normal text-brand-700">required</span> : null}
                {group.type === "multiple" ? (
                  <span className="ml-1 text-[10.5px] font-normal text-ink-400">(choose any)</span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((option) => {
                  const active = (selections[group.id] ?? []).includes(option.label);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role={group.type === "single" ? "radio" : "checkbox"}
                      aria-checked={active}
                      onClick={() => toggle(group.id, option.label, group.type)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                        active
                          ? "border-brand-600 bg-white text-brand-800 shadow-sm"
                          : "border-line bg-white/70 text-ink-600 hover:border-brand-300 hover:text-brand-700",
                      )}
                    >
                      {active ? <Check size={12} strokeWidth={3} className="text-brand-600" /> : null}
                      {option.label}
                      {option.charge > 0 ? (
                        <span className="text-[10.5px] font-bold text-brand-700">+{formatPrice(option.charge)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {group.options.some((option) => option.note) ? (
                <p className="mt-1 text-[10.5px] text-ink-400">
                  {group.options
                    .filter((option) => option.note && (selections[group.id] ?? []).includes(option.label))
                    .map((option) => `${option.label}: ${option.note}`)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ))}

          {preparation?.allowInstructions ? (
            <label className="block">
              <span className="mb-1 flex items-center justify-between text-[12px] font-semibold text-ink-700">
                Cutting instructions
                <span className="text-[10.5px] font-normal text-ink-400">
                  {instructions.length}/{limit}
                </span>
              </span>
              <textarea
                value={instructions}
                maxLength={limit}
                onChange={(event) => onInstructionsChange(event.target.value)}
                rows={2}
                placeholder="e.g. small pieces for a curry, keep the bones for stock"
                className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed text-ink-800 focus:border-brand-500 focus:outline-none"
              />
              <span className="mt-1 block text-[10.5px] text-ink-400">
                Our team reads this before cutting. Charges are set by the options above, not by the note.
              </span>
            </label>
          ) : null}

          {preparation?.note || note ? (
            <p className="rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
              {preparation?.note ?? note}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

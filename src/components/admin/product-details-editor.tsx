"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Plus, Star, Trash2 } from "lucide-react";
import type { ProductDetails, ProductOptionGroup } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";
import { ImageUploader } from "@/components/admin/image-uploader";
import { isAllowedImageReference } from "@/lib/catalogue/image-reference";

/**
 * Product form editors for the Product Details experience:
 *  - gallery (order + primary image)
 *  - variations (group → options with price / stock / default)
 *  - additional information (specs, nutrition, storage, usage, features)
 *
 * Everything here writes into the same `ProductInput` the existing form already
 * saves through `saveProductAction`, so the admin continues to have a single
 * product module.
 */

const fieldClass =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none";
const labelClass = "mb-1.5 block text-[12px] font-semibold text-ink-700";

export function GalleryEditor({
  images,
  onChange,
  library,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  library: string[];
}) {
  const move = (index: number, delta: number) => {
    const next = images.slice();
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = (path: string) => {
    if (!path || images.includes(path)) return;
    onChange([...images, path]);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] leading-relaxed text-ink-400">
        The first image is the main one on cards and at the top of the product page. Reorder with the arrows,
        remove, or pick another photo from the library.
      </p>

      {images.length === 0 ? (
        <p className="rounded-xl bg-surface-50 px-3 py-4 text-center text-[12px] text-ink-400">
          No images yet — add at least one.
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <li key={`${image}-${index}`} className="min-w-0">
              <div
                className={cn(
                  "relative aspect-square overflow-hidden rounded-xl bg-surface-2 ring-1",
                  index === 0 ? "ring-2 ring-brand-600" : "ring-line",
                )}
              >
                <Image src={isAllowedImageReference(image, true) ? image : "/images/category-placeholder.svg"} alt="" fill sizes="120px" className="object-contain p-1.5" />
                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded-full bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                    Main
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex items-center justify-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move image ${index + 1} earlier`}
                  className="rounded p-1 text-ink-400 hover:bg-surface hover:text-ink-700 disabled:opacity-30"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  aria-label={`Move image ${index + 1} later`}
                  className="rounded p-1 text-ink-400 hover:bg-surface hover:text-ink-700 disabled:opacity-30"
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(images.filter((_, position) => position !== index))}
                  aria-label={`Remove image ${index + 1}`}
                  className="rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-1.5">
        {library.map((path) => (
          <button
            key={path}
            type="button"
            onClick={() => add(path)}
            aria-label={`Add ${path.split("/").pop()} to gallery`}
            className={cn(
              "relative size-10 overflow-hidden rounded-lg bg-white ring-1 transition-all",
              images.includes(path) ? "opacity-40 ring-line" : "ring-line hover:ring-brand-400",
            )}
          >
            <Image src={path} alt="" fill sizes="40px" className="object-cover" />
          </button>
        ))}
      </div>

      <ImageUploader
        folder="products"
        onUploaded={(urls) => {
          const next = [...images];
          for (const url of urls) if (!next.includes(url)) next.push(url);
          onChange(next);
        }}
      />

      <label className="block">
        <span className={labelClass}>Add image by path or URL</span>
        <input
          type="text"
          placeholder="/images/products/oranges.jpg"
          className={fieldClass}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            const value = event.currentTarget.value.trim();
            if (value) {
              add(value);
              event.currentTarget.value = "";
            }
          }}
        />
        <span className="mt-1 block text-[11px] text-ink-400">Press Enter to add. Use an uploaded image or an approved image path; temporary browser links cannot be saved.</span>
      </label>
    </div>
  );
}

export function OptionsEditor({
  options,
  onChange,
}: {
  options: ProductOptionGroup[];
  onChange: (options: ProductOptionGroup[]) => void;
}) {
  const update = (groupIndex: number, patch: Partial<ProductOptionGroup>) => {
    const next = options.slice();
    next[groupIndex] = { ...next[groupIndex], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-[11.5px] leading-relaxed text-ink-400">
        Variations add selectable options (Weight, Pack size) with their own price, stock and default. Leave
        all groups empty for a product sold in a single size.
      </p>
      {options.filter((group) => group.values.some((value) => value.label.trim())).length > 1 ? (
        <p role="status" className="rounded-xl bg-accent-50 px-3 py-2 text-[12px] text-ink-700">
          Products with multiple variation groups cannot be ordered until combination pricing and stock are reviewed.
          Use one group with multiple options for now.
        </p>
      ) : null}

      {options.map((group, groupIndex) => (
        <div key={groupIndex} className="rounded-xl bg-surface-2 p-3 ring-1 ring-line">
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className={labelClass}>Group name</span>
              <input
                value={group.name}
                onChange={(event) => update(groupIndex, { name: event.target.value })}
                className={fieldClass}
                placeholder="Weight"
                aria-label={`Variation group ${groupIndex + 1} name`}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(options.filter((_, position) => position !== groupIndex))}
              aria-label={`Remove variation group ${groupIndex + 1}`}
              className="mb-0.5 inline-flex size-10 items-center justify-center rounded-xl bg-white text-ink-500 ring-1 ring-line hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <div className="mt-2 space-y-2">
            <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-1.5 px-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">
              <span>Option</span>
              <span>Price</span>
              <span>Stock</span>
              <span className="w-16 text-center">Default</span>
            </div>
            {group.values.map((value, valueIndex) => (
              <div key={valueIndex} className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-center gap-1.5">
                <input
                  value={value.label}
                  onChange={(event) => {
                    const values = group.values.slice();
                    values[valueIndex] = { ...values[valueIndex], label: event.target.value };
                    update(groupIndex, { values });
                  }}
                  aria-label={`Group ${groupIndex + 1} option ${valueIndex + 1} label`}
                  placeholder="1 Kg"
                  className={cn(fieldClass, "h-9 text-[12.5px]")}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={value.price ?? ""}
                  onChange={(event) => {
                    const values = group.values.slice();
                    values[valueIndex] = {
                      ...values[valueIndex],
                      price: event.target.value === "" ? undefined : Number(event.target.value),
                    };
                    update(groupIndex, { values });
                  }}
                  aria-label={`Group ${groupIndex + 1} option ${valueIndex + 1} price`}
                  placeholder="auto"
                  className={cn(fieldClass, "h-9 text-[12.5px]")}
                />
                <input
                  type="number"
                  min={0}
                  value={value.stock ?? ""}
                  onChange={(event) => {
                    const values = group.values.slice();
                    values[valueIndex] = {
                      ...values[valueIndex],
                      stock: event.target.value === "" ? undefined : Number(event.target.value),
                    };
                    update(groupIndex, { values });
                  }}
                  aria-label={`Group ${groupIndex + 1} option ${valueIndex + 1} stock`}
                  placeholder="auto"
                  className={cn(fieldClass, "h-9 text-[12.5px]")}
                />
                <div className="flex w-16 items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const values = group.values.map((entry, position) => ({
                        ...entry,
                        isDefault: position === valueIndex,
                      }));
                      update(groupIndex, { values });
                    }}
                    aria-label={`Make option ${valueIndex + 1} the default`}
                    aria-pressed={Boolean(value.isDefault)}
                    className={cn(
                      "rounded p-1",
                      value.isDefault ? "text-accent-600" : "text-ink-300 hover:text-accent-500",
                    )}
                  >
                    <Star size={14} className={value.isDefault ? "fill-accent-500" : undefined} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update(groupIndex, {
                        values: group.values.filter((_, position) => position !== valueIndex),
                      })
                    }
                    aria-label={`Remove option ${valueIndex + 1}`}
                    className="rounded p-1 text-ink-300 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => update(groupIndex, { values: [...group.values, { label: "" }] })}
            className="mt-2 inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-[11.5px] font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50"
          >
            <Plus size={12} /> Add option
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...options, { name: options.length === 0 ? "Weight" : "", values: [{ label: "" }] }])}
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100"
      >
        <Plus size={14} /> Add variation group
      </button>
    </div>
  );
}

export function DetailsEditor({
  details,
  onChange,
}: {
  details: ProductDetails;
  onChange: (details: ProductDetails) => void;
}) {
  const set = <K extends keyof ProductDetails>(key: K, value: ProductDetails[K]) =>
    onChange({ ...details, [key]: value });

  const pairEditor = (
    key: "specifications" | "nutrition",
    title: string,
    hint: string,
    placeholders: [string, string],
  ) => {
    const pairs = details[key] ?? [];
    return (
      <div>
        <p className="text-[12px] font-semibold text-ink-700">{title}</p>
        <p className="mb-2 text-[11px] text-ink-400">{hint}</p>
        <div className="space-y-2">
          {pairs.map((pair, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={pair.label}
                onChange={(event) => {
                  const next = pairs.slice();
                  next[index] = { ...next[index], label: event.target.value };
                  set(key, next);
                }}
                aria-label={`${title} ${index + 1} label`}
                placeholder={placeholders[0]}
                className={cn(fieldClass, "h-9 text-[12.5px]")}
              />
              <input
                value={pair.value}
                onChange={(event) => {
                  const next = pairs.slice();
                  next[index] = { ...next[index], value: event.target.value };
                  set(key, next);
                }}
                aria-label={`${title} ${index + 1} value`}
                placeholder={placeholders[1]}
                className={cn(fieldClass, "h-9 text-[12.5px]")}
              />
              <button
                type="button"
                onClick={() => set(key, pairs.filter((_, position) => position !== index))}
                aria-label={`Remove ${title.toLowerCase()} row ${index + 1}`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-ink-500 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => set(key, [...pairs, { label: "", value: "" }])}
          className="mt-2 inline-flex h-8 items-center gap-1 rounded-full bg-brand-50 px-3 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-100"
        >
          <Plus size={12} /> Add row
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <p className="text-[11.5px] leading-relaxed text-ink-400">
        These fields power the Additional Information tab and the Description bullets. Only filled fields are
        shown on the website, so a product never displays irrelevant specifications.
      </p>

      {pairEditor(
        "specifications",
        "Specifications",
        "Shown as the Attribute / Details table (Product Type, Origin, Colour, Supplier, Barcode…).",
        ["Attribute", "Details"],
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Weight / size</span>
          <input
            value={details.weight ?? ""}
            onChange={(event) => set("weight", event.target.value)}
            className={fieldClass}
            placeholder="500 g"
          />
        </label>
        <label className="block">
          <span className={labelClass}>Dimensions</span>
          <input
            value={details.dimensions ?? ""}
            onChange={(event) => set("dimensions", event.target.value)}
            className={fieldClass}
            placeholder="18 × 12 × 6 cm"
          />
        </label>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-ink-700">Features</p>
        <p className="mb-2 text-[11px] text-ink-400">One per line — shown as bullets in the Description tab.</p>
        <textarea
          rows={4}
          value={(details.features ?? []).join("\n")}
          onChange={(event) =>
            set(
              "features",
              event.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed focus:border-brand-500 focus:outline-none"
          placeholder={"Hand-picked daily\nNo artificial ripening"}
        />
      </div>

      <div className="grid gap-3">
        <label className="block">
          <span className={labelClass}>Ingredients</span>
          <textarea
            rows={2}
            value={details.ingredients ?? ""}
            onChange={(event) => set("ingredients", event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed focus:border-brand-500 focus:outline-none"
            placeholder="100% fresh oranges. No additives."
          />
        </label>
        <label className="block">
          <span className={labelClass}>Storage instructions</span>
          <textarea
            rows={2}
            value={details.storage ?? ""}
            onChange={(event) => set("storage", event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed focus:border-brand-500 focus:outline-none"
            placeholder="Refrigerate at 2–4 °C and use within 5 days."
          />
        </label>
        <label className="block">
          <span className={labelClass}>Usage instructions</span>
          <textarea
            rows={2}
            value={details.usage ?? ""}
            onChange={(event) => set("usage", event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] leading-relaxed focus:border-brand-500 focus:outline-none"
            placeholder="Rinse before eating. Serve chilled."
          />
        </label>
      </div>

      {pairEditor(
        "nutrition",
        "Nutrition",
        "Optional — rendered as a second table under Additional Information.",
        ["Nutrient", "Amount"],
      )}
    </div>
  );
}

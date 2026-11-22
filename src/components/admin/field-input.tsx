"use client";

import { useMemo, useRef, useState } from "react";
import type { FieldDef } from "@/lib/admin/fields";
import { BlockEditor, type EditorBlock } from "@/components/admin/block-editor";
import { cn } from "@/lib/utils/cn";
import { CURRENCY_SYMBOL, formatPrice } from "@/lib/utils/currency";

export type PickerProduct = { id: string; name: string; image: string; price: number; unit: string; stock: number };
export type PickerMedia = { id: string; url: string; alt: string; folder: string };
export type PickerCategory = { id: string; name: string; productCount?: number };

type Props = {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  products?: PickerProduct[];
  media?: PickerMedia[];
  categories?: PickerCategory[];
};

const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-700";
const helpClass = "mt-1 text-[11.5px] leading-relaxed text-ink-400";
const inputClass =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";

function FieldShell({
  field,
  children,
  id,
}: {
  field: FieldDef;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div className={cn(field.span === 2 && "sm:col-span-2", field.span === 3 && "sm:col-span-3")}>
      <label htmlFor={id} className={labelClass}>
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      {children}
      {field.help ? <p className={helpClass}>{field.help}</p> : null}
    </div>
  );
}

export function FieldInput({ field, value, onChange, products = [], media = [], categories = [] }: Props) {
  const id = `field-${field.name}`;
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  switch (field.type) {
    case "blocks":
      return (
        <div className="sm:col-span-3">
          <span className={labelClass}>{field.label}</span>
          <input type="hidden" name={field.name} value={JSON.stringify(Array.isArray(value) ? value : [])} />
          <BlockEditor
            blocks={Array.isArray(value) ? (value as EditorBlock[]) : []}
            blockTypes={field.blockTypes ?? ["paragraph", "heading", "image", "list", "quote"]}
            media={media}
            onChange={(blocks) => onChange(blocks)}
          />
          {field.help ? <p className={helpClass}>{field.help}</p> : null}
        </div>
      );

    case "textarea":
      return (
        <FieldShell field={field} id={id}>
          <textarea
            id={id}
            name={field.name}
            rows={field.name === "body" ? 8 : 4}
            value={String(value ?? "")}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
            className={cn(inputClass, "resize-y leading-relaxed")}
          />
        </FieldShell>
      );

    case "number":
    case "price":
      return (
        <FieldShell field={field} id={id}>
          <div className="relative">
            {field.type === "price" ? (
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-400">{CURRENCY_SYMBOL}</span>
            ) : null}
            <input
              id={id}
              name={field.name}
              type="number"
              inputMode="decimal"
              min={field.min}
              max={field.max}
              step={field.type === "price" ? "0.01" : field.step ?? 1}
              value={String(value ?? "")}
              onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
              className={cn(inputClass, field.type === "price" && "pl-7")}
            />
          </div>
        </FieldShell>
      );

    case "boolean":
      return (
        <div className={cn(field.span === 2 && "sm:col-span-2", field.span === 3 && "sm:col-span-3")}>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-white px-3.5 py-3">
            <input
              type="checkbox"
              name={field.name}
              checked={Boolean(value)}
              onChange={(event) => onChange(event.target.checked)}
              className="mt-0.5 size-4 accent-brand-600"
            />
            <span>
              <span className="block text-[12.5px] font-semibold text-ink-800">{field.label}</span>
              {field.help ? <span className="mt-0.5 block text-[11.5px] text-ink-400">{field.help}</span> : null}
            </span>
          </label>
        </div>
      );

    case "select":
      return (
        <FieldShell field={field} id={id}>
          <select
            id={id}
            name={field.name}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
            className={cn(inputClass, "appearance-none bg-[length:16px] pr-9")}
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236f6f6f' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
            }}
          >
            <option value="">Choose…</option>
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FieldShell>
      );

    case "date":
      return (
        <FieldShell field={field} id={id}>
          <input
            id={id}
            name={field.name}
            type="date"
            value={String(value ?? "").slice(0, 10)}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          />
        </FieldShell>
      );

    case "image":
      return (
        <FieldShell field={field} id={id}>
          <div className="rounded-xl border border-line bg-white p-2.5">
            <div className="flex items-start gap-3">
              <div className="relative size-[74px] shrink-0 overflow-hidden rounded-lg bg-surface">
                {String(value ?? "") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(value)} alt="" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-[10.5px] text-ink-300">
                    No image
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <input
                  id={id}
                  name={field.name}
                  value={String(value ?? "")}
                  onChange={(event) => onChange(event.target.value)}
                  placeholder="/images/product.jpg or https://…"
                  className={cn(inputClass, "py-2 text-[12.5px]")}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
                  >
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                  {media.length > 0 ? (
                    <select
                      aria-label={`Choose ${field.label} from library`}
                      value=""
                      onChange={(event) => {
                        if (event.target.value) onChange(event.target.value);
                      }}
                      className="max-w-[150px] rounded-lg border border-line bg-white px-2 py-1 text-[11.5px] text-ink-600"
                    >
                      <option value="">Library…</option>
                      {media.map((item) => (
                        <option key={item.id} value={item.url}>
                          {item.alt || item.url.split("/").pop()}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    setUploadError(null);
                    try {
                      const body = new FormData();
                      body.set("file", file);
                      body.set("folder", "general");
                      const response = await fetch("/api/admin/media/upload", { method: "POST", body });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
                      onChange(data.url);
                    } catch (error) {
                      setUploadError(error instanceof Error ? error.message : "Upload failed.");
                    } finally {
                      setUploading(false);
                      if (fileRef.current) fileRef.current.value = "";
                    }
                  }}
                />
              </div>
            </div>
            {uploadError ? <p role="alert" className="mt-2 text-[11.5px] text-red-600">{uploadError}</p> : null}
          </div>
        </FieldShell>
      );

    case "tags": {
      const tags = Array.isArray(value) ? (value as string[]) : [];
      return (
        <FieldShell field={field} id={id}>
          <input
            id={id}
            name={field.name}
            value={tags.join(", ")}
            onChange={(event) =>
              onChange(
                event.target.value
                  .split(",")
                  .map((entry) => entry.trimStart())
                  .filter((entry, index, all) => entry !== "" || index < all.length - 1),
              )
            }
            placeholder="grocery, basket"
            className={inputClass}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.filter(Boolean).map((tag) => (
              <span key={tag} className="rounded-full bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700">
                {tag}
              </span>
            ))}
          </div>
        </FieldShell>
      );
    }

    case "category-picker":
      return (
        <CategoryPicker
          field={field}
          categories={categories}
          selected={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      );

    case "product-picker":
      return (
        <ProductPicker
          field={field}
          products={products}
          selected={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
        />
      );

    case "repeater":
      return (
        <Repeater
          field={field}
          rows={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
          onChange={onChange}
          products={products}
          media={media}
        />
      );

    case "readonly":
      return (
        <FieldShell field={field} id={id}>
          <p className={cn(inputClass, "bg-surface text-ink-500")}>{String(value ?? "—")}</p>
        </FieldShell>
      );

    default:
      return (
        <FieldShell field={field} id={id}>
          <input
            id={id}
            name={field.name}
            value={String(value ?? "")}
            onChange={(event) => onChange(event.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        </FieldShell>
      );
  }
}

function CategoryPicker({
  field,
  categories,
  selected,
  onChange,
}: {
  field: FieldDef;
  categories: PickerCategory[];
  selected: string[];
  onChange: (value: unknown) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);

  return (
    <div className="sm:col-span-3">
      <span className={labelClass}>
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <input type="hidden" name={field.name} value={JSON.stringify(selected)} />
      {categories.length === 0 ? (
        <p className="rounded-xl bg-surface px-3 py-2 text-[12px] text-ink-500">
          No categories exist yet — create one under Catalogue → Categories &amp; brands.
        </p>
      ) : (
        <ul className="grid gap-1.5 rounded-xl border border-line bg-white p-2 sm:grid-cols-2">
          {categories.map((category) => {
            const checked = selected.includes(category.id);
            return (
              <li key={category.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px]",
                    checked ? "bg-brand-50 text-brand-800" : "hover:bg-surface text-ink-700",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(category.id)}
                    className="size-3.5 accent-brand-600"
                  />
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  {typeof category.productCount === "number" ? (
                    <span className="text-[11px] text-ink-400">
                      {category.productCount} {category.productCount === 1 ? "product" : "products"}
                    </span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {field.help ? <p className={helpClass}>{field.help}</p> : null}
    </div>
  );
}

function ProductPicker({
  field,
  products,
  selected,
  onChange,
}: {
  field: FieldDef;
  products: PickerProduct[];
  selected: string[];
  onChange: (value: unknown) => void;
}) {
  const [query, setQuery] = useState("");
  const index = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products
      .filter((product) => (term ? product.name.toLowerCase().includes(term) : true))
      .slice(0, 40);
  }, [products, query]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);

  return (
    <div className="sm:col-span-3">
      <span className={labelClass}>
        {field.label}
        {field.required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <input type="hidden" name={field.name} value={JSON.stringify(selected)} />
      {selected.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((id, position) => {
            const product = index.get(id);
            return (
              <li
                key={id}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-1 pr-2 text-[11.5px] font-semibold text-brand-800"
              >
                <span className="inline-flex size-5 overflow-hidden rounded-full bg-white">
                  {product?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.image} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                {product?.name ?? id}
                <button
                  type="button"
                  aria-label={`Remove ${product?.name ?? id}`}
                  onClick={() => toggle(id)}
                  className="text-brand-500 hover:text-brand-800"
                >
                  ×
                </button>
                <span className="sr-only">position {position + 1}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="rounded-xl border border-line bg-white">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search products…"
          aria-label={`Search ${field.label}`}
          className="w-full rounded-t-xl border-b border-line px-3.5 py-2 text-[12.5px] outline-none focus:border-brand-500"
        />
        <ul className="max-h-56 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <li className="px-2 py-3 text-center text-[12px] text-ink-400">No products match “{query}”.</li>
          ) : (
            results.map((product) => {
              const checked = selected.includes(product.id);
              return (
                <li key={product.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px]",
                      checked ? "bg-brand-50 text-brand-800" : "hover:bg-surface text-ink-700",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(product.id)}
                      className="size-3.5 accent-brand-600"
                    />
                    <span className="inline-flex size-7 shrink-0 overflow-hidden rounded-md bg-surface">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.image} alt="" className="size-full object-cover" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{product.name}</span>
                    <span className="text-[11px] text-ink-400">
                      {formatPrice(product.price)} · {product.stock} left
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
      </div>
      {field.help ? <p className={helpClass}>{field.help}</p> : null}
    </div>
  );
}

function Repeater({
  field,
  rows,
  onChange,
  products,
  media,
}: {
  field: FieldDef;
  rows: Record<string, unknown>[];
  onChange: (value: unknown) => void;
  products: PickerProduct[];
  media: PickerMedia[];
}) {
  const itemFields = field.itemFields ?? [];
  const update = (index: number, key: string, value: unknown) => {
    const next = rows.map((row, position) => (position === index ? { ...row, [key]: value } : row));
    onChange(next);
  };
  const add = () => {
    const blank: Record<string, unknown> = {};
    itemFields.forEach((item) => {
      blank[item.name] = item.type === "number" ? 1 : "";
    });
    onChange([...rows, blank]);
  };
  const remove = (index: number) => onChange(rows.filter((_, position) => position !== index));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = rows.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="sm:col-span-3">
      <span className={labelClass}>{field.label}</span>
      <input type="hidden" name={field.name} value={JSON.stringify(rows)} />
      <ul className="space-y-2">
        {rows.map((row, index) => {
          const title =
            String(row.name ?? row.title ?? row.label ?? "") ||
            `${field.label.replace(/s$/, "")} ${index + 1}`;
          return (
            <li key={index} className="rounded-xl border border-line bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold text-ink-700">{title}</p>
                <div className="flex items-center gap-1">
                  <button type="button" aria-label={`Move ${title} up`} onClick={() => move(index, -1)} className="rounded-md px-1.5 py-0.5 text-[12px] text-ink-400 hover:bg-surface hover:text-ink-700">
                    ↑
                  </button>
                  <button type="button" aria-label={`Move ${title} down`} onClick={() => move(index, 1)} className="rounded-md px-1.5 py-0.5 text-[12px] text-ink-400 hover:bg-surface hover:text-ink-700">
                    ↓
                  </button>
                  <button type="button" aria-label={`Remove ${title}`} onClick={() => remove(index)} className="rounded-md px-1.5 py-0.5 text-[12px] text-red-500 hover:bg-red-50">
                    Remove
                  </button>
                </div>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {itemFields.map((item) => {
                  if (item.type === "product-picker") {
                    return (
                      <label key={item.name} className="block">
                        <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">{item.label}</span>
                        <select
                          value={String(row[item.name] ?? "")}
                          onChange={(event) => update(index, item.name, event.target.value)}
                          className="w-full rounded-lg border border-line bg-white px-2.5 py-2 text-[12.5px]"
                        >
                          <option value="">Choose a product…</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }
                  if (item.type === "image") {
                    return (
                      <label key={item.name} className="block">
                        <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <input
                            value={String(row[item.name] ?? "")}
                            onChange={(event) => update(index, item.name, event.target.value)}
                            placeholder="/images/…"
                            className="w-full rounded-lg border border-line px-2.5 py-2 text-[12.5px]"
                          />
                          {media.length ? (
                            <select
                              aria-label={`Choose ${item.label} from library`}
                              value=""
                              onChange={(event) => event.target.value && update(index, item.name, event.target.value)}
                              className="rounded-lg border border-line px-1.5 py-2 text-[11.5px]"
                            >
                              <option value="">Library</option>
                              {media.map((entry) => (
                                <option key={entry.id} value={entry.url}>
                                  {entry.alt || entry.url.split("/").pop()}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </label>
                    );
                  }
                  return (
                    <label key={item.name} className="block">
                      <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">{item.label}</span>
                      <input
                        type={item.type === "number" ? "number" : "text"}
                        min={item.type === "number" ? 1 : undefined}
                        value={String(row[item.name] ?? "")}
                        onChange={(event) =>
                          update(
                            index,
                            item.name,
                            item.type === "number" ? Number(event.target.value) : event.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-line px-2.5 py-2 text-[12.5px]"
                      />
                    </label>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={add}
        className="mt-2 rounded-lg border border-dashed border-brand-300 px-3 py-1.5 text-[12px] font-semibold text-brand-700 hover:bg-brand-50"
      >
        + {field.addLabel ?? "Add item"}
      </button>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { saveTopPicksAction } from "@/lib/admin/top-picks-actions";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import { formatDate } from "@/lib/utils/format";
import type { TopPicksSectionInput } from "@/lib/content/home-sections/types";

export type AdminProductOption = {
  id: string;
  name: string;
  slug: string;
  category: string;
  unit: string;
  price: number;
  image: string;
  imageMode?: "contain" | "cover";
  availability: "in_stock" | "low_stock" | "out_of_stock";
};

type FormState = Omit<TopPicksSectionInput, "productIds">;
type Status = { tone: "idle" | "saving" | "saved" | "error"; message?: string };

const fieldClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[14px] text-ink-800 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15";

export function TopPicksEditor({
  initial,
  catalogue,
  limits,
}: {
  initial: TopPicksSectionInput & { updatedAt: string; updatedBy: string };
  catalogue: AdminProductOption[];
  limits: {
    eyebrow: number;
    title: number;
    subtitle: number;
    ctaLabel: number;
    ctaHref: number;
    maxProducts: number;
    minProducts: number;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>({
    eyebrow: initial.eyebrow,
    title: initial.title,
    subtitle: initial.subtitle,
    ctaLabel: initial.ctaLabel,
    ctaHref: initial.ctaHref,
  });
  const [productIds, setProductIds] = useState<string[]>(initial.productIds);
  const [status, setStatus] = useState<Status>({ tone: "idle" });
  const [query, setQuery] = useState("");
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  const byId = useMemo(() => new Map(catalogue.map((item) => [item.id, item])), [catalogue]);

  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        eyebrow: initial.eyebrow,
        title: initial.title,
        subtitle: initial.subtitle,
        ctaLabel: initial.ctaLabel,
        ctaHref: initial.ctaHref,
        productIds: initial.productIds,
      }),
    [initial],
  );

  const snapshot = useMemo(
    () => JSON.stringify({ ...form, productIds }),
    [form, productIds],
  );
  const isDirty = snapshot !== initialSnapshot;

  const filteredCatalogue = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return catalogue;
    return catalogue.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term),
    );
  }, [catalogue, query]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus((current) => (current.tone === "error" ? { tone: "idle" } : current));
  };

  const addProduct = (productId: string) => {
    if (productIds.includes(productId)) return;
    if (productIds.length >= limits.maxProducts) {
      setStatus({
        tone: "error",
        message: `A maximum of ${limits.maxProducts} products is allowed.`,
      });
      return;
    }
    if (replaceIndex !== null) {
      setProductIds((ids) => ids.map((id, index) => (index === replaceIndex ? productId : id)));
      setReplaceIndex(null);
      setStatus({ tone: "idle" });
      return;
    }
    setProductIds((ids) => [...ids, productId]);
    setStatus({ tone: "idle" });
  };

  const removeProduct = (index: number) => {
    setProductIds((ids) => ids.filter((_, current) => current !== index));
    setReplaceIndex((current) => (current === index ? null : current));
    setStatus({ tone: "idle" });
  };

  const move = useCallback((from: number, to: number) => {
    setProductIds((ids) => {
      if (to < 0 || to >= ids.length || from === to) return ids;
      const next = [...ids];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setStatus({ tone: "idle" });
  }, []);

  const onDrop = (targetIndex: number | null) => {
    const from = dragFrom.current;
    if (from !== null && targetIndex !== null) move(from, targetIndex);
    dragFrom.current = null;
    setDragIndex(null);
    setDropIndex(null);
  };

  const save = () => {
    setStatus({ tone: "saving", message: "Saving…" });
    startTransition(async () => {
      try {
        const result = await saveTopPicksAction({ ...form, productIds });
        if (result.ok) {
          setStatus({ tone: "saved", message: "Saved — the homepage is up to date." });
          router.refresh();
        } else {
          setStatus({ tone: "error", message: result.errors.join(" ") });
        }
      } catch {
        setStatus({ tone: "error", message: "Could not save. Check your connection and admin access, then try again." });
      }
    });
  };

  const reset = () => {
    setForm({
      eyebrow: initial.eyebrow,
      title: initial.title,
      subtitle: initial.subtitle,
      ctaLabel: initial.ctaLabel,
      ctaHref: initial.ctaHref,
    });
    setProductIds(initial.productIds);
    setReplaceIndex(null);
    setStatus({ tone: "idle" });
  };

  const busy = isPending || status.tone === "saving";
  const canSave = isDirty && !busy && productIds.length >= limits.minProducts;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      {/* ------------------------------- left column ------------------------------- */}
      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-extrabold text-ink-900">Section content</h2>
              <p className="mt-1 text-[12.5px] text-ink-500">
                The heading copy shown on the homepage.
              </p>
            </div>
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">
              Live
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold text-ink-700">
                  Eyebrow label
                  <span className="text-[11px] font-medium text-ink-400">
                    {form.eyebrow.length}/{limits.eyebrow}
                  </span>
                </span>
                <input
                  value={form.eyebrow}
                  maxLength={limits.eyebrow}
                  onChange={(event) => update("eyebrow", event.target.value)}
                  placeholder="Handpicked"
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold text-ink-700">
                  Section title
                  <span className="text-[11px] font-medium text-ink-400">
                    {form.title.length}/{limits.title}
                  </span>
                </span>
                <input
                  value={form.title}
                  maxLength={limits.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="Our Top Picks"
                  aria-required="true"
                  className={fieldClass}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-[12.5px] font-semibold text-ink-700">
                Subtitle
                <span className="text-[11px] font-medium text-ink-400">
                  {form.subtitle.length}/{limits.subtitle}
                </span>
              </span>
              <textarea
                value={form.subtitle}
                maxLength={limits.subtitle}
                rows={2}
                onChange={(event) => update("subtitle", event.target.value)}
                placeholder="Carefully selected essentials for your everyday needs."
                className="w-full resize-none rounded-xl border border-line bg-white px-3.5 py-3 text-[14px] leading-relaxed text-ink-800 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">
                  Button label
                </span>
                <input
                  value={form.ctaLabel}
                  maxLength={limits.ctaLabel}
                  onChange={(event) => update("ctaLabel", event.target.value)}
                  placeholder="View All Products"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">
                  Button link
                </span>
                <input
                  value={form.ctaHref}
                  maxLength={limits.ctaHref}
                  onChange={(event) => update("ctaHref", event.target.value)}
                  placeholder="/shop?collection=top-picks"
                  className={fieldClass}
                />
              </label>
            </div>
            <p className="text-[11.5px] text-ink-400">
              Leave the button label empty to hide the button.
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-extrabold text-ink-900">Products in this section</h2>
              <p className="mt-1 text-[12.5px] text-ink-500">
                Drag to reorder, or use the arrows. The order here is the order on the homepage.
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-bold",
                productIds.length === limits.maxProducts
                  ? "bg-accent-100 text-accent-700"
                  : "bg-surface text-ink-600",
              )}
            >
              {productIds.length}/{limits.maxProducts} slots
            </span>
          </div>

          <ul className="mt-4 space-y-2.5">
            {productIds.map((productId, index) => {
              const product = byId.get(productId);
              const isReplacing = replaceIndex === index;
              return (
                <li
                  key={`${productId}-${index}`}
                  draggable
                  onDragStart={(event) => {
                    dragFrom.current = index;
                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropIndex(index);
                  }}
                  onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
                  onDrop={(event) => {
                    event.preventDefault();
                    onDrop(index);
                  }}
                  onDragEnd={() => onDrop(null)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-white p-2.5 transition-all",
                    isReplacing
                      ? "border-brand-500 ring-2 ring-brand-500/15"
                      : "border-line",
                    dragIndex === index && "opacity-50",
                    dropIndex === index && dragIndex !== null && dragIndex !== index && "border-brand-400 bg-brand-50/40",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="hidden cursor-grab touch-none items-center text-ink-300 sm:flex"
                    title="Drag to reorder"
                  >
                    <GripVertical size={16} />
                  </span>

                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-ink-600">
                    {index + 1}
                  </span>

                  <span
                    className={cn(
                      "relative size-12 shrink-0 overflow-hidden rounded-lg",
                      product?.imageMode === "cover" ? "bg-brand-50" : "bg-surface",
                    )}
                  >
                    {product && (
                      <Image
                        src={product.image}
                        alt=""
                        fill
                        sizes="48px"
                        className={
                          product.imageMode === "cover"
                            ? "object-cover"
                            : "object-contain p-1"
                        }
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-bold text-ink-900">
                      {product?.name ?? productId}
                    </p>
                    <p className="truncate text-[11.5px] text-ink-400">
                      {product
                        ? `${product.category} · ${product.unit} · ${formatPrice(product.price)}`
                        : "Not in catalogue"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Move ${product?.name ?? productId} up`}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-surface hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-500"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, index + 1)}
                      disabled={index === productIds.length - 1}
                      aria-label={`Move ${product?.name ?? productId} down`}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-surface hover:text-brand-700 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-500"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceIndex(isReplacing ? null : index);
                        setQuery("");
                      }}
                      aria-pressed={isReplacing}
                      aria-label={`Change product in slot ${index + 1}`}
                      className={cn(
                        "hidden size-8 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-brand-50 hover:text-brand-700 xs:inline-flex",
                        isReplacing && "bg-brand-50 text-brand-700",
                      )}
                      title="Swap product"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      aria-label={`Remove ${product?.name ?? productId} from section`}
                      className="inline-flex size-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {productIds.length === 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center">
              <p className="text-[13px] font-semibold text-ink-700">No products selected</p>
              <p className="mt-1 text-[12.5px] text-ink-500">
                Add at least one product from the catalogue.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-[11.5px] text-ink-400">
            <Check size={13} className="text-brand-600" />
            Last updated {formatDate(initial.updatedAt)} by {initial.updatedBy}
          </div>
        </section>
      </div>

      {/* ------------------------------- right column ------------------------------ */}
      <div className="min-w-0 space-y-6 lg:sticky lg:top-24">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-extrabold text-ink-900">
                {replaceIndex !== null ? `Swap slot ${replaceIndex + 1}` : "Add products"}
              </h2>
              <p className="mt-1 text-[12.5px] text-ink-500">
                {replaceIndex !== null
                  ? "Pick a product to replace the selected slot."
                  : "Search the catalogue and add products to the section."}
              </p>
            </div>
            {replaceIndex !== null && (
              <button
                type="button"
                onClick={() => setReplaceIndex(null)}
                className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-600 hover:text-ink-800"
              >
                <X size={12} /> Cancel
              </button>
            )}
          </div>

          <div className="relative mt-4">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products…"
              aria-label="Search products"
              className={cn(fieldClass, "pl-9")}
            />
          </div>

          <ul className="no-scrollbar mt-3 max-h-[420px] space-y-1.5 overflow-y-auto pr-0.5">
            {filteredCatalogue.map((item) => {
              const added = productIds.includes(item.id);
              const atLimit = productIds.length >= limits.maxProducts && replaceIndex === null;
              return (
                <li key={item.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-2 transition-colors",
                      added ? "border-brand-100 bg-brand-50/50" : "border-line hover:bg-surface",
                    )}
                  >
                    <span
                      className={cn(
                        "relative size-10 shrink-0 overflow-hidden rounded-lg",
                        item.imageMode === "cover" ? "bg-brand-50" : "bg-surface",
                      )}
                    >
                      <Image
                        src={item.image}
                        alt=""
                        fill
                        sizes="40px"
                        className={item.imageMode === "cover" ? "object-cover" : "object-contain p-1"}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-ink-900">{item.name}</p>
                      <p className="truncate text-[11px] text-ink-400">
                        {item.category} · {formatPrice(item.price)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addProduct(item.id)}
                      disabled={added || atLimit}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[11.5px] font-bold transition-colors",
                        added
                          ? "bg-white text-brand-700 ring-1 ring-brand-200"
                          : "bg-brand-600 text-white hover:bg-brand-700",
                        atLimit && !added && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {added ? (
                        <>
                          <Check size={12} /> Added
                        </>
                      ) : replaceIndex !== null ? (
                        "Swap"
                      ) : (
                        <>
                          <Plus size={12} /> Add
                        </>
                      )}
                    </button>
                  </div>
                </li>
              );
            })}

            {filteredCatalogue.length === 0 && (
              <li className="px-3 py-6 text-center text-[12.5px] text-ink-500">
                No products match “{query}”.
              </li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold text-ink-700">
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <span
              className={cn(
                "size-2 rounded-full",
                isDirty ? "bg-accent-500" : "bg-brand-500",
              )}
              aria-hidden="true"
            />
          </div>

          <div id="top-picks-status" role="status" aria-live="polite" className="mt-3 min-h-[20px] text-[12.5px]">
            {status.tone === "error" && (
              <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-red-600">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                {status.message}
              </p>
            )}
            {status.tone === "saved" && (
              <p className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 font-semibold text-brand-700">
                <Check size={14} /> {status.message}
              </p>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 text-[13.5px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={!isDirty || busy}
              className="inline-flex h-11 items-center justify-center rounded-full bg-white px-4 text-[13px] font-semibold text-ink-700 ring-1 ring-line transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-45"
            >
              Reset
            </button>
          </div>

          {productIds.length < limits.minProducts && (
            <p className="mt-2 text-[11.5px] text-red-500">
              Add at least {limits.minProducts} product before saving.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

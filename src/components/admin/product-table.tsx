"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Search,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { Category, Product } from "@/lib/types/domain";
import type { MutationResult } from "@/lib/catalogue/types";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";
import {
  deleteProductAction,
  toggleFeaturedAction,
  toggleProductStatusAction,
  toggleProductVisibilityAction,
  updateProductStockAction,
} from "@/lib/admin/catalogue-actions";

type StatusFilter = "all" | "published" | "draft" | "hidden" | "low" | "out";

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All products" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Drafts" },
  { value: "hidden", label: "Hidden" },
  { value: "low", label: "Low or out of stock" },
  { value: "out", label: "Out of stock" },
];

function StatPill({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-xl border border-[#e3ece5] bg-white px-3 py-2 text-[11.5px] font-semibold text-[#5a7162]">
      <span className={cn("font-extrabold tabular-nums", tone === "warn" ? "text-amber-700" : "text-[#254734]")}>
        {value}
      </span>
      {label}
    </span>
  );
}

export function ProductTable({
  products,
  categories,
  initialStatus = "all",
}: {
  products: Product[];
  categories: Category[];
  initialStatus?: "all" | "low";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const stockOnFocus = useRef<Record<string, number>>({});

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (category !== "all" && product.categoryId !== category) return false;
      if (status === "published" && (product.status ?? "active") !== "active") return false;
      if (status === "draft" && (product.status ?? "active") === "active") return false;
      if (status === "hidden" && (product.visibility ?? "visible") !== "hidden") return false;
      if (status === "low" && (product.stock ?? 0) > 10) return false;
      if (status === "out" && (product.stock ?? 0) > 0) return false;
      if (!term) return true;
      return `${product.name} ${product.sku ?? ""} ${product.categoryLabel} ${product.slug}`
        .toLowerCase()
        .includes(term);
    });
  }, [products, search, category, status]);

  const apply = async (
    id: string,
    run: () => Promise<MutationResult<unknown>>,
    successMessage: string,
  ) => {
    setBusyId(id);
    try {
      const result = await run();
      if (result.ok) {
        setNotice({ tone: "ok", message: successMessage });
        startTransition(() => router.refresh());
        return true;
      }
      setNotice({ tone: "error", message: result.errors.join(" ") });
      // Reload the authoritative record after a rejection, especially if stock
      // changed since the field was focused.
      startTransition(() => router.refresh());
      return false;
    } catch {
      setNotice({ tone: "error", message: "The change could not be saved. Please try again." });
      startTransition(() => router.refresh());
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const stats = {
    total: products.length,
    published: products.filter((p) => (p.status ?? "active") === "active").length,
    out: products.filter((p) => (p.stock ?? 0) <= 0).length,
    hidden: products.filter((p) => (p.visibility ?? "visible") === "hidden").length,
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatPill label="products" value={stats.total} />
        <StatPill label="published" value={stats.published} />
        <StatPill label="hidden" value={stats.hidden} />
        <StatPill label="out of stock" value={stats.out} tone="warn" />
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-extrabold text-[#254734]">Browse products</h2>
        <p className="text-[11.5px] text-[#596f60]">Showing {filtered.length} of {products.length}</p>
      </div>
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, SKU or slug…"
            aria-label="Search products"
            className="h-10 w-full rounded-full border border-line bg-white pl-10 pr-4 text-[13px] text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none"
          />
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
          className="h-10 rounded-full border border-line bg-white px-3.5 text-[13px] text-ink-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="all">All categories</option>
          {categories.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="h-10 rounded-full border border-line bg-white px-3.5 text-[13px] text-ink-700 focus:border-brand-500 focus:outline-none"
        >
          {statusFilters.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {entry.label}
            </option>
          ))}
        </select>
        {search || category !== "all" || status !== "all" ? (
          <button type="button" onClick={() => { setSearch(""); setCategory("all"); setStatus("all"); }} className="h-10 shrink-0 rounded-xl px-3 text-[12px] font-bold text-brand-700 hover:bg-brand-50">Clear filters</button>
        ) : null}
      </div>

      <p className="mb-3 text-[11.5px] leading-relaxed text-[#5d7365]">Stock saves when you leave the field. Use the status, eye and star controls to update publishing, visibility and featured products.</p>
      <div role="status" aria-live="polite" className={notice ? "sticky top-[76px] z-10 min-h-5" : ""}>
        {notice && (
          <p
            className={cn(
              "mb-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-medium",
              notice.tone === "ok"
                ? "bg-brand-50 text-brand-800"
                : "bg-accent-50 text-accent-700",
            )}
          >
            {notice.tone === "ok" ? <Check size={14} /> : <TriangleAlert size={14} />}
            {notice.message}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        {/* desktop header */}
        <div className="hidden grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,0.7fr))_auto] gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-500 lg:grid">
          <span>Product</span>
          <span>Price</span>
          <span>Stock</span>
          <span>Status</span>
          <span>Visible</span>
          <span className="text-right">Actions</span>
        </div>

        <ul className="divide-y divide-line">
          {filtered.length === 0 && (
            <li className="px-4 py-12 text-center text-[13px] text-ink-500">
              No products match this view.
            </li>
          )}

          {filtered.map((product) => {
            const busy = busyId === product.id || pending;
            const draft = (product.status ?? "active") !== "active";
            const hidden = (product.visibility ?? "visible") === "hidden";
            const out = (product.stock ?? 0) <= 0;

            return (
              <li
                key={product.id}
                className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 py-4 transition-colors hover:bg-[#f9fbf9] lg:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,0.7fr))_auto] lg:items-center"
              >
                <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line">
                    <Image
                      src={product.image}
                      alt=""
                      fill
                      sizes="44px"
                      className={cn(
                        product.imageMode === "cover" ? "object-cover" : "object-contain p-1",
                      )}
                    />
                  </span>
                  <span className="min-w-0">
                    <Link
                      href={`/admin/catalogue/products/${product.id}`}
                      className="block truncate text-[13.5px] font-semibold text-ink-900 hover:text-brand-700"
                    >
                      {product.name}
                    </Link>
                    <span className="block truncate text-[11.5px] text-ink-400">
                      {product.categoryLabel} · {product.sku ?? product.slug}
                    </span>
                  </span>
                </div>

                <div className="flex items-center gap-2 lg:block">
                  <span className="text-[12px] font-medium text-ink-400 lg:hidden">Price</span>
                  <span className="text-[13px] font-semibold tabular-nums text-ink-800">
                    {formatPrice(product.price)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-ink-400 lg:hidden">Stock</span>
                  <label className="sr-only" htmlFor={`stock-${product.id}`}>
                    Stock for {product.name}
                  </label>
                  <input
                    key={`${product.id}:${product.stock ?? 0}`}
                    id={`stock-${product.id}`}
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={product.stock ?? 0}
                    onFocus={() => { stockOnFocus.current[product.id] = product.stock ?? 0; }}
                    onBlur={(event) => {
                      const raw = event.target.value.trim();
                      const next = Number(raw);
                      const expected = stockOnFocus.current[product.id] ?? product.stock ?? 0;
                      if (!raw || !Number.isSafeInteger(next) || next < 0) {
                        event.target.value = String(expected);
                        setNotice({ tone: "error", message: "Enter a non-negative whole-number stock level." });
                        return;
                      }
                      if (next !== expected) {
                        const input = event.currentTarget;
                        void apply(
                          product.id,
                          () => updateProductStockAction(product.id, next, expected),
                          `${product.name} stock updated.`,
                        ).then((saved) => {
                          if (!saved && input.isConnected) input.value = String(expected);
                        });
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    }}
                    className={cn(
                      "h-8 w-[74px] rounded-lg border px-2 text-[13px] tabular-nums focus:outline-none",
                      out
                        ? "border-accent-300 bg-accent-50 text-accent-700"
                        : "border-line bg-white text-ink-800",
                      "focus:border-brand-500",
                    )}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-ink-400 lg:hidden">Status</span>
                  <button
                    type="button"
                    disabled={busy}
                    title={draft ? "Publish product" : "Move product to draft"}
                    onClick={() =>
                      void apply(
                        product.id,
                        () => toggleProductStatusAction(product.id, draft),
                        draft ? `${product.name} published.` : `${product.name} moved to draft.`,
                      )
                    }
                    className={cn(
                      "inline-flex h-7 items-center rounded-full px-2.5 text-[11.5px] font-bold transition-colors",
                      draft
                        ? "bg-accent-100 text-accent-700 hover:bg-accent-200"
                        : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                    )}
                  >
                    {draft ? "Draft" : "Published"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-ink-400 lg:hidden">Visible</span>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={!hidden}
                    title={`${hidden ? "Show" : "Hide"} on the storefront`}
                    aria-label={`${hidden ? "Show" : "Hide"} ${product.name} on the storefront`}
                    onClick={() =>
                      void apply(
                        product.id,
                        () => toggleProductVisibilityAction(product.id, hidden),
                        hidden ? `${product.name} is visible.` : `${product.name} hidden.`,
                      )
                    }
                    className={cn(
                      "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-2.5 transition-colors lg:size-8 lg:rounded-full lg:px-0",
                      hidden
                        ? "bg-surface text-ink-500 hover:bg-ink-900/5"
                        : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                    )}
                  >
                    {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
                    <span aria-hidden="true" className="text-[11px] font-bold lg:hidden">{hidden ? "No" : "Yes"}</span>
                  </button>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-1.5 border-t border-line pt-2 lg:col-span-1 lg:border-0 lg:pt-0">
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={Boolean(product.flags?.featured)}
                    title={product.flags?.featured ? "Remove from featured" : "Feature product"}
                    aria-label={`${product.flags?.featured ? "Unfeature" : "Feature"} ${product.name}`}
                    onClick={() =>
                      void apply(
                        product.id,
                        () => toggleFeaturedAction(product.id, !product.flags?.featured),
                        product.flags?.featured
                          ? `${product.name} removed from Featured.`
                          : `${product.name} is now featured.`,
                      )
                    }
                    className={cn(
                      "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-2.5 transition-colors lg:size-8 lg:rounded-full lg:px-0",
                      product.flags?.featured
                        ? "bg-accent-100 text-accent-700 hover:bg-accent-200"
                        : "bg-surface text-ink-500 hover:bg-ink-900/5",
                    )}
                  >
                    <Star size={15} className={product.flags?.featured ? "fill-accent-500" : undefined} />
                    <span aria-hidden="true" className="text-[11px] font-bold lg:hidden">{product.flags?.featured ? "Featured" : "Feature"}</span>
                  </button>

                  <Link
                    href={`/admin/catalogue/products/${product.id}`}
                    title="Edit product"
                    aria-label={`Edit ${product.name}`}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-surface px-2.5 text-ink-600 transition-colors hover:bg-brand-50 hover:text-brand-700 lg:size-8 lg:rounded-full lg:px-0"
                  >
                    <Pencil size={14} /><span aria-hidden="true" className="text-[11px] font-bold lg:hidden">Edit</span>
                  </Link>

                  {confirmId === product.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmId(null);
                          void apply(
                            product.id,
                            () => deleteProductAction(product.id),
                            `${product.name} deleted.`,
                          );
                        }}
                        className="inline-flex h-8 items-center rounded-full bg-red-600 px-2.5 text-[11.5px] font-bold text-white hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="inline-flex h-8 items-center rounded-full bg-surface px-2.5 text-[11.5px] font-semibold text-ink-600"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmId(product.id)}
                      title="Delete product"
                      aria-label={`Delete ${product.name}`}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-surface px-2.5 text-ink-500 transition-colors hover:bg-red-50 hover:text-red-600 lg:size-8 lg:rounded-full lg:px-0"
                    >
                      <Trash2 size={14} /><span aria-hidden="true" className="text-[11px] font-bold lg:hidden">Delete</span>
                    </button>
                  )}

                  {busyId === product.id && (
                    <Loader2 size={14} className="animate-spin text-ink-400" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 text-[11.5px] text-ink-400">
        Showing {filtered.length} of {products.length} products · stock edits save when you
        leave the field.
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { needsPurchaseChoices } from "@/lib/catalogue/purchase";
import { Check, Copy, Heart, Link2, Loader2, ShoppingBag, Star, Trash2, X } from "lucide-react";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { useStore } from "@/lib/store/store-provider";
import { formatPrice } from "@/lib/utils/format";
import { catalogueDisplayPrice } from "@/lib/catalogue/display-price";
import { cn } from "@/lib/utils/cn";

/**
 * Wishlist page.
 * Follows the approved reference: a yellow table header (Product · Price · Date
 * Added · Stock Status · action), one row per saved product, then the share /
 * clear / add-all bar underneath. Rows are built from the live catalogue, so an
 * admin price or stock change is reflected immediately; anything deleted from the
 * catalogue is skipped instead of showing a broken card.
 */

type Row = {
  id: string;
  slug: string;
  name: string;
  image: string;
  unit: string;
  priceLabel: string;
  compareAtPrice?: number;
  rating: number;
  reviewCount: number;
  categoryLabel: string;
  stock: number;
  addedAt?: string;
};

function formatAdded(iso?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="text-[12px] font-semibold text-red-500">Out of stock</span>;
  if (stock <= 5)
    return <span className="text-[12px] font-semibold text-accent-600">Only {stock} left</span>;
  return <span className="text-[12px] font-semibold text-brand-600">In stock</span>;
}

export function WishlistView() {
  const router = useRouter();
  const { getProduct } = useCatalogue();
  const {
    wishlist,
    wishlistMeta,
    wishlistToken,
    wishlistSaving,
    wishlistReady,
    wishlistError,
    retryWishlist,
    toggleWishlist,
    clearWishlist,
    addToCart,
    isHydrated,
  } = useStore();
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [addNotice, setAddNotice] = useState("");

  const rows = useMemo<Row[]>(() => {
    return wishlist
      .map((id): Row | null => {
        const product = getProduct(id);
        if (!product) return null;
        const displayPrice = catalogueDisplayPrice(product);
        return {
          id: product.id,
          slug: product.slug,
          name: product.name,
          image: product.image,
          unit: product.unit,
          priceLabel: displayPrice.label,
          compareAtPrice: displayPrice.compareAtPrice,
          rating: product.rating ?? 0,
          reviewCount: product.reviewCount ?? 0,
          categoryLabel: product.categoryLabel,
          stock: product.stock ?? 0,
          addedAt: wishlistMeta[id],
        };
      })
      .filter((row): row is Row => row !== null);
  }, [wishlist, getProduct, wishlistMeta]);

  const shareUrl =
    typeof window !== "undefined" && wishlistToken
      ? `${window.location.origin}/wishlist?list=${wishlistToken}`
      : "";

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field below is still selectable */
    }
  };

  const addAll = () => {
    let skipped = 0;
    for (const row of rows) {
      const product = getProduct(row.id);
      if (product && row.stock > 0 && needsPurchaseChoices(product)) skipped += 1;
      else if (product && row.stock > 0) addToCart(row.id, 1);
    }
    setAddNotice(skipped ? `${skipped} product${skipped === 1 ? " needs" : "s need"} preparation or quantity choices. Open each product to add it.` : "Available products added to your cart.");
  };

  if (wishlistError && !wishlistReady) {
    return <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{wishlistError} <button type="button" onClick={retryWishlist} className="ml-2 font-bold underline">Try again</button></div>;
  }
  if (!isHydrated || !wishlistReady) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading your wishlist">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-20 animate-pulse rounded-xl bg-white ring-1 ring-line" />
        ))}
      </div>
    );
  }

  const saveError = wishlistError ? <div role="alert" className="mb-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">{wishlistError} <button type="button" onClick={retryWishlist} className="ml-2 font-bold underline">Retry saving</button></div> : null;
  if (rows.length === 0) {
    return (
      <div>
      {saveError}
      <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
        <span className="mx-auto mb-3 inline-flex size-14 items-center justify-center rounded-full bg-surface text-ink-300">
          <Heart size={24} />
        </span>
        <p className="text-[16px] font-bold text-ink-800">Nothing saved yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-500">
          Tap the heart on any product to save it to your account. You can also share your list with a read-only link.
        </p>
        <Link
          href="/home-grocery"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-brand-600 px-5 text-[13.5px] font-semibold text-white hover:bg-brand-700"
        >
          Continue shopping
        </Link>
      </div>
      </div>
    );
  }

  return (
    <div>
      {saveError}
      {/* ---------- desktop table (the reference layout) ---------- */}
      <div className="rounded-2xl bg-white ring-1 ring-line">
        <div className="hidden grid-cols-[48px_minmax(0,1fr)_130px_170px_130px_150px] items-center gap-3 rounded-t-2xl bg-accent-500 px-4 py-3 text-[12.5px] font-bold text-ink-900 md:grid">
          <span aria-hidden="true" />
          <span>Product</span>
          <span>Price</span>
          <span>Date Added</span>
          <span>Stock Status</span>
          <span aria-hidden="true" />
        </div>

        <ul className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.id}
              data-wishlist-row={row.id}
              className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3 px-3 py-3.5 md:grid-cols-[48px_minmax(0,1fr)_130px_170px_130px_150px] md:px-4"
            >
              <button
                type="button"
                onClick={() => toggleWishlist(row.id)}
                aria-label={`Remove ${row.name} from wishlist`}
                className="inline-flex size-7 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <X size={15} strokeWidth={2.2} />
              </button>

              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href={`/product/${row.slug}`}
                  className="relative inline-flex size-14 shrink-0 overflow-hidden rounded-lg bg-surface"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={row.image} alt={row.name} className="size-full object-cover" />
                </Link>
                <div className="min-w-0">
                  <Link
                    href={`/product/${row.slug}`}
                    className="block truncate text-[13.5px] font-semibold text-ink-900 hover:text-brand-700"
                  >
                    {row.name}
                  </Link>
                  <p className="text-[11.5px] text-ink-400">
                    {row.unit} · {row.categoryLabel}
                  </p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                    {row.reviewCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-accent-600">
                        <Star size={10} className="fill-accent-500 text-accent-500" />
                        {row.rating.toFixed(1)} ({row.reviewCount})
                      </span>
                    ) : null}
                    <Link href={`/product/${row.slug}`} className="font-semibold text-brand-700 hover:underline">
                      View product
                    </Link>
                  </p>
                  {/* mobile-only copies of the two columns */}
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 md:hidden">
                    <span className="text-[12.5px] font-bold text-ink-900">{row.priceLabel}</span>
                    <StockBadge stock={row.stock} />
                  </p>
                </div>
              </div>

              <div className="hidden md:block">
                <span className="block text-[13px] font-semibold text-ink-800">{row.priceLabel}</span>
                {row.compareAtPrice ? (
                  <span className="text-[11.5px] text-ink-400 line-through">
                    {formatPrice(row.compareAtPrice)}
                  </span>
                ) : null}
              </div>
              <div className="hidden text-[12px] text-ink-500 md:block">{formatAdded(row.addedAt)}</div>
              <div className="hidden md:block">
                <StockBadge stock={row.stock} />
              </div>

              <div className="col-span-2 pl-10 md:col-span-1 md:pl-0 md:text-right">
                <button
                  type="button"
                  onClick={() => {
                    const product = getProduct(row.id);
                    if (product && needsPurchaseChoices(product)) router.push(`/product/${encodeURIComponent(row.slug)}`);
                    else addToCart(row.id, 1);
                  }}
                  disabled={row.stock === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500"
                >
                  <ShoppingBag size={12} /> {row.stock === 0 ? "Out of stock" : getProduct(row.id) && needsPurchaseChoices(getProduct(row.id)!) ? "Choose options" : "Add to Cart"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ---------- share / clear / add-all bar ---------- */}
      {addNotice && <p role="status" className="mt-3 text-[12px] text-ink-600">{addNotice}</p>}
      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white px-4 py-3.5 ring-1 ring-line lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label
            htmlFor="wishlist-link"
            className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-ink-600"
          >
            <Link2 size={13} /> Wishlist link:
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              id="wishlist-link"
              readOnly
              value={shareUrl || (wishlistError ? "Not saved — retry above" : wishlistSaving ? "Saving your list…" : "Your link will appear after saving")}
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 w-full min-w-0 flex-1 rounded-full border border-line bg-surface/60 px-3.5 text-[11.5px] text-ink-600 outline-none focus:border-brand-500"
            />
            <button
              type="button"
              onClick={copyLink}
              disabled={!shareUrl}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
          {wishlistSaving ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
              <Loader2 size={11} className="animate-spin" /> Saving…
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {confirmClear ? (
            <span className="flex items-center gap-2 text-[12px]">
              <span className="text-ink-600">Clear the whole list?</span>
              <button
                type="button"
                onClick={() => {
                  clearWishlist();
                  setConfirmClear(false);
                }}
                className="font-bold text-red-600 hover:underline"
              >
                Yes, clear
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="font-semibold text-ink-500 hover:underline"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-600 underline-offset-4 hover:text-red-600 hover:underline"
            >
              <Trash2 size={12} /> Clear Wishlist
            </button>
          )}
          <button
            type="button"
            onClick={addAll}
            disabled={rows.every((row) => row.stock === 0)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-full bg-brand-600 px-5 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-700",
              "disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500",
            )}
          >
            <ShoppingBag size={13} /> Add All to Cart
          </button>
        </div>
      </div>
    </div>
  );
}

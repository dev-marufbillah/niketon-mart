"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Download, Link2, Star } from "lucide-react";
import { useStore } from "@/lib/store/store-provider";

type SharedItem = {
  productId: string;
  name: string;
  slug: string;
  image: string;
  unit: string;
  priceLabel: string;
  rating: number;
  reviewCount: number;
  categoryLabel: string;
  stock: number;
  addedAt: string;
};

/**
 * A shared wishlist (`/wishlist?list=<token>`).
 * Read-only by design: it renders straight from the database on the server and
 * offers one action — copy the list into *your* wishlist, which then syncs to
 * your own record. It never edits the list it is showing.
 */
export function SharedWishlist({ token, items }: { token: string; items: SharedItem[] }) {
  const { importWishlist } = useStore();
  const [imported, setImported] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/wishlist?list=${token}`);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <section className="mb-8 rounded-2xl bg-white ring-1 ring-line" aria-labelledby="shared-wishlist">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <div>
          <h2 id="shared-wishlist" className="flex items-center gap-1.5 text-[15px] font-extrabold text-ink-900">
            <Link2 size={15} className="text-brand-600" /> Shared wishlist
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {items.length} saved product{items.length === 1 ? "" : "s"} · read only
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-[12px] font-semibold text-ink-700 hover:bg-surface"
          >
            {linkCopied ? <Check size={12} /> : <Link2 size={12} />} {linkCopied ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (importWishlist(items.map((item) => item.productId))) setImported(true);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-semibold text-white hover:bg-brand-700"
          >
            <Download size={12} /> Copy these to my wishlist
          </button>
        </div>
      </div>

      <ul className="divide-y divide-line">
        {items.length === 0 ? (
          <li className="px-4 py-8 text-center text-[13px] text-ink-500">
            This shared list is empty — the owner may have cleared it.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.productId} className="flex items-center gap-3 px-4 py-3">
              <span className="inline-flex size-12 shrink-0 overflow-hidden rounded-lg bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.image} alt="" className="size-full object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <Link
                  href={`/product/${item.slug}`}
                  className="block truncate text-[13px] font-semibold text-ink-900 hover:text-brand-700"
                >
                  {item.name}
                </Link>
                <span className="text-[11px] text-ink-400">
                  {item.unit} · {item.categoryLabel}
                  {item.reviewCount > 0 ? ` · ${item.rating.toFixed(1)}` : ""}
                </span>
              </span>
              {item.rating > 0 ? (
                <span className="hidden items-center gap-1 text-[11px] text-accent-600 sm:inline-flex">
                  <Star size={10} className="fill-accent-500 text-accent-500" /> {item.rating.toFixed(1)}
                </span>
              ) : null}
              <span className="text-right">
                <span className="block text-[12.5px] font-semibold text-ink-800">{item.priceLabel}</span>
                <span className="text-[11px] text-ink-400">{item.stock > 0 ? "In stock" : "Out of stock"}</span>
              </span>
            </li>
          ))
        )}
      </ul>

      {imported ? (
        <p role="status" className="border-t border-line px-4 py-2.5 text-[12px] font-semibold text-brand-700">
          Added to your wishlist below. Check its save status there.
        </p>
      ) : null}
    </section>
  );
}

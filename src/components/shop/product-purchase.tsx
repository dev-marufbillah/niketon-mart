"use client";

import { useState } from "react";
import { Heart, Minus, Loader2, Plus, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/types/domain";
import { useStore } from "@/lib/store/store-provider";
import { cn } from "@/lib/utils/cn";

/**
 * Quantity + cart + wishlist controls on the product detail page.
 * Quantities are clamped to the catalogue's stock and the shared cart store is
 * reused — this page never keeps its own basket.
 */
export function ProductPurchase({ product }: { product: Product }) {
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const stock = Math.max(0, product.stock ?? 0);
  const soldOut = stock === 0;
  const saved = wishlist.includes(product.id);

  const change = (delta: number) =>
    setQuantity((current) => Math.min(stock || 1, Math.max(1, current + delta)));

  const add = async () => {
    if (soldOut || pending) return;
    setPending(true);
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    addToCart(product.id, quantity);
    setPending(false);
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "inline-flex h-12 items-center rounded-full bg-surface px-1.5 ring-1 ring-line",
            soldOut && "opacity-50",
          )}
        >
          <button
            type="button"
            onClick={() => change(-1)}
            disabled={soldOut || quantity <= 1}
            aria-label="Decrease quantity"
            className="inline-flex size-9 items-center justify-center rounded-full bg-white text-ink-700 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
          >
            <Minus size={15} />
          </button>
          <span
            className="w-10 text-center text-[14px] font-bold tabular-nums text-ink-900"
            aria-live="polite"
          >
            {soldOut ? 0 : quantity}
          </span>
          <button
            type="button"
            onClick={() => change(1)}
            disabled={soldOut || quantity >= stock}
            aria-label="Increase quantity"
            className="inline-flex size-9 items-center justify-center rounded-full bg-white text-ink-700 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
          >
            <Plus size={15} />
          </button>
        </div>

        <button
          type="button"
          onClick={add}
          disabled={soldOut || pending}
          aria-busy={pending}
          className={cn(
            "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-7 text-[14px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-700",
            "disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none",
            "min-w-[190px]",
          )}
        >
          {pending ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <ShoppingBag size={17} />
          )}
          {soldOut ? "Out of stock" : pending ? "Adding…" : "Add to Cart"}
        </button>

        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-pressed={saved}
          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-full border transition-colors",
            saved
              ? "border-brand-600/30 bg-brand-50 text-brand-700"
              : "border-line bg-white text-ink-600 hover:border-brand-600/40 hover:text-brand-700",
          )}
        >
          <Heart size={19} className={saved ? "fill-brand-600" : undefined} />
        </button>
      </div>

      <p className="text-[12.5px] text-ink-500">
        {soldOut
          ? "This item is currently unavailable. You can save it to your wishlist."
          : stock <= 10
            ? `Only ${stock} left in stock — order soon.`
            : "In stock. Delivery options are shown at checkout."}
      </p>
    </div>
  );
}

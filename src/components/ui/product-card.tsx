"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { needsPurchaseChoices } from "@/lib/catalogue/purchase";
import { catalogueDisplayPrice, type CatalogueDisplayPrice } from "@/lib/catalogue/display-price";
import { Heart, Loader2, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";
import { discountPercent, formatPrice } from "@/lib/utils/format";
import { useStore } from "@/lib/store/store-provider";
import { Rating } from "@/components/ui/rating";

function CataloguePrice({ price, className }: { price: CatalogueDisplayPrice; className?: string }) {
  return <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
    <span className="text-[15px] font-bold tabular-nums text-ink-900">{price.label}</span>
    {price.compareAtPrice ? <span className="text-sm tabular-nums text-ink-400 line-through">{formatPrice(price.compareAtPrice)}</span> : null}
  </span>;
}

function WishlistButton({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const { wishlist, toggleWishlist } = useStore();
  const active = wishlist.includes(product.id);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleWishlist(product.id);
      }}
      aria-label={active ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      aria-pressed={active}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full bg-white text-ink-600 ring-1 ring-ink-900/8 transition-all duration-200 hover:scale-105 hover:text-brand-600",
        active && "text-brand-600 ring-brand-600/30",
        className,
      )}
    >
      <Heart size={17} strokeWidth={1.8} className={active ? "fill-brand-600" : undefined} />
    </button>
  );
}

export function AddToCartButton({
  product,
  label = "Add",
  className,
}: {
  product: Product;
  label?: string;
  className?: string;
}) {
  const { addToCart, requireShopping } = useStore();
  const router = useRouter();
  const needsChoices = needsPurchaseChoices(product);
  const [pulse, setPulse] = useState(false);
  const [pending, setPending] = useState(false);
  const soldOut = (product.stock ?? 0) <= 0;

  const onClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (soldOut || pending) return;
    if (!requireShopping(`/product/${encodeURIComponent(product.slug)}`)) return;
    if (needsChoices) {
      router.push(`/product/${encodeURIComponent(product.slug)}`);
      return;
    }
    setPending(true);
    // Short pending state keeps double taps from racing the cart update and gives
    // the button a visible acknowledgement on slow devices.
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    addToCart(product.id);
    setPending(false);
    setPulse(true);
    window.setTimeout(() => setPulse(false), 420);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soldOut || pending}
      aria-label={soldOut ? `${product.name} is out of stock` : needsChoices ? `Choose options for ${product.name}` : `Add ${product.name} to cart`}
      aria-busy={pending}
      className={cn(
        "relative z-10 inline-flex h-9 min-w-[76px] items-center justify-center gap-1.5 rounded-full bg-brand-50 px-4 text-[13px] font-semibold text-brand-700 transition-all duration-200 hover:bg-brand-600 hover:text-white active:scale-95",
        "disabled:cursor-not-allowed disabled:bg-surface disabled:text-ink-400 disabled:hover:bg-surface disabled:hover:text-ink-400",
        pulse && "scale-95 bg-brand-600 text-white",
        className,
      )}
    >
      {pending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <ShoppingBag size={14} strokeWidth={2} />
      )}
      {soldOut ? "Sold out" : pending ? "Adding" : needsChoices ? "Choose" : label}
    </button>
  );
}

/**
 * The catalogue card. One component, two layouts:
 *  - `grid`  → vertical card used in Featured / Best Seller carousels
 *  - `deal`  → horizontal card used by Deals of the Day
 */
export function ProductCard({
  product,
  variant = "grid",
  priority = false,
  compactDesktop = false,
  className,
}: {
  product: Product;
  variant?: "grid" | "deal";
  priority?: boolean;
  /** Compact homepage merchandising without changing mobile/shop cards. */
  compactDesktop?: boolean;
  className?: string;
}) {
  const { pushRecentlyViewed } = useStore();
  const displayPrice = catalogueDisplayPrice(product);
  const off = displayPrice.amount === undefined ? null : discountPercent(displayPrice.amount, displayPrice.compareAtPrice);
  const soldOut = (product.stock ?? 0) <= 0;
  const lowStock = !soldOut && (product.stock ?? 0) <= 10;

  const media = (
    <div
      className={cn(
        "relative overflow-hidden bg-white",
        variant === "grid"
          ? "aspect-[4/3] rounded-t-2xl"
          : "h-full min-h-[190px] w-full rounded-l-2xl bg-surface sm:min-h-[216px]",
        compactDesktop && (variant === "grid" ? "lg:aspect-[7/5]" : "lg:min-h-[180px]"),
        product.imageMode === "cover" && "bg-brand-50",
      )}
    >
      <Image
        src={product.image}
        alt={product.name}
        fill
        sizes={variant === "grid" ? "(max-width: 480px) 65vw, (max-width: 1023px) 45vw, (max-width: 1279px) 33vw, 300px" : "220px"}
        priority={priority}
        className={cn(
          "transition-transform duration-500 will-change-transform group-hover:scale-[1.06]",
          product.imageMode === "cover"
            ? "object-cover object-center"
            : variant === "grid"
              ? "object-contain p-3"
              : "object-contain p-6",
        )}
      />
      {off !== null && (
        <span
          className={cn(
            "absolute rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold leading-none text-white shadow-sm",
            variant === "grid" ? "left-3 top-3" : "left-3 top-3",
          )}
        >
          {off}% off
        </span>
      )}
      {soldOut && (
        <span className="absolute bottom-3 left-3 rounded-full bg-ink-900/80 px-3 py-1 text-[11px] font-bold leading-none text-white">
          Out of stock
        </span>
      )}
      <WishlistButton product={product} className="absolute right-3 top-3 z-10" />
    </div>
  );

  const body = (
    <div className={cn("flex flex-1 flex-col", variant === "grid" ? "p-4 pt-3.5" : "p-5", compactDesktop && "lg:p-3 lg:pt-2.5")}>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-semibold text-brand-600">
          {product.categoryLabel}
        </span>
        <Rating value={product.rating} />
      </div>
      <h3
        className={cn(
          "mt-1 font-bold leading-snug text-ink-800",
          variant === "grid" ? "text-[15px]" : "text-[17px]",
          compactDesktop && "lg:text-[14px]",
        )}
      >
        <Link
          href={`/product/${encodeURIComponent(product.slug)}`}
          onClick={() => pushRecentlyViewed(product.id)}
          className="transition-colors after:absolute after:inset-0 after:z-[1] after:rounded-2xl after:content-[''] hover:text-brand-600"
        >
          {product.name}
        </Link>
      </h3>
      <p className="mt-1 text-[12.5px] text-ink-400">
        {product.unit}
        {lowStock && <span className="ml-2 font-semibold text-accent-600">Only a few left</span>}
      </p>

      <div
        className={cn(
          "mt-auto flex items-center justify-between gap-3",
          variant === "grid" ? "pt-3" : "pt-4",
        )}
      >
        <CataloguePrice price={displayPrice} />
        <AddToCartButton product={product} className={compactDesktop ? "lg:h-8 lg:min-w-[68px] lg:px-3 lg:text-xs" : undefined} />
      </div>
    </div>
  );

  if (variant === "deal") {
    return (
      <article
        data-product-id={product.id}
        data-product-price={displayPrice.amount}
        data-product-stock={product.stock ?? 0}
        className={cn(
          "group relative isolate flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-line transition-shadow duration-300 hover:shadow-card sm:flex-row",
          className,
        )}
      >
        <div className="flex w-full shrink-0 self-stretch sm:w-[40%]">{media}</div>
        <div className={cn("flex flex-1 flex-col p-5", compactDesktop && "lg:p-4")}>
          <div className="flex items-start justify-between gap-3">
            <span className="text-[12px] font-semibold text-brand-600">
              {product.categoryLabel}
            </span>
            <Rating value={product.rating} />
          </div>
          <h3 className="mt-1 text-[17px] font-bold leading-snug text-ink-800">
            <Link
              href={`/product/${encodeURIComponent(product.slug)}`}
              onClick={() => pushRecentlyViewed(product.id)}
              className="transition-colors after:absolute after:inset-0 after:z-[1] after:rounded-2xl after:content-[''] hover:text-brand-600"
            >
              {product.name}
            </Link>
          </h3>
          <CataloguePrice price={displayPrice} className="mt-1.5" />
          <p className={cn("mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-500", compactDesktop && "lg:line-clamp-2")}>
            {product.description}
          </p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <span className="text-[11.5px] font-medium text-ink-400">{product.unit}</span>
            <AddToCartButton product={product} className={compactDesktop ? "lg:h-8 lg:min-w-[68px] lg:px-3 lg:text-xs" : undefined} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      data-product-id={product.id}
      data-product-price={displayPrice.amount}
      data-product-stock={product.stock ?? 0}
      className={cn(
        "group relative isolate flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-line transition-all duration-300 hover:-translate-y-1 hover:shadow-lift",
        className,
      )}
    >
      {media}
      {body}
    </article>
  );
}

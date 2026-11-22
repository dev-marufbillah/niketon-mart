"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store/store-provider";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { cartLineKey, unitCompareAt, unitPrice, unitStock } from "@/lib/store/cart-line";
import { quoteCartAction } from "@/lib/actions/cart";
import type { Quote } from "@/lib/checkout/quote";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { PreparationLine } from "@/components/checkout/preparation-line";
import { formatGrams } from "@/lib/weights/weight";
import { ProductCard } from "@/components/ui/product-card";

/**
 * Full-page shopping cart.
 *
 * Local cart state paints instantly (it is persisted in the browser), then every
 * change is re-priced by the server through `quoteCartAction`: live unit prices,
 * stock ceilings, coupon discount, delivery fee, tax and the final total. The
 * checkout re-runs the same calculation before it writes an order, so the two
 * screens can never disagree.
 */

type Item = {
  productId: string;
  quantity: number;
  variantLabel?: string;
  preparation?: { choices: { group: string; label: string }[]; instructions?: string };
};

function Stepper({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white">
      <button
        type="button"
        aria-label={`Decrease quantity of ${label}`}
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        className="inline-flex size-9 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-surface disabled:opacity-40"
      >
        <Minus size={13} strokeWidth={2.2} />
      </button>
      <span className="w-8 text-center text-[13px] font-semibold tabular-nums text-ink-900" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase quantity of ${label}`}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="inline-flex size-9 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-surface disabled:opacity-40"
      >
        <Plus size={13} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "discount" | "total";
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        tone === "total" && "border-t border-line pt-3 text-[15px] font-extrabold text-ink-900",
      )}
    >
      <dt className={cn("text-[13px]", tone === "total" ? "text-ink-900" : "text-ink-500")}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          tone === "discount" ? "font-semibold text-brand-700" : "text-ink-800",
          tone === "total" && "text-ink-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function CartView() {
  const { getProduct, products } = useCatalogue();
  const {
    cart,
    coupon,
    wishlist,
    subtotal,
    isHydrated,
    updateQuantity,
    removeFromCart,
    clearCart,
    toggleWishlist,
    applyCoupon,
    clearCoupon,
  } = useStore();

  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const items = useMemo<Item[]>(
    () =>
      cart.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        variantLabel: line.variantLabel,
        preparation: line.preparation
          ? {
              choices: line.preparation.options.map((option) => ({ group: option.group, label: option.label })),
              instructions: line.preparation.instructions,
            }
          : undefined,
      })),
    [cart],
  );

  // Server quote: prices, stock, coupon, delivery, tax and the final total.
  useEffect(() => {
    if (!isHydrated || items.length === 0) {
      queueMicrotask(() => setQuote(null));
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      const result = await quoteCartAction({ items, couponCode: coupon?.code });
      if (!active) return;
      setQuoting(false);
      if (result.ok) setQuote(result.quote);
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [items, coupon?.code, isHydrated]);

  // A coupon that stops being valid (cart changed, expired, limit reached) is
  // dropped instead of quietly discounting the wrong amount.
  useEffect(() => {
    if (!coupon || !quote) return;
    if (!quote.couponCode) {
      if (quote.errors.some((error) => /coupon/i.test(error))) {
        clearCoupon();
        queueMicrotask(() => setCouponMessage({ tone: "error", text: "Your coupon no longer applies, so it was removed." }));
      }
    }
  }, [quote, coupon, clearCoupon]);

  const applyCode = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setCouponMessage({ tone: "error", text: "Enter a coupon code first." });
      return;
    }
    setApplying(true);
    setCouponMessage(null);
    const result = await quoteCartAction({ items, couponCode: trimmed });
    setApplying(false);
    if (!result.ok) {
      setCouponMessage({ tone: "error", text: result.error });
      return;
    }
    const applied = result.quote.couponCode;
    if (!applied) {
      setCouponMessage({
        tone: "error",
        text: result.quote.errors[0] ?? "That coupon could not be applied to this basket.",
      });
      return;
    }
    applyCoupon({
      code: applied,
      description: result.quote.couponDescription,
      discount: result.quote.discount,
      freeShipping: result.quote.freeShippingCoupon,
    });
    setQuote(result.quote);
    setCode("");
    setCouponMessage({
      tone: "success",
      text: result.quote.freeShippingCoupon
        ? `${applied} applied — delivery is free.`
        : `${applied} applied — you save ${formatPrice(result.quote.discount)}.`,
    });
  }, [applyCoupon, code, items]);

  const removeCoupon = useCallback(() => {
    clearCoupon();
    setCouponMessage(null);
  }, [clearCoupon]);

  const saveForLater = (productId: string, name: string) => {
    if (!wishlist.includes(productId)) toggleWishlist(productId);
    removeFromCart({ productId });
    setCouponMessage({ tone: "success", text: `${name} moved to your wishlist.` });
  };

  /* ------------------------------ loading ------------------------------ */
  if (!isHydrated) {
    return (
      <div
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
        aria-busy="true"
        aria-label="Loading your cart"
      >
        <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-line" />
        <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-line" />
      </div>
    );
  }

  /* ------------------------------- empty ------------------------------- */
  if (cart.length === 0) {
    const suggestions = products
      .filter((product) => product.visibility !== "hidden" && (product.stock ?? 0) > 0)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 4);

    return (
      <div>
        <div className="rounded-2xl bg-white px-6 py-14 text-center ring-1 ring-line sm:px-10">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <ShoppingBag size={26} strokeWidth={1.8} />
          </span>
          <h2 className="mt-4 text-[20px] font-extrabold text-ink-900">Your shopping cart is empty</h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-500">
            Browse the shop and add what you need — your cart is saved on this device, so nothing is lost
            if you close the tab.
          </p>
          <Link
            href="/home-grocery"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand-600 px-6 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-700"
          >
            Continue shopping <ArrowRight size={15} />
          </Link>
        </div>

        {suggestions.length > 0 ? (
          <section className="mt-10" aria-labelledby="cart-suggestions">
            <div className="flex items-end justify-between gap-3">
              <h2 id="cart-suggestions" className="text-[19px] font-extrabold text-ink-900">
                Popular right now
              </h2>
              <Link href="/home-grocery" className="text-[12.5px] font-semibold text-brand-700 hover:underline">
                View all
              </Link>
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              {suggestions.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    );
  }

  /* -------------------------------- filled -------------------------------- */
  /**
   * Matches a cart line to its server-priced quote line. Preparation is part of
   * the identity: the same fish in two cuts is two quote lines.
   */
  const quoteFor = (
    productId: string,
    variantLabel?: string,
    signature?: string,
  ) =>
    quote?.lines.find(
      (line) =>
        line.productId === productId &&
        line.variantLabel === variantLabel &&
        (line.preparation?.signature ?? "none") === (signature ?? "none"),
    );

  const itemCount = quote?.itemCount ?? cart.reduce((total, line) => total + line.quantity, 0);
  const subtotalValue = quote?.subtotal ?? subtotal;
  const discount = quote?.discount ?? 0;
  const deliveryFee = quote?.deliveryFee ?? 0;
  const tax = quote?.tax ?? 0;
  const total = quote?.total ?? subtotalValue;
  const minOrder = quote?.settings.minOrderValue ?? 0;
  const belowMinimum = quote?.belowMinimum ?? false;
  const blocked = Boolean(quote && (!quote.ok || quote.lines.some((line) => line.shortOnStock)));
  const stockErrors = quote?.errors.filter((error) => /stock|available|no longer/i.test(error)) ?? [];
  const couponErrors = quote?.errors.filter((error) => /coupon/i.test(error)) ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
          {/* Header bar — hidden on phones, where each row is a stacked card. */}
          <div className="hidden grid-cols-[minmax(0,1fr)_104px_132px_104px] items-center gap-3 bg-accent-500 px-5 py-3.5 text-[12.5px] font-bold text-ink-900 md:grid">
            <span>Product</span>
            <span className="text-center">Price</span>
            <span className="text-center">Quantity</span>
            <span className="text-right">Subtotal</span>
          </div>

          <ul>
            {cart.map((line) => {
              const product = getProduct(line.productId);
              if (!product) {
                return (
                  <li key={cartLineKey(line)} className="flex items-center gap-3 border-t border-line px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink-700">This product is no longer available</p>
                      <p className="text-[11.5px] text-ink-400">
                        It was removed from the catalogue after you added it.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(line)}
                      className="text-[12px] font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                );
              }

              const server = quoteFor(line.productId, line.variantLabel, line.preparation?.signature);
              const price =
                server?.totalUnitPrice ??
                (unitPrice(product, line.variantLabel) + (line.preparation?.chargePerUnit ?? 0));
              const compareAt = server?.compareAtPrice ?? unitCompareAt(product, line.variantLabel);
              const stock = server?.available ?? unitStock(product, line.variantLabel);
              const off =
                compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : null;
              const lineTotal = server?.lineTotal ?? Math.round(price * line.quantity * 100) / 100;
              const shortOnStock = server ? server.shortOnStock : line.quantity > stock;

              return (
                <li
                  key={cartLineKey(line)}
                  className="grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 md:grid-cols-[minmax(0,1fr)_104px_132px_104px] md:items-center md:gap-3"
                  data-cart-line={line.productId}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <button
                      type="button"
                      onClick={() => removeFromCart(line)}
                      aria-label={`Remove ${product.name}${line.variantLabel ? ` (${line.variantLabel})` : ""} from cart`}
                      className="mt-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={15} strokeWidth={2.2} />
                    </button>
                    <Link
                      href={`/product/${product.slug}`}
                      className="inline-flex size-[68px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product.image} alt="" className="size-full object-cover" />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={`/product/${product.slug}`}
                        className="block truncate text-[14px] font-bold text-ink-900 hover:text-brand-700"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-0.5 text-[11.5px] text-ink-500">
                        {server?.unit ?? line.variantLabel ?? product.unit}
                        {product.sku ? <span className="text-ink-400"> · SKU {product.sku}</span> : null}
                      </p>
                      <PreparationLine preparation={line.preparation} />
                      {server?.weight ? (
                        <p className="mt-0.5 text-[11px] text-ink-500">
                          Sold by weight: {formatGrams(server.weight.estimatedGrams)} estimated
                          {server.weight.estimateLabel ? ` (${server.weight.estimateLabel})` : ""}. We weigh before
                          packing — a heavier pack is only charged after you approve it.
                        </p>
                      ) : null}
                      <p
                        className={cn(
                          "mt-1 inline-flex items-center gap-1 text-[11px] font-semibold",
                          stock === 0 ? "text-red-600" : shortOnStock ? "text-accent-700" : "text-brand-700",
                        )}
                      >
                        {stock === 0
                          ? "Out of stock"
                          : shortOnStock
                            ? `Only ${stock} left — adjust the quantity`
                            : stock <= 10
                              ? `Only ${stock} left in stock`
                              : "In stock"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button
                          type="button"
                          onClick={() => saveForLater(product.id, product.name)}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-500 transition-colors hover:text-brand-700"
                        >
                          <Heart size={12} strokeWidth={2} /> Save for later
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line)}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-500 transition-colors hover:text-red-600 md:hidden"
                        >
                          <Trash2 size={12} strokeWidth={2} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:block md:text-center">
                    <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400 md:hidden">
                      Price
                    </span>
                    <span className="inline-flex flex-wrap items-center justify-end gap-1.5 md:justify-center">
                      <span className="text-[13.5px] font-semibold tabular-nums text-ink-900">
                        {formatPrice(price)}
                      </span>
                      {compareAt ? (
                        <span className="text-[11.5px] text-ink-400 line-through tabular-nums">
                          {formatPrice(compareAt)}
                        </span>
                      ) : null}
                      {off ? (
                        <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                          -{off}%
                        </span>
                      ) : null}
                    </span>
                  </div>

                  <div className="flex items-center justify-between md:justify-center">
                    <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400 md:hidden">
                      Quantity
                    </span>
                    <Stepper
                      value={line.quantity}
                      max={Math.max(1, stock)}
                      label={`${product.name}${line.variantLabel ? ` (${line.variantLabel})` : ""}`}
                      onChange={(next) => updateQuantity(line, next)}
                    />
                  </div>

                  <div className="flex items-center justify-between md:block md:text-right">
                    <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-400 md:hidden">
                      Subtotal
                    </span>
                    <span className="text-[14px] font-extrabold tabular-nums text-ink-900" data-line-total>
                      {formatPrice(lineTotal)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Coupon + clear cart, exactly where the reference puts them. */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {coupon ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-[12px] font-bold text-brand-800">
                  <Tag size={13} /> {coupon.code}
                  <button
                    type="button"
                    onClick={removeCoupon}
                    aria-label={`Remove coupon ${coupon.code}`}
                    className="ml-0.5 text-brand-600 hover:text-brand-900"
                  >
                    <X size={13} strokeWidth={2.4} />
                  </button>
                </span>
                <span className="text-[11.5px] text-ink-500">
                  {coupon.freeShipping ? "Free delivery applied" : `${formatPrice(discount)} off your order`}
                </span>
              </div>
            ) : (
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void applyCode();
                }}
              >
                <label htmlFor="cart-coupon" className="sr-only">
                  Coupon code
                </label>
                <input
                  id="cart-coupon"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="Coupon code"
                  autoComplete="off"
                  className="h-10 w-full max-w-[220px] rounded-xl border border-line bg-white px-3.5 text-[12.5px] outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500"
                />
                <button
                  type="submit"
                  disabled={applying}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-600 px-5 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
                >
                  {applying ? <Loader2 size={14} className="animate-spin" /> : null}
                  Apply Coupon
                </button>
              </form>
            )}
            {couponMessage ? (
              <p
                role="status"
                className={cn(
                  "mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold",
                  couponMessage.tone === "error" ? "text-red-600" : "text-brand-700",
                )}
              >
                {couponMessage.tone === "success" ? <Check size={12} /> : null}
                {couponMessage.text}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="shrink-0 self-start text-[12.5px] font-semibold text-ink-500 underline decoration-ink-300 underline-offset-4 transition-colors hover:text-red-600 sm:self-auto"
          >
            Clear Shopping Cart
          </button>
        </div>

        {confirmClear ? (
          <div
            role="alertdialog"
            aria-label="Clear shopping cart"
            className="mt-3 rounded-2xl border border-accent-200 bg-accent-50 p-4"
          >
            <p className="text-[13px] font-bold text-ink-900">Remove everything from your cart?</p>
            <p className="mt-0.5 text-[12px] text-ink-600">
              {itemCount} {itemCount === 1 ? "item" : "items"} will be removed. Saved wishlist items and your
              coupon stay untouched.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  clearCart();
                  setConfirmClear(false);
                }}
                className="inline-flex h-9 items-center rounded-full bg-red-600 px-4 text-[12.5px] font-bold text-white hover:bg-red-700"
              >
                Yes, clear cart
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="inline-flex h-9 items-center rounded-full border border-line bg-white px-4 text-[12.5px] font-semibold text-ink-700 hover:bg-surface"
              >
                Keep my items
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/home-grocery"
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-brand-700 hover:underline"
          >
            ← Continue shopping
          </Link>
          <p className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-400">
            <Truck size={13} /> {quote?.freeShipping ? "Delivery is free on this order." : `Free delivery over ${formatPrice(quote?.settings.freeShippingThreshold ?? 50)}.`}
          </p>
        </div>
      </div>

      {/* Order summary */}
      <aside className="lg:sticky lg:top-[150px] lg:self-start" aria-labelledby="cart-summary-heading">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <h2 id="cart-summary-heading" className="text-[15px] font-extrabold text-ink-900">
            Order Summary
          </h2>

          <dl className="mt-4 space-y-2.5 text-[13px]">
            <SummaryRow label="Items" value={<span data-summary-items>{itemCount}</span>} />
            <SummaryRow
              label="Sub Total"
              value={<span data-summary-subtotal>{formatPrice(subtotalValue)}</span>}
            />
            <SummaryRow
              label="Shipping"
              value={
                <span data-summary-shipping>
                  {deliveryFee === 0 ? "Free" : formatPrice(deliveryFee)}
                </span>
              }
            />
            <SummaryRow
              label={quote ? `Taxes (${quote.settings.taxRate}%)` : "Taxes"}
              value={<span data-summary-tax>{formatPrice(tax)}</span>}
            />
            <SummaryRow
              label="Coupon Discount"
              tone="discount"
              value={
                <span data-summary-discount>
                  {discount > 0 ? `-${formatPrice(discount)}` : formatPrice(0)}
                </span>
              }
            />
            <SummaryRow
              label="Total"
              tone="total"
              value={
                <span data-summary-total>
                  {quoting && !quote ? <Loader2 size={14} className="animate-spin" /> : formatPrice(total)}
                </span>
              }
            />
          </dl>

          <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
            {quote && quote.shippingFrom !== deliveryFee && deliveryFee > 0
              ? `Shipping shown is our lowest area rate — the exact fee is confirmed at checkout.`
              : "Prices, stock and totals are re-checked by our server before the order is placed."}
          </p>

          {quote && quote.freeShippingRemaining > 0 && !coupon?.freeShipping ? (
            <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-[11.5px] font-semibold text-brand-800">
              Add {formatPrice(quote.freeShippingRemaining)} more for free delivery.
            </p>
          ) : null}

          {belowMinimum && minOrder > 0 ? (
            <p className="mt-3 rounded-xl bg-accent-50 px-3 py-2 text-[11.5px] font-semibold text-accent-700">
              Minimum order is {formatPrice(minOrder)} — add {formatPrice(minOrder - subtotalValue)} more to
              check out.
            </p>
          ) : null}

          {stockErrors.length > 0 ? (
            <ul role="alert" className="mt-3 space-y-1 rounded-xl bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-600">
              {stockErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}

          {couponErrors.length > 0 ? (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-600">
              {couponErrors[0]}
            </p>
          ) : null}

          {blocked ? (
            <span className="mt-4 inline-flex h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-ink-200 text-[14px] font-bold text-ink-500">
              Fix your basket to continue
            </span>
          ) : (
            <Link
              href="/checkout"
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 text-[14px] font-bold text-white transition-colors hover:bg-brand-700"
            >
              Proceed to Checkout <ArrowRight size={16} />
            </Link>
          )}

          <Link
            href="/wishlist"
            className="mt-2.5 block text-center text-[12px] font-semibold text-ink-500 transition-colors hover:text-brand-700"
          >
            View your wishlist
          </Link>
        </div>
      </aside>
    </div>
  );
}

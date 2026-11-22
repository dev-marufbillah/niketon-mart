"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { needsPurchaseChoices } from "@/lib/catalogue/purchase";
import { catalogueDisplayPrice } from "@/lib/catalogue/display-price";
import { Heart, Minus, Plus, ShoppingBag, Trash2, Truck, X } from "lucide-react";
import { useStore } from "@/lib/store/store-provider";
import { useSiteSettings } from "@/lib/settings-provider";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { cn } from "@/lib/utils/cn";
import { cartLineKey, linePrice, linePreparationCharge } from "@/lib/store/cart-line";
import { formatPrice } from "@/lib/utils/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { useBodyScrollLock } from "@/lib/ui/use-body-scroll-lock";

function DrawerShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={cn("fixed inset-0 z-[80]", open ? "pointer-events-auto" : "pointer-events-none")}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-ink-900/45 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-[430px] flex-col bg-white shadow-menu transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="inline-flex size-9 items-center justify-center rounded-full bg-surface text-ink-600 transition-colors hover:bg-ink-900 hover:text-white"
          >
            <X size={17} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5">{children}</div>
        {footer}
      </aside>
    </div>
  );
}

export function CartDrawer() {
  const { getProduct } = useCatalogue();
  const settings = useSiteSettings();

  const {
    cart,
    cartOpen,
    setCartOpen,
    updateQuantity,
    removeFromCart,
    subtotal,
    clearCart,
  } = useStore();

  const remaining = Math.max(0, settings.freeShippingThreshold - subtotal);
  const progress = settings.freeShippingThreshold > 0 ? Math.min(100, (subtotal / settings.freeShippingThreshold) * 100) : 0;

  return (
    <DrawerShell
      open={cartOpen}
      onClose={() => setCartOpen(false)}
      title="Your Cart"
      subtitle={`${cart.reduce((total, line) => total + line.quantity, 0)} items ready to checkout`}
      footer={
        cart.length > 0 ? (
          <div className="border-t border-line bg-white px-5 py-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-ink-500">Estimated subtotal</span>
              <span className="text-lg font-extrabold text-ink-900">{formatPrice(subtotal)}</span>
            </div>
            <ButtonLink href="/checkout" onClick={() => setCartOpen(false)} fullWidth size="lg" iconRight={<span aria-hidden>→</span>}>
              Proceed to Checkout
            </ButtonLink>
            <Link
              href="/cart"
              onClick={() => setCartOpen(false)}
              className="mt-2 block w-full py-2 text-center text-xs font-semibold text-brand-700 hover:underline"
            >
              View shopping cart
            </Link>
            <button
              type="button"
              onClick={clearCart}
              className="mt-2 w-full py-2 text-center text-xs font-semibold text-ink-400 hover:text-ink-700"
            >
              Clear cart
            </button>
          </div>
        ) : undefined
      }
    >
      {cart.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-surface text-ink-300">
            <ShoppingBag size={26} />
          </span>
          <p className="text-base font-bold text-ink-800">Your cart is empty</p>
          <p className="mt-1 max-w-[220px] text-sm text-ink-500">
            Add fresh produce and pantry staples to get started.
          </p>
          <Button className="mt-5" onClick={() => setCartOpen(false)}>
            Continue shopping
          </Button>
        </div>
      ) : (
        <>
          {settings.freeShippingThreshold > 0 ? <div className="my-4 rounded-xl bg-brand-50 p-3">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-700">
              <Truck size={15} />
              {remaining > 0
                ? `Add ${formatPrice(remaining)} more for free delivery`
                : "You have unlocked free delivery 🎉"}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div> : null}

          <ul className="divide-y divide-line">
            {cart.map((line) => {
              const product = getProduct(line.productId);
              if (!product) return null;
              return (
                <li key={cartLineKey(line)} className="flex gap-3 py-4">
                  <Link
                    href={`/product/${product.slug}`}
                    onClick={() => setCartOpen(false)}
                    className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface"
                  >
                    <Image src={product.image} alt={product.name} fill sizes="80px" className="object-contain p-2" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-bold text-ink-900">{product.name}</p>
                        <p className="text-[11.5px] text-ink-400">{line.variantLabel ?? product.unit}</p>
                        {line.preparation?.options.length ? (
                          <p className="text-[11px] font-semibold text-brand-700">
                            {line.preparation.options.map((option) => option.label).join(" · ")}
                            {linePreparationCharge(line) > 0
                              ? ` (+${formatPrice(linePreparationCharge(line))}/${line.variantLabel ?? product.unit})`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line)}
                        aria-label={`Remove ${product.name}`}
                        className="shrink-0 rounded-full p-1.5 text-ink-300 transition-colors hover:bg-red-50 hover:text-red-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex h-8 items-center rounded-full ring-1 ring-line">
                        <button
                          type="button"
                          onClick={() => updateQuantity(line, line.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="inline-flex size-8 items-center justify-center rounded-full text-ink-600 hover:text-brand-700"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-[13px] font-bold tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(line, line.quantity + 1)}
                          aria-label="Increase quantity"
                          className="inline-flex size-8 items-center justify-center rounded-full text-ink-600 hover:text-brand-700"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="text-[13.5px] font-bold text-ink-900">
                        {formatPrice(linePrice(line, product))}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </DrawerShell>
  );
}

export function WishlistDrawer() {
  const { getProduct } = useCatalogue();
  const router = useRouter();
  const { wishlist, wishlistOpen, setWishlistOpen, toggleWishlist, addToCart, wishlistReady, wishlistError, retryWishlist } = useStore();
  const items = wishlist
    .map((id) => getProduct(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return (
    <DrawerShell
      open={wishlistOpen}
      onClose={() => setWishlistOpen(false)}
      title="Wishlist"
      subtitle={`${items.length} saved ${items.length === 1 ? "product" : "products"}`}
      footer={
        items.length > 0 ? (
          <div className="border-t border-line px-5 py-4">
            <ButtonLink href="/wishlist" onClick={() => setWishlistOpen(false)} fullWidth variant="outline" size="lg">
              View full wishlist
            </ButtonLink>
          </div>
        ) : undefined
      }
    >
      {wishlistError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{wishlistError} <button type="button" onClick={retryWishlist} className="font-bold underline">Try again</button></p>
      ) : !wishlistReady ? (
        <p role="status" className="py-12 text-center text-sm text-ink-500">Loading your wishlist…</p>
      ) : items.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-20 text-center">
          <span className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-surface text-ink-300">
            <Heart size={26} />
          </span>
          <p className="text-base font-bold text-ink-800">No saved products yet</p>
          <p className="mt-1 max-w-[230px] text-sm text-ink-500">
            Tap the heart on any product to keep it here for later.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((product) => (
            <li key={product.id} className="flex gap-3 py-4">
              <Link
                href={`/product/${product.slug}`}
                onClick={() => setWishlistOpen(false)}
                className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface"
              >
                <Image src={product.image} alt={product.name} fill sizes="80px" className="object-contain p-2" />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-bold text-ink-900">{product.name}</p>
                <p className="text-[11.5px] text-ink-400">
                  {product.categoryLabel} · {product.unit}
                </p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[13.5px] font-bold text-ink-900">{catalogueDisplayPrice(product).label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (needsPurchaseChoices(product)) { setWishlistOpen(false); router.push(`/product/${encodeURIComponent(product.slug)}`); }
                        else addToCart(product.id);
                      }}
                      disabled={(product.stock ?? 0) <= 0}
                      className="rounded-full bg-brand-50 px-3 py-1.5 text-[11.5px] font-bold text-brand-700 hover:bg-brand-600 hover:text-white disabled:opacity-50"
                    >
                      {needsPurchaseChoices(product) ? "Choose options" : "Add to cart"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(product.id)}
                      aria-label={`Remove ${product.name} from wishlist`}
                      className="rounded-full p-1.5 text-ink-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DrawerShell>
  );
}

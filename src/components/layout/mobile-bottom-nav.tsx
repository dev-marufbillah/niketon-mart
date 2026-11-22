"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Heart, Home, LayoutGrid, ShoppingBag, User } from "lucide-react";
import { AccountLink } from "@/components/layout/account-link";
import { MobileNav } from "@/components/layout/mobile-nav";
import { useStore } from "@/lib/store/store-provider";
import { cn } from "@/lib/utils/cn";

const itemClass =
  "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export function MobileBottomNav() {
  const pathname = usePathname();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { cartCount, setCartOpen, setWishlistOpen, wishlist } = useStore();
  const hidden =
    pathname === "/cart" ||
    pathname === "/checkout" ||
    pathname === "/wishlist" ||
    pathname.startsWith("/my-account") ||
    pathname.startsWith("/order/");

  if (hidden) return null;

  const categoriesActive = ["/categories", "/home-grocery", "/fresh-market", "/grocery"].includes(pathname);

  return (
    <>
      <div
        aria-hidden="true"
        className="h-[calc(5rem+env(safe-area-inset-bottom))] lg:hidden"
      />
      <nav
        aria-label="Mobile quick navigation"
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-line bg-white/95 px-2 pt-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(16,24,40,0.08)] backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid h-14 max-w-lg grid-cols-5 items-center">
          <li>
            <Link
              href="/"
              aria-current={pathname === "/" ? "page" : undefined}
              className={cn(itemClass, pathname === "/" ? "text-brand-700" : "text-ink-500 hover:text-brand-700")}
            >
              <Home size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>Home</span>
            </Link>
          </li>
          <li>
            <button
              type="button"
              aria-label="Open categories"
              aria-expanded={categoriesOpen}
              onClick={() => setCategoriesOpen(true)}
              className={cn(itemClass, "w-full", categoriesActive ? "text-brand-700" : "text-ink-500 hover:text-brand-700")}
            >
              <LayoutGrid size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>Categories</span>
            </button>
          </li>
          <li className="flex justify-center">
            <div className="flex flex-col items-center">
              <button
                type="button"
                data-mobile-bag
                onClick={() => setCartOpen(true)}
                aria-label={`Open bag, ${cartCount} items`}
                className="relative -mt-5 inline-flex size-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-[0_6px_16px_rgba(16,115,82,0.32)] ring-4 ring-white transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
              >
                <ShoppingBag size={23} strokeWidth={1.8} aria-hidden="true" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold leading-5 text-brand-900">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </button>
              <span className="mt-1 text-[10px] font-semibold leading-none text-brand-700">Bag</span>
            </div>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setWishlistOpen(true)}
              aria-label={`Open wishlist, ${wishlist.length} items`}
              className={cn(itemClass, "w-full text-ink-500 hover:text-brand-700")}
            >
              <Heart size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>Wishlist</span>
            </button>
          </li>
          <li>
            <AccountLink
              ariaLabel="Account"
              className={cn(itemClass, "text-ink-500 hover:text-brand-700")}
            >
              <User size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>Account</span>
            </AccountLink>
          </li>
        </ul>
      </nav>
      <MobileNav open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
    </>
  );
}

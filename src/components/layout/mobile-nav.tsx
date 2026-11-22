"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Heart, LayoutDashboard, Phone, ShoppingBag, User, X } from "lucide-react";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { mainNav } from "@/config/site";
import { useStore } from "@/lib/store/store-provider";
import { SearchBar } from "@/components/layout/search-bar";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils/cn";
import { useSiteSettings } from "@/lib/settings-provider";
import { categoryHref, categoryImage, navigationCategories, primaryNavigationCategories } from "@/lib/catalogue/departments";
import { CategoryImage } from "@/components/ui/category-image";
import { useBodyScrollLock } from "@/lib/ui/use-body-scroll-lock";
import { AccountLink } from "@/components/layout/account-link";

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const settings = useSiteSettings();
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const { cartCount, wishlist, setCartOpen, setWishlistOpen, isAdmin } = useStore();
  const { categories, products } = useCatalogue();
  const links = [
    ...mainNav.filter((link) => link.href !== "/about"),
    ...primaryNavigationCategories(categories).map((category) => ({ label: category.name, href: categoryHref(category, categories) })),
    ...mainNav.filter((link) => link.href === "/about"),
  ];
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
      className={cn(
        "fixed inset-0 z-[70] lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-ink-900/50 backdrop-blur-[2px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          "absolute inset-y-0 left-0 flex w-[86%] max-w-[360px] flex-col bg-white shadow-menu transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between bg-brand-600 px-5 py-4">
          <div onClick={onClose}><Logo /></div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex size-9 items-center justify-center rounded-full bg-white/15 text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-line p-4">
          <SearchBar onNavigate={onClose} tone="light" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <nav aria-label="Mobile">
            <ul className="space-y-1">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className="group flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-semibold text-ink-800 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    <span className="origin-left transition-transform duration-200 motion-safe:group-hover:scale-105 motion-safe:group-focus-visible:scale-105 motion-reduce:transition-none">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-4 rounded-xl bg-surface">
            <button
              type="button"
              onClick={() => setCategoriesOpen((value) => !value)}
              aria-expanded={categoriesOpen}
              className="flex w-full items-center justify-between px-3 py-3 text-sm font-bold text-ink-800"
            >
              Shop by category
              <ChevronDown
                size={16}
                className={cn("transition-transform", categoriesOpen && "rotate-180")}
              />
            </button>
            {categoriesOpen && (
              <ul className="grid grid-cols-2 gap-2 px-3 pb-3">
                {navigationCategories(categories).map((category) => (
                  <li key={category.id} className="min-w-0">
                    <Link
                      href={categoryHref(category, categories)}
                      onClick={onClose}
                      className="group flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-[12.5px] font-semibold text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
                    >
                      <CategoryImage src={categoryImage(category, categories, products)} size={32} className="size-8 rounded-lg bg-surface transition-transform duration-200 motion-safe:group-hover:scale-110" />
                      <span className="truncate">{category.parentId ? `${categories.find((parent) => parent.id === category.parentId)?.name ?? ""} › ` : ""}{category.name}</span>
                    </Link>
                  </li>
                ))}
                {!navigationCategories(categories).length && <li className="col-span-2 text-xs text-ink-500">No categories are available yet.</li>}
              </ul>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                setWishlistOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-surface py-3 text-sm font-semibold text-ink-700"
            >
              <Heart size={16} /> Wishlist ({wishlist.length})
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                setCartOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white"
            >
              <ShoppingBag size={16} /> Cart ({cartCount})
            </button>
          </div>

          <AccountLink
            onClick={onClose}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-ink-700 ring-1 ring-line"
          >
            <User size={16} /> My Account
          </AccountLink>
          {isAdmin && <Link href="/admin" onClick={onClose} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-50 py-3 text-sm font-semibold text-brand-700"><LayoutDashboard size={16} /> Admin dashboard</Link>}
        </div>

        {settings.phone && settings.phoneHref ? <a
          href={settings.phoneHref}
          className="flex items-center gap-3 border-t border-line px-5 py-4 text-sm font-semibold text-brand-700"
        >
          <span className="inline-flex size-9 items-center justify-center rounded-full bg-brand-50">
            <Phone size={16} />
          </span>
          {settings.phone}
        </a> : null}
      </aside>
    </div>
  );
}

export function MobileCartPreview() {
  const { cartCount, setCartOpen } = useStore();
  return (
    <button
      type="button"
      onClick={() => setCartOpen(true)}
      aria-label={`Open cart, ${cartCount} items`}
      className="relative inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 lg:hidden"
    >
      <ShoppingBag size={20} strokeWidth={1.7} />
      {cartCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold leading-4 text-brand-900">
          {cartCount}
        </span>
      )}
    </button>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open menu"
      className="inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 lg:hidden"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    </button>
  );
}

export function MobileLogo() {
  return <Logo className="lg:hidden" />;
}

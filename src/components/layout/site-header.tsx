"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Heart,
  LayoutDashboard,
  Phone,
  ShoppingBag,
  User,
} from "lucide-react";
import { mainNav, socialPaths } from "@/config/site";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { categoryHref, primaryNavigationCategories } from "@/lib/catalogue/departments";
import { useSiteSettings } from "@/lib/settings-provider";
import { useStore } from "@/lib/store/store-provider";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/layout/logo";
import { SearchBar } from "@/components/layout/search-bar";
import { CategoryMenu } from "@/components/layout/category-menu";
import { RecentlyViewed } from "@/components/layout/recently-viewed";
import { AccountLink } from "@/components/layout/account-link";

function HeaderActions() {
  const { cartCount, wishlist, setCartOpen, setWishlistOpen, isAdmin } = useStore();

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <button
        type="button"
        onClick={() => setWishlistOpen(true)}
        aria-label={`Open wishlist, ${wishlist.length} items`}
        className="relative inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 max-[380px]:hidden"
      >
        <Heart size={20} strokeWidth={1.7} />
        {wishlist.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold leading-4 text-brand-900">
            {wishlist.length}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        aria-label={`Open cart, ${cartCount} items`}
        className="relative inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
      >
        <ShoppingBag size={20} strokeWidth={1.7} />
        {cartCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold leading-4 text-brand-900">
            {cartCount}
          </span>
        )}
      </button>
      <AccountLink
        ariaLabel="My account"
        className="inline-flex size-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
      >
        <User size={20} strokeWidth={1.7} />
      </AccountLink>
      {isAdmin && <Link href="/admin" aria-label="Admin dashboard" title="Admin dashboard" className="hidden size-10 items-center justify-center rounded-full text-accent-400 transition-colors hover:bg-white/10 lg:inline-flex"><LayoutDashboard size={20} strokeWidth={1.8} /></Link>}
    </div>
  );
}

export function SiteHeader() {
  const settings = useSiteSettings();
  const { categories } = useCatalogue();
  const links = [
    ...mainNav.filter((link) => link.href !== "/about"),
    ...primaryNavigationCategories(categories).map((category) => ({ label: category.name, href: categoryHref(category, categories) })),
    ...mainNav.filter((link) => link.href === "/about"),
  ];
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div className="hidden bg-accent-500 md:block">
        <div className="container-page flex h-[42px] items-center justify-between gap-4">
          {settings.phone && settings.phoneHref ? <a
            href={settings.phoneHref}
            className="inline-flex items-center gap-2 whitespace-nowrap text-[12.5px] font-semibold text-brand-900"
          >
            <Phone size={14} strokeWidth={2.2} className="hidden xs:block" />
            Call Us : {settings.phone}
          </a> : <span className="text-xs font-semibold text-brand-900">Niketon Mart</span>}

          {settings.announcement.enabled && settings.announcement.message.trim() ? (
            <p className="hidden min-w-0 flex-1 truncate text-center text-[12.5px] font-semibold text-brand-900 md:block">
              {settings.announcement.message}{" "}
              {settings.announcement.ctaLabel && settings.announcement.ctaHref ? (
                <Link
                  href={settings.announcement.ctaHref}
                  className="whitespace-nowrap underline decoration-brand-900/40 underline-offset-2 hover:decoration-brand-900"
                >
                  {settings.announcement.ctaLabel}
                </Link>
              ) : null}
            </p>
          ) : (
            <span className="hidden flex-1 md:block" aria-hidden="true" />
          )}

          <ul className="flex items-center gap-1.5">
            {settings.socials.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="inline-flex size-6 items-center justify-center rounded-full bg-brand-600/12 text-brand-800 transition-colors hover:bg-brand-600 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="size-3 fill-current">
                    <path d={socialPaths[social.icon as keyof typeof socialPaths]} />
                  </svg>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-40 bg-brand-600 transition-shadow duration-300",
          scrolled && "shadow-[0_12px_30px_-18px_rgba(10,40,28,0.55)]",
        )}
      >
        <div className="container-page">
          <div className="flex h-[72px] items-center justify-center gap-3 md:justify-between lg:gap-6">
            <Logo className="shrink-0 max-[380px]:gap-1.5 max-[380px]:[&>span:last-child]:text-[18px]" />
            <SearchBar className="hidden flex-1 md:block lg:max-w-[620px]" />
            <div className="ml-auto hidden items-center gap-1 lg:flex">
              <HeaderActions />
            </div>
          </div>

          <div className="pb-3 md:hidden">
            <SearchBar />
          </div>

          <nav
            aria-label="Primary"
            className="hidden items-center justify-between gap-2 border-t border-white/10 pb-3 pt-3 lg:flex xl:gap-5"
          >
            <CategoryMenu />
            <ul className="no-scrollbar flex min-w-0 flex-1 items-center justify-start gap-2 overflow-x-auto py-1 xl:justify-center xl:gap-3 2xl:gap-5">
              {links.map((link) => (
                <li key={link.href} className="shrink-0">
                  <Link
                    href={link.href}
                    title={link.label}
                    className="inline-flex max-w-[6rem] rounded-md px-1 py-1 text-[13px] font-semibold text-white/95 transition-[color,transform] duration-200 ease-out hover:text-accent-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-400 motion-safe:hover:scale-105 motion-safe:focus-visible:scale-105 motion-reduce:transition-none xl:max-w-[11rem] xl:text-[14px]"
                  >
                    <span className="truncate">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="shrink-0"><RecentlyViewed /></div>
          </nav>
        </div>
      </header>
    </>
  );
}

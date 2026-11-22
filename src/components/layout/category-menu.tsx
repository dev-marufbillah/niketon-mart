"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Menu } from "lucide-react";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { useSiteSettings } from "@/lib/settings-provider";
import { formatPrice } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import { categoryGroup, categoryGroups, categoryHref, categoryImage, navigationCategories } from "@/lib/catalogue/departments";
import { CategoryImage } from "@/components/ui/category-image";

/** Uses the same live, visibility-filtered catalogue as the home and shop. */
export function CategoryMenu() {
  const settings = useSiteSettings();
  const { categories, products } = useCatalogue();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const available = navigationCategories(categories);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="category-mega-menu"
        className="inline-flex h-11 items-center gap-2.5 rounded-lg bg-accent-500 px-5 text-[14px] font-bold text-brand-900 transition-colors hover:bg-accent-400"
      >
        <Menu size={18} strokeWidth={2.4} /> Browse All Categories
        <ChevronDown size={16} strokeWidth={2.2} className={cn("transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <div id="category-mega-menu" className="absolute left-0 top-[calc(100%+12px)] z-50 max-h-[min(76vh,640px)] w-[min(92vw,960px)] overflow-y-auto rounded-2xl bg-white p-6 shadow-menu ring-1 ring-ink-900/5 xl:p-7">
          <div className="grid gap-7 grid-cols-[minmax(0,1fr)_210px]">
            <div className="grid content-start grid-cols-3 gap-x-5 gap-y-6">
              {categoryGroups.map((group) => {
                const items = available.filter((category) => categoryGroup(category, categories) === group.key);
                if (!items.length) return null;
                return (
                  <div key={group.key}>
                    <p className="mb-3 px-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-400">{group.title}</p>
                    <ul className="space-y-1.5">
                      {items.map((category) => (
                        <li key={category.id}>
                          <Link href={categoryHref(category, categories)} onClick={() => setOpen(false)} className="group flex origin-left items-center justify-between gap-2 rounded-xl px-2 py-2 text-[13px] font-semibold text-ink-700 transition-[color,background-color,transform,box-shadow] duration-200 hover:bg-brand-50 hover:text-brand-700 hover:shadow-sm motion-safe:hover:scale-[1.025] focus-visible:bg-brand-50">
                            <span className="flex min-w-0 items-center gap-2.5"><span className="shrink-0 overflow-hidden rounded-xl bg-surface"><CategoryImage src={categoryImage(category, categories, products)} size={40} className="size-10 rounded-xl transition-transform duration-300 motion-safe:group-hover:scale-110 motion-safe:group-focus-visible:scale-110" /></span><span className="min-w-0 leading-snug">{category.parentId ? `${categories.find((parent) => parent.id === category.parentId)?.name ?? ""} › ` : ""}{category.name}</span></span>
                            <span className="shrink-0 text-[11px] font-medium text-ink-300">{category.productCount ?? 0}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {!available.length && <p className="text-sm text-ink-500">No categories are available yet.</p>}
            </div>
            <Link href="/fresh-market" onClick={() => setOpen(false)} className="group relative flex min-h-[280px] flex-col justify-end overflow-hidden rounded-2xl bg-brand-50 p-5 ring-1 ring-brand-100 transition-shadow hover:shadow-card">
              <Image src="/images/promo-vegetables.png" alt="Fresh vegetables basket" width={260} height={170} className="pointer-events-none absolute -right-5 top-3 w-44 opacity-90 transition-transform duration-500 motion-safe:group-hover:scale-110" />
              <p className="relative text-[11px] font-bold uppercase tracking-wider text-brand-600">Fresh Market</p>
              <p className="relative mt-1 max-w-[130px] text-[15px] font-extrabold leading-tight text-ink-900">Browse fresh groceries</p>
              <span className="relative mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700">Shop now <ArrowRight size={13} /></span>
            </Link>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-ink-500">{settings.freeShippingThreshold > 0 ? `Free delivery on orders over ${formatPrice(settings.freeShippingThreshold)}` : "Delivery charges are shown at checkout"}</p>
            <Link href="/home-grocery" onClick={() => setOpen(false)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-brand-700 hover:text-brand-800">View all products <ArrowRight size={13} /></Link>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock3 } from "lucide-react";
import { useStore } from "@/lib/store/store-provider";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { cn } from "@/lib/utils/cn";
import { catalogueDisplayPrice } from "@/lib/catalogue/display-price";

export function RecentlyViewed() {
  const { recentlyViewed, isHydrated } = useStore();
  const { getProduct } = useCatalogue();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const items = recentlyViewed
    .map((id) => getProduct(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-500 transition-colors hover:text-accent-400"
      >
        Recently Viewed
        <ChevronDown size={16} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+14px)] z-50 w-72 overflow-hidden rounded-2xl bg-white p-3 shadow-menu ring-1 ring-ink-900/5">
          {isHydrated && items.length === 0 ? (
            <div className="px-2 py-6 text-center">
              <Clock3 size={20} className="mx-auto mb-2 text-ink-300" />
              <p className="text-sm font-semibold text-ink-700">Nothing here yet</p>
              <p className="mt-1 text-xs text-ink-400">
                Products you open will show up here.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/product/${product.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface"
                  >
                    <span className="relative size-11 overflow-hidden rounded-lg bg-surface">
                      <Image src={product.image} alt="" fill sizes="44px" className="object-contain p-1" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink-800">
                        {product.name}
                      </span>
                      <span className="text-[11px] text-ink-400">{product.unit}</span>
                    </span>
                    <span className="text-[13px] font-bold text-ink-900">{catalogueDisplayPrice(product).label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

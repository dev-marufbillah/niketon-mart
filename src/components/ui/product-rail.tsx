"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Product } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";
import { ProductCard } from "@/components/ui/product-card";

/**
 * Scroll-snap product rail used by Featured Products & Best Sellers.
 * Arrows are progressive enhancement — touch/trackpad scrolling always works.
 */
export function ProductRail({
  products,
  className,
  label,
  compactDesktop = false,
}: {
  products: Product[];
  className?: string;
  label: string;
  compactDesktop?: boolean;
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [progress, setProgress] = useState({ atStart: true, atEnd: false });

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setProgress({
      atStart: el.scrollLeft < 8,
      atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
    });
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const scrollBy = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: amount * direction, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={trackRef}
        aria-label={label}
        className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2 pt-1"
      >
        {products.map((product) => (
          <li
            key={product.id}
            className={cn("w-[240px] shrink-0 snap-start xs:w-[262px] lg:w-[calc((100%-3.75rem)/4)]", compactDesktop && "xl:w-[calc((100%-5rem)/5)]")}
          >
            <ProductCard product={product} compactDesktop={compactDesktop} />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-center gap-3 lg:justify-end">
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          disabled={progress.atStart}
          aria-label={`Scroll ${label} left`}
          className="inline-flex size-11 items-center justify-center rounded-full bg-white text-ink-700 ring-1 ring-line transition-all hover:bg-brand-600 hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-ink-700"
        >
          <ArrowLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => scrollBy(1)}
          disabled={progress.atEnd}
          aria-label={`Scroll ${label} right`}
          className="inline-flex size-11 items-center justify-center rounded-full bg-brand-600 text-white transition-all hover:bg-brand-700 disabled:opacity-40"
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Product gallery
 * ---------------
 * Main image with previous/next arrows plus a thumbnail strip, matching the
 * reference design. Images come from the product's database gallery; when a
 * variation carries its own image the gallery follows the selected variation.
 */
export function ProductGallery({
  images,
  name,
  imageMode = "contain",
  discount,
  activeImage,
}: {
  images: string[];
  name: string;
  imageMode?: "contain" | "cover";
  discount: number | null;
  /** Variation-driven image; when it changes the gallery jumps to it. */
  activeImage?: string;
}) {
  const gallery = images.length > 0 ? images : ["/images/products/oranges.jpg"];
  const [index, setIndex] = useState(0);

  const activeIndex = activeImage ? gallery.indexOf(activeImage) : -1;
  const currentIndex = activeIndex >= 0 ? activeIndex : index;
  const current = gallery[currentIndex] ?? gallery[0];
  const multiple = gallery.length > 1;
  const step = (delta: number) =>
    setIndex((value) => (value + delta + gallery.length) % gallery.length);

  return (
    <div className="min-w-0 lg:w-full lg:max-w-[480px]">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface-2">
        {discount !== null && (
          <span className="absolute left-4 top-4 z-10 rounded-full bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-wide text-white shadow-sm">
            {discount}% off
          </span>
        )}

        <div className="relative aspect-square w-full lg:aspect-[4/3]">
          <Image
            src={current}
            alt={`${name} — image ${index + 1} of ${gallery.length}`}
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 480px"
            className={cn(imageMode === "cover" ? "object-cover" : "object-contain p-8 sm:p-12 lg:p-7")}
          />
        </div>

        {multiple && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous image"
              className="absolute left-0 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-r-full bg-accent-500 text-brand-900 shadow-sm transition-colors hover:bg-accent-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next image"
              className="absolute right-0 top-1/2 z-10 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-l-full bg-brand-600 text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <ChevronRight size={20} />
            </button>
            <p className="absolute bottom-3 right-4 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-ink-600">
              {index + 1} / {gallery.length}
            </p>
          </>
        )}
      </div>

      {multiple && (
        <ul className="mt-3 grid grid-cols-4 gap-2.5" aria-label="Product images">
          {gallery.map((image, position) => (
            <li key={`${image}-${position}`}>
              <button
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Show image ${position + 1}`}
                aria-current={position === index}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden rounded-xl bg-white ring-1 transition-all",
                  position === index
                    ? "ring-2 ring-brand-600"
                    : "ring-line hover:ring-brand-300",
                )}
              >
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="120px"
                  className={cn(imageMode === "cover" ? "object-cover" : "object-contain p-2")}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

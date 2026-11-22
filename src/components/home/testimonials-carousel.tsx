"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";
import { RatingStars } from "@/components/ui/rating";
import { cn } from "@/lib/utils/cn";

export type TestimonialItem = {
  id: string;
  name: string;
  role: string;
  quote: string;
  rating: number;
  avatar: string;
};

export function TestimonialsCarousel({ items }: { items: TestimonialItem[] }) {
  const [active, setActive] = useState(0);
  const current = items[Math.min(active, items.length - 1)];

  const move = useCallback(
    (direction: 1 | -1) => {
      setActive((index) => (index + direction + items.length) % items.length);
    },
    [items.length],
  );

  if (!current) return null;

  return (
    <div className="relative container-page text-center">
      <ul className="mt-9 flex items-center justify-center gap-2 max-[359px]:gap-1 sm:gap-4">
        {items.map((testimonial, index) => {
          const isActive = index === active;
          return (
            <li key={testimonial.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Read testimonial from ${testimonial.name}`}
                aria-current={isActive}
                className={cn(
                  "relative inline-flex items-center justify-center overflow-hidden rounded-full bg-surface transition-all duration-300",
                  isActive
                    ? "size-[76px] ring-[3px] ring-accent-500 ring-offset-2 max-[359px]:size-14 sm:size-[88px]"
                    : "size-[52px] opacity-85 hover:opacity-100 max-[359px]:size-10 sm:size-[62px]",
                )}
              >
                {testimonial.avatar ? (
                  <Image src={testimonial.avatar} alt="" fill sizes="88px" className="object-cover" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="relative mx-auto mt-8 max-w-3xl sm:mt-10">
        <Quote aria-hidden="true" className="mx-auto mb-2 size-7 text-brand-200" strokeWidth={2} />

        <div key={current.id} className="animate-fade-up">
          <blockquote className="text-[17px] leading-[1.6] text-ink-600 sm:text-[21px] sm:leading-[1.65]">
            {current.quote}
          </blockquote>

          <div className="mt-6 flex items-center justify-center gap-2.5">
            <RatingStars value={current.rating} />
            <span className="text-sm font-bold text-ink-900">{current.rating.toFixed(1)}</span>
          </div>

          <figcaption className="mt-4">
            <p className="text-[15px] font-bold text-ink-900">{current.name}</p>
            <p className="mt-0.5 text-[13px] text-ink-400">{current.role}</p>
          </figcaption>
        </div>

        <div className="mt-7 flex items-center justify-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Previous testimonial"
            className="inline-flex size-11 items-center justify-center rounded-full bg-ink-800 text-white transition-colors hover:bg-ink-900"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Next testimonial"
            className="inline-flex size-11 items-center justify-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="Previous testimonial"
        className="absolute left-4 top-1/2 hidden size-14 -translate-y-1/2 items-center justify-center rounded-full bg-ink-800 text-white transition-all hover:scale-105 hover:bg-ink-900 lg:left-8 lg:inline-flex xl:left-16"
      >
        <ArrowLeft size={20} />
      </button>
      <button
        type="button"
        onClick={() => move(1)}
        aria-label="Next testimonial"
        className="absolute right-4 top-1/2 hidden size-14 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-white transition-all hover:scale-105 hover:bg-brand-700 lg:right-8 lg:inline-flex xl:right-16"
      >
        <ArrowRight size={20} />
      </button>
    </div>
  );
}

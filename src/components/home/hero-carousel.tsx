"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, ShoppingBasket, Truck } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export type HeroSlideContent = {
  id: string;
  badge: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  image: string;
  mobileImage?: string;
  imageAlt?: string;
  imageFit?: "contain" | "cover";
  imagePosition?: "left" | "center" | "right";
  featureOne?: string;
  featureTwo?: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

const fitClass = {
  contain: "object-contain",
  cover: "object-cover",
} as const;

const positionClass = {
  left: "object-left-bottom",
  center: "object-bottom",
  right: "object-right-bottom",
} as const;

function FloatingBadge({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  className: string;
}) {
  if (!label.trim()) return null;
  return (
    <div className={`absolute inline-flex max-w-[75%] items-center gap-2 rounded-full bg-white py-2 pl-2 pr-3 shadow-[0_18px_38px_-22px_rgba(16,24,40,0.45)] ring-1 ring-ink-900/5 ${className}`}>
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
        {icon}
      </span>
      <span className="truncate text-[11px] font-semibold text-ink-800 sm:text-[12.5px]">{label}</span>
    </div>
  );
}

export function HeroCarousel({
  slides,
  autoplay,
  intervalSeconds,
  reviewProof,
}: {
  slides: HeroSlideContent[];
  autoplay: boolean;
  intervalSeconds: number;
  reviewProof: { average: number; total: number };
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const currentIndex = slides.length ? active % slides.length : 0;
  const current = slides[currentIndex];

  useEffect(() => {
    if (!autoplay || paused || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const timer = window.setInterval(
      () => setActive((index) => (index + 1) % slides.length),
      intervalSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [autoplay, intervalSeconds, paused, slides.length]);

  if (!current) return null;

  const move = (direction: -1 | 1) => {
    setActive((index) => (index + direction + slides.length) % slides.length);
  };
  const fit = fitClass[current.imageFit === "cover" ? "cover" : "contain"];
  const position = positionClass[current.imagePosition === "left" || current.imagePosition === "right" ? current.imagePosition : "center"];
  const imageClass = `${fit} ${position} drop-shadow-[0_30px_40px_rgba(16,24,40,0.08)]`;

  return (
    <section
      id="top"
      aria-label="Homepage hero"
      aria-roledescription={slides.length > 1 ? "carousel" : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
      className="grocery-pattern relative overflow-hidden bg-surface pb-0"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_75%_15%,rgba(255,255,255,0.9)_0%,rgba(245,245,245,0)_55%)]"
      />
      <div className="container-page relative grid items-center gap-8 pb-7 pt-8 sm:gap-10 sm:pb-10 sm:pt-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-4 lg:pb-0 lg:pt-14">
        <div key={current.id} className="relative z-10 order-2 max-w-[560px] animate-fade-up md:order-1 lg:pb-16">
          {current.badge ? (
            <span className="inline-flex items-center gap-2.5 rounded-full bg-white py-2 pl-2 pr-5 shadow-[0_10px_28px_-18px_rgba(16,24,40,0.4)] ring-1 ring-ink-900/5">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                <ShoppingBasket size={17} strokeWidth={2} />
              </span>
              <span className="text-[13.5px] font-semibold text-ink-800">{current.badge}</span>
            </span>
          ) : null}

          <h1 id="hero-title" className="mt-5 text-[32px] leading-[1.1] tracking-[-0.03em] sm:text-[44px] lg:text-[52px]">
            {current.title}{" "}
            {current.titleAccent ? <span className="text-brand-600">{current.titleAccent}</span> : null}
          </h1>

          {current.subtitle ? (
            <p className="mt-5 max-w-[420px] text-[14.5px] leading-relaxed text-ink-500">{current.subtitle}</p>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
            {current.primaryLabel ? (
              <ButtonLink
                href={current.primaryHref || "/home-grocery"}
                size="lg"
                className="min-w-[150px]"
                iconRight={<ArrowRight size={17} />}
              >
                {current.primaryLabel}
              </ButtonLink>
            ) : null}
            {current.secondaryLabel ? (
              <Link
                href={current.secondaryHref || "/home-grocery"}
                className="text-[14.5px] font-semibold text-ink-800 underline decoration-ink-300 decoration-2 underline-offset-[6px] transition-colors hover:text-brand-600 hover:decoration-brand-500"
              >
                {current.secondaryLabel}
              </Link>
            ) : null}
          </div>

          {reviewProof.total > 0 ? (
            <div className="mt-9">
              <p className="text-[15px] font-extrabold leading-tight text-ink-900">{reviewProof.average.toFixed(1)} / 5 customer rating</p>
              <p className="text-[12.5px] text-ink-500">Based on {reviewProof.total} approved review{reviewProof.total === 1 ? "" : "s"}</p>
            </div>
          ) : null}
        </div>

        <div className="relative order-1 mx-auto w-full max-w-[560px] md:order-2 lg:max-w-none">
          <div className="relative aspect-[1.05/1] w-full sm:aspect-[1.35/1] lg:aspect-[0.98/1] lg:-mb-2">
            {current.mobileImage ? (
              <Image
                src={current.mobileImage}
                alt={current.imageAlt ?? ""}
                fill
                priority={active === 0}
                sizes="(max-width: 767px) 92vw, 1px"
                className={`md:hidden ${imageClass}`}
              />
            ) : null}
            <Image
              src={current.image}
              alt={current.imageAlt ?? ""}
              fill
              priority={active === 0}
              sizes={current.mobileImage ? "(min-width: 768px) 640px, 1px" : "(max-width: 1024px) 92vw, 640px"}
              className={`${current.mobileImage ? "hidden md:block" : ""} ${imageClass}`}
            />
            <FloatingBadge
              icon={<ShieldCheck size={16} />}
              label={current.featureOne ?? ""}
              className="right-1 top-[35%] sm:right-2 sm:top-[30%] lg:-right-2 lg:top-[27%]"
            />
            <FloatingBadge
              icon={<Truck size={16} />}
              label={current.featureTwo ?? ""}
              className="bottom-[18%] left-0 sm:bottom-[24%] sm:left-4 lg:-left-4 lg:bottom-[24%]"
            />
          </div>
        </div>

        {slides.length > 1 ? (
          <div className="order-3 col-span-full flex items-center justify-center gap-3 lg:-mt-3 lg:pb-4">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label="Previous hero slide"
              className="inline-flex size-10 items-center justify-center rounded-full bg-white text-ink-800 shadow-sm ring-1 ring-line transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2" role="group" aria-label="Choose hero slide">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Go to slide ${index + 1}`}
                  aria-current={index === currentIndex ? "true" : undefined}
                  className={`h-2.5 rounded-full transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${index === currentIndex ? "w-7 bg-brand-600" : "w-2.5 bg-ink-300 hover:bg-brand-300"}`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label="Next hero slide"
              className="inline-flex size-10 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <ArrowRight size={18} />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { paginationItems } from "@/lib/catalogue/query";

/**
 * Numbered pagination with prev/next and ellipses.
 * Two modes, one component:
 *  - `onChange`    — the shop pages a client-side list;
 *  - `hrefPattern` — server pages (blog) link to real URLs so every page is
 *    shareable. The pattern is a plain string (a function cannot cross the
 *    server → client boundary) with `{page}` replaced per link.
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  hrefPattern,
  label = "Pagination",
  className,
}: {
  page: number;
  totalPages: number;
  onChange?: (page: number) => void;
  hrefPattern?: string;
  label?: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  const items = paginationItems(page, totalPages);
  const hrefFor = hrefPattern ? (target: number) => hrefPattern.replace("{page}", String(target)) : null;

  const base =
    "inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[13px] font-semibold transition-all";
  const idle = "bg-white text-ink-600 ring-1 ring-line hover:bg-brand-50 hover:text-brand-700";
  const active = "bg-brand-600 text-white shadow-cta";
  const disabled = "cursor-not-allowed bg-white text-ink-300 ring-1 ring-line";

  const step = (target: number, content: React.ReactNode, aria: string, disabledState: boolean, extra: string) =>
    hrefFor ? (
      disabledState ? (
        <span aria-disabled="true" aria-label={aria} className={cn(base, disabled, extra)}>
          {content}
        </span>
      ) : (
        <Link href={hrefFor(target)} aria-label={aria} className={cn(base, idle, extra)}>
          {content}
        </Link>
      )
    ) : (
      <button
        type="button"
        onClick={() => onChange?.(target)}
        disabled={disabledState}
        aria-label={aria}
        className={cn(base, disabledState ? disabled : idle, extra)}
      >
        {content}
      </button>
    );

  const number = (target: number) => {
    const current = target === page;
    const content = <span className="tabular-nums">{target}</span>;
    return hrefFor ? (
      <Link
        key={`page-${target}`}
        href={hrefFor(target)}
        aria-label={`Page ${target}`}
        aria-current={current ? "page" : undefined}
        className={cn(base, current ? active : idle, "tabular-nums")}
      >
        {content}
      </Link>
    ) : (
      <button
        key={`page-${target}`}
        type="button"
        onClick={() => onChange?.(target)}
        aria-label={`Page ${target}`}
        aria-current={current ? "page" : undefined}
        className={cn(base, current ? active : idle, "tabular-nums")}
      >
        {content}
      </button>
    );
  };

  return (
    <nav aria-label={label} className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {step(
        page - 1,
        <>
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">Previous</span>
        </>,
        "Previous page",
        page <= 1,
        "gap-1 pl-2.5",
      )}

      {items.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            aria-hidden="true"
            className="inline-flex h-10 min-w-10 items-center justify-center text-ink-400"
          >
            …
          </span>
        ) : (
          number(item)
        ),
      )}

      {step(
        page + 1,
        <>
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={16} />
        </>,
        "Next page",
        page >= totalPages,
        "gap-1 pr-2.5",
      )}
    </nav>
  );
}

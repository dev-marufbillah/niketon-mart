import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Compact page banner for the shop.
 * Soft surface + the brand's grocery doodle pattern, a centred title and the
 * breadcrumb directly beneath it — mirrors the reference without adding weight.
 */
export function ShopHero({
  title = "Shop",
  current = "Home Grocery",
  parent = { label: "Home", href: "/" },
  subtitle,
}: {
  title?: string;
  current?: string;
  parent?: { label: string; href: string };
  subtitle?: string;
}) {
  return (
    <section
      aria-label={`${current} page header`}
      className="grocery-pattern relative overflow-hidden border-b border-line bg-surface-2"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/70 via-white/40 to-white/80"
      />
      <div className="container-page relative py-9 text-center sm:py-11 lg:py-12">
        <h1 className="text-[28px] leading-tight sm:text-[34px] lg:text-[38px]">{title}</h1>
        <nav
          aria-label="Breadcrumb"
          className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-[12.5px] text-ink-500"
        >
          <Link href={parent.href} className="transition-colors hover:text-brand-700">
            {parent.label}
          </Link>
          <ChevronRight size={13} className="text-ink-300" aria-hidden="true" />
          <span className="font-semibold text-ink-700" aria-current="page">
            {current}
          </span>
        </nav>
        {subtitle && (
          <p className="mx-auto mt-3 max-w-lg text-[13.5px] leading-relaxed text-ink-500">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { useSiteSettings } from "@/lib/settings-provider";

/** Basket mark used in the header, footer and marketing banners. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-9 items-center justify-center rounded-full bg-accent-500 text-brand-800",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-5" strokeWidth={1.9} stroke="currentColor">
        <path
          d="M5.6 9h12.8l-1.1 8.2a2.4 2.4 0 0 1-2.38 2.1H9.08a2.4 2.4 0 0 1-2.38-2.1L5.6 9Z"
          strokeLinejoin="round"
        />
        <path d="M9.2 9c0-2.1 1.25-3.6 2.8-3.6S14.8 6.9 14.8 9" strokeLinecap="round" />
        <path d="M9.6 12.4v3.2M14.4 12.4v3.2" strokeLinecap="round" opacity=".55" />
      </svg>
    </span>
  );
}

export function Logo({
  tone = "light",
  className,
  href = "/",
}: {
  tone?: "light" | "dark";
  className?: string;
  href?: string;
}) {
  const { name } = useSiteSettings();
  return (
    <Link
      href={href}
      aria-label={`${name} — home`}
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <LogoMark className="transition-transform duration-300 group-hover:-rotate-6" />
      <span
        className={cn(
          "text-[22px] font-extrabold tracking-tight",
          tone === "light" ? "text-white" : "text-ink-900",
        )}
      >
        {name}
        <span className="text-accent-500">.</span>
      </span>
    </Link>
  );
}

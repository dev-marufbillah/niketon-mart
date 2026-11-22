import Link from "next/link";
import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "accent" | "outline" | "ghost" | "soft";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap " +
  "transition-[background-color,color,box-shadow,transform] duration-200 " +
  "disabled:pointer-events-none disabled:opacity-50 active:translate-y-px select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-cta hover:bg-brand-700 focus-visible:bg-brand-700",
  accent:
    "bg-accent-500 text-brand-900 hover:bg-accent-400 shadow-[0_12px_24px_-14px_rgba(248,197,25,0.9)]",
  outline:
    "border border-brand-600/25 bg-white text-brand-700 hover:border-brand-600 hover:bg-brand-50",
  ghost: "text-ink-700 hover:bg-ink-900/5",
  soft: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[13px] rounded-full",
  md: "h-11 px-6 text-sm rounded-full",
  lg: "h-[52px] px-8 text-[15px] rounded-full",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
  iconRight?: ReactNode;
  iconLeft?: ReactNode;
  fullWidth?: boolean;
};

export const Button = forwardRef<
  HTMLButtonElement,
  CommonProps & ComponentPropsWithoutRef<"button">
>(function Button(
  { variant = "primary", size = "md", className, children, iconRight, iconLeft, fullWidth, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  iconRight,
  iconLeft,
  fullWidth,
  prefetch,
  ...props
}: CommonProps & { href: string; prefetch?: boolean } & Omit<
    ComponentPropsWithoutRef<typeof Link>,
    "href" | "className" | "children"
  >) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...props}
    >
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  );
}

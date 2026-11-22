import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils/cn";

export const IconButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> & { tone?: "light" | "dark" | "brand"; label: string }
>(function IconButton({ className, tone = "light", label, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 items-center justify-center rounded-full transition-colors duration-200",
        tone === "light" && "bg-white text-ink-700 shadow-sm ring-1 ring-ink-900/5 hover:bg-brand-50 hover:text-brand-700",
        tone === "dark" && "bg-ink-900 text-white hover:bg-ink-800",
        tone === "brand" && "bg-brand-600 text-white hover:bg-brand-700",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

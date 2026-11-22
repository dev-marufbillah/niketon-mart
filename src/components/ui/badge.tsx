import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Tone = "green" | "yellow" | "soft" | "neutral" | "white";

const tones: Record<Tone, string> = {
  green: "bg-brand-600 text-white",
  yellow: "bg-accent-500 text-brand-900",
  soft: "bg-brand-50 text-brand-700",
  neutral: "bg-surface text-ink-600",
  white: "bg-white text-ink-800 shadow-sm",
};

export function Badge({
  children,
  tone = "green",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

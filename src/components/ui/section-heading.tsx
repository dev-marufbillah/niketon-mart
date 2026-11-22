import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared section header: small eyebrow label, two-tone title
 * (the second phrase is brand green) and an optional trailing action.
 */
export function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
  action,
  align = "left",
  className,
  titleAs: Title = "h2",
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  description?: string;
  action?: ReactNode;
  align?: "left" | "center";
  className?: string;
  titleAs?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between",
        align === "center" && "sm:flex-col sm:items-center sm:text-center",
        className,
      )}
    >
      <div className={cn("max-w-xl", align === "center" && "mx-auto")}>
        {eyebrow && (
          <p className="mb-2 text-sm font-semibold tracking-wide text-ink-500">
            {eyebrow}
          </p>
        )}
        <Title className="text-[26px] leading-[1.15] sm:text-[32px] lg:text-[38px]">
          {title}
          {accent && <span className="text-brand-600"> {accent}</span>}
        </Title>
        {description && (
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-500">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

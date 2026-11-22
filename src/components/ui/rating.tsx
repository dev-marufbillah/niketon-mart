import { Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Rating({
  value,
  count,
  size = "sm",
  className,
  showValue = true,
}: {
  value: number;
  count?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
  showValue?: boolean;
}) {
  const star = size === "md" ? 18 : size === "sm" ? 16 : 14;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Star
        size={star}
        strokeWidth={1.5}
        className="fill-star text-star"
        aria-hidden="true"
      />
      {showValue && (
        <span
          className={cn(
            "font-semibold text-ink-800 tabular-nums",
            size === "md" ? "text-base" : "text-sm",
          )}
        >
          {value.toFixed(1)}
        </span>
      )}
      {typeof count === "number" && (
        <span className="text-xs text-ink-400">({count})</span>
      )}
    </span>
  );
}

export function RatingStars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)} aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={20}
          strokeWidth={1.5}
          className={index < Math.round(value) ? "fill-star text-star" : "fill-ink-200 text-ink-200"}
        />
      ))}
    </span>
  );
}

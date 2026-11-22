import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";

export function Price({
  price,
  compareAtPrice,
  size = "md",
  className,
  inverse = false,
}: {
  price: number;
  compareAtPrice?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      <span
        className={cn(
          "font-bold tabular-nums",
          inverse ? "text-white" : "text-ink-900",
          size === "lg" ? "text-xl" : size === "md" ? "text-[17px]" : "text-sm",
        )}
      >
        {formatPrice(price)}
      </span>
      {compareAtPrice && compareAtPrice > price && (
        <span
          className={cn(
            "text-sm line-through tabular-nums",
            inverse ? "text-white/60" : "text-ink-400",
          )}
        >
          {formatPrice(compareAtPrice)}
        </span>
      )}
    </span>
  );
}

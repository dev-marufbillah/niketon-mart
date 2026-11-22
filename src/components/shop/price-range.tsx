"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";

/**
 * Dual-thumb price filter.
 *
 * Both ranges are real `<input type="range">` controls (keyboard accessible) and
 * are clamped against each other so min can never pass max. The value is only
 * committed on pointer-up / key-up so dragging doesn't thrash the listing.
 */
export function PriceRange({
  min,
  max,
  step,
  value,
  onChange,
}: {
  min: number;
  max: number;
  /** Committed bounds; undefined means the full range. */
  value: { min?: number; max?: number };
  step?: number;
  onChange: (next: { min?: number; max?: number }) => void;
}) {
  const lower = value.min ?? min;
  const upper = value.max ?? max;
  const [draft, setDraft] = useState({ lower, upper });

  useEffect(() => {
    const timer = window.setTimeout(() => setDraft({ lower, upper }), 0);
    return () => window.clearTimeout(timer);
  }, [lower, upper]);

  const span = Math.max(1, max - min);
  const leftPct = ((draft.lower - min) / span) * 100;
  const rightPct = ((draft.upper - min) / span) * 100;
  const stepValue = step ?? Math.max(1, Math.round((max - min) / 50));

  const commit = () => {
    onChange({
      min: draft.lower > min ? draft.lower : undefined,
      max: draft.upper < max ? draft.upper : undefined,
    });
  };

  return (
    <div>
      <p className="mb-3 text-[13px] font-semibold text-ink-700">
        {formatPrice(draft.lower)} - {formatPrice(draft.upper)}
      </p>

      <div className="relative mb-4 h-5">
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
        <span
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-600"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={stepValue}
          value={draft.lower}
          aria-label="Minimum price"
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), draft.upper);
            setDraft((current) => ({ ...current, lower: next }));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className={cn("range-input range-input-thumb")}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={stepValue}
          value={draft.upper}
          aria-label="Maximum price"
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), draft.lower);
            setDraft((current) => ({ ...current, upper: next }));
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className={cn("range-input range-input-thumb")}
        />
      </div>
    </div>
  );
}

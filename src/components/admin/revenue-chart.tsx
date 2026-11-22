"use client";

import { useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { formatPrice } from "@/lib/utils/currency";

type Point = { date: string; orders: number; revenue: number };

/**
 * Lightweight revenue chart (no chart library).
 * A single accent line over a subtle grid — matches the admin's brand colours
 * and keeps the bundle small.
 */
export function RevenueChart({ series }: { series: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...series.map((point) => point.revenue));
  const width = 100;
  const height = 40;
  const step = series.length > 1 ? width / (series.length - 1) : width;

  const points = series.map((point, index) => ({
    x: index * step,
    y: height - (point.revenue / max) * (height - 6) - 2,
    ...point,
  }));

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const current = active !== null ? points[active] : null;

  if (series.every((point) => point.revenue === 0)) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl bg-[#f7faf8] px-5 text-center">
        <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-[#e9f3ec] text-[#76a286]"><ChartNoAxesCombined size={19} aria-hidden="true" /></span>
        <p className="text-[12.5px] font-bold text-[#4e6b58]">No order value to show yet</p>
        <p className="mt-1 max-w-[270px] text-[11.5px] leading-relaxed text-[#617768]">Daily order values will be plotted here as orders come in.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-[150px] w-full"
          role="img"
          aria-label={`Order value for the last ${series.length} days, highest day ${formatPrice(max)}. Includes unpaid orders.`}
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1B8057" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1B8057" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={width}
              y1={height * ratio}
              y2={height * ratio}
              stroke="#ECECEC"
              strokeWidth="0.4"
            />
          ))}
          <path d={area} fill="url(#revenue-fill)" />
          <path d={line} fill="none" stroke="#1B8057" strokeWidth="0.9" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((point, index) => (
            <g key={point.date}>
              <circle
                cx={point.x}
                cy={point.y}
                r={active === index ? 1.8 : 1}
                fill="#fff"
                stroke="#1B8057"
                strokeWidth="0.7"
              />
              <rect
                x={point.x - step / 2}
                y="0"
                width={step}
                height={height}
                fill="transparent"
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                tabIndex={0}
                aria-label={`${point.date}: ${point.orders} orders, ${formatPrice(point.revenue)}`}
              />
            </g>
          ))}
        </svg>
        {current ? (
          <div className="pointer-events-none absolute -top-1 right-0 rounded-lg bg-ink-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg">
            <span className="font-bold">{formatPrice(current.revenue)}</span> · {current.orders} orders ·{" "}
            {current.date.slice(5)}
          </div>
        ) : null}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-ink-400">
        <span>{series[0]?.date.slice(5)}</span>
        <span>{series[Math.floor(series.length / 2)]?.date.slice(5)}</span>
        <span>{series[series.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

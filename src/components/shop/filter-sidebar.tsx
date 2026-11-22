"use client";

import { useId, type ReactNode } from "react";
import { Star } from "lucide-react";
import type { ShopFacets, ShopQuery } from "@/lib/catalogue/types";
import { countActiveFilters, toggleCategoryFilter } from "@/lib/catalogue/query";
import { cn } from "@/lib/utils/cn";
import { PriceRange } from "@/components/shop/price-range";

type Option = { value: string; label: string; count: number; parentId?: string };

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="border-t border-line pt-5 first:border-t-0 first:pt-0"
    >
      <p id={id} className="mb-3 text-[14px] font-extrabold text-ink-900">
        {title}
      </p>
      {children}
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  count,
  id,
  indented = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  count?: number;
  id: string;
  indented?: boolean;
}) {
  const empty = count === 0;
  return (
    <label
      htmlFor={id}
      className={cn(
        "group flex cursor-pointer items-center gap-2.5 py-[5px] text-[13px] leading-snug transition-colors hover:text-ink-900",
        empty ? "text-ink-400" : "text-ink-600",
        indented && "pl-4",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 cursor-pointer rounded-[4px] border-ink-300 text-brand-600 accent-brand-600"
      />
      <span className="min-w-0 flex-1 break-words">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-400">{count}</span>
      )}
    </label>
  );
}

function OptionList({
  options,
  selected,
  onToggle,
  idPrefix,
}: {
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  idPrefix: string;
}) {
  if (options.length === 0) {
    return <p className="text-[12.5px] text-ink-400">Nothing available yet.</p>;
  }
  return (
    <div className="space-y-0.5">
      {options.map((option) => (
        <CheckRow
          key={option.value}
          id={`${idPrefix}-${option.value}`}
          checked={selected.includes(option.value)}
          onChange={() => onToggle(option.value)}
          label={option.label}
          count={option.count}
          indented={Boolean(option.parentId)}
        />
      ))}
    </div>
  );
}

/**
 * The shop's filter panel.
 *
 * Rendered in the sticky desktop column and inside the mobile drawer — same
 * instance logic, same URL-backed state. Every control maps to a real product
 * field: category, price, rating, brand, product type and stock.
 */
export function FilterSidebar({
  facets,
  query,
  onChange,
  onClear,
  className,
  idPrefix = "filters",
}: {
  facets: ShopFacets;
  query: ShopQuery;
  onChange: (next: ShopQuery) => void;
  onClear: () => void;
  className?: string;
  idPrefix?: string;
}) {
  const activeCount = countActiveFilters(query, facets.price);

  const update = (patch: Partial<ShopQuery>) => onChange({ ...query, ...patch, page: 1 });

  const toggle = <T,>(values: T[], value: T): T[] =>
    values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

  return (
    <div className={cn("text-left", className)}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold text-ink-900">Filter Options</h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[12px] font-semibold text-brand-700 underline underline-offset-2 transition-colors hover:text-brand-800"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-5">
        <FilterGroup title="Category">
          <OptionList
            idPrefix={`${idPrefix}-category`}
            options={facets.categories}
            selected={query.categories}
            onToggle={(value) =>
              update({ categories: toggleCategoryFilter(query.categories, value, facets.categories) })
            }
          />
        </FilterGroup>

        <FilterGroup title="Price">
          <PriceRange
            min={facets.price.min}
            max={facets.price.max}
            value={{ min: query.min, max: query.max }}
            onChange={(next) => update(next)}
          />
        </FilterGroup>

        <FilterGroup title="Review">
          <div className="space-y-0.5">
            {facets.ratings.map((rating) => (
              <CheckRow
                key={rating.value}
                id={`${idPrefix}-rating-${rating.value}`}
                checked={query.ratings.includes(rating.value)}
                onChange={() => update({ ratings: toggle(query.ratings, rating.value) })}
                count={rating.count}
                label={
                  <span className="flex items-center gap-1.5">
                    <span className="flex items-center gap-0.5" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          size={13}
                          strokeWidth={1.4}
                          className={
                            index < rating.value
                              ? "fill-star text-star"
                              : "fill-ink-200 text-ink-200"
                          }
                        />
                      ))}
                    </span>
                    {rating.value} Star
                  </span>
                }
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Brand">
          <OptionList
            idPrefix={`${idPrefix}-brand`}
            options={facets.brands}
            selected={query.brands}
            onToggle={(value) => update({ brands: toggle(query.brands, value) })}
          />
        </FilterGroup>

        <FilterGroup title="Product Type">
          <OptionList
            idPrefix={`${idPrefix}-type`}
            options={facets.productTypes}
            selected={query.types}
            onToggle={(value) => update({ types: toggle(query.types, value) })}
          />
        </FilterGroup>

        <FilterGroup title="Availability">
          <div className="space-y-0.5">
            <CheckRow
              id={`${idPrefix}-stock-in`}
              checked={query.stock.includes("in")}
              onChange={() => update({ stock: toggle(query.stock, "in") })}
              label="In Stock"
              count={facets.stock.in}
            />
            <CheckRow
              id={`${idPrefix}-stock-out`}
              checked={query.stock.includes("out")}
              onChange={() => update({ stock: toggle(query.stock, "out") })}
              label="Out of Stock"
              count={facets.stock.out}
            />
          </div>
        </FilterGroup>
      </div>
    </div>
  );
}

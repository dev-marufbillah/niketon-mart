"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, PackageSearch, SlidersHorizontal, X } from "lucide-react";
import type { Product } from "@/lib/types/domain";
import type { ShopFacets, ShopQuery } from "@/lib/catalogue/types";
import {
  applyShopFilters,
  buildChips,
  countActiveFilters,
  parseShopQuery,
  perPageOptions,
  removeChip,
  shopHref,
  sortOptions,
  sortProducts,
  paginate,
} from "@/lib/catalogue/query";
import { cn } from "@/lib/utils/cn";
import { ProductCard } from "@/components/ui/product-card";
import { Button } from "@/components/ui/button";
import { FilterSidebar } from "@/components/shop/filter-sidebar";
import { CategoryExplore } from "@/components/shop/category-explore";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { filterFamilyForSelection } from "@/lib/catalogue/departments";
import { Pagination } from "@/components/shop/pagination";
import { useBodyScrollLock } from "@/lib/ui/use-body-scroll-lock";
import { markShopFilterNavigation } from "@/lib/ui/navigation-events";

type SearchParamsInput = Record<string, string | string[] | undefined>;

export function ShopBrowser({
  products,
  facets,
  initialSearchParams,
  basePath = "/home-grocery",
  categoryScopeId,
}: {
  products: Product[];
  facets: ShopFacets;
  initialSearchParams: SearchParamsInput;
  basePath?: string;
  /** Validated on the server against this department's public catalogue. */
  categoryScopeId?: string;
}) {
  const { categories: catalogueCategories } = useCatalogue();
  const [query, setQuery] = useState<ShopQuery>(() =>
    parseShopQuery(initialSearchParams, facets.price),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isUpdating, setUpdating] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(128);
  const resultsRef = useRef<HTMLDivElement>(null);
  const lastSyncedQuery = useRef(query);

  /* ---- track the sticky header so sticky panels sit directly beneath it ---- */
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("header.sticky");
    if (!header) return;
    const sync = () => setHeaderHeight(header.getBoundingClientRect().height);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  /* ---- URL sync (shareable, refresh-safe, back/forward aware) ---- */
  useEffect(() => {
    // The URL already describes the initial render and history traversals.
    // Comparing the state identity also avoids an unwanted first rewrite when
    // React Strict Mode replays effects in development.
    if (lastSyncedQuery.current === query) return;
    lastSyncedQuery.current = query;
    const href = shopHref(query, basePath, categoryScopeId);
    markShopFilterNavigation(href);
    window.history.replaceState({ ...window.history.state }, "", href);
    setUpdating(true);
    const timer = window.setTimeout(() => setUpdating(false), 260);
    return () => window.clearTimeout(timer);
  }, [query, basePath, categoryScopeId]);

  useEffect(() => {
    const onPop = () => {
      const params = Object.fromEntries(new URLSearchParams(window.location.search));
      const restored = parseShopQuery(params, facets.price);
      lastSyncedQuery.current = restored;
      setQuery(restored);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [facets.price]);

  /* Coordinate the filter sheet with the shared menu/cart/wishlist locks. */
  useBodyScrollLock(drawerOpen);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const filtered = useMemo(
    () => sortProducts(applyShopFilters(products, query, facets.categories, facets.brands), query.sort),
    [products, query, facets.categories, facets.brands],
  );
  const result = useMemo(
    () => paginate(filtered, query.page, query.perPage),
    [filtered, query.page, query.perPage],
  );
  const chips = useMemo(() => buildChips(query, facets, facets.price), [query, facets]);
  // For the admin-featured family (e.g. Dates), its child categories are in
  // the actual filter controls, not a second row of decorative category cards.
  const hideFamilyCards = Boolean(categoryScopeId || filterFamilyForSelection(catalogueCategories, query.categories));
  const activeCount = countActiveFilters(query, facets.price);
  const categoryIsEmpty = query.categories.length === 1 && facets.categories.some((facet) => facet.value === query.categories[0]) &&
    applyShopFilters(products, { ...query, brands: [], types: [], ratings: [], stock: [], min: undefined, max: undefined, q: undefined }, facets.categories, facets.brands).length === 0;

  const apply = (next: ShopQuery) => setQuery(next);

  const clearAll = () =>
    setQuery({
      categories: [],
      brands: [],
      types: [],
      ratings: [],
      stock: [],
      sort: query.sort,
      page: 1,
      perPage: query.perPage,
    });

  const goToPage = (page: number) => {
    const clamped = Math.min(Math.max(1, page), result.totalPages);
    setQuery({ ...query, page: clamped });
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Distinct ids: the same control is rendered twice (mobile toolbar + desktop bar).
  const mobileSortId = "shop-sort-mobile";
  const desktopSortId = "shop-sort-desktop";
  const perById = "shop-per-page";

  return (
    <div className="bg-white pb-16 pt-8 lg:pb-20">
      <div className="container-page">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-10 xl:gap-12">
          {/* ---------------- desktop sidebar ---------------- */}
          <aside
            aria-label="Product filters"
            className="hidden min-w-0 lg:block lg:self-start lg:pt-1"
          >
            <div className="sticky overflow-y-auto pr-2" style={{ top: Math.round(headerHeight) + 20, maxHeight: `calc(100vh - ${Math.round(headerHeight) + 40}px)` }}>
              <FilterSidebar facets={facets} query={query} onChange={apply} onClear={clearAll} />
            </div>
          </aside>

          {/* ---------------- results ---------------- */}
          <div className="min-w-0">
            {!hideFamilyCards && <CategoryExplore query={query} basePath={basePath} availableProducts={products} facets={facets} />}
            {/* sticky mobile toolbar */}
            <div
              style={{ top: Math.round(headerHeight) }}
              className="sticky z-30 -mx-4 mb-1 flex items-center gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mb-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDrawerOpen(true)}
                iconLeft={<SlidersHorizontal size={15} />}
                className="lg:hidden"
              >
                Filters
                {activeCount > 0 && (
                  <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                    {activeCount}
                  </span>
                )}
              </Button>

              <label htmlFor={mobileSortId} className="sr-only">
                Sort products
              </label>
              <div className="relative ml-auto lg:hidden">
                <select
                  id={mobileSortId}
                  value={query.sort}
                  onChange={(event) =>
                    apply({ ...query, sort: event.target.value as ShopQuery["sort"], page: 1 })
                  }
                  className="h-9 appearance-none rounded-full border border-line bg-white pl-3.5 pr-8 text-[12.5px] font-semibold text-ink-700 focus:border-brand-500 focus:outline-none"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={15}
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500"
                />
              </div>
            </div>

            {/* desktop toolbar */}
            <div className="hidden flex-wrap items-center justify-between gap-4 pb-4 lg:flex">
              <p
                className="text-[13px] font-medium text-ink-500"
                aria-live="polite"
                aria-atomic="true"
              >
                Showing{" "}
                <span className="font-bold text-ink-800 tabular-nums">
                  {result.from}-{result.to}
                </span>{" "}
                of <span className="font-bold text-ink-800 tabular-nums">{result.total}</span>{" "}
                results
                {query.q && (
                  <span className="ml-1 text-ink-400">for “{query.q}”</span>
                )}
              </p>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor={perById} className="text-[13px] text-ink-500">
                    Show :
                  </label>
                  <div className="relative">
                    <select
                      id={perById}
                      value={query.perPage}
                      onChange={(event) =>
                        apply({ ...query, perPage: Number(event.target.value), page: 1 })
                      }
                      className="h-10 appearance-none rounded-full border border-line bg-white pl-3.5 pr-8 text-[13px] font-medium text-ink-700 focus:border-brand-500 focus:outline-none"
                    >
                      {perPageOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor={desktopSortId} className="text-[13px] text-ink-500">
                    Sort by :
                  </label>
                  <div className="relative">
                    <select
                      id={desktopSortId}
                      value={query.sort}
                      onChange={(event) =>
                        apply({ ...query, sort: event.target.value as ShopQuery["sort"], page: 1 })
                      }
                      className="h-10 min-w-[176px] appearance-none rounded-full border border-line bg-white pl-4 pr-9 text-[13px] font-medium text-ink-700 focus:border-brand-500 focus:outline-none"
                    >
                      {sortOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* active filters */}
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 pb-4 transition-opacity",
                chips.length === 0 && "hidden",
              )}
            >
              <span className="text-[13px] font-semibold text-ink-700">Active Filter</span>
              {chips.map((chip) => (
                <button
                  key={`${chip.key}-${chip.value}`}
                  type="button"
                  onClick={() => apply(removeChip(query, chip))}
                  aria-label={`Remove filter ${chip.label}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent-500 py-1.5 pl-3.5 pr-2.5 text-[12.5px] font-semibold text-ink-900 transition-colors hover:bg-accent-400"
                >
                  {chip.label}
                  <X size={13} strokeWidth={2.4} className="opacity-70" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="ml-1 text-[12.5px] font-semibold text-brand-700 underline underline-offset-2 transition-colors hover:text-brand-800"
              >
                Clear All
              </button>
            </div>

            <p className="pb-4 text-[13px] text-ink-500 lg:hidden" aria-live="polite">
              Showing <span className="font-bold text-ink-800">{result.from}-{result.to}</span> of{" "}
              <span className="font-bold text-ink-800">{result.total}</span> results
            </p>

            {/* grid */}
            <div ref={resultsRef} className="relative scroll-mt-28" aria-busy={isUpdating}>
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -top-1 left-0 right-0 h-[2px] overflow-hidden rounded-full transition-opacity duration-200",
                  isUpdating ? "opacity-100" : "opacity-0",
                )}
              >
                <span className="block h-full w-1/3 animate-[fade-up_0.9s_ease-in-out_infinite_alternate] rounded-full bg-brand-500" />
              </span>

              {result.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface-2 px-6 py-16 text-center">
                  <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-white text-ink-300 shadow-sm">
                    <PackageSearch size={24} />
                  </span>
                  <p className="text-[16px] font-extrabold text-ink-900">
                    {categoryIsEmpty ? "No products in this category yet" : products.length ? "No products match these filters" : "No products available yet"}
                  </p>
                  <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-500">
                    {categoryIsEmpty || !products.length ? "Please check back later." : "Try removing a filter or widening the price range."}
                  </p>
                  {products.length > 0 && <Button variant="primary" size="sm" className="mt-5" onClick={clearAll}>
                    Clear all filters
                  </Button>}
                </div>
              ) : (
                <div
                  className={cn(
                    "grid grid-cols-2 gap-3.5 xs:gap-4 sm:gap-5 md:grid-cols-3",
                    "transition-opacity duration-200",
                    isUpdating ? "opacity-70" : "opacity-100",
                  )}
                >
                  {result.items.map((product, index) => (
                    <ProductCard key={product.id} product={product} priority={index < 3} />
                  ))}
                </div>
              )}
            </div>

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              onChange={goToPage}
              className="mt-10"
            />
          </div>
        </div>
      </div>

      {/* ---------------- mobile filter sheet (mounted only while open) ---------------- */}
      {drawerOpen && (
      <div className="fixed inset-0 z-[85] lg:hidden">
        <div
          onClick={() => setDrawerOpen(false)}
          className="absolute inset-0 animate-[fade-up_0.2s_ease-out_both] bg-ink-900/45 backdrop-blur-[2px]"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product filters"
          className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] animate-[fade-up_0.28s_cubic-bezier(0.22,1,0.36,1)_both] flex-col rounded-t-3xl bg-white shadow-menu"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <p className="text-[15px] font-extrabold text-ink-900">Filters</p>
              <p className="text-[12px] text-ink-500">
                {activeCount > 0 ? `${activeCount} applied` : "Refine your results"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close filters"
              className="inline-flex size-9 items-center justify-center rounded-full bg-surface text-ink-600 transition-colors hover:bg-ink-900 hover:text-white"
            >
              <X size={17} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            <FilterSidebar
              idPrefix="mobile-filters"
              facets={facets}
              query={query}
              onChange={apply}
              onClear={clearAll}
            />
          </div>

          <div className="flex items-center gap-3 border-t border-line bg-white px-5 py-4">
            <Button variant="outline" size="md" onClick={clearAll} className="flex-1">
              Clear all
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setDrawerOpen(false)}
              className="flex-[1.4]"
            >
              Show {result.total} results
            </Button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

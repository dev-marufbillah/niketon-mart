"use client";

import Link from "next/link";
import type { Product } from "@/lib/types/domain";
import type { ShopFacets, ShopQuery } from "@/lib/catalogue/types";
import { applyShopFilters, shopHref } from "@/lib/catalogue/query";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { categoryImage, navigationCategories } from "@/lib/catalogue/departments";
import { CategoryImage } from "@/components/ui/category-image";

/** Category families come from the same visibility-filtered admin catalogue. */
export function CategoryExplore({ query, basePath, availableProducts, facets }: { query: ShopQuery; basePath: string; availableProducts: Product[]; facets: ShopFacets }) {
  const { categories, products: catalogueProducts } = useCatalogue();
  if (query.categories.length !== 1) return null;
  const visible = navigationCategories(categories);
  const selected = visible.find((entry) => entry.id === query.categories[0]);
  if (!selected) return null;
  const parent = selected.parentId ? visible.find((entry) => entry.id === selected.parentId) : selected;
  if (!parent) return null;
  const children = visible.filter((entry) => entry.parentId === parent.id);
  return (
    <section aria-label={`${parent.name} subcategories`} className="mb-7 rounded-2xl bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">Explore categories</p>
          <h2 className="mt-1 text-xl font-extrabold text-ink-900">Explore {parent.name}</h2></div>
        {selected.id !== parent.id ? <Link className="text-xs font-semibold text-brand-700 hover:underline" href={shopHref({ ...query, categories: [parent.id], page: 1 }, basePath)}>View all {parent.name}</Link> : null}
      </div>
      {children.length ? <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {children.map((child) => {
          // Counts follow the visible department catalogue and all active
          // search/facet filters, not inventory quantities or fabricated data.
          const count = applyShopFilters(availableProducts, { ...query, categories: [child.id] }, facets.categories, facets.brands).length;
          return <li key={child.id} className="min-w-0"><Link href={shopHref({ ...query, categories: [child.id], page: 1 }, basePath)} className="group flex h-full items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-line transition-shadow hover:shadow-card" aria-current={selected.id === child.id ? "page" : undefined}>
            <CategoryImage src={categoryImage(child, categories, catalogueProducts)} size={64} className="size-14 rounded-lg motion-safe:group-hover:scale-105" />
            <span className="min-w-0"><span className="block break-words text-sm font-bold text-ink-900">{child.name}</span><span className="text-xs text-ink-500">{count} product{count === 1 ? "" : "s"}</span></span>
          </Link></li>;
        })}
      </ul> : <p className="mt-3 text-sm text-ink-500">No subcategories have been added yet.</p>}
    </section>
  );
}

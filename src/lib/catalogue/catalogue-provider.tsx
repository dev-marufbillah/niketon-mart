"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { Brand, Category, Product, ProductType } from "@/lib/types/domain";
import type { CatalogueSnapshot } from "@/lib/catalogue/types";
import { matchesProductSearch } from "@/lib/catalogue/search";

/**
 * Client view of the live catalogue.
 *
 * The storefront layout resolves the catalogue on the server (one JSON store read
 * per request) and hands the snapshot down here, so the cart, wishlist, search
 * and recently-viewed widgets see exactly what the shop shows — including admin
 * price, stock and visibility changes — without importing seed data directly.
 */

type CatalogueContextValue = CatalogueSnapshot & {
  getProduct: (id: string) => Product | undefined;
  search: (term: string, limit?: number) => Product[];
  categoryById: (id: string) => Category | undefined;
  brandById: (id: string) => Brand | undefined;
  typeById: (id: string) => ProductType | undefined;
};

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

export function CatalogueProvider({
  catalogue,
  children,
}: {
  catalogue: CatalogueSnapshot;
  children: ReactNode;
}) {
  const { products, categories, brands, productTypes } = catalogue;

  const productIndex = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const categoryIndex = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const brandIndex = useMemo(() => new Map(brands.map((brand) => [brand.id, brand])), [brands]);
  const typeIndex = useMemo(
    () => new Map(productTypes.map((type) => [type.id, type])),
    [productTypes],
  );

  const getProduct = useCallback((id: string) => productIndex.get(id), [productIndex]);

  const search = useCallback(
    (term: string, limit = 6) => {
      const needle = term.trim().toLowerCase();
      if (!needle) return [];
      return products
        .filter((product) => {
          const brand = product.brandId ? brandIndex.get(product.brandId)?.name ?? "" : "";
          return matchesProductSearch(product, needle, brand);
        })
        .slice(0, limit);
    },
    [products, brandIndex],
  );

  const value = useMemo<CatalogueContextValue>(
    () => ({
      products,
      categories,
      brands,
      productTypes,
      getProduct,
      search,
      categoryById: (id: string) => categoryIndex.get(id),
      brandById: (id: string) => brandIndex.get(id),
      typeById: (id: string) => typeIndex.get(id),
    }),
    [products, categories, brands, productTypes, getProduct, search, categoryIndex, brandIndex, typeIndex],
  );

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogue() {
  const context = useContext(CatalogueContext);
  if (!context) throw new Error("useCatalogue must be used inside <CatalogueProvider>");
  return context;
}

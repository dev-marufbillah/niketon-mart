import type { Product } from "@/lib/types/domain";

/** One matching rule for live suggestions and full shop results. */
export function matchesProductSearch(product: Product, term: string, brandName = ""): boolean {
  const needle = term.trim().toLocaleLowerCase();
  if (!needle) return true;
  return `${product.name} ${product.categoryLabel} ${brandName} ${product.description}`.toLocaleLowerCase().includes(needle);
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopHero } from "@/components/shop/shop-hero";
import { ShopBrowser } from "@/components/shop/shop-browser";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { buildShopFacets, getRenderStorefrontCatalogue } from "@/lib/catalogue/repository";
import { categoryFamilyCatalogue, departmentCatalogue, filterFamilyForSelection, type Department } from "@/lib/catalogue/departments";
import { parseShopQuery, shopRequestKey } from "@/lib/catalogue/query";
import { getRenderSettings, type CataloguePageKey } from "@/lib/repositories/settings";

const pageDetails: Record<Department, { key: CataloguePageKey; path: string; label: string }> = {
  fresh: { key: "freshMarket", path: "/fresh-market", label: "Fresh Market" },
  grocery: { key: "grocery", path: "/grocery", label: "Grocery" },
};

export async function departmentMetadata(department: Department): Promise<Metadata> {
  const settings = await getRenderSettings();
  const copy = settings.cataloguePages[pageDetails[department].key];
  return { title: copy.title, description: copy.description || settings.seo.description || settings.description };
}

/** The category partition and products always come from the live public catalogue. */
export async function DepartmentPage({
  department,
  searchParams,
}: {
  department: Department;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, catalogue, settings] = await Promise.all([searchParams, getRenderStorefrontCatalogue(), getRenderSettings()]);
  const details = pageDetails[department];
  const copy = settings.cataloguePages[details.key];
  const departmentShop = departmentCatalogue(catalogue, department);
  // Preserve older featured-category links such as ?category=<id>. Once a
  // shopper changes filters, an explicit scope is carried in the shareable URL.
  if (params.scope !== undefined && (typeof params.scope !== "string" || !params.scope.trim())) notFound();
  const selected = parseShopQuery(params, { min: 0, max: 100 }).categories;
  const scopeId = typeof params.scope === "string" ? params.scope : filterFamilyForSelection(departmentShop.categories, selected);
  const shop = scopeId ? categoryFamilyCatalogue(departmentShop, scopeId) : departmentShop;
  if (!shop) notFound();
  const facets = buildShopFacets(shop);
  const scopedCategory = scopeId ? shop.categories.find((category) => category.id === scopeId) : undefined;

  return (
    <>
      <ShopHero
        title={scopedCategory?.name ?? copy.title}
        current={scopedCategory?.name ?? details.label}
        subtitle={scopedCategory ? scopedCategory.description : copy.description}
        parent={scopedCategory ? { label: details.label, href: details.path } : undefined}
      />
      <ShopBrowser key={shopRequestKey(details.path, params)} basePath={details.path} products={shop.products} facets={facets} initialSearchParams={params} categoryScopeId={scopeId} />
      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

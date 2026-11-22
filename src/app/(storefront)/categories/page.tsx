import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ShopHero } from "@/components/shop/shop-hero";
import { CategoryImage } from "@/components/ui/category-image";
import { categoryGroup, categoryGroups, categoryHref, categoryImage, navigationCategories } from "@/lib/catalogue/departments";
import { getRenderStorefrontCatalogue } from "@/lib/catalogue/repository";
import { getRenderSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getRenderSettings();
  const copy = settings.cataloguePages.categories;
  return { title: copy.title, description: copy.description || settings.seo.description || settings.description };
}

export default async function CategoriesPage() {
  const [catalogue, settings] = await Promise.all([getRenderStorefrontCatalogue(), getRenderSettings()]);
  const { categories, products } = catalogue;
  const available = navigationCategories(categories);
  const roots = available.filter((category) => !category.parentId);
  const copy = settings.cataloguePages.categories;

  return (
    <>
      <ShopHero title={copy.title} current="Categories" subtitle={copy.description} />
      <div className="container-page py-12 sm:py-16">
        {!roots.length && <p className="rounded-2xl bg-surface-2 p-8 text-center text-sm text-ink-500">No categories are available yet.</p>}
        {categoryGroups.map((group) => {
          const items = roots.filter((category) => categoryGroup(category, categories) === group.key);
          if (!items.length) return null;
          return (
            <section key={group.key} aria-labelledby={`category-group-${group.key}`} className="mb-12 last:mb-0">
              <h2 id={`category-group-${group.key}`} className="mb-5 text-xl font-extrabold text-ink-900">{group.title}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((category) => {
                  const children = available.filter((entry) => entry.parentId === category.id);
                  return (
                    <div key={category.id} className="min-w-0 rounded-2xl bg-white p-4 ring-1 ring-line transition-shadow hover:shadow-card">
                      <Link href={categoryHref(category, categories)} className="group flex items-center gap-3 rounded-lg focus-visible:outline-offset-4">
                        <CategoryImage src={categoryImage(category, categories, products)} size={72} className="size-[72px] rounded-xl bg-surface" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-bold text-ink-900 group-hover:text-brand-700">{category.name}</span>
                          <span className="mt-1 block text-xs text-ink-500">{category.productCount ?? 0} product{category.productCount === 1 ? "" : "s"}</span>
                        </span>
                        <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-brand-600" />
                      </Link>
                      {category.description && <p className="mt-3 text-xs leading-relaxed text-ink-500">{category.description}</p>}
                      {children.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                          {children.map((child) => <li key={child.id}><Link href={categoryHref(child, categories)} className="inline-flex rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-600 hover:bg-brand-50 hover:text-brand-700">{child.name}</Link></li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

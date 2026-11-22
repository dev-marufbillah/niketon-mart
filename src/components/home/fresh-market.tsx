import Link from "next/link";
import { ArrowRight, Scissors } from "lucide-react";
import { getRenderStorefrontCatalogue } from "@/lib/catalogue/repository";
import { getSectionCopy } from "@/lib/repositories/homepage";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeading } from "@/components/ui/section-heading";
import { CategoryImage } from "@/components/ui/category-image";
import { categoryImage } from "@/lib/catalogue/departments";

/**
 * Fresh market counters.
 *
 * The departments and their products come from the catalogue, so a fish the
 * admin adds in the morning is on the homepage on the next request. The admin
 * edits the copy and picks which category slugs appear (Homepage → Fresh market
 * departments); nothing here is a hardcoded product list.
 */
export async function FreshMarket() {
  const [copy, catalogue] = await Promise.all([getSectionCopy("freshMarket"), getRenderStorefrontCatalogue()]);

  const slugs = String(copy.departments ?? "fish, meat-poultry, vegetables")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);

  const perDepartment = Math.min(6, Math.max(1, Number(copy.perDepartment ?? 6) || 6));

  const departments = slugs
    .map((slug) => catalogue.categories.find((category) => category.slug === slug || category.id === slug))
    .filter((category): category is NonNullable<typeof category> => Boolean(category) && category?.showOnHome !== false)
    .map((category) => ({
      category,
      products: catalogue.products
        .filter((product) => product.categoryId === category.id && (product.stock ?? 0) > 0)
        .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
        .slice(0, perDepartment),
    }))
    .filter((entry) => entry.products.length > 0);

  if (departments.length === 0) return null;

  return (
    <section id="fresh-market" aria-labelledby="fresh-market-title" className="bg-surface py-14 sm:py-16 lg:py-12">
      <div className="container-page">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <SectionHeading
              eyebrow={String(copy.eyebrow ?? "Fresh Market")}
              title={String(copy.title ?? "Cut and cleaned")}
              accent={String(copy.titleAccent ?? "before it reaches you")}
            />
            <h2 id="fresh-market-title" className="sr-only">
              Fresh market
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-500">
              {String(copy.description ?? "")}
            </p>
          </div>
          <Link
            href={String(copy.ctaHref ?? "/shop?category=fish")}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 self-start rounded-full bg-brand-600 px-5 text-[13px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-700 lg:self-auto"
          >
            {String(copy.ctaLabel ?? "Shop the fresh market")}
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="mt-7 space-y-8">
          {departments.map(({ category, products }) => (
            <div key={category.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CategoryImage src={categoryImage(category, catalogue.categories, catalogue.products)} size={32} className="size-8 rounded-lg" />
                  <h3 className="text-[16px] font-extrabold text-ink-900">{category.name}</h3>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10.5px] font-semibold text-brand-700 ring-1 ring-line">
                    <Scissors size={10} /> cut to order
                  </span>
                </div>
                <Link
                  href={`/home-grocery?category=${encodeURIComponent(category.id)}`}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-700 hover:underline"
                >
                  All {category.name.toLowerCase()} <ArrowRight size={12} />
                </Link>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:flex lg:flex-wrap lg:justify-center lg:gap-4">
                {products.map((product) => (
                  <li key={product.id} className="min-w-0 lg:w-[calc((100%-2rem)/3)] xl:w-[calc((100%-3rem)/4)]">
                    <ProductCard product={product} compactDesktop />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

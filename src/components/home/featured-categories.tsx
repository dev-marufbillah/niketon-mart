import Link from "next/link";
import { CategoryImage } from "@/components/ui/category-image";
import { categoryHref, categoryImage, filterFamilyForSelection } from "@/lib/catalogue/departments";
import { getRenderStorefrontCatalogue } from "@/lib/catalogue/repository";
import { getSectionCopy } from "@/lib/repositories/homepage";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils/cn";

export async function FeaturedCategories() {
  const [{ categories, products }, copy] = await Promise.all([
    getRenderStorefrontCatalogue(),
    getSectionCopy("categories"),
  ]);

  const featured = categories.filter((category) => !category.parentId && category.showOnHome !== false);

  return (
    <section aria-labelledby="categories-title" className="bg-white py-14 sm:py-16 lg:py-12">
      <div className="container-page">
        <SectionHeading
          align="center"
          eyebrow={String(copy.eyebrow ?? "Categories")}
          title={String(copy.title ?? "Featured")}
          accent={String(copy.titleAccent ?? "Categories")}
          className="mb-10 lg:mb-7"
        />
        <h2 id="categories-title" className="sr-only">
          Featured Categories
        </h2>

        {/* The small-screen rail stays familiar. On desktop the larger cards
            wrap naturally and centre every row, including the final partial row. */}
        {featured.length ? <ul tabIndex={0} aria-label="Browse featured categories; scroll horizontally on small screens" className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:px-0 lg:flex-wrap lg:justify-center lg:snap-none lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0">
          {featured.map((category) => (
            <li key={category.id} className="snap-start lg:flex">
              <Link
                href={filterFamilyForSelection(categories, [category.id])
                  ? categoryHref(category, categories)
                  : `/home-grocery?category=${encodeURIComponent(category.id)}`}
                title={category.description || category.name}
                className="group flex w-[118px] flex-col items-center text-center sm:w-[130px] lg:h-full lg:w-[170px] lg:rounded-2xl lg:bg-surface-2 lg:px-4 lg:py-5 lg:ring-1 lg:ring-line lg:transition-all lg:duration-200 lg:hover:-translate-y-1 lg:hover:bg-brand-50 lg:hover:shadow-card xl:w-[184px]"
              >
                <span
                  className={cn(
                    "relative flex size-[104px] items-center justify-center rounded-full bg-surface text-[40px] transition-all duration-300 sm:size-[118px] lg:size-[112px] xl:size-[120px]",
                    "group-hover:-translate-y-1 group-hover:bg-brand-50 group-hover:shadow-[0_18px_34px_-22px_rgba(27,128,87,0.55)]",
                  )}
                >
                  <CategoryImage src={categoryImage(category, categories, products)} size={144} className="size-full rounded-full transition-transform duration-300 group-hover:scale-105" />
                </span>
                <span className="mt-3 text-[14px] font-bold text-ink-800 transition-colors group-hover:text-brand-700 lg:mt-3 lg:flex lg:min-h-[2.5rem] lg:items-center lg:justify-center lg:text-[14px] lg:leading-snug">
                  {category.name}
                </span>
                <span className="mt-0.5 text-[12.5px] text-ink-400 lg:mt-1 lg:text-[12px]">
                  {category.productCount} {category.productCount === 1 ? "Product" : "Products"}
                </span>
              </Link>
            </li>
          ))}
        </ul> : <p className="text-center text-sm text-ink-500">No featured categories are available yet.</p>}
      </div>
    </section>
  );
}

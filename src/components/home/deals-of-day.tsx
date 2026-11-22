import { getDealsOfTheDay } from "@/lib/catalogue/repository";
import { getSectionCopy } from "@/lib/repositories/homepage";
import { ProductCard } from "@/components/ui/product-card";
import { SectionHeading } from "@/components/ui/section-heading";

export async function DealsOfDay() {
  const copy = await getSectionCopy("deals");
  const ids = Array.isArray(copy.productIds) ? (copy.productIds as string[]) : [];
  const deals = await getDealsOfTheDay(ids);

  return (
    <section aria-labelledby="deals-title" className="bg-white pb-14 sm:pb-16 lg:pb-20">
      <div className="container-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            eyebrow={String(copy.eyebrow ?? "Today Deals")}
            title={String(copy.title ?? "Deals")}
            accent={String(copy.titleAccent ?? "of the Day")}
          />
          <p className="max-w-[430px] text-[13px] leading-relaxed text-ink-500 sm:text-right">
            {String(copy.description ?? "")}
          </p>
        </div>
        <h2 id="deals-title" className="sr-only">
          Deals of the Day
        </h2>

        <div className="mt-8 grid gap-5 lg:grid-cols-2 lg:gap-6">
          {deals.map((product) => (
            <ProductCard key={product.id} product={product} variant="deal" compactDesktop />
          ))}
        </div>
      </div>
    </section>
  );
}

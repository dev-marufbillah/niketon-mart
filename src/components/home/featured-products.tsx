import { ArrowRight } from "lucide-react";
import { getFeaturedProducts } from "@/lib/catalogue/repository";
import { getSectionCopy } from "@/lib/repositories/homepage";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductRail } from "@/components/ui/product-rail";
import { ButtonLink } from "@/components/ui/button";

export async function FeaturedProducts() {
  const copy = await getSectionCopy("featured");
  const ids = Array.isArray(copy.productIds) ? (copy.productIds as string[]) : [];
  const products = await getFeaturedProducts(ids);

  return (
    <section
      id="featured-products"
      aria-labelledby="featured-products-title"
      className="bg-surface py-14 sm:py-16 lg:py-12"
    >
      <div className="container-page">
        <SectionHeading
          eyebrow={String(copy.eyebrow ?? "Products")}
          title={String(copy.title ?? "Featured")}
          accent={String(copy.titleAccent ?? "Products")}
          action={
            <ButtonLink
              href={String(copy.ctaHref ?? "/home-grocery")}
              iconRight={<ArrowRight size={16} />}
              className="px-6"
            >
              {String(copy.ctaLabel ?? "View All Products")}
            </ButtonLink>
          }
          className="mb-8"
        />
        <h2 id="featured-products-title" className="sr-only">
          Featured Products
        </h2>
        {products.length ? <ProductRail products={products} label="Featured products" compactDesktop /> :
          <p className="text-sm text-ink-500">No featured products are available yet.</p>}
      </div>
    </section>
  );
}

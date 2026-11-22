import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getRenderStorefrontProductBySlug } from "@/lib/catalogue/repository";
import { getApprovedReviews, getReviewSummary } from "@/lib/reviews/repository";
import { ProductCard } from "@/components/ui/product-card";
import { ProductExperience } from "@/components/product/product-experience";
import { getCustomerProfile, requireShopper } from "@/lib/auth/customer";
import { getRenderSettings } from "@/lib/repositories/settings";
import { ServiceFeatures } from "@/components/home/service-features";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getRenderStorefrontProductBySlug(slug);
  if (!data) return { title: "Product not found" };
  return {
    title: data.product.name,
    description: data.product.description,
    robots: { index: false, follow: false },
    openGraph: { images: [{ url: data.product.image }] },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireShopper(`/product/${encodeURIComponent(slug)}`);
  const data = await getRenderStorefrontProductBySlug(slug);
  if (!data) notFound();

  const { product, related, category, brand, productType } = data;
  const [reviews, summary, profile, settings] = await Promise.all([
    getApprovedReviews(product.id),
    getReviewSummary(product.id),
    getCustomerProfile(),
    getRenderSettings(),
  ]);
  // A signed-in shopper should not have to retype their name and email to
  // review a product they bought — the form is prefilled, still editable.
  const reviewer = profile
    ? { name: `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.name, email: profile.email }
    : undefined;

  return (
    <>
      <div className="border-b border-line bg-surface-2">
        <div className="container-page py-4">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-500"
          >
            <Link href="/" className="transition-colors hover:text-brand-700">
              Home
            </Link>
            <ChevronRight size={13} className="text-ink-300" />
            <Link href="/home-grocery" className="transition-colors hover:text-brand-700">
              Shop
            </Link>
            {category && (
              <>
                <ChevronRight size={13} className="text-ink-300" />
                <Link
                  href={`/home-grocery?category=${category.id}`}
                  className="transition-colors hover:text-brand-700"
                >
                  {category.name}
                </Link>
              </>
            )}
            <ChevronRight size={13} className="text-ink-300" />
            <span className="font-semibold text-ink-700" aria-current="page">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      <ProductExperience
        product={product}
        reviews={reviews}
        summary={summary}
        reviewer={reviewer}
        category={category}
        brand={brand}
        productType={productType}
        preparationNote={settings.freshMarket.preparationNote}
        weightDisclaimer={settings.freshMarket.weightDisclaimer}
      />

      {related.length > 0 && (
        <section aria-labelledby="related-title" className="bg-surface py-12 lg:py-16">
          <div className="container-page">
            <div className="mb-6 text-center">
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                Related Products
              </p>
              <h2 id="related-title" className="mt-1 text-[22px] sm:text-[26px]">
                Explore <span className="text-brand-600">Related Products</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
              {related.map((entry) => (
                <ProductCard key={entry.id} product={entry} />
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link
                href={`/home-grocery?category=${product.categoryId}`}
                className="text-[13px] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
              >
                View the whole category
              </Link>
            </div>
          </div>
        </section>
      )}

      <ServiceFeatures />
    </>
  );
}

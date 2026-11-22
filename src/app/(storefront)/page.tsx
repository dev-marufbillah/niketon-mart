import Link from "next/link";
import { Hero } from "@/components/home/hero";
import { FeaturedCategories } from "@/components/home/featured-categories";
import { PromoBanners } from "@/components/home/promo-banners";
import { FreshMarket } from "@/components/home/fresh-market";
import { FeaturedProducts } from "@/components/home/featured-products";
import { SummerDiscount } from "@/components/home/summer-discount";
import { DealsOfDay } from "@/components/home/deals-of-day";
import { WeeklyDeals } from "@/components/home/weekly-deals";
import { TopPicks } from "@/components/home/top-picks";
import { Testimonials } from "@/components/home/testimonials";
import { BlogSection } from "@/components/home/blog-section";
import { FaqSection } from "@/components/home/faq-section";
import { LifestyleStrip, ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { getRenderHomepage } from "@/lib/repositories/homepage";
import { getRenderSettings } from "@/lib/repositories/settings";
import { getServiceFeatures } from "@/lib/repositories/content";
import type { HomeSectionKey } from "@/lib/content/section-schema";

export const dynamic = "force-dynamic";

/**
 * Home grocery storefront.
 *
 * The section order and visibility come from the `homepage` document that the
 * admin panel edits — this file only maps a section key to its component. A
 * section the admin hides is never rendered; a section the admin moves up
 * renders higher on the page. No content is hardcoded here.
 */
const sectionComponents: Record<HomeSectionKey, React.ComponentType> = {
  hero: Hero,
  categories: FeaturedCategories,
  freshMarket: FreshMarket,
  promos: PromoBanners,
  featured: FeaturedProducts,
  campaign: SummerDiscount,
  deals: DealsOfDay,
  weekly: WeeklyDeals,
  topPicks: TopPicks,
  testimonials: Testimonials,
  blog: BlogSection,
  faq: FaqSection,
  services: ServiceFeatures,
  lifestyle: LifestyleStrip,
  newsletter: Newsletter,
};

export default async function HomePage() {
  const [homepage, settings] = await Promise.all([getRenderHomepage(), getRenderSettings()]);

  // A brand-new database (before any admin save) renders the designed order.
  const sections =
    homepage.sections.length > 0
      ? homepage.sections
      : (Object.keys(sectionComponents) as HomeSectionKey[]).map((key, index) => ({
          key,
          label: key,
          visible: true,
          order: index + 1,
          }));

  const ordered = [...sections].sort((a, b) => a.order - b.order).filter((section) => section.visible);

  if (!settings.maintenance.storefrontEnabled) {
    return (
      <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-600">Down for maintenance</p>
        <h1 className="mt-3 text-[28px] font-extrabold text-ink-900 sm:text-[34px]">
          {settings.maintenance.message || "We are updating the store and will be back shortly."}
        </h1>
        <p className="mt-3 max-w-md text-[13.5px] text-ink-500">
          Our team is restocking the shelves. Please check back soon — your baskets and orders are safe.
        </p>
      </div>
    );
  }

  const serviceItems = await getServiceFeatures();

  return (
    <>
      {ordered.map((section) => {
        const Component = sectionComponents[section.key as HomeSectionKey];
        if (!Component) return null;
        // Hide the benefits strip when the admin has removed every benefit.
        if (section.key === "services" && serviceItems.length === 0) return null;
        return <Component key={section.key} />;
      })}
      <p className="sr-only">
        <Link href="/home-grocery">Browse the full grocery catalogue</Link>
      </p>
    </>
  );
}

import { ArrowRight } from "lucide-react";
import { getResolvedTopPicksSection } from "@/lib/content/home-sections/repository";
import { ProductCard } from "@/components/ui/product-card";
import { ButtonLink } from "@/components/ui/button";

/**
 * Section headings across the storefront highlight the closing words in brand
 * green ("Featured Products", "Deals of the Day"). Titles are admin-editable
 * text, so the accent is derived from the last word instead of being duplicated
 * in the CMS payload.
 */
function splitTitle(title: string) {
  const trimmed = title.trim();
  const index = trimmed.lastIndexOf(" ");
  if (index === -1) return { lead: "", accent: trimmed };
  return { lead: trimmed.slice(0, index), accent: trimmed.slice(index + 1) };
}

/**
 * Our Top Picks
 *
 * Content (title, subtitle, CTA) and the product list/order come from the
 * admin-managed section record — nothing here is hardcoded. Layout, card design,
 * spacing and typography are unchanged from the section it replaces.
 */
export async function TopPicks() {
  const section = await getResolvedTopPicksSection();
  if (section.items.length === 0) return null;

  const hasCta = section.ctaLabel.length > 0 && section.ctaHref.length > 0;
  const heading = splitTitle(section.title);

  return (
    <section
      id="our-top-picks"
      aria-labelledby="our-top-picks-title"
      className="bg-surface py-14 sm:py-16 lg:py-12"
    >
      <div className="container-page">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            {section.eyebrow && (
              <p className="mb-2 text-sm font-semibold tracking-wide text-ink-500">
                {section.eyebrow}
              </p>
            )}
            <h2
              id="our-top-picks-title"
              className="text-[26px] leading-[1.15] sm:text-[32px] lg:text-[38px]"
            >
              {heading.lead}
              {heading.lead && " "}
              <span className="text-brand-600">{heading.accent}</span>
            </h2>
            {section.subtitle && (
              <p className="mt-2 text-[13px] leading-relaxed text-ink-500 sm:text-sm">
                {section.subtitle}
              </p>
            )}
          </div>

          {hasCta && (
            <ButtonLink
              href={section.ctaHref}
              iconRight={<ArrowRight size={16} />}
              className="shrink-0 px-6"
            >
              {section.ctaLabel}
            </ButtonLink>
          )}
        </div>

        <div className="mt-8 grid gap-5 xs:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {section.items.map(({ key, product }) => (
            <ProductCard key={key} product={product} compactDesktop />
          ))}
        </div>
      </div>
    </section>
  );
}

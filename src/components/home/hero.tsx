import { HeroCarousel, type HeroSlideContent } from "@/components/home/hero-carousel";
import { getHeroSlides } from "@/lib/repositories/content";
import { listReviews } from "@/lib/reviews/repository";
import { summariseReviews } from "@/lib/reviews/model";
import { getSectionCopy } from "@/lib/repositories/homepage";

const text = (value: unknown, fallback = "") => String(value ?? fallback);

/**
 * The existing admin-managed hero slide records drive the storefront carousel.
 * Homepage copy remains the safe fallback when no visible slide is configured.
 */
export async function Hero() {
  const [records, copy, reviews] = await Promise.all([
    getHeroSlides(),
    getSectionCopy("hero"),
    listReviews({ status: "approved" }),
  ]);
  const slides: HeroSlideContent[] = records.length
    ? records.map((slide) => ({
        id: slide.id,
        badge: slide.badge,
        title: slide.title,
        titleAccent: slide.titleAccent,
        subtitle: slide.subtitle,
        image: slide.image,
        mobileImage: slide.mobileImage,
        imageAlt: slide.imageAlt,
        imageFit: slide.imageFit,
        imagePosition: slide.imagePosition,
        featureOne: slide.featureOne ?? "Grocery essentials",
        featureTwo: slide.featureTwo ?? "Fresh market",
        primaryLabel: slide.primaryLabel,
        primaryHref: slide.primaryHref,
        secondaryLabel: slide.secondaryLabel,
        secondaryHref: slide.secondaryHref,
      }))
    : [{
        id: "hero-copy-fallback",
        badge: text(copy.badge),
        title: text(copy.title),
        titleAccent: text(copy.titleAccent),
        subtitle: text(copy.subtitle),
        image: text(copy.image, "/images/hero-woman.png"),
        imageAlt: "",
        featureOne: "Grocery essentials",
        featureTwo: "Fresh market",
        primaryLabel: text(copy.primaryLabel, "Shop Now"),
        primaryHref: text(copy.primaryHref, "/home-grocery"),
        secondaryLabel: text(copy.secondaryLabel),
        secondaryHref: text(copy.secondaryHref, "/home-grocery"),
      }];
  const proof = summariseReviews(reviews.filter((review) => !review.isDemo));
  const configuredInterval = Number(copy.slideIntervalSeconds);

  return (
    <HeroCarousel
      slides={slides}
      autoplay={copy.autoplay !== false}
      intervalSeconds={Number.isInteger(configuredInterval) && configuredInterval >= 3 && configuredInterval <= 15 ? configuredInterval : 6}
      reviewProof={proof}
    />
  );
}

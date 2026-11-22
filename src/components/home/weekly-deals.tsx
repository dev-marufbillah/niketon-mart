import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getSectionCopy } from "@/lib/repositories/homepage";

/** Weekly deals banner — fully copy-driven from the homepage editor. */
export async function WeeklyDeals() {
  const copy = await getSectionCopy("weekly");
  const eyebrow = String(copy.eyebrow || "");
  const title = String(copy.title || "");
  const titleAccent = String(copy.titleAccent || "");
  const subtitle = String(copy.subtitle || "");
  const ctaLabel = String(copy.ctaLabel || "Shop Now");
  const ctaHref = String(copy.ctaHref || "/home-grocery");
  const image = String(copy.image || "/images/deals-basket.png");

  return (
    <section id="weekly-deals" aria-labelledby="weekly-deals-title" className="bg-white pb-14 sm:pb-16 lg:pb-20">
      <div className="container-page">
        <div className="relative isolate overflow-hidden rounded-2xl bg-brand-600">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_85%_10%,rgba(255,255,255,0.12)_0%,rgba(27,128,87,0)_60%)]"
          />
          <div className="relative z-10 grid items-center gap-4 sm:grid-cols-[1.1fr_1fr]">
            <div className="max-w-[440px] px-6 py-10 sm:px-9 sm:py-12 lg:py-14">
              {eyebrow ? <p className="text-[13px] font-bold text-accent-500">{eyebrow}</p> : null}
              <h2
                id="weekly-deals-title"
                className="mt-2 text-[24px] leading-[1.2] text-white sm:text-[30px] lg:text-[34px]"
              >
                {title}{" "}
                {titleAccent ? <span className="text-accent-500">{titleAccent}</span> : null}
              </h2>
              {subtitle ? (
                <p className="mt-3 max-w-[330px] text-[13px] leading-relaxed text-white/75">{subtitle}</p>
              ) : null}
              <ButtonLink
                href={ctaHref}
                variant="accent"
                className="mt-6"
                iconRight={<ArrowRight size={16} />}
              >
                {ctaLabel}
              </ButtonLink>
            </div>

            <div className="relative h-[210px] overflow-hidden sm:h-full sm:min-h-[290px]">
              <Image
                src={image}
                alt=""
                fill
                sizes="(max-width: 640px) 90vw, 560px"
                className="object-contain object-bottom sm:-right-6 sm:object-[center_80%]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CampaignCountdown } from "@/components/home/campaign-countdown";
import { getSectionCopy } from "@/lib/repositories/homepage";

/** Discount countdown block — copy, deadline and images are all editable. */
export async function SummerDiscount() {
  const copy = await getSectionCopy("campaign");

  const title = String(copy.title || "Summer");
  const titleAccent = String(copy.titleAccent || "Discount");
  const subtitle = String(copy.subtitle || "");
  const ctaLabel = String(copy.ctaLabel || "Shop Now");
  const ctaHref = String(copy.ctaHref || "/home-grocery");
  const leftImage = String(copy.leftImage || "/images/lifestyle/countdown-left.jpg");
  const rightImage = String(copy.rightImage || "/images/lifestyle/produce-bin.jpg");
  const endsAt = String(copy.endsAt || "");

  return (
    <section id="campaign" aria-labelledby="summer-discount-title" className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="container-page">
        <div className="grid items-stretch gap-4 lg:grid-cols-[220px_1fr_220px] lg:gap-5">
          <div className="relative hidden overflow-hidden rounded-2xl ring-[6px] ring-white lg:block">
            <Image src={leftImage} alt="" fill sizes="220px" className="object-cover" />
          </div>

          <div className="grocery-pattern relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-line bg-white px-5 py-10 text-center sm:px-8 sm:py-12">
            <div className="relative">
              <h2 id="summer-discount-title" className="text-[26px] leading-tight sm:text-[34px]">
                {title} {titleAccent ? <span className="text-brand-600">{titleAccent}</span> : null}
              </h2>
              {subtitle ? (
                <p className="mt-2 text-[13.5px] font-medium text-ink-600 sm:text-[15px]">{subtitle}</p>
              ) : null}

              <CampaignCountdown endsAt={endsAt || undefined} />

              <ButtonLink href={ctaHref} className="mt-8" iconRight={<ArrowRight size={16} />}>
                {ctaLabel}
              </ButtonLink>
            </div>
          </div>

          <div className="relative hidden overflow-hidden rounded-2xl ring-[6px] ring-white lg:block">
            <Image src={rightImage} alt="" fill sizes="220px" className="object-cover" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:hidden">
            {[leftImage, rightImage].map((image, index) => (
              <div key={`${image}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-xl">
                <Image src={image} alt="" fill sizes="45vw" className="object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { getPromoBanners } from "@/lib/repositories/content";

/** Promo banners — content is managed in Admin → Website → Promo banners. */
export async function PromoBanners() {
  const banners = await getPromoBanners().catch(() => []);
  if (banners.length === 0) return null;

  return (
    <section id="promotions" aria-label="Featured promotions" className="bg-white pb-14 sm:pb-16 lg:py-10">
      <div className="container-page grid gap-5 lg:grid-cols-2 lg:gap-6">
        {banners.slice(0, 2).map((banner) => (
          <article
            key={banner.id}
            className={cn(
              "relative isolate flex min-h-[236px] overflow-hidden rounded-2xl sm:min-h-[264px] lg:min-h-[225px]",
              banner.tone === "yellow" ? "bg-accent-500" : "bg-surface",
            )}
          >
            {banner.tone === "yellow" ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_90%_at_80%_20%,rgba(255,255,255,0.28)_0%,rgba(248,197,25,0)_60%)]"
              />
            ) : null}
            <div className="relative z-10 flex max-w-[58%] flex-col justify-center gap-3 p-6 sm:p-8 lg:max-w-[55%] lg:gap-2.5 lg:p-6">
              {banner.badge ? (
                <span
                  className={cn(
                    "w-fit rounded-full px-3.5 py-1.5 text-[12px] font-bold",
                    banner.tone === "yellow" ? "bg-accent-100/90 text-brand-900" : "bg-accent-500 text-brand-900",
                  )}
                >
                  {banner.badge}
                </span>
              ) : null}
              <h3 className="text-[24px] leading-[1.15] sm:text-[28px] lg:text-[24px]">
                {banner.title}
                {banner.titleAccent ? (
                  <>
                    <br />
                    {banner.titleAccent}
                  </>
                ) : null}
              </h3>
              {banner.description ? (
                <p className="max-w-[230px] text-[12.5px] leading-relaxed text-ink-500">{banner.description}</p>
              ) : null}
              <ButtonLink
                href={banner.href || "/home-grocery"}
                size="sm"
                className="mt-1 w-fit px-5"
                iconRight={<ArrowRight size={15} />}
              >
                Shop Now
              </ButtonLink>
            </div>

            <div className="pointer-events-none absolute -right-2 bottom-0 top-0 w-[52%] lg:right-1 lg:w-[44%]">
              <Image
                src={banner.image}
                alt=""
                fill
                sizes="(max-width: 1024px) 52vw, 330px"
                className="object-contain object-right-bottom drop-shadow-[0_18px_24px_rgba(16,24,40,0.12)]"
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

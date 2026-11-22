import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { BackButton } from "@/components/system/back-button";
import type { SiteSettings } from "@/lib/repositories/settings";

/**
 * Custom 404 screen.
 * ------------------
 * One component renders every not-found state on the storefront (unknown URL,
 * missing product, blog post, page or category) so they can never drift apart.
 * Copy, illustration and buttons come from `settings.notFound` — the admin
 * screen writes them, this reads them on every request.
 */
export function NotFoundView({ notFound }: { notFound: SiteSettings["notFound"] }) {
  return (
    <section className="bg-white">
      {notFound.noindex ? <meta name="robots" content="noindex, follow" /> : null}
      <div className="container-page flex flex-col items-center py-12 text-center sm:py-16 lg:py-20">
        {notFound.imageUrl ? (
          <Image
            src={notFound.imageUrl}
            alt=""
            width={1040}
            height={590}
            priority
            sizes="(max-width: 640px) 84vw, 520px"
            className="h-auto w-full max-w-[300px] sm:max-w-[420px] lg:max-w-[500px]"
          />
        ) : null}

        <h1 className="mt-4 text-[26px] leading-tight font-extrabold text-brand-600 sm:mt-6 sm:text-[34px] lg:text-[38px]">
          {notFound.heading}
        </h1>

        {notFound.description ? (
          <p className="mx-auto mt-3 max-w-[420px] text-[13.5px] leading-relaxed text-ink-500 sm:text-[14.5px]">
            {notFound.description}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col items-center gap-2.5 sm:flex-row">
          {notFound.showHomeButton ? (
            <ButtonLink href={notFound.homeButtonHref || "/"} size="md" className="px-7 sm:h-[46px] sm:px-8">
              {notFound.homeButtonLabel}
            </ButtonLink>
          ) : null}
          {notFound.showBackButton ? <BackButton label={notFound.backButtonLabel} /> : null}
        </div>
      </div>
    </section>
  );
}

import { NewsletterForm } from "@/components/layout/newsletter-form";
import { getSectionCopy } from "@/lib/repositories/homepage";

/**
 * Newsletter band. Copy is editable in the homepage editor and every submitted
 * address is persisted in the `subscribers` collection (Admin → Marketing).
 */
export async function Newsletter() {
  const copy = await getSectionCopy("newsletter");
  const eyebrow = String(copy.eyebrow || "");
  const title = String(copy.title || "");
  const titleAccent = String(copy.titleAccent || "");
  const subtitle = String(copy.subtitle || "");
  const buttonLabel = String(copy.buttonLabel || "Subscribe") || "Subscribe";

  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-title"
      className="grocery-pattern border-b border-line bg-surface-2 pb-16 pt-14 sm:pb-20 sm:pt-16"
    >
      <div className="container-page text-center">
        {eyebrow ? <p className="text-sm font-semibold text-ink-500">{eyebrow}</p> : null}
        <h2
          id="newsletter-title"
          className="mx-auto mt-2 max-w-[720px] text-[26px] leading-[1.2] sm:text-[34px] lg:text-[40px]"
        >
          {title} {titleAccent ? <span className="text-brand-600">{titleAccent}</span> : null}
        </h2>
        {subtitle ? <p className="mx-auto mt-3 max-w-md text-[14.5px] text-ink-500">{subtitle}</p> : null}

        <NewsletterForm buttonLabel={buttonLabel} />
      </div>
    </section>
  );
}

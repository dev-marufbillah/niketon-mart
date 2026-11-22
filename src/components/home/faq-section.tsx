import { getFaqs } from "@/lib/repositories/content";
import { getSectionCopy } from "@/lib/repositories/homepage";
import { FaqAccordion } from "@/components/home/faq-accordion";

/** FAQ section — questions are managed in Admin → Website → FAQs. */
export async function FaqSection() {
  const [items, copy] = await Promise.all([getFaqs(), getSectionCopy("faq")]);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="faq-title" className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="container-page">
        <div className="text-center">
          {copy.eyebrow ? <p className="text-sm font-semibold text-ink-500">{String(copy.eyebrow)}</p> : null}
          <h2 id="faq-title" className="mt-2 text-[26px] leading-[1.2] sm:text-[32px] lg:text-[38px]">
            {String(copy.title ?? "")}{" "}
            {copy.titleAccent ? <span className="text-brand-600">{String(copy.titleAccent)}</span> : null}
          </h2>
        </div>

        <FaqAccordion
          items={items.map((item) => ({ id: item.id, question: item.question, answer: item.answer }))}
        />
      </div>
    </section>
  );
}

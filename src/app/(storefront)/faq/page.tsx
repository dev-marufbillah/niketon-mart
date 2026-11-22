import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { FaqAccordion } from "@/components/content/faq-accordion";
import { getFaqGroups, getPageBySlug } from "@/lib/repositories/content";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}): Promise<Metadata> {
  const [{ category }, { q }, page] = await Promise.all([searchParams, searchParams, getPageBySlug("faq")]);
  const categories = await getFaqGroups();
  const active = categories.categories.find((item) => item.slug === category);
  const title = active ? `${active.name} FAQs` : q ? `Search “${q}”` : page?.title || "FAQs";
  return {
    title,
    description:
      "Answers about ordering, payment, delivery, products and your account — maintained by the store team.",
    alternates: { canonical: "/faq" },
    robots: { index: !q, follow: true },
  };
}

/**
 * FAQs (reference 3)
 * ------------------
 * Category rail on the left, accordion on the right. Both the categories and
 * every question come from `faq_categories` / `faqs`, so a change in
 * Admin → Website → FAQs appears here immediately. Search and category are URL
 * state (`?q=` / `?category=`), which keeps the page shareable and server-rendered.
 */
export default async function FaqPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category = "", q = "" } = await searchParams;
  const { categories, faqs, uncategorised } = await getFaqGroups();

  const term = q.trim().toLowerCase();
  const activeCategory = category ? categories.find((item) => item.slug === category) : undefined;

  const visible = faqs.filter((faq) => {
    if (activeCategory && faq.categoryId !== activeCategory.id) return false;
    if (!term) return true;
    return faq.question.toLowerCase().includes(term) || faq.answer.toLowerCase().includes(term);
  });

  const total = faqs.length + uncategorised.length;

  const query = (patch: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = { category, q, ...patch };
    if (next.category) params.set("category", next.category);
    if (next.q) params.set("q", next.q);
    const text = params.toString();
    return text ? `/faq?${text}` : "/faq";
  };

  return (
    <>
      <ShopHero title="FAQs" current="FAQs" />

      <section className="container-page py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[300px_1fr] lg:gap-8">
          {/* ---------------- category rail ---------------- */}
          <div className="min-w-0">
            <div className="lg:sticky lg:top-4">
              <nav
                aria-label="FAQ categories"
                className="scrollbar-none -mx-4 w-[calc(100%+2rem)] max-w-[calc(100vw)] overflow-x-auto px-4 lg:mx-0 lg:w-full lg:overflow-visible lg:px-0"
              >
                <ul className="flex gap-2 lg:flex-col lg:gap-2.5">
                  <li className="shrink-0">
                    <Link
                      href={query({ category: "" })}
                      aria-current={!activeCategory ? "page" : undefined}
                      className={
                        !activeCategory
                          ? "flex items-center justify-between gap-2 rounded-xl bg-accent-500 px-4 py-3 text-[13px] font-bold whitespace-nowrap text-brand-900 lg:whitespace-normal"
                          : "flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-[13px] font-semibold whitespace-nowrap text-ink-700 ring-1 ring-line hover:text-brand-700 lg:whitespace-normal"
                      }
                    >
                      All questions
                      <span className="text-[11.5px] font-bold opacity-70">{faqs.length + uncategorised.length}</span>
                    </Link>
                  </li>
                  {categories.map((item) => {
                    const active = activeCategory?.id === item.id;
                    return (
                      <li key={item.id} className="shrink-0">
                        <Link
                          href={query({ category: item.slug })}
                          aria-current={active ? "page" : undefined}
                          className={
                            active
                              ? "flex items-center justify-between gap-2 rounded-xl bg-accent-500 px-4 py-3 text-[13px] font-bold whitespace-nowrap text-brand-900 lg:whitespace-normal"
                              : "flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-[13px] font-semibold whitespace-nowrap text-ink-700 ring-1 ring-line hover:text-brand-700 lg:whitespace-normal"
                          }
                        >
                          {item.name}
                          <span className="text-[11.5px] font-bold opacity-70">{item.count}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="mt-4 hidden rounded-2xl bg-brand-900 p-5 text-white lg:block">
                <p className="text-[13.5px] font-extrabold">Still have a question?</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-white/70">
                  Send it through the contact form to the store team.
                </p>
                <Link
                  href="/contact"
                  className="mt-3 inline-flex h-9 items-center rounded-full bg-accent-500 px-4 text-[12px] font-bold text-brand-900 hover:bg-accent-400"
                >
                  Contact us
                </Link>
              </div>
            </div>
          </div>

          {/* ------------------- accordion ------------------- */}
          <div className="min-w-0">
            <form action="/faq" method="get" role="search" className="mb-5">
              {category ? <input type="hidden" name="category" value={category} /> : null}
              <label className="relative block">
                <span className="sr-only">Search the FAQs</span>
                <Search
                  size={16}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
                />
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Search a question, e.g. delivery"
                  className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-24 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-lg bg-brand-600 px-3 text-[12px] font-bold text-white hover:bg-brand-700"
                >
                  Search
                </button>
              </label>
            </form>

            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[12.5px] text-ink-500">
                {term ? (
                  <>
                    <span className="font-semibold text-ink-800">{visible.length}</span> result
                    {visible.length === 1 ? "" : "s"} for “{q}”
                  </>
                ) : activeCategory ? (
                  <>
                    <span className="font-semibold text-ink-800">{visible.length}</span> question
                    {visible.length === 1 ? "" : "s"} in {activeCategory.name}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-ink-800">{visible.length}</span> question
                    {visible.length === 1 ? "" : "s"} in total
                  </>
                )}
              </p>
              {activeCategory?.description ? (
                <p className="max-w-md text-[11.5px] text-ink-400">{activeCategory.description}</p>
              ) : null}
            </div>

            {visible.length > 0 ? (
              <FaqAccordion
                items={visible.map((faq) => ({
                  id: faq.id,
                  question: faq.question,
                  answer: faq.answer,
                  categoryId: faq.categoryId,
                }))}
                defaultOpenId={visible[1]?.id ?? visible[0]?.id}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center">
                <p className="text-[14px] font-extrabold text-ink-900">No answers match that search</p>
                <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
                  {term
                    ? `Nothing in ${activeCategory ? activeCategory.name : "the FAQs"} mentions “${q}”. Try a shorter word, or ask us directly.`
                    : "This category has no published questions yet."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link
                    href={query({ q: "" })}
                    className="inline-flex h-9 items-center rounded-full bg-surface px-4 text-[12px] font-semibold text-ink-700 ring-1 ring-line hover:bg-white"
                  >
                    Clear search
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700"
                  >
                    Ask the team
                  </Link>
                </div>
              </div>
            )}

            {!term && !activeCategory && uncategorised.length > 0 ? (
              <div className="mt-6">
                <p className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-400">More questions</p>
                <FaqAccordion
                  items={uncategorised.map((faq) => ({ id: faq.id, question: faq.question, answer: faq.answer }))}
                />
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-between gap-3 text-[12px] text-ink-400 sm:hidden">
              <span>Can’t find it?</span>
              <Link href="/contact" className="font-semibold text-brand-700">
                Contact the store →
              </Link>
            </div>
            <p className="mt-4 hidden text-[11.5px] text-ink-400 sm:block">
              Showing {visible.length} of {total} answers · updated by the store team
            </p>
          </div>
        </div>
      </section>

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

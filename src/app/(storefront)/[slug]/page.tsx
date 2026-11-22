import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/repositories/content";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return { title: "Page not found" };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.subtitle,
  };
}

/**
 * CMS pages (About, Contact, Privacy, Terms…).
 * The slug, title, body and SEO text all come from the `pages` collection that
 * the admin edits — adding a page in the admin makes it reachable here.
 */
export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();

  const paragraphs = page.body.split(/\n{2,}/);

  return (
    <div className="container-page py-10">
      {page.heroImage ? (
        <div className="relative mb-6 aspect-[16/6] overflow-hidden rounded-2xl bg-surface">
          <Image src={page.heroImage} alt="" fill sizes="100vw" className="object-cover" priority />
          <span className="absolute inset-0 bg-brand-900/35" aria-hidden="true" />
          <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
            <h1 className="text-[26px] font-extrabold text-white sm:text-[36px]">{page.title}</h1>
            {page.subtitle ? <p className="mt-1 max-w-xl text-[13px] text-white/80">{page.subtitle}</p> : null}
          </div>
        </div>
      ) : (
        <header className="mb-6">
          <h1 className="text-[26px] font-extrabold text-ink-900 sm:text-[34px]">{page.title}</h1>
          {page.subtitle ? <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-500">{page.subtitle}</p> : null}
        </header>
      )}

      <div className="max-w-3xl">
        <div className="space-y-4 text-[14px] leading-relaxed text-ink-600">
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}



          <p className="text-[12.5px] text-ink-400">
            Need an order update? <Link href="/track-order" className="font-semibold text-brand-700">Track your order</Link>.
          </p>
        </div>

      </div>
    </div>
  );
}

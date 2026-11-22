import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3 } from "lucide-react";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { PostBlocks, tableOfContents } from "@/components/content/post-blocks";
import { ShareRow } from "@/components/content/share-row";
import {
  getAuthors,
  getBlogCategoriesWithCounts,
  getPostBySlug,
  getPostNeighbours,
  getPosts,
  getPromoBanners,
  type PostRow,
} from "@/lib/repositories/content";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Article not found", robots: { index: false, follow: false } };

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt;
  return {
    title,
    description,
    keywords: post.tags,
    alternates: { canonical: `/blogs/${post.slug}` },
    openGraph: {
      title,
      description,
      url: `/blogs/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt,
      authors: [post.author],
      images: post.image ? [{ url: post.image, alt: post.title }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description, images: post.image ? [post.image] : undefined },
  };
}

export function generateStaticParams() {
  return [];
}

function RelatedCard({ post }: { post: PostRow }) {
  return (
    <article className="group overflow-hidden rounded-xl bg-white ring-1 ring-line">
      <Link href={`/blogs/${post.slug}`} className="relative block aspect-[16/10] bg-surface">
        {post.image ? (
          <Image
            src={post.image}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : null}
        {post.category ? (
          <span className="absolute bottom-2 left-2 rounded bg-accent-500 px-2 py-0.5 text-[10px] font-bold text-brand-900">
            {post.category}
          </span>
        ) : null}
      </Link>
      <div className="p-3.5">
        <p className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
          <span className="font-semibold text-ink-600">{post.author}</span> •{" "}
          <CalendarDays size={11} /> {formatDate(post.publishedAt)}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-[13px] font-bold leading-snug text-ink-900 group-hover:text-brand-700">
          <Link href={`/blogs/${post.slug}`}>{post.title}</Link>
        </h3>
        <Link
          href={`/blogs/${post.slug}`}
          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-700"
        >
          Read More <ArrowRight size={12} />
        </Link>
      </div>
    </article>
  );
}

/**
 * Blog article (reference 5)
 * --------------------------
 * Cover, centred title block, article column + sidebar (categories, table of
 * contents, promo), author card, related articles and previous/next links.
 *
 * Public = published + visible + publication date reached, so drafts and
 * scheduled posts 404 for shoppers but stay editable in the admin. SEO text,
 * canonical, Open Graph and Article JSON-LD all come from the post record.
 */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const [categories, authors, promos, neighbours, sameCategory] = await Promise.all([
    getBlogCategoriesWithCounts(),
    getAuthors(),
    getPromoBanners(),
    getPostNeighbours(slug),
    getPosts({ category: post.categoryId || post.category, limit: 4, excludeSlug: post.slug }),
  ]);

  const author = authors.find((entry) => entry.id === post.authorId) ?? authors.find((entry) => entry.name === post.author);
  const promo = promos[0];
  const blocks = post.blocks && post.blocks.length > 0 ? post.blocks : null;
  const paragraphs = (post.body ?? "").split(/\n{2,}/).filter(Boolean);
  const toc = blocks ? tableOfContents(blocks) : [];

  const related = (sameCategory.length > 0 ? sameCategory : await getPosts({ limit: 4, excludeSlug: post.slug })).slice(
    0,
    3,
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription || post.excerpt,
    image: post.image ? [post.image] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { "@type": "Person", name: post.author },
    publisher: { "@type": "Organization", name: "Niketon Mart" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `/blogs/${post.slug}` },
    articleSection: post.category,
    keywords: (post.tags ?? []).join(", "),
  };

  return (
    <>
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <ShopHero title="Blog Details" current="Blog Details" parent={{ label: "Blog", href: "/blogs" }} />

      <article className="container-page py-8 sm:py-10">
        {/* ------------------------------- cover ------------------------------- */}
        <div className="relative aspect-[16/6.6] overflow-hidden rounded-2xl bg-surface">
          {post.image ? (
            <Image
              src={post.image}
              alt={post.title}
              fill
              sizes="(max-width: 1024px) 100vw, 1160px"
              className="object-cover"
              priority
            />
          ) : null}
        </div>

        {/* ------------------------------- title ------------------------------- */}
        <header className="mx-auto mt-6 max-w-3xl text-center">
          {post.category ? (
            <Link
              href={`/blogs?category=${categories.find((c) => c.id === post.categoryId)?.slug ?? post.category}`}
              className="inline-flex rounded-full bg-accent-500 px-3 py-1 text-[10.5px] font-bold text-brand-900 hover:bg-accent-400"
            >
              {post.category}
            </Link>
          ) : null}
          <h1 className="mt-3 text-[24px] font-black leading-[1.2] text-ink-900 sm:text-[32px]">{post.title}</h1>
          <p className="mt-2.5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-50 text-[9px] font-black text-brand-700">
                {post.author
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              {post.author}
            </span>
            <span aria-hidden="true">•</span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={12} /> {formatDate(post.publishedAt)}
            </span>
            <span aria-hidden="true">•</span>
            <span className="inline-flex items-center gap-1">
              <Clock3 size={12} /> {post.readTime}
            </span>
          </p>
        </header>

        <ShareRow url={`/blogs/${post.slug}`} title={post.title} className="mx-auto mt-4 max-w-3xl" />

        {/* ------------------------- article + sidebar ------------------------- */}
        <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_280px] lg:gap-9">
          <div>
            {blocks ? <PostBlocks blocks={blocks} /> : (
              <div className="space-y-4">
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="text-[14.5px] leading-[1.9] text-ink-600">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {post.tags && post.tags.length > 0 ? (
              <ul className="mt-6 flex flex-wrap items-center gap-1.5">
                <li className="text-[11.5px] font-semibold text-ink-400">Tags:</li>
                {post.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/blogs?q=${encodeURIComponent(tag)}`}
                      className="inline-flex rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700"
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* author box */}
            {author ? (
              <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-brand-600 p-4 text-white sm:flex-row sm:items-center sm:p-5">
                <span className="relative size-14 shrink-0 overflow-hidden rounded-full bg-white/15">
                  {author.avatar ? (
                    <Image src={author.avatar} alt={author.name} fill sizes="56px" className="object-cover" />
                  ) : null}
                </span>
                <div>
                  <p className="text-[13.5px] font-extrabold">{author.name}</p>
                  <p className="text-[11px] font-semibold text-accent-400">{author.role}</p>
                  {author.bio ? (
                    <p className="mt-1 text-[12px] leading-relaxed text-white/80">{author.bio}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* prev / next */}
            <nav aria-label="More articles" className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
              {neighbours.previous ? (
                <Link
                  href={`/blogs/${neighbours.previous.slug}`}
                  className="group rounded-xl bg-white p-3.5 ring-1 ring-line hover:ring-brand-200"
                >
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-400">
                    <ArrowLeft size={11} /> Previous
                  </span>
                  <span className="mt-1 block line-clamp-2 text-[12.5px] font-semibold text-ink-800 group-hover:text-brand-700">
                    {neighbours.previous.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {neighbours.next ? (
                <Link
                  href={`/blogs/${neighbours.next.slug}`}
                  className="group rounded-xl bg-white p-3.5 text-right ring-1 ring-line hover:ring-brand-200"
                >
                  <span className="inline-flex items-center justify-end gap-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-400">
                    Next <ArrowRight size={11} />
                  </span>
                  <span className="mt-1 block line-clamp-2 text-[12.5px] font-semibold text-ink-800 group-hover:text-brand-700">
                    {neighbours.next.title}
                  </span>
                </Link>
              ) : null}
            </nav>

            <div className="mt-4">
              <Link
                href="/blogs"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-[12.5px] font-bold text-ink-700 ring-1 ring-line hover:bg-white hover:text-brand-700"
              >
                <ArrowLeft size={14} /> Back to blog
              </Link>
            </div>
          </div>

          {/* ------------------------------- sidebar ------------------------------- */}
          <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <h2 className="text-[13px] font-extrabold text-ink-900">Filter by Categories</h2>
              <ul className="mt-2.5 space-y-1">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/blogs?category=${category.slug}`}
                      className={
                        category.id === post.categoryId
                          ? "flex items-center justify-between gap-2 rounded px-2 py-1.5 text-[12px] font-bold text-brand-700"
                          : "flex items-center justify-between gap-2 rounded px-2 py-1.5 text-[12px] font-medium text-ink-600 hover:bg-surface hover:text-brand-700"
                      }
                    >
                      {category.name}
                      <span className="text-[10.5px] font-semibold text-ink-400">({category.count})</span>
                    </Link>
                  </li>
                ))}
                {categories.length === 0 ? <li className="text-[12px] text-ink-400">No categories yet.</li> : null}
              </ul>
            </div>

            {toc.length > 0 ? (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <h2 className="text-[13px] font-extrabold text-ink-900">Table of Contents</h2>
                <ol className="mt-2.5 space-y-1.5">
                  {toc.map((item, index) => (
                    <li key={item.id} className="flex gap-1.5 text-[12px] leading-snug">
                      <span className="text-ink-400">{index + 1}.</span>
                      <a href={`#${item.id}`} className="text-ink-600 hover:text-brand-700">
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {promo ? (
              <div className="group relative overflow-hidden rounded-2xl bg-brand-900">
                {promo.image ? (
                  <Image
                    src={promo.image}
                    alt={promo.title}
                    width={560}
                    height={720}
                    sizes="(max-width: 1024px) 100vw, 280px"
                    className="h-[280px] w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3.5">
                  <p className="text-[17px] font-black leading-tight text-white">
                    {promo.title}
                    {promo.titleAccent ? <span className="block text-accent-400">{promo.titleAccent}</span> : null}
                  </p>
                  <Link
                    href={promo.href || "/shop"}
                    className="mt-2 inline-flex h-8 items-center rounded-full bg-accent-500 px-3 text-[11px] font-bold text-brand-900 hover:bg-accent-400"
                  >
                    Buy now
                  </Link>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
              <p className="text-[12.5px] font-extrabold text-ink-900">Keep reading</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
                Browse every story in the{" "}
                <Link href="/blogs" className="font-semibold text-brand-700">
                  blog archive
                </Link>
                .
              </p>
            </div>
          </aside>
        </div>

        {/* ------------------------------- related ------------------------------- */}
        {related.length > 0 ? (
          <section aria-labelledby="related-heading" className="mt-12 border-t border-line pt-9">
            <div className="mx-auto max-w-xl text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-600">Related News &amp; Blogs</p>
              <h2 id="related-heading" className="mt-1.5 text-[22px] font-black text-ink-900 sm:text-[26px]">
                Latest Related <span className="text-brand-600">News &amp; Blogs</span>
              </h2>
            </div>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((entry) => (
                <li key={entry.id} className="contents">
                  <RelatedCard post={entry} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

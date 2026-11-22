import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Search } from "lucide-react";
import { ShopHero } from "@/components/shop/shop-hero";
import { Pagination } from "@/components/shop/pagination";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import {
  countPosts,
  getBlogCategoriesWithCounts,
  getPosts,
  getPromoBanners,
  type PostRow,
} from "@/lib/repositories/content";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const PER_PAGE = 5;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}): Promise<Metadata> {
  const { q = "", category = "" } = await searchParams;
  const title = q ? `Search “${q}” · Blog` : "Our Blog — news, recipes and store notes";
  const description =
    "Practical guides from the Niketon Mart team: seasonal produce, shopping lists, storage tips and what is new in the aisles.";
  return {
    title,
    description,
    alternates: { canonical: category ? `/blogs?category=${category}` : "/blogs" },
    robots: { index: !q, follow: true },
    openGraph: { title, description, url: "/blogs", type: "website" },
  };
}

function AuthorBadge({ post }: { post: PostRow }) {
  const initials = post.author
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-50 text-[9px] font-black text-brand-700">
        {initials}
      </span>
      <span className="font-semibold text-ink-700">{post.author}</span>
    </span>
  );
}

function PostCard({ post }: { post: PostRow }) {
  return (
    <article className="group overflow-hidden rounded-2xl bg-white ring-1 ring-line transition-shadow hover:shadow-[0_16px_40px_-28px_rgba(15,61,46,0.55)]">
      <Link href={`/blogs/${post.slug}`} className="relative block aspect-[16/7] overflow-hidden bg-surface">
        {post.image ? (
          <Image
            src={post.image}
            alt={post.title}
            fill
            sizes="(max-width: 1024px) 100vw, 780px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[12px] text-ink-300">No cover image</span>
        )}
        {post.category ? (
          <span className="absolute bottom-3 left-3 inline-flex rounded-md bg-accent-500 px-2.5 py-1 text-[10.5px] font-bold text-brand-900 shadow-sm">
            {post.category}
          </span>
        ) : null}
        <span className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-brand-600 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <ArrowUpRight size={16} />
        </span>
      </Link>

      <div className="p-4 sm:p-5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink-400">
          <AuthorBadge post={post} />
          <span aria-hidden="true">•</span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} /> {formatDate(post.publishedAt)}
          </span>
        </p>
        <h3 className="mt-2 text-[16.5px] font-extrabold leading-snug text-ink-900 sm:text-[18px]">
          <Link href={`/blogs/${post.slug}`} className="transition-colors hover:text-brand-700">
            {post.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">{post.excerpt}</p>
        <Link
          href={`/blogs/${post.slug}`}
          className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-brand-700 hover:text-brand-800"
        >
          Read More <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  );
}

/**
 * Blog listing (reference 4)
 * --------------------------
 * Wide article cards on the left, sidebar on the right. Everything is real:
 * posts come from `posts` (published + visible + date reached), the category list
 * from `blog_categories` with live counts, recent posts from the newest four and
 * the promo card from `promo_banners`. Search, category and page live in the URL.
 */
export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; page?: string }>;
}) {
  const { q = "", category = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const [categories, promos, total] = await Promise.all([
    getBlogCategoriesWithCounts(),
    getPromoBanners(),
    countPosts({ search: q, category }),
  ]);

  const activeCategory = category ? categories.find((item) => item.slug === category) : undefined;
  const posts = await getPosts({ search: q, category, page: currentPage, perPage: PER_PAGE });
  const recent = await getPosts({ limit: 4 });
  const promo = promos[0];
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  /** One builder for every link on this page, so filters and paging never drift apart. */
  const link = (patch: { q?: string; category?: string; page?: number } = {}) => {
    const next = { q, category, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.category) params.set("category", next.category);
    if (next.page > 1) params.set("page", String(next.page));
    const text = params.toString();
    return text ? `/blogs?${text}` : "/blogs";
  };
  const hrefPattern = link({ page: 1 }) + (link({ page: 1 }).includes("?") ? "&" : "?") + "page={page}";

  return (
    <>
      <ShopHero title="Our Blog" current="Blog" />

      <section className="container-page py-9 sm:py-12">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-brand-600">News &amp; Blogs</p>
          <h2 className="mt-1.5 text-[24px] font-black leading-tight text-ink-900 sm:text-[30px]">
            Our Latest <span className="text-brand-600">News &amp; Blogs</span>
          </h2>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_336px] lg:gap-9">
          {/* ------------------------------- posts ------------------------------- */}
          <div>
            {(q || activeCategory) && (
              <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="text-ink-500">Filtered by:</span>
                {activeCategory ? (
                  <Link
                    href={link({ category: "" })}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700 ring-1 ring-brand-100"
                  >
                    {activeCategory.name} <span aria-hidden="true">×</span>
                  </Link>
                ) : null}
                {q ? (
                  <Link
                    href={link({ q: "" })}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700 ring-1 ring-brand-100"
                  >
                    “{q}” <span aria-hidden="true">×</span>
                  </Link>
                ) : null}
                <Link href="/blogs" className="font-semibold text-ink-400 hover:text-brand-700">
                  Clear all
                </Link>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center">
                <p className="text-[15px] font-extrabold text-ink-900">
                  {q ? "No articles match that search" : "Nothing published here yet"}
                </p>
                <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
                  {q
                    ? `We could not find a story containing “${q}”. Try a shorter word such as “produce” or “delivery”.`
                    : "New stories appear here as soon as the team publishes them."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link
                    href="/blogs"
                    className="inline-flex h-9 items-center rounded-full bg-surface px-4 text-[12px] font-semibold text-ink-700 ring-1 ring-line hover:bg-white"
                  >
                    All articles
                  </Link>
                  <Link
                    href="/contact"
                    className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700"
                  >
                    Ask the team
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}

            {totalPages > 1 ? (
              <div className="mt-8 flex flex-col items-center gap-2">
                <Pagination
                  page={Math.min(currentPage, totalPages)}
                  totalPages={totalPages}
                  hrefPattern={hrefPattern}
                  label="Blog pages"
                />
                <p className="text-[11.5px] text-ink-400">
                  Page {Math.min(currentPage, totalPages)} of {totalPages} · {total} article{total === 1 ? "" : "s"}
                </p>
              </div>
            ) : null}
          </div>

          {/* ------------------------------ sidebar ------------------------------ */}
          <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <h2 className="text-[13.5px] font-extrabold text-ink-900">Search</h2>
              <form action="/blogs" method="get" role="search" className="mt-2.5">
                {category ? <input type="hidden" name="category" value={category} /> : null}
                <label className="relative block">
                  <span className="sr-only">Search articles</span>
                  <input
                    type="search"
                    name="q"
                    defaultValue={q}
                    placeholder="Search articles"
                    className="h-10 w-full rounded-lg border border-line bg-white pl-3 pr-10 text-[12.5px] text-ink-900 outline-none placeholder:text-ink-300 focus:border-brand-500"
                  />
                  <button
                    type="submit"
                    aria-label="Search"
                    className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md bg-brand-600 text-white hover:bg-brand-700"
                  >
                    <Search size={14} />
                  </button>
                </label>
              </form>
            </div>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <h2 className="text-[13.5px] font-extrabold text-ink-900">Popular Category</h2>
              <ul className="mt-2.5 space-y-1">
                {categories.length === 0 ? (
                  <li className="text-[12px] text-ink-400">Categories appear once posts are published.</li>
                ) : (
                  categories.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/blogs?category=${item.slug}`}
                        className={
                          activeCategory?.id === item.id
                            ? "flex items-center justify-between gap-2 rounded-md bg-brand-50 px-2 py-1.5 text-[12.5px] font-bold text-brand-700"
                            : "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[12.5px] font-medium text-ink-600 hover:bg-surface hover:text-brand-700"
                        }
                      >
                        {item.name}
                        <span className="text-[11px] font-semibold text-ink-400">({item.count})</span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <h2 className="text-[13.5px] font-extrabold text-ink-900">Recent Post</h2>
              <ul className="mt-2.5 space-y-3">
                {recent.slice(0, 3).map((post) => (
                  <li key={post.id}>
                    <Link href={`/blogs/${post.slug}`} className="group flex gap-2.5">
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-surface">
                        {post.image ? (
                          <Image src={post.image} alt="" fill sizes="56px" className="object-cover" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 block text-[12px] font-semibold leading-snug text-ink-800 group-hover:text-brand-700">
                          {post.title}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] text-ink-400">{formatDate(post.publishedAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {promo ? (
              <div className="group relative overflow-hidden rounded-2xl bg-brand-900">
                {promo.image ? (
                  <Image
                    src={promo.image}
                    alt={promo.title}
                    width={672}
                    height={880}
                    sizes="(max-width: 1024px) 100vw, 336px"
                    className="h-[330px] w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-accent-400">
                    {promo.badge || "This week"}
                  </p>
                  <p className="mt-1 text-[17px] font-black leading-tight text-white">
                    {promo.title}
                    {promo.titleAccent ? <span className="block text-accent-400">{promo.titleAccent}</span> : null}
                  </p>
                  <Link
                    href={promo.href || "/shop"}
                    className="mt-2.5 inline-flex h-8 items-center rounded-full bg-accent-500 px-3.5 text-[11.5px] font-bold text-brand-900 hover:bg-accent-400"
                  >
                    Shop now
                  </Link>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

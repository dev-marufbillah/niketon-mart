import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format";
import { getPosts } from "@/lib/repositories/content";
import { getSectionCopy } from "@/lib/repositories/homepage";

/** News & blogs strip — posts are managed in Admin → Website → Blog posts. */
export async function BlogSection() {
  const copy = await getSectionCopy("blog");
  const limit = Number(copy.limit ?? 3) || 3;
  const posts = await getPosts({ limit });
  if (posts.length === 0) return null;

  return (
    <section id="blog" aria-labelledby="blog-title" className="bg-surface py-14 sm:py-16 lg:py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow={String(copy.eyebrow ?? "News & Blogs")}
          title={String(copy.title ?? "Our Latest")}
          accent={String(copy.titleAccent ?? "News & Blogs")}
          action={
            <ButtonLink href={String(copy.ctaHref ?? "/blogs")} iconRight={<ArrowRight size={16} />}>
              {String(copy.ctaLabel ?? "View All")}
            </ButtonLink>
          }
          className="mb-8"
        />
        <h2 id="blog-title" className="sr-only">
          Our latest news and blogs
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:mx-auto lg:max-w-[1100px] lg:grid-cols-3">
          {posts.slice(0, 3).map((post) => (
            <article key={post.id} className="group">
              <Link href={`/blogs/${post.slug}`} className="block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-ink-100 lg:aspect-[16/9]">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    sizes="(max-width: 768px) 92vw, 400px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 bg-ink-900/10 transition-colors group-hover:bg-ink-900/20" />
                  <span className="absolute left-1/2 top-1/2 inline-flex size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-white shadow-cta transition-transform duration-300 group-hover:scale-110">
                    <ArrowRight size={19} className="-rotate-45" />
                  </span>
                  <span className="absolute -bottom-0 left-4 rounded-md bg-accent-500 px-3 py-1.5 text-[11.5px] font-bold text-brand-900">
                    {post.category}
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-2 text-[12.5px] text-ink-500">
                  <span className="font-medium">{post.author}</span>
                  <span className="size-1.5 rounded-full bg-brand-600" aria-hidden="true" />
                  <span>{formatDate(post.publishedAt)}</span>
                </div>

                <h3 className="mt-2 line-clamp-2 text-[17px] font-bold leading-snug text-ink-900 transition-colors group-hover:text-brand-700">
                  {post.title}
                </h3>
              </Link>
              <Link
                href={`/blogs/${post.slug}`}
                className="mt-3 inline-flex text-[13px] font-bold text-brand-700 underline decoration-brand-600/40 decoration-2 underline-offset-4 transition-colors hover:decoration-brand-600"
              >
                Read More
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

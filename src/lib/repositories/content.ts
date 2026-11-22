import "server-only";

import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";

/** One piece of rich article content, edited in the admin blog editor. */
export type PostBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "image"; src: string; alt?: string; caption?: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string; by?: string }
  | { type: "callout"; title: string; text: string; href?: string; label?: string }
  | { type: "columns"; items: { title: string; text: string }[] }
  | { type: "steps"; items: { title: string; text: string }[] };

export type HeroSlide = Row & {
  badge: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  image: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  mobileImage?: string;
  imageAlt?: string;
  imageFit?: "contain" | "cover";
  imagePosition?: "left" | "center" | "right";
  featureOne?: string;
  featureTwo?: string;
  visible: boolean;
  order: number;
};

export type PromoBanner = Row & {
  badge: string;
  title: string;
  titleAccent: string;
  description: string;
  href: string;
  image: string;
  tone: "light" | "yellow";
  visible: boolean;
  order: number;
};

export type TestimonialRow = Row & {
  quote: string;
  name: string;
  role: string;
  rating: number;
  avatar: string;
  visible: boolean;
  order: number;
};

export type PostRow = Row & {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categoryId?: string;
  author: string;
  authorId?: string;
  publishedAt: string;
  image: string;
  readTime: string;
  body?: string;
  blocks?: PostBlock[];
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  status: "published" | "draft";
  visible: boolean;
  order: number;
};

export type BlogCategoryRow = Row & {
  name: string;
  slug: string;
  description: string;
  visible: boolean;
  order: number;
};

export type AuthorRow = Row & {
  name: string;
  role: string;
  bio: string;
  avatar: string;
  visible: boolean;
  order: number;
};

export type FaqCategoryRow = Row & {
  name: string;
  slug: string;
  description: string;
  visible: boolean;
  order: number;
};

export type FaqRow = Row & {
  question: string;
  answer: string;
  categoryId?: string;
  visible: boolean;
  order: number;
};

export type ServiceRow = Row & {
  title: string;
  description: string;
  icon: string;
  visible: boolean;
  order: number;
};

export type PageRow = Row & {
  slug: string;
  title: string;
  subtitle: string;
  heroImage: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  visible: boolean;
  published: boolean;
  updatedAt: string;
};

/**
 * A repeatable, typed block on a CMS page (About, Contact…).
 * `data` holds the fields declared by the page-section schema, so a new field
 * is a schema change plus an admin field — no new table, no new screen.
 */
export type PageSectionRow = Row & {
  page: string;
  key: string;
  type: string;
  visible: boolean;
  order: number;
  data: Record<string, unknown>;
};

const byOrder = <T extends { order?: number }>(rows: T[]) =>
  rows.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const today = () => new Date().toISOString().slice(0, 10);

/** A post is public only when it is visible, published and its date has arrived. */
export function isPublicPost(post: PostRow): boolean {
  if (!post.visible || post.status !== "published") return false;
  const published = (post.publishedAt ?? "").slice(0, 10);
  return !published || published <= today();
}

export async function getHeroSlides(includeHidden = false): Promise<HeroSlide[]> {
  const db = await ensureDatabase();
  const rows = await db.list<HeroSlide>("hero_slides");
  return byOrder(rows.filter((row) => includeHidden || row.visible));
}

export async function getPromoBanners(includeHidden = false): Promise<PromoBanner[]> {
  const db = await ensureDatabase();
  const rows = await db.list<PromoBanner>("promo_banners");
  return byOrder(rows.filter((row) => includeHidden || row.visible));
}

export async function getTestimonials(includeHidden = false): Promise<TestimonialRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<TestimonialRow>("testimonials");
  return byOrder(rows.filter((row) => includeHidden || row.visible));
}

export type PostQuery = {
  includeHidden?: boolean;
  limit?: number;
  category?: string;
  tag?: string;
  search?: string;
  page?: number;
  perPage?: number;
  excludeSlug?: string;
};

/** Every published post, newest first, with optional category / tag / search filters. */
export async function getPosts(options: PostQuery = {}): Promise<PostRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<PostRow>("posts");
  const search = (options.search ?? "").trim().toLowerCase();

  let filtered = rows.filter((row) => (options.includeHidden ? true : isPublicPost(row)));

  if (options.category) {
    filtered = filtered.filter(
      (row) => row.categoryId === options.category || row.slug === options.category || row.category === options.category,
    );
  }
  if (options.tag) {
    filtered = filtered.filter((row) => (row.tags ?? []).includes(options.tag!));
  }
  if (options.excludeSlug) {
    filtered = filtered.filter((row) => row.slug !== options.excludeSlug);
  }
  if (search) {
    filtered = filtered.filter((row) =>
      [row.title, row.excerpt, row.author, row.category, (row.tags ?? []).join(" "), row.body ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }

  const sorted = filtered.sort((a, b) => {
    const left = `${a.publishedAt ?? ""}-${a.order ?? 0}`;
    const right = `${b.publishedAt ?? ""}-${b.order ?? 0}`;
    return right.localeCompare(left);
  });

  if (options.perPage) {
    const page = Math.max(1, options.page ?? 1);
    return sorted.slice((page - 1) * options.perPage, page * options.perPage);
  }
  return options.limit ? sorted.slice(0, options.limit) : sorted;
}

export async function countPosts(options: PostQuery = {}): Promise<number> {
  return (await getPosts(options)).length;
}

export async function getPostBySlug(slug: string): Promise<PostRow | null> {
  const db = await ensureDatabase();
  const rows = await db.list<PostRow>("posts", { where: { slug } });
  const post = rows[0];
  if (!post || !isPublicPost(post)) return null;
  return post;
}

/** Previous / next article in publication order, for the article footer. */
export async function getPostNeighbours(slug: string): Promise<{ previous: PostRow | null; next: PostRow | null }> {
  const posts = await getPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return { previous: null, next: null };
  return {
    previous: posts[index + 1] ?? null, // older
    next: posts[index - 1] ?? null, // newer
  };
}

export async function getBlogCategories(includeHidden = false): Promise<BlogCategoryRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<BlogCategoryRow>("blog_categories");
  return byOrder(rows.filter((row) => includeHidden || row.visible));
}

export async function getAuthors(includeHidden = false): Promise<AuthorRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<AuthorRow>("authors");
  return byOrder(rows.filter((row) => includeHidden || row.visible));
}

/** Category names with a real post count, for the blog sidebar. */
export async function getBlogCategoriesWithCounts(): Promise<(BlogCategoryRow & { count: number })[]> {
  const [categories, posts] = await Promise.all([getBlogCategories(), getPosts()]);
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const key of [post.categoryId, post.slug && post.category].filter(Boolean) as string[]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return categories
    .map((category) => ({
      ...category,
      count: counts.get(category.id) ?? counts.get(category.name) ?? 0,
    }))
    .filter((category) => category.count > 0);
}

/** Tags that actually appear on a published post. */
export async function getPostTags(): Promise<string[]> {
  const posts = await getPosts();
  return Array.from(new Set(posts.flatMap((post) => post.tags ?? []))).sort();
}

export async function getFaqCategories(includeHidden = false): Promise<FaqCategoryRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<FaqCategoryRow>("faq_categories");
  return byOrder(rows.filter((row) => includeHidden || row.visible));
}

export async function getFaqs(includeHidden = false): Promise<FaqRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<FaqRow>("faqs");
  return byOrder(rows.filter((row) => includeHidden || row.visible));
}

/** FAQs grouped by their category, with counts — the FAQ page renders this. */
export async function getFaqGroups(): Promise<{
  categories: (FaqCategoryRow & { count: number })[];
  faqs: FaqRow[];
  uncategorised: FaqRow[];
}> {
  const [categories, faqs] = await Promise.all([getFaqCategories(), getFaqs()]);
  const grouped = categories.map((category) => ({
    ...category,
    count: faqs.filter((faq) => faq.categoryId === category.id).length,
  }));
  const known = new Set(categories.map((category) => category.id));
  return {
    categories: grouped.filter((category) => category.count > 0),
    faqs: faqs.filter((faq) => faq.categoryId && known.has(faq.categoryId)),
    uncategorised: faqs.filter((faq) => !faq.categoryId || !known.has(faq.categoryId)),
  };
}

export async function getServiceFeatures(includeHidden = false): Promise<ServiceRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<ServiceRow>("service_features");
  return byOrder(rows.filter((row) => includeHidden || row.visible));
}

export async function getPages(includeHidden = false): Promise<PageRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<PageRow>("pages");
  return rows
    .filter((row) => includeHidden || (row.visible && row.published))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getPageBySlug(slug: string): Promise<PageRow | null> {
  const db = await ensureDatabase();
  const rows = await db.list<PageRow>("pages", { where: { slug } });
  const page = rows[0];
  if (!page || !page.visible || !page.published) return null;
  return page;
}

/** Raw page record regardless of publish state — used so an unpublished page 404s. */
export async function getPageRecord(slug: string): Promise<PageRow | null> {
  const db = await ensureDatabase();
  const rows = await db.list<PageRow>("pages", { where: { slug } });
  return rows[0] ?? null;
}

/** Ordered, visible blocks for one CMS page (about, contact …). */
export async function getPageSections(page: string, includeHidden = false): Promise<PageSectionRow[]> {
  const db = await ensureDatabase();
  const rows = await db.list<PageSectionRow>("page_sections");
  return byOrder(rows.filter((row) => row.page === page && (includeHidden || row.visible)));
}

export function pageSectionData<T extends Record<string, unknown>>(section: PageSectionRow): T {
  return (section.data ?? {}) as T;
}

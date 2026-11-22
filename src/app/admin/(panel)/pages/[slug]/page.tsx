import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PageMetaForm, PageSectionForm } from "@/components/admin/page-section-form";
import { getPageSchema, getSectionSchema } from "@/lib/content/page-sections";
import { requirePermission } from "@/lib/auth/session";
import { ensureDatabase } from "@/lib/db";
import { listMedia } from "@/lib/repositories/media";
import { getPageSections, type PageRow, type PageSectionRow } from "@/lib/repositories/content";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const schema = getPageSchema(slug);
  return { title: schema?.label ?? "Page" };
}

/**
 * CMS page builder (About, Contact).
 * Page settings on the left, every block below it in the order the storefront
 * renders them. Blocks are typed, so each one shows only the fields it uses.
 */
export default async function PageBuilder({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requirePermission("content.view");
  const { slug } = await params;
  const schema = getPageSchema(slug);
  if (!schema) notFound();

  const db = await ensureDatabase();
  const pages = await db.list<PageRow>("pages", { where: { slug } });
  const page = pages[0];
  if (!page) notFound();

  const [sections, media] = await Promise.all([getPageSections(slug, true), listMedia()]);
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const storefront =
    schema.path ?? (slug === "about" ? "/about" : slug === "contact" ? "/contact" : `/${slug}`);

  return (
    <div>
      <AdminPageHeader
        title={schema.label}
        description={schema.description}
        action={{ href: storefront, label: "Preview page" }}
        backHref={{ href: "/admin/r/pages", label: "All pages" }}
        meta={`${ordered.length} block${ordered.length === 1 ? "" : "s"} · stored in page_sections`}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <div className="space-y-3">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h2 className="mb-3 text-[14px] font-extrabold text-ink-900">Page settings</h2>
            <PageMetaForm
              page={slug}
              initial={{
                title: page.title,
                subtitle: page.subtitle ?? "",
                seoTitle: page.seoTitle ?? "",
                seoDescription: page.seoDescription ?? "",
                published: Boolean(page.published),
              }}
            />
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
              The page URL is <code className="rounded bg-surface px-1.5 py-0.5">{storefront}</code>. The footer,
              header and service strip around the page are shared with the rest of the store.
            </p>
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h2 className="text-[14px] font-extrabold text-ink-900">Where the rest comes from</h2>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-ink-500">
              <li>
                Address, phone, email and social links:{" "}
                <Link href="/admin/settings" className="font-semibold text-brand-700">
                  Site settings
                </Link>
                .
              </li>
              {slug === "contact" ? (
                <li>
                  Opening hours and the sentence under the form:{" "}
                  <Link href="/admin/settings" className="font-semibold text-brand-700">
                    Site settings → Contact details
                  </Link>
                  .
                </li>
              ) : null}
              <li>
                The free-shipping / payment / support strip:{" "}
                <Link href="/admin/r/service_features" className="font-semibold text-brand-700">
                  Service benefits
                </Link>
                .
              </li>
              <li>
                The newsletter band:{" "}
                <Link href="/admin/homepage" className="font-semibold text-brand-700">
                  Homepage → Newsletter
                </Link>
                .
              </li>
            </ul>
          </section>
        </div>

        <div className="space-y-3">
          {ordered.length === 0 ? (
            <p className="rounded-2xl bg-white p-4 text-[12.5px] text-ink-500 ring-1 ring-line">
              This page has no blocks yet. Reseed the database, or add sections in{" "}
              <code className="rounded bg-surface px-1.5 py-0.5">page_sections</code>.
            </p>
          ) : (
            ordered.map((section: PageSectionRow, index) => {
              const sectionSchema = getSectionSchema(slug, section.type);
              if (!sectionSchema) return null;
              return (
                <PageSectionForm
                  key={section.id}
                  page={slug}
                  sectionKey={section.key}
                  label={sectionSchema.label}
                  description={sectionSchema.description}
                  fields={sectionSchema.fields}
                  data={section.data ?? {}}
                  visible={section.visible}
                  media={media.map((item) => ({ id: item.id, url: item.url, alt: item.alt, folder: item.folder }))}
                  isFirst={index === 0}
                  isLast={index === ordered.length - 1}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

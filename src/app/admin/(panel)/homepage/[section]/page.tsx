import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SectionCopyForm } from "@/components/admin/section-copy-form";
import { sectionSchemas, type HomeSectionKey } from "@/lib/content/section-schema";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { getHomepage } from "@/lib/repositories/homepage";
import { ensureDatabase } from "@/lib/db";
import { listMedia } from "@/lib/repositories/media";
import type { Product } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await params;
  const schema = sectionSchemas[section as HomeSectionKey];
  return { title: schema ? schema.label : "Section" };
}

export default async function AdminHomepageSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const search = await searchParams;
  const schema = sectionSchemas[section as HomeSectionKey];
  if (!schema) notFound();

  const user = await requireAdmin();
  if (!can(user, "content.manage")) redirect("/admin/homepage");

  const db = await ensureDatabase();
  const [homepage, products, media] = await Promise.all([
    getHomepage(),
    db.list<Product>("products"),
    listMedia(),
  ]);

  const copy = { ...(homepage.copy?.[section] ?? {}) };
  const sectionMeta = homepage.sections.find((entry) => entry.key === section);

  return (
    <div>
      <AdminPageHeader
        title={schema.label}
        description={schema.description}
        backHref={{ href: "/admin/homepage", label: "Homepage sections" }}
        meta={sectionMeta && !sectionMeta.visible ? "This section is currently hidden on the website." : undefined}
      />

      {schema.relatedModule ? (
        <p className="mb-4 rounded-xl bg-white px-3.5 py-2.5 text-[12px] text-ink-500 ring-1 ring-line">
          The content of this block is managed in{" "}
          <Link href={schema.relatedModule.href} className="font-semibold text-brand-700">
            {schema.relatedModule.label} →
          </Link>
        </p>
      ) : null}

      {typeof search.saved === "string" ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700">
          Section saved. The homepage has been updated.
        </p>
      ) : null}

      {schema.fields.length === 0 ? (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
          <p className="text-[13px] text-ink-600">
            This section has no editable copy of its own — visibility and order are controlled on the homepage
            screen.
          </p>
        </div>
      ) : (
        <SectionCopyForm
          sectionKey={section as HomeSectionKey}
          fields={schema.fields}
          initial={copy}
          products={products.map((product) => ({
            id: product.id,
            name: product.name,
            image: product.image,
            price: product.price,
            unit: product.unit,
            stock: product.stock ?? 0,
          }))}
          media={media.map((item) => ({ id: item.id, url: item.url, alt: item.alt, folder: item.folder }))}
        />
      )}
    </div>
  );
}

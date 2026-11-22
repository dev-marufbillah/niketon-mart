import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ResourceForm } from "@/components/admin/resource-form";
import { getResource } from "@/lib/admin/resources";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { ensureDatabase } from "@/lib/db";
import { listMedia } from "@/lib/repositories/media";
import { resolveFieldOptions } from "@/lib/admin/field-options";
import type { Category, Product } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}): Promise<Metadata> {
  const { resource } = await params;
  const config = getResource(resource);
  return { title: config ? `Edit ${config.singular}` : "Edit record" };
}

export default async function ResourceEditPage({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource, id } = await params;
  const config = getResource(resource);
  if (!config) notFound();

  const user = await requireAdmin();
  if (!can(user, config.permission)) redirect("/admin");

  const db = await ensureDatabase();
  const row = await db.get(config.collection, id);
  if (!row) notFound();

  const [products, media, categories, fields] = await Promise.all([
    db.list<Product>("products"),
    listMedia(),
    db.list<Category>("categories"),
    resolveFieldOptions(config.fields),
  ]);
  const name = String(row.title ?? row.name ?? row.code ?? row.email ?? id);
  const updatedAt = String(row.updatedAt ?? row.createdAt ?? "");
  const updatedLabel = updatedAt ? new Date(updatedAt).toLocaleString() : "—";
  const previewHref = config.previewPath?.(row as Record<string, unknown>);

  return (
    <div>
      <AdminPageHeader
        title={name}
        description={config.description}
        backHref={{ href: `/admin/r/${config.key}`, label: config.label }}
        meta={`Last updated ${updatedLabel}`}
      />

      {previewHref ? (
        <p className="mb-4">
          <Link
            href={previewHref}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50"
          >
            Preview on website ↗
          </Link>
        </p>
      ) : null}

      <ResourceForm
        resourceKey={config.key}
        id={id}
        fields={fields}
        initial={row as Record<string, unknown>}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          image: product.image,
          price: product.price,
          unit: product.unit,
          stock: product.stock ?? 0,
        }))}
        media={media.map((item) => ({ id: item.id, url: item.url, alt: item.alt, folder: item.folder }))}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          productCount: products.filter((product) => product.categoryId === category.id).length,
        }))}
        singular={config.singular}
        backHref={`/admin/r/${config.key}`}
      />
    </div>
  );
}

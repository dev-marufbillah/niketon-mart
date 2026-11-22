import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ResourceForm } from "@/components/admin/resource-form";
import { getResource } from "@/lib/admin/resources";
import { defaultsFor } from "@/lib/admin/fields";
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
  params: Promise<{ resource: string }>;
}): Promise<Metadata> {
  const { resource } = await params;
  const config = getResource(resource);
  return { title: config ? `New ${config.singular}` : "New record" };
}

export default async function ResourceCreatePage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  const config = getResource(resource);
  if (!config) notFound();

  const user = await requireAdmin();
  if (!can(user, config.permission)) redirect("/admin");
  if (config.canCreate === false) redirect(`/admin/r/${config.key}`);

  const db = await ensureDatabase();
  const [products, media, categories, fields] = await Promise.all([
    db.list<Product>("products"),
    listMedia(),
    db.list<Category>("categories"),
    resolveFieldOptions(config.fields),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={`New ${config.singular}`}
        description={config.description}
        backHref={{ href: `/admin/r/${config.key}`, label: config.label }}
      />
      <ResourceForm
        resourceKey={config.key}
        fields={fields}
        initial={defaultsFor(fields)}
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

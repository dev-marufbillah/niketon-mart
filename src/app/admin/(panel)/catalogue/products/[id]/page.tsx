import { requirePermission } from "@/lib/auth/session";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, ExternalLink } from "lucide-react";
import { getAdminCatalogue } from "@/lib/catalogue/repository";
import { ProductForm } from "@/components/admin/product-form";
import { listPresets } from "@/lib/preparation/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit product",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("products.manage");
  const { id } = await params;
  const [catalogue, presets] = await Promise.all([getAdminCatalogue(), listPresets()]);
  const product = catalogue.products.find((entry) => entry.id === id);
  if (!product) notFound();

  return (
    <div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
        <Link href="/admin" className="hover:text-brand-700">Admin</Link>
        <ChevronRight size={13} className="text-ink-300" />
        <Link href="/admin/catalogue/products" className="hover:text-brand-700">Products</Link>
        <ChevronRight size={13} className="text-ink-300" />
        <span className="font-semibold text-ink-800">{product.name}</span>
      </nav>

      <div className="mb-5 mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[24px] leading-tight sm:text-[28px]">
          Edit <span className="text-brand-600">{product.name}</span>
        </h1>
        <Link
          href={`/product/${product.slug}`}
          className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-white px-3.5 text-[12.5px] font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50"
        >
          <ExternalLink size={13} /> View on storefront
        </Link>
      </div>

      <ProductForm
        product={product}
        categories={catalogue.categories}
        brands={catalogue.brands}
        productTypes={catalogue.productTypes}
        presets={presets.map((preset) => ({
          id: preset.id,
          name: preset.name,
          category: preset.category,
          description: preset.description,
          groups: preset.groups,
        }))}
      />
    </div>
  );
}

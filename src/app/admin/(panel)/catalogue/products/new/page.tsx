import { requirePermission } from "@/lib/auth/session";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAdminCatalogue } from "@/lib/catalogue/repository";
import { ProductForm } from "@/components/admin/product-form";
import { listPresets } from "@/lib/preparation/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New product",
};

export default async function NewProductPage() {
  await requirePermission("products.manage");
  const [catalogue, presets] = await Promise.all([getAdminCatalogue(), listPresets()]);

  return (
    <div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
        <Link href="/admin" className="hover:text-brand-700">
          Admin
        </Link>
        <ChevronRight size={13} className="text-ink-300" />
        <Link href="/admin/catalogue/products" className="hover:text-brand-700">
          Products
        </Link>
        <ChevronRight size={13} className="text-ink-300" />
        <span className="font-semibold text-ink-800">New product</span>
      </nav>

      <h1 className="mb-5 mt-3 text-[24px] leading-tight sm:text-[28px]">
        Create a <span className="text-brand-600">product</span>
      </h1>

      <ProductForm
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

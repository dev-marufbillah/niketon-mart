import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getAdminCatalogue } from "@/lib/catalogue/repository";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categories & Brands",
  description: "Manage the taxonomy that powers the shop filters.",
};

export default async function TaxonomyPage() {
  const user = await requirePermission("products.view");
  const catalogue = await getAdminCatalogue();

  return (
    <div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12.5px] text-ink-500">
        <Link href="/admin" className="hover:text-brand-700">
          Admin
        </Link>
        <ChevronRight size={13} className="text-ink-300" />
        <span className="font-semibold text-ink-800">Categories &amp; Brands</span>
      </nav>

      <h1 className="mb-1.5 mt-3 text-[24px] leading-tight sm:text-[28px]">
        Categories, brands &amp; <span className="text-brand-600">types</span>
      </h1>
      <p className="mb-6 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">
        The shop builds its filter groups from this data — nothing is hardcoded. Create a
        category, brand or product type here and it appears on{" "}
        <Link href="/home-grocery" className="font-semibold text-brand-700 hover:underline">
          /home-grocery
        </Link>{" "}
        on the next request. Items still in use by a product can’t be deleted.
      </p>

      {can(user, "products.manage") ? (
        <TaxonomyManager categories={catalogue.categories} brands={catalogue.brands} productTypes={catalogue.productTypes} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { label: "Categories", rows: catalogue.categories },
            { label: "Brands", rows: catalogue.brands },
            { label: "Product types", rows: catalogue.productTypes },
          ].map(({ label, rows }) => (
            <section key={label} className="rounded-2xl bg-white p-5 ring-1 ring-line">
              <h2 className="font-bold">{label} <span className="text-xs text-ink-400">· read only</span></h2>
              <ul className="mt-3 space-y-2 text-sm">{rows.map((row) => <li key={row.id}>{row.name}</li>)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

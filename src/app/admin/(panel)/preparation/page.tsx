import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PreparationManager } from "@/components/admin/preparation-manager";
import { requirePermission } from "@/lib/auth/session";
import { getPreparationOverview, listPresets } from "@/lib/preparation/repository";
import { formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preparation & cutting" };

export default async function AdminPreparationPage() {
  await requirePermission("products.manage");
  const [presets, overview] = await Promise.all([listPresets(true), getPreparationOverview()]);

  const withoutPrep = overview.products.filter(
    (product) => !product.prepEnabled && ["fish", "meat-poultry", "vegetables"].includes(product.categoryId),
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Preparation & cutting"
        description="One place for how fresh products are cleaned and cut. A preset is a starting point — each product keeps its own copy, and the order stores exactly what the shopper chose."
        action={{ href: "/admin/catalogue/products/new", label: "New product" }}
        meta={`${overview.stats.prepared} of ${overview.stats.total} products offer preparation · ${overview.stats.options} options across ${overview.stats.groups} groups`}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Products with options", value: overview.stats.prepared },
          { label: "Preparation options", value: overview.stats.options },
          { label: "Chargeable options", value: overview.stats.chargeable },
          { label: "Presets in the library", value: overview.stats.presets },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-400">{card.label}</p>
            <p className="mt-1 text-[22px] font-extrabold leading-none text-ink-900">{card.value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-[14px] font-extrabold text-ink-900">Preset library</h2>
        <PreparationManager presets={presets} />
      </section>

      <section className="overflow-x-auto rounded-2xl bg-white ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[13.5px] font-extrabold text-ink-900">Products &amp; their preparation</h2>
          <Link href="/admin/catalogue/products" className="text-[11.5px] font-semibold text-brand-700 hover:underline">
            Open product list →
          </Link>
        </div>
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-line text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-400">
              <th className="px-4 py-2.5">Product</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Groups</th>
              <th className="px-3 py-2.5">Options</th>
              <th className="px-3 py-2.5">Instructions</th>
              <th className="px-3 py-2.5">Max charge</th>
              <th className="px-3 py-2.5">Stock</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {overview.products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-400">
                  No products yet.
                </td>
              </tr>
            ) : (
              overview.products.map((product) => (
                <tr key={product.id} className={product.prepEnabled ? undefined : "text-ink-500"}>
                  <td className="px-4 py-2.5 font-semibold text-ink-900">{product.name}</td>
                  <td className="px-3 py-2.5">{product.categoryLabel}</td>
                  <td className="px-3 py-2.5">{product.groupCount || "—"}</td>
                  <td className="px-3 py-2.5">{product.optionCount || "—"}</td>
                  <td className="px-3 py-2.5">{product.allowsInstructions ? "Yes" : "—"}</td>
                  <td className="px-3 py-2.5">{product.maxCharge ? formatPrice(product.maxCharge) : "—"}</td>
                  <td className="px-3 py-2.5">{product.stock}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Link
                      href={`/admin/catalogue/products/${product.id}`}
                      className="inline-flex h-7 items-center rounded-full bg-surface px-2.5 text-[10.5px] font-semibold text-ink-700 ring-1 ring-line hover:bg-ink-900/5"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {withoutPrep.length > 0 ? (
        <p className="rounded-2xl bg-amber-50 p-4 text-[11.5px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
          <strong>{withoutPrep.length} fresh product{withoutPrep.length === 1 ? "" : "s"}</strong> do not offer any
          preparation yet: {withoutPrep.slice(0, 6).map((product) => product.name).join(", ")}
          {withoutPrep.length > 6 ? "…" : ""}. Open a product and switch on
          “Offer cutting / cleaning / preparation” to give shoppers the choice.
        </p>
      ) : null}
    </div>
  );
}

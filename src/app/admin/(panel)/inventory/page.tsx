import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StockAdjustForm } from "@/components/admin/stock-adjust-form";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getInventoryOverview } from "@/lib/repositories/inventory";
import { movementReasonLabels } from "@/lib/orders/constants";
import { formatPrice, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory" };

export default async function AdminInventoryPage() {
  const user = await requirePermission("inventory.manage");
  const { products, movements, stats } = await getInventoryOverview();
  const attention = products.filter((product) => (product.stock ?? 0) <= 10).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));

  return (
    <div>
      <AdminPageHeader title="Inventory" description="Review stock levels, make adjustments and see the reason for each recorded movement." />
      <section aria-label="Inventory summary" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {[
          { label: "SKUs", value: String(stats.skus) },
          { label: "Units on hand", value: String(stats.units) },
          { label: "Value at listed prices", value: formatPrice(stats.value) },
          { label: "Low stock", value: String(stats.low) },
          { label: "Out of stock", value: String(stats.out) },
        ].map((item) => <div key={item.label} className="min-w-0 rounded-2xl border border-[#e4ece6] bg-white px-4 py-3"><p className="text-[11px] font-semibold text-[#596f60]">{item.label}</p><p className="mt-1 break-words text-[19px] font-extrabold tabular-nums text-[#254734]">{item.value}</p></div>)}
      </section>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.5fr)]">
        <section className="rounded-[20px] border border-[#e4ece6] bg-white p-4 sm:p-5">
          <h2 className="text-[15px] font-extrabold text-[#254734]">Adjust stock</h2>
          <p className="mb-4 mt-1 text-[12px] leading-relaxed text-[#5e7465]">Select a product and record a change. Use a positive number to add units or a negative number to remove them; you can also set an exact level.</p>
          <StockAdjustForm products={products.map((product) => ({ id: product.id, name: product.name, stock: product.stock ?? 0, unit: product.unit }))} />
        </section>
        <div className="min-w-0 space-y-3">
          <section className="rounded-[20px] border border-[#e4ece6] bg-white p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-extrabold text-[#254734]">Needs attention</h2><p className="mt-1 text-[11.5px] text-[#5e7465]">Products with 10 or fewer units.</p></div>
              {can(user, "products.view") ? <Link href="/admin/catalogue/products?stock=low" className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-brand-700 hover:underline">Open products <ArrowRight size={13} aria-hidden="true" /></Link> : null}
            </div>
            {attention.length === 0 ? <p className="rounded-xl bg-[#f7faf8] p-4 text-[12px] text-[#5d7365]">No products currently need stock attention.</p> : (
              <ul className="max-h-[280px] divide-y divide-[#eef3ef] overflow-y-auto pr-1">{attention.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-2 py-2.5 text-[12.5px]"><span className="min-w-0 flex-1 truncate font-semibold text-[#405a49]">{product.name}</span><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${(product.stock ?? 0) <= 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{product.stock ?? 0} left</span><span className="w-[55px] shrink-0 truncate text-right text-[11px] text-ink-500">{product.unit}</span></li>
              ))}</ul>
            )}
          </section>
          <section className="rounded-[20px] border border-[#e4ece6] bg-white p-4 sm:p-5">
            <h2 className="text-[15px] font-extrabold text-[#254734]">Recent stock movements</h2><p className="mb-3 mt-1 text-[11.5px] text-[#5e7465]">The latest changes recorded in your stock ledger.</p>
            {movements.length === 0 ? <p className="rounded-xl bg-[#f7faf8] p-4 text-[12px] leading-relaxed text-[#5d7365]">No movements yet. Stock changes from orders, edits and adjustments appear here.</p> : (
              <ul className="divide-y divide-[#eef3ef]">{movements.map((movement) => (
                <li key={movement.id} className="flex items-center justify-between gap-3 py-2.5 text-[12px]"><span className="min-w-0 flex-1"><span className="block truncate font-bold text-[#405a49]">{movement.productName}</span><span className="text-[11px] text-ink-500">{movementReasonLabels[movement.reason] ?? movement.reason}{movement.reference ? ` · ${movement.reference}` : ""} · {formatDate(movement.createdAt)}</span></span><span className={`shrink-0 font-bold tabular-nums ${movement.delta < 0 ? "text-red-600" : "text-brand-700"}`}>{movement.delta > 0 ? "+" : ""}{movement.delta}</span><span className="w-[46px] shrink-0 text-right text-[11px] tabular-nums text-ink-500">→ {movement.balance}</span></li>
              ))}</ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

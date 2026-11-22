import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { formatPrice } from "@/lib/utils/currency";
import type { Metadata } from "next";
import Link from "next/link";
import { getAdminCatalogue } from "@/lib/catalogue/repository";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ProductTable } from "@/components/admin/product-table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Products",
  description: "Manage the product catalogue — pricing, stock, visibility and merchandising.",
};

export default async function AdminProductsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission("products.view");
  const params = await searchParams;
  const lowStock = params.stock === "low";
  const catalogue = await getAdminCatalogue();
  const canManage = can(user, "products.manage");
  const readOnlyProducts = lowStock ? catalogue.products.filter((product) => (product.stock ?? 0) <= 10) : catalogue.products;

  return (
    <div>
      <AdminPageHeader
        title="Shop products"
        description="Manage the catalogue, prices, stock and visibility. Prices and stock are validated on the server."
        action={canManage ? { href: "/admin/catalogue/products/new", label: "New product" } : undefined}
      />
      {canManage ? (
        <ProductTable key={lowStock ? "low" : "all"} products={catalogue.products} categories={catalogue.categories} initialStatus={lowStock ? "low" : "all"} />
      ) : (
        <section className="rounded-[20px] border border-[#e4ece6] bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-[#203c2c]">Products <span className="text-xs font-medium text-ink-500">· read only{lowStock ? " · low or out of stock" : ""}</span></h2>
            {lowStock ? <Link href="/admin/catalogue/products" className="text-[12px] font-bold text-brand-700 hover:underline">Show all products</Link> : null}
          </div>
          {readOnlyProducts.length === 0 ? <p className="py-3 text-sm text-ink-500">No products match this view.</p> : (
            <ul className="divide-y divide-line">{readOnlyProducts.map((product) => (
              <li key={product.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span>{product.name} · {product.categoryLabel}</span><span>{formatPrice(product.price)} · {product.stock ?? 0} in stock</span>
              </li>
            ))}</ul>
          )}
        </section>
      )}
    </div>
  );
}

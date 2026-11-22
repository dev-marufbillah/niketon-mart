import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity, ArrowRight, ArrowUpRight, Boxes, ClipboardList, Database, Layers3,
  Package, ShoppingBag, Store, Tags, TriangleAlert, WalletCards,
  type LucideIcon,
} from "lucide-react";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { requireAdmin } from "@/lib/auth/session";
import { can, roleDefinitions } from "@/lib/auth/permissions";
import { getSalesAnalytics, getOrderStats, orderStatuses } from "@/lib/repositories/orders";
import { getInventoryOverview } from "@/lib/repositories/inventory";
import { getCustomerStats } from "@/lib/repositories/customers";
import { listActivity } from "@/lib/repositories/activity";
import { getCatalogueStats } from "@/lib/catalogue/repository";
import { dbInfo } from "@/lib/db";
import { formatPrice, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Dashboard",
  description: "Sales, orders, stock and website activity at a glance.",
};

const panel = "min-w-0 rounded-[20px] border border-[#e4ece6] bg-white p-4 shadow-[0_8px_25px_-22px_rgba(24,64,41,0.28)] sm:p-5";
const panelLink = "inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-[#1b8057] hover:text-[#10563a] hover:underline";

function StatCard({ label, value, hint, href, icon: Icon, tone = "default" }: {
  label: string; value: string; hint?: string; href?: string; icon: LucideIcon; tone?: "default" | "warn" | "good";
}) {
  const body = (
    <div className={`flex h-full min-w-0 flex-col rounded-[18px] border border-[#e4ece6] bg-white p-4 shadow-[0_8px_25px_-22px_rgba(24,64,41,0.3)] transition-shadow sm:p-5 ${href ? "hover:border-[#bddcc8] hover:shadow-card" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold leading-snug text-[#667e6e] sm:text-[12px]">{label}</span>
        <span className={`inline-flex size-9 shrink-0 items-center justify-center rounded-xl ${tone === "warn" ? "bg-[#fff5df] text-[#a46b08]" : tone === "good" ? "bg-[#e6f5eb] text-[#1a8053]" : "bg-[#f0f5f1] text-[#597967]"}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <span className={`mt-2 break-words text-[24px] font-extrabold leading-tight tracking-[-0.03em] tabular-nums sm:text-[27px] ${tone === "good" ? "text-[#187e53]" : tone === "warn" ? "text-[#9b680b]" : "text-[#203c2c]"}`}>{value}</span>
      {hint ? <span className="mt-2 text-[11px] leading-relaxed text-[#596f60] sm:text-[11.5px]">{hint}</span> : null}
    </div>
  );
  return href ? <Link href={href} className="min-w-0 rounded-[18px]">{body}</Link> : body;
}

function SectionHeading({ title, detail, href, linkLabel }: { title: string; detail?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-extrabold text-[#203c2c]">{title}</h2>
        {detail ? <p className="mt-1 text-[11.5px] leading-relaxed text-[#596f60]">{detail}</p> : null}
      </div>
      {href && linkLabel ? <Link href={href} className={panelLink}>{linkLabel} <ArrowRight size={13} aria-hidden="true" /></Link> : null}
    </div>
  );
}

export default async function AdminDashboardPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await requireAdmin();
  const denied = typeof params.denied === "string" ? params.denied : null;

  const canOrders = can(user, "orders.view");
  const canInventory = can(user, "inventory.manage");
  const canCustomers = can(user, "customers.view");
  const canAudit = can(user, "settings.manage");
  const canProducts = can(user, "products.view");
  const canTaxonomy = can(user, "products.manage");
  const canContent = can(user, "content.view");

  const [orderStats, analytics, inventory, customers, activity, catalogue, db] = await Promise.all([
    canOrders ? getOrderStats() : Promise.resolve(null),
    canOrders ? getSalesAnalytics() : Promise.resolve(null),
    canInventory ? getInventoryOverview() : Promise.resolve(null),
    canCustomers ? getCustomerStats() : Promise.resolve(null),
    canAudit ? listActivity(8) : Promise.resolve([]),
    getCatalogueStats(),
    dbInfo(),
  ]);
  const quickLinks = [
    canOrders ? { href: "/admin/orders", label: "Orders", icon: ClipboardList } : null,
    canProducts ? { href: "/admin/catalogue/products", label: "Products", icon: Package } : null,
    canInventory ? { href: "/admin/inventory", label: "Inventory", icon: Boxes } : null,
    canContent ? { href: "/admin/homepage", label: "Website", icon: Store } : null,
  ].filter((item): item is { href: string; label: string; icon: LucideIcon } => item !== null);
  const attention = inventory?.products.filter((product) => (product.stock ?? 0) <= 10)
    .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)).slice(0, 5) ?? [];
  const latestOrders = orderStats ? [...orderStats.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5) : [];
  const firstName = user.name.trim().split(/\s+/)[0] || "there";

  return (
    <div className="space-y-5">
      {denied ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] font-medium text-amber-800">
          Your role does not include access to “{denied.replace(".", " ")}”. Ask the owner if you need it.
        </p>
      ) : null}
      {user.mustChangePassword ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[12.5px] text-amber-900"><strong>You are using a starter password.</strong> Change it to keep the admin panel secure.</p>
          <Link href="/admin/account" className="rounded-xl bg-[#1b8057] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#166b49]">Change password</Link>
        </div>
      ) : null}

      <section className="relative overflow-hidden rounded-[24px] bg-[#174c38] p-5 text-white shadow-[0_16px_35px_-26px_rgba(14,76,45,0.7)] sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-28 size-72 rounded-full border-[48px] border-white/[0.04]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 left-[38%] size-60 rounded-full bg-[#77c590]/[0.08] blur-2xl" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#b8dbc4]"><span className="size-1.5 rounded-full bg-[#f7d47a]" /> Your workspace</p>
            <h1 className="mt-3 text-[25px] font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-[32px]">Welcome back, {firstName}</h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#d4e9db]">A clear view of your store, all in one place. You&apos;re signed in as {roleDefinitions[user.role].label.toLowerCase()}.</p>
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#c1dac9]">
              <span className="inline-flex items-center gap-1.5"><Database size={13} aria-hidden="true" /> Storage: {db.driver === "mongo" ? `MongoDB (${db.database})` : "File store (local)"}</span>
              <span aria-hidden="true" className="hidden text-[#8aaf98] sm:inline">·</span>
              <span>{catalogue.products} products</span>
            </p>
          </div>
          {quickLinks.length ? (
            <div className="w-full shrink-0 xl:w-[360px]">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b8dbc4]">Quick access</p>
              <div className="grid grid-cols-2 gap-2">
                {quickLinks.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className="flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-3 text-[12px] font-bold text-white transition-colors hover:bg-white/[0.16] focus-visible:outline-white">
                    <Icon size={15} aria-hidden="true" className="text-[#c8e8d1]" /><span className="flex-1">{label}</span><ArrowUpRight size={13} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="snapshot-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#557461]">At a glance</p><h2 id="snapshot-heading" className="mt-1 text-[17px] font-extrabold text-[#203c2c]">Store snapshot</h2></div>
          {canOrders ? <p className="text-[11px] text-[#788d7e]">Order values include unpaid orders; they are not payments received.</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {canOrders && orderStats ? (
            <>
              <StatCard label="Order value (all time)" value={formatPrice(orderStats.revenue)} hint={`${orderStats.todayCount} orders today (UTC) · ${formatPrice(orderStats.todayRevenue)} today, excluding cancelled`} href="/admin/orders" tone="good" icon={WalletCards} />
              <StatCard label="Orders" value={String(orderStats.total)} hint={`${orderStats.pending} pending · ${orderStats.inProgress} in progress`} href="/admin/orders" icon={ShoppingBag} />
              <StatCard label="Average order" value={formatPrice(orderStats.averageOrderValue)} hint={`${orderStats.completed} delivered · ${orderStats.cancelled} cancelled`} icon={ClipboardList} />
              <StatCard label="Unpaid orders" value={String(orderStats.unpaid)} hint="Payment still pending" href="/admin/orders?payment=unpaid" tone={orderStats.unpaid > 0 ? "warn" : "default"} icon={TriangleAlert} />
            </>
          ) : (
            <>
              <StatCard label="Products" value={String(catalogue.products)} hint={`${catalogue.published} published`} href={canProducts ? "/admin/catalogue/products" : undefined} icon={Package} />
              <StatCard label="Low stock" value={String(catalogue.lowStock)} hint={`${catalogue.outOfStock} out of stock`} tone="warn" href={canInventory ? "/admin/inventory" : undefined} icon={Boxes} />
              <StatCard label="Categories" value={String(catalogue.categories)} href={canTaxonomy ? "/admin/catalogue/taxonomy" : undefined} icon={Layers3} />
              <StatCard label="Brands" value={String(catalogue.brands)} href={canTaxonomy ? "/admin/catalogue/taxonomy" : undefined} icon={Tags} />
            </>
          )}
        </div>
      </section>

      {canOrders && analytics ? (
        <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
          <section className={panel}>
            <SectionHeading title="Order value — last 14 days" detail="Includes unpaid orders; excludes cancelled and refunded orders. Dates use UTC." href="/admin/orders" linkLabel="All orders" />
            <RevenueChart series={analytics.series} />
          </section>
          <section className={panel}>
            <SectionHeading title="Best sellers" detail="Products ranked by quantity ordered." />
            {analytics.bestSellers.length === 0 ? (
              <div className="flex min-h-[145px] flex-col items-center justify-center rounded-2xl bg-[#f7faf8] px-5 text-center">
                <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-[#e9f3ec] text-[#76a286]"><ShoppingBag size={19} aria-hidden="true" /></span>
                <p className="text-[12.5px] font-bold text-[#4e6b58]">No sales to show yet</p>
                <p className="mt-1 max-w-[250px] text-[11.5px] leading-relaxed text-[#617768]">Best sellers will appear here when orders are placed.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#eef2ef]">
                {analytics.bestSellers.map((product, index) => (
                  <li key={product.productId} className="flex items-center gap-3 py-2.5 first:pt-0">
                    <span className="w-4 text-center text-[11px] font-bold text-[#718779]">{index + 1}</span>
                    <span className="inline-flex size-10 shrink-0 overflow-hidden rounded-xl bg-[#f3f7f4]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product.image} alt="" className="size-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-bold text-[#294334]">{product.name}</span><span className="text-[11px] text-[#607667]">{product.quantity} sold</span></span>
                    <span className="text-[12px] font-bold tabular-nums text-[#41604d]">{formatPrice(product.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {canInventory && inventory ? (
          <section className={panel}>
            <SectionHeading title="Low stock" detail="Products with 10 or fewer units." href="/admin/inventory" linkLabel="Manage" />
            {attention.length === 0 ? <p className="rounded-xl bg-[#f7faf8] p-4 text-[12px] leading-relaxed text-[#5d7365]">No products currently need stock attention.</p> : (
              <ul className="divide-y divide-[#eef2ef]">{attention.map((product) => (
                <li key={product.id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                  <span className="min-w-0 truncate font-medium text-[#405a49]">{product.name}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${(product.stock ?? 0) <= 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>{product.stock ?? 0} left</span>
                </li>
              ))}</ul>
            )}
          </section>
        ) : null}
        {canCustomers && customers ? (
          <section className={panel}>
            <SectionHeading title="Customers" detail="A summary of customer accounts." href="/admin/customers" linkLabel="View all" />
            <div className="grid grid-cols-2 gap-2">
              {[{ label: "Total", value: String(customers.total) }, { label: "Repeat buyers", value: String(customers.returning) }, { label: "Avg. lifetime value", value: formatPrice(customers.lifetimeValue) }, { label: "Blocked", value: String(customers.blocked) }].map((item) => (
                <div key={item.label} className="min-w-0 rounded-xl bg-[#f6f9f7] px-3 py-2.5"><p className="break-words text-[18px] font-extrabold tabular-nums text-[#294334]">{item.value}</p><p className="mt-0.5 text-[10.5px] leading-snug text-[#617667]">{item.label}</p></div>
              ))}
            </div>
          </section>
        ) : null}
        {canAudit ? (
          <section className={panel}>
            <SectionHeading title="Recent activity" detail="The latest admin actions." href="/admin/activity" linkLabel="Full log" />
            {activity.length === 0 ? <p className="rounded-xl bg-[#f7faf8] p-4 text-[12px] text-[#5d7365]">No activity recorded yet.</p> : (
              <ul className="space-y-3">{activity.slice(0, 6).map((entry) => (
                <li key={entry.id} className="flex gap-2.5 text-[12px]">
                  <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#edf5ef] text-[#669575]"><Activity size={13} aria-hidden="true" /></span>
                  <span className="min-w-0"><span className="block leading-snug text-[#405a49]">{entry.summary}</span><span className="mt-1 block text-[10.5px] text-[#657b6c]">{entry.actor} · {formatDate(entry.createdAt)}</span></span>
                </li>
              ))}</ul>
            )}
          </section>
        ) : null}
      </div>

      {canOrders && latestOrders.length > 0 ? (
        <section className={panel}>
          <SectionHeading title="Latest orders" detail="The five most recently placed orders." href="/admin/orders" linkLabel="Open order desk" />
          <ul className="divide-y divide-[#eef2ef]">{latestOrders.map((order) => {
            const status = orderStatuses.find((entry) => entry.value === order.status);
            return (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[12.5px]">
                <Link href={`/admin/orders/${order.id}`} className="min-w-[130px] flex-1"><span className="block font-bold text-[#284b35] hover:text-brand-700">{order.number}</span><span className="mt-0.5 block text-[11px] text-[#607667]">{order.customer.name} · {formatDate(order.createdAt)}</span></Link>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status?.tone ?? ""}`}>{status?.label ?? order.status}</span>
                <span className="min-w-[74px] text-right font-bold tabular-nums text-[#294334]">{formatPrice(order.total)}</span>
              </li>
            );
          })}</ul>
        </section>
      ) : null}
    </div>
  );
}

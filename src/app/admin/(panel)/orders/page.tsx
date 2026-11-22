import type { Metadata } from "next";
import Link from "next/link";
import { Search, ShoppingBag } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/session";
import { listOrders, orderStatuses, channelLabels, type Order } from "@/lib/repositories/orders";
import { formatPrice, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders" };
const statusFilters = [{ value: "", label: "All statuses" }, ...orderStatuses.map(({ value, label }) => ({ value, label }))];

export default async function AdminOrdersPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("orders.view");
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const channel = typeof params.channel === "string" ? params.channel : "";
  const search = typeof params.q === "string" ? params.q : "";
  const unpaidOnly = params.payment === "unpaid";

  let orders: Order[] = await listOrders({ status, channel, search });
  if (unpaidOnly) orders = orders.filter((order) => order.paymentStatus === "unpaid");
  const value = orders.filter((order) => order.status !== "cancelled").reduce((total, order) => total + order.total, 0);
  const hasFilters = Boolean(status || channel || search || unpaidOnly);
  const hrefFor = (next: { status?: string; payment?: string }) => {
    const query = new URLSearchParams();
    if (next.status) query.set("status", next.status);
    if (channel) query.set("channel", channel);
    if (search) query.set("q", search);
    if (next.payment) query.set("payment", next.payment);
    const suffix = query.toString();
    return `/admin/orders${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="Review orders, payment status and preparation details in one place. Open an order to see its full details and available actions."
        meta={`${orders.length} order${orders.length === 1 ? "" : "s"} shown · ${formatPrice(value)} order value excluding cancelled (includes unpaid)`}
      />

      <section aria-label="Order search and filters" className="mb-4 rounded-[18px] border border-[#e4ece6] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-[14px] font-extrabold text-[#254734]">Find an order</h2><p className="mt-0.5 text-[11.5px] text-[#5e7465]">Search or choose a status below.</p></div>
          {hasFilters ? <Link href="/admin/orders" className="text-[11.5px] font-bold text-brand-700 hover:underline">Clear filters</Link> : null}
        </div>
        <form action="/admin/orders" className="mt-3 flex max-w-xl gap-2">
          {status ? <input type="hidden" name="status" value={status} /> : null}
          {channel ? <input type="hidden" name="channel" value={channel} /> : null}
          {unpaidOnly ? <input type="hidden" name="payment" value="unpaid" /> : null}
          <div className="relative min-w-0 flex-1">
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input name="q" defaultValue={search} placeholder="Order number, name, email or phone…" aria-label="Search orders" className="h-10 w-full rounded-xl border border-[#dfeae2] bg-[#fbfdfb] pl-9 pr-3 text-[12.5px] outline-none focus:border-brand-500" />
          </div>
          <button type="submit" className="h-10 rounded-xl bg-[#1b8057] px-4 text-[12px] font-bold text-white hover:bg-[#166b49]">Search</button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          {statusFilters.map((filter) => (
            <Link key={filter.value || "all"} href={hrefFor({ status: filter.value, payment: unpaidOnly ? "unpaid" : undefined })} aria-current={status === filter.value ? "page" : undefined}
              className={`inline-flex min-h-8 items-center whitespace-nowrap rounded-lg px-3 py-1.5 text-[11.5px] font-bold ${status === filter.value ? "bg-[#e2f2e7] text-[#16643e]" : "bg-[#f5f8f6] text-[#61766a] hover:bg-[#edf5ef] hover:text-[#16643e]"}`}>
              {filter.label}
            </Link>
          ))}
          <Link href={hrefFor({ status, payment: unpaidOnly ? undefined : "unpaid" })} aria-current={unpaidOnly ? "page" : undefined} className={`inline-flex min-h-8 items-center rounded-lg px-3 py-1.5 text-[11.5px] font-bold ${unpaidOnly ? "bg-amber-100 text-amber-800" : "bg-[#f5f8f6] text-[#61766a] hover:bg-amber-50"}`}>Unpaid only</Link>
        </div>
      </section>

      {orders.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#dce9df] bg-white px-6 py-14 text-center">
          <span className="mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-2xl bg-[#edf6ef] text-[#689579]"><ShoppingBag size={20} aria-hidden="true" /></span>
          <p className="text-[15px] font-bold text-[#254734]">No orders match this view</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-500">{hasFilters ? "Try clearing your search or filters to see other orders." : "Orders will appear here when customers place them."}</p>
          {hasFilters ? <Link href="/admin/orders" className="mt-4 inline-block text-[12.5px] font-bold text-brand-700 hover:underline">Clear filters</Link> : null}
        </div>
      ) : (
        <>
          <div role="region" aria-label="Orders table; scroll horizontally if needed" tabIndex={0} className="hidden overflow-x-auto rounded-[20px] border border-[#e4ece6] bg-white md:block">
            <table className="w-full min-w-[760px] text-left text-[12.5px]">
              <thead><tr className="border-b border-[#e9f0eb] bg-[#f8faf8] text-[10.5px] uppercase tracking-[0.08em] text-[#65786b]">
                <th className="px-4 py-3 font-bold">Order</th><th className="px-4 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Channel</th><th className="px-4 py-3 font-bold">Payment</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 text-right font-bold">Total</th>
              </tr></thead>
              <tbody>{orders.map((order) => {
                const statusMeta = orderStatuses.find((entry) => entry.value === order.status);
                return <tr key={order.id} className="border-b border-[#eef3ef] last:border-0 hover:bg-[#f9fbf9]">
                  <td className="px-4 py-3"><Link href={`/admin/orders/${order.id}`} className="font-bold text-[#294a36] hover:text-brand-700 hover:underline">{order.number}</Link><p className="mt-0.5 text-[11px] text-ink-400">{formatDate(order.createdAt)}</p></td>
                  <td className="px-4 py-3"><p className="font-semibold text-ink-800">{order.customer.name}</p><p className="mt-0.5 text-[11px] text-ink-400">{order.customer.email}</p></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-600">{channelLabels[order.channel]}</span></td>
                  <td className="px-4 py-3 capitalize"><span className={order.paymentStatus === "paid" ? "text-brand-700" : "text-ink-600"}>{order.paymentStatus}</span><p className="text-[11px] text-ink-400">{order.paymentMethod}</p></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta?.tone ?? ""}`}>{statusMeta?.label ?? order.status}</span></td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums text-[#294334]">{formatPrice(order.total)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <ul className="space-y-3 md:hidden">{orders.map((order) => {
            const statusMeta = orderStatuses.find((entry) => entry.value === order.status);
            return <li key={order.id} className="rounded-[18px] border border-[#e4ece6] bg-white p-4">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/admin/orders/${order.id}`} className="break-words text-[13.5px] font-extrabold text-[#254734] hover:text-brand-700">{order.number}</Link><p className="mt-0.5 text-[11px] text-ink-500">{formatDate(order.createdAt)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta?.tone ?? ""}`}>{statusMeta?.label ?? order.status}</span></div>
              <div className="mt-3 border-t border-[#edf2ee] pt-3"><p className="text-[12.5px] font-bold text-ink-800">{order.customer.name}</p><p className="break-all text-[11px] text-ink-500">{order.customer.email}</p></div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-[11.5px]"><div><dt className="text-ink-500">Channel</dt><dd className="mt-1 font-semibold text-ink-700">{channelLabels[order.channel]}</dd></div><div><dt className="text-ink-500">Payment</dt><dd className="mt-1 font-semibold capitalize text-ink-700">{order.paymentStatus}<span className="block text-[10.5px] font-normal text-ink-500">{order.paymentMethod}</span></dd></div><div className="text-right"><dt className="text-ink-500">Total</dt><dd className="mt-1 font-bold tabular-nums text-[#254734]">{formatPrice(order.total)}</dd></div></dl>
              <Link href={`/admin/orders/${order.id}`} className="mt-3 inline-flex text-[11.5px] font-bold text-brand-700 hover:underline">Open order <span aria-hidden="true">&nbsp;→</span></Link>
            </li>;
          })}</ul>
        </>
      )}
    </div>
  );
}

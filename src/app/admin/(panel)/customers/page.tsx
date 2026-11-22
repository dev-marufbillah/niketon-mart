import type { Metadata } from "next";
import Link from "next/link";
import { Search, UsersRound } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getCustomerStats } from "@/lib/repositories/customers";
import { ensureDatabase } from "@/lib/db";
import type { CustomerProfile } from "@/lib/repositories/accounts";
import { formatPrice, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customers" };

export default async function AdminCustomersPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("customers.view");
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const { customers, total, returning, blocked, lifetimeValue } = await getCustomerStats();
  const db = await ensureDatabase();
  const accounts = new Set((await db.list<CustomerProfile>("customers")).filter((row) => row.passwordHash || row.googleSubjectHash).map((row) => row.id));
  const filtered = search ? customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase().includes(search)) : customers;

  return (
    <div>
      <AdminPageHeader title="Customers" description="Registered shoppers and separate guest records, with account status and order history." meta={`${total} customers · ${accounts.size} with accounts · ${returning} repeat buyers · ${blocked} blocked · ${formatPrice(lifetimeValue)} average lifetime value`} />
      <section aria-label="Customer search" className="mb-4 rounded-[18px] border border-[#e4ece6] bg-white p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2"><h2 className="text-[14px] font-extrabold text-[#254734]">Find a customer</h2><span className="text-[11.5px] text-[#596f60]">{filtered.length} shown</span></div>
        <form action="/admin/customers" className="mt-3 flex max-w-lg gap-2">
          <div className="relative min-w-0 flex-1"><Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input name="q" defaultValue={search} placeholder="Search name, email or phone…" aria-label="Search customers" className="h-10 w-full rounded-xl border border-[#dfeae2] bg-[#fbfdfb] pl-9 pr-3 text-[12.5px] outline-none focus:border-brand-500" /></div>
          <button type="submit" className="h-10 rounded-xl bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700">Search</button>
          {search ? <Link href="/admin/customers" className="inline-flex h-10 items-center rounded-xl px-2 text-[12px] font-bold text-brand-700 hover:bg-brand-50">Clear</Link> : null}
        </form>
      </section>
      {filtered.length === 0 ? (
        <div className="rounded-[20px] border border-dashed border-[#dce9df] bg-white px-6 py-14 text-center">
          <span className="mx-auto mb-3 inline-flex size-11 items-center justify-center rounded-2xl bg-[#edf6ef] text-[#689579]"><UsersRound size={20} aria-hidden="true" /></span>
          <p className="text-[15px] font-bold text-[#254734]">{search ? "No customers match this search" : "No customers yet"}</p>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-500">{search ? "Try a different name, email or phone number, or clear the search." : "Registered shoppers and guest customer records will appear here."}</p>
          {search ? <Link href="/admin/customers" className="mt-4 inline-block text-[12.5px] font-bold text-brand-700 hover:underline">Clear search</Link> : null}
        </div>
      ) : <>
        <div role="region" aria-label="Customers table; scroll horizontally if needed" tabIndex={0} className="hidden overflow-x-auto rounded-[20px] border border-[#e4ece6] bg-white md:block">
          <table className="w-full min-w-[850px] text-left text-[12.5px]">
            <thead><tr className="border-b border-[#e9f0eb] bg-[#f8faf8] text-[10.5px] uppercase tracking-[0.08em] text-[#65786b]"><th className="px-4 py-3 font-bold">Customer</th><th className="px-4 py-3 font-bold">Area</th><th className="px-4 py-3 font-bold">Orders</th><th className="px-4 py-3 text-right font-bold">Spent</th><th className="px-4 py-3 font-bold">Last order</th><th className="px-4 py-3 font-bold">Account</th><th className="px-4 py-3 font-bold">Status</th></tr></thead>
            <tbody>{filtered.map((customer) => <tr key={customer.id} className="border-b border-[#eef3ef] last:border-0 hover:bg-[#f9fbf9]">
              <td className="px-4 py-3"><Link href={`/admin/customers/${customer.id}`} className="font-bold text-[#294a36] hover:text-brand-700 hover:underline">{customer.name}</Link><p className="mt-0.5 text-[11px] text-ink-500">{customer.email}</p></td>
              <td className="px-4 py-3 text-ink-600">{customer.area ?? "—"}</td><td className="px-4 py-3 tabular-nums text-ink-700">{customer.orderCount}</td><td className="px-4 py-3 text-right font-bold tabular-nums text-[#294334]">{formatPrice(customer.totalSpent)}</td><td className="px-4 py-3 text-ink-500">{customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${accounts.has(customer.id) ? "bg-brand-50 text-brand-700" : "bg-surface text-ink-500"}`}>{accounts.has(customer.id) ? "Registered" : "Guest"}</span></td>
              <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${customer.status === "active" ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"}`}>{customer.status === "active" ? "Active" : "Blocked"}</span></td>
            </tr>)}</tbody>
          </table>
        </div>
        <ul className="space-y-3 md:hidden">{filtered.map((customer) => <li key={customer.id} className="rounded-[18px] border border-[#e4ece6] bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link href={`/admin/customers/${customer.id}`} className="break-words text-[13.5px] font-bold text-[#254734] hover:text-brand-700">{customer.name}</Link><p className="break-all text-[11px] text-ink-500">{customer.email}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10.5px] font-bold ${customer.status === "active" ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"}`}>{customer.status === "active" ? "Active" : "Blocked"}</span></div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-[#edf2ee] pt-3 text-[11.5px]"><div><dt className="text-ink-500">Area</dt><dd className="mt-0.5 font-semibold text-ink-700">{customer.area ?? "—"}</dd></div><div><dt className="text-ink-500">Account</dt><dd className="mt-0.5 font-semibold text-ink-700">{accounts.has(customer.id) ? "Registered" : "Guest"}</dd></div><div><dt className="text-ink-500">Orders</dt><dd className="mt-0.5 font-semibold tabular-nums text-ink-700">{customer.orderCount}</dd></div><div><dt className="text-ink-500">Spent</dt><dd className="mt-0.5 font-semibold tabular-nums text-ink-700">{formatPrice(customer.totalSpent)}</dd></div><div className="col-span-2"><dt className="text-ink-500">Last order</dt><dd className="mt-0.5 font-semibold text-ink-700">{customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}</dd></div></dl>
        </li>)}</ul>
      </>}
    </div>
  );
}

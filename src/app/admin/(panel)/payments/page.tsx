import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/session";
import { listPaymentRecords, paymentStatuses } from "@/lib/repositories/orders";
import { getCheckoutMethods } from "@/lib/repositories/operations";
import { missingProviderConfig, paymentProviders } from "@/lib/payments/providers";
import { formatPrice, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Payment records" };

const filters = [{ value: "", label: "All" }, ...paymentStatuses.map(({ value, label }) => ({ value, label }))];

/**
 * Payment records.
 * Every order's payment in one list, plus the honest status of each gateway:
 * which methods are live at checkout, which are switched off, and — for a
 * gateway — exactly which server credentials are still missing. Credentials
 * themselves are never shown, only whether they are present.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("payments.manage");
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const search = typeof params.q === "string" ? params.q : "";

  const [records, methods] = await Promise.all([listPaymentRecords({ status, search }), getCheckoutMethods()]);
  const checkoutPaused = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  const awaiting = records.filter((order) => order.paymentStatus === "awaiting_verification");
  const collected = records
    .filter((order) => order.paymentStatus === "paid")
    .reduce((total, order) => total + order.total, 0);

  return (
    <div>
      <AdminPageHeader
        title="Payment records"
        description="Review recorded payment statuses and configure methods; staff must verify actual payments separately."
        meta={`${records.length} record${records.length === 1 ? "" : "s"} shown · ${formatPrice(collected)} in orders marked paid · ${
          awaiting.length
        } awaiting verification`}
      />

      {/* --- methods --- */}
      <section className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-line">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-extrabold text-ink-900">Payment method configuration</h2>
          <Link href="/admin/r/payment_methods" className="text-[11.5px] font-semibold text-brand-700">
            Manage methods →
          </Link>
        </div>
        {checkoutPaused ? (
          <p className="mb-2 rounded-lg bg-accent-100 px-3 py-2 text-[11.5px] text-ink-700">
            Production checkout is paused pending transaction-safety work; configured methods cannot currently accept new orders.
          </p>
        ) : null}
        <ul className="divide-y divide-line">
          {methods.map((method) => (
            <li key={method.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-ink-800">{method.label}</span>
                <span className="text-[11px] text-ink-400">
                  {method.mode === "offline"
                    ? "Paid on delivery"
                    : method.mode === "manual-transfer"
                      ? "Mobile transfer — staff verify the transaction ID"
                      : `Online gateway · ${paymentProviders[method.provider as keyof typeof paymentProviders]?.label ?? method.provider}`}
                </span>
              </span>
              {method.available ? (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                  Configured
                </span>
              ) : (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600">
                  Hidden
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
          {methods
            .filter((method) => !method.available)
            .map((method) => `${method.label}: ${method.reason}`)
            .join(" · ") || "Enabled methods are configured; checkout availability also depends on the production hold."}
        </p>
      </section>

      {/* --- gateways --- */}
      <section className="mb-4 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-1 text-[14px] font-extrabold text-ink-900">Online gateways</h2>
        <p className="mb-3 text-[11.5px] leading-relaxed text-ink-500">
          Online gateways are not implemented yet. Credentials alone cannot enable them: a developer must implement
          and test the provider-specific session and verified callback before activation. Nothing is simulated.
        </p>
        <ul className="space-y-2">
          {Object.values(paymentProviders).map((provider) => {
            const missing = missingProviderConfig(provider.key);
            return (
              <li key={provider.key} className="rounded-xl bg-surface/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-ink-800">{provider.label}</span>
                  <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[10.5px] font-semibold text-accent-700">
                    Not implemented
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{provider.setupHint}</p>
                {missing.length ? (
                  <p className="mt-1 font-mono text-[10.5px] text-ink-400">Missing: {missing.join(", ")}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {/* --- records --- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form action="/admin/payments" className="relative">
          <input
            name="q"
            defaultValue={search}
            placeholder="Order number, name, email or phone…"
            aria-label="Search payments"
            className="h-9 w-[260px] rounded-full border border-line bg-white px-3 text-[12.5px] outline-none focus:border-brand-500"
          />
        </form>
        <ul className="no-scrollbar flex gap-1 overflow-x-auto">
          {filters.map((filter) => (
            <li key={filter.value || "all"}>
              <Link
                href={`/admin/payments${filter.value ? `?status=${filter.value}` : ""}`}
                className={`inline-flex h-9 items-center rounded-full px-3.5 text-[12px] font-semibold ${
                  status === filter.value
                    ? "bg-ink-900 text-white"
                    : "bg-white text-ink-600 ring-1 ring-line hover:bg-surface"
                }`}
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        {records.length === 0 ? (
          <p className="p-6 text-center text-[12.5px] text-ink-500">No payments match this filter yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {records.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <Link href={`/admin/orders/${order.id}`} className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-ink-800">
                    {order.number} · {order.customer.name}
                  </span>
                  <span className="text-[11px] text-ink-400">
                    {order.paymentMethod} · {formatDate(order.createdAt)}
                    {order.payment?.reference ? ` · ref ${order.payment.reference}` : ""}
                  </span>
                </Link>
                <span className="text-[12.5px] font-semibold tabular-nums text-ink-800">
                  {formatPrice(order.total)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    order.paymentStatus === "paid"
                      ? "bg-brand-50 text-brand-700"
                      : order.paymentStatus === "awaiting_verification"
                        ? "bg-accent-100 text-accent-700"
                        : order.paymentStatus === "failed" || order.paymentStatus === "refunded"
                          ? "bg-red-50 text-red-600"
                          : "bg-surface text-ink-500"
                  }`}
                >
                  {paymentStatuses.find((entry) => entry.value === order.paymentStatus)?.label ??
                    order.paymentStatus}
                </span>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="text-[11.5px] font-semibold text-brand-700"
                >
                  Verify →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByNumber, orderStatuses, paymentStatuses } from "@/lib/repositories/orders";
import { hasOrderAccess } from "@/lib/auth/order-access";
import { getSettings } from "@/lib/repositories/settings";
import { formatPrice, formatDate } from "@/lib/utils/format";
import { formatGrams } from "@/lib/weights/weight";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Printable invoice for a single order.
 * Same access rule as the order page: authenticated checkout owner or a
 * verified order-scoped cookie.
 */
export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;
  const order = await getOrderByNumber(decodeURIComponent(number));
  if (!order) notFound();

  if (!(await hasOrderAccess(order))) {
    return (
      <div className="container-page max-w-md py-12">
        <div className="rounded-2xl bg-white p-6 ring-1 ring-line">
          <h1 className="text-[18px] font-extrabold text-ink-900">Invoice locked</h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Open this invoice from your order confirmation or the order page — it needs the private link shown after placing
            order {order.number}.
          </p>
          <Link
            href={`/order/${order.number}`}
            className="mt-4 inline-flex h-10 items-center rounded-full bg-brand-600 px-5 text-[12.5px] font-bold text-white"
          >
            Go to the order
          </Link>
        </div>
      </div>
    );
  }

  const settings = await getSettings();
  const address = order.deliveryAddress;
  const paymentLabel =
    paymentStatuses.find((entry) => entry.value === order.paymentStatus)?.label ?? order.paymentStatus;
  const statusLabel = orderStatuses.find((entry) => entry.value === order.status)?.label ?? order.status;

  return (
    <div className="bg-surface/60 py-8 print:bg-white print:py-0">
      <div className="container-page max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link
            href={`/order/${order.number}`}
            className="text-[12.5px] font-semibold text-ink-600 hover:text-brand-700"
          >
            ← Back to order
          </Link>
          <span className="text-[11.5px] text-ink-400">Use your browser&apos;s Print / Save as PDF</span>
        </div>

        <article className="rounded-2xl bg-white p-6 ring-1 ring-line print:rounded-none print:p-0 print:ring-0 sm:p-8">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-[18px] font-extrabold text-ink-900">{settings.siteName}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">
                {settings.address}
                <br />
                {settings.phone} · {settings.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Invoice</p>
              <p className="text-[15px] font-extrabold text-ink-900">{order.number}</p>
              <p className="text-[11.5px] text-ink-500">{formatDate(order.createdAt)}</p>
            </div>
          </header>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Delivered to</p>
              <p className="mt-1 text-[12.5px] font-bold text-ink-800">{order.customer.name}</p>
              <p className="text-[12px] leading-relaxed text-ink-600">
                {address?.line1 ?? order.customer.address}
                {address?.line2 ? <>, {address.line2}</> : null}
                {address?.city ? <>, {address.city}</> : null}
                {address?.postalCode ? <> {address.postalCode}</> : null}
                <br />
                {order.customer.area}
                <br />
                {order.customer.phone}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Payment</p>
              <p className="mt-1 text-[12.5px] font-bold text-ink-800">{order.paymentMethod}</p>
              <p className="text-[12px] text-ink-600">
                {paymentLabel}
                {order.payment?.reference ? ` · Ref ${order.payment.reference}` : ""}
              </p>
              <p className="mt-2 text-[10.5px] font-bold uppercase tracking-wide text-ink-400">Status</p>
              <p className="text-[12px] text-ink-600">{statusLabel}</p>
            </div>
          </div>

          <table className="mt-5 w-full text-left text-[12px]">
            <thead>
              <tr className="border-y border-line text-[10.5px] uppercase tracking-wide text-ink-400">
                <th className="py-2 font-bold">Item</th>
                <th className="py-2 text-center font-bold">Qty</th>
                <th className="py-2 text-right font-bold">Price</th>
                <th className="py-2 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={`${item.productId}-${item.variantLabel ?? item.unit}`} className="border-b border-line/70">
                  <td className="py-2.5">
                    <span className="block font-semibold text-ink-800">{item.name}</span>
                    <span className="text-[11px] text-ink-400">{item.variantLabel ?? item.unit}</span>
                    {item.preparation?.options.length ? (
                      <span className="block text-[10.5px] text-ink-500">
                        {item.preparation.options.map((option) => option.label).join(" · ")}
                        {item.preparation.instructions ? ` — “${item.preparation.instructions}”` : ""}
                      </span>
                    ) : null}
                    {item.weight?.actualGrams ? (
                      <span className="block text-[10.5px] text-ink-500">
                        Weighed {formatGrams(item.weight.actualGrams)} (ordered{" "}
                        {formatGrams(item.weight.estimatedGrams)})
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 text-center tabular-nums text-ink-700">{item.quantity}</td>
                  <td className="py-2.5 text-right tabular-nums text-ink-700">{formatPrice(item.price)}</td>
                  <td className="py-2.5 text-right tabular-nums font-semibold text-ink-800">
                    {formatPrice(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-[12.5px]">
            <div className="flex justify-between">
              <dt className="text-ink-500">Sub total</dt>
              <dd className="tabular-nums text-ink-800">{formatPrice(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Delivery</dt>
              <dd className="tabular-nums text-ink-800">
                {order.deliveryFee === 0 ? "Free" : formatPrice(order.deliveryFee)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">Tax</dt>
              <dd className="tabular-nums text-ink-800">{formatPrice(order.tax ?? 0)}</dd>
            </div>
            {order.discount > 0 ? (
              <div className="flex justify-between">
                <dt className="text-ink-500">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                <dd className="tabular-nums text-brand-700">-{formatPrice(order.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-line pt-2 text-[15px] font-extrabold text-ink-900">
              <dt>Total</dt>
              <dd className="tabular-nums">{formatPrice(order.total)}</dd>
            </div>
          </dl>

          <p className="mt-6 border-t border-line pt-3 text-[10.5px] leading-relaxed text-ink-400">
            {settings.checkout.notice || "Thank you for shopping with us."} This invoice was generated for the order
            above and is only valid together with its order record.
          </p>
        </article>
      </div>
    </div>
  );
}

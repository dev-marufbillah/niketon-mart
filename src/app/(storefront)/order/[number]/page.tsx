import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Download, MapPin, PackageCheck, Truck } from "lucide-react";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { OrderAccessForm } from "@/components/checkout/order-access-form";
import { OrderTimeline } from "@/components/order/order-timeline";
import { PreparationLine } from "@/components/checkout/preparation-line";
import { WeightConfirmation } from "@/components/order/weight-confirmation";
import { OrderFragmentAccess } from "@/components/order/order-fragment-access";
import { OrderPrivateLink } from "@/components/order/order-private-link";
import { currentOrderAccessKey, hasOrderAccess } from "@/lib/auth/order-access";
import { formatGrams } from "@/lib/weights/weight";
import { weightApprovalSnapshot } from "@/lib/weights/approval";
import { weightAdjustmentHoldReason } from "@/lib/weights/finance";
import { getOrderByNumber, orderStatuses, paymentStatuses } from "@/lib/repositories/orders";
import { orderStatuses as orderStatusLabels } from "@/lib/orders/constants";
import { getSettings } from "@/lib/repositories/settings";
import { formatPrice, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order status",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * One order, one page.
 *
 * Reference 3 ("Track Your Order" details) is the default view: Order Status +
 * Order ID, the five-step timeline fed by real status changes, then the products
 * and the money. Reference for the completed screen ("Your order is completed!")
 * is shown on top only when the shopper has just placed this order (`?new=1`,
 * set by the checkout redirect) — never on a later visit.
 *
 * Access is private: the page needs the order's access token, or the private token provided at checkout.
 */
export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ number }, query] = await Promise.all([params, searchParams]);
  const order = await getOrderByNumber(decodeURIComponent(number));
  if (!order) notFound();

  // A signed-in checkout owner or a verified order-scoped cookie is required.
  // Fragment/legacy keys are exchanged by POST, never accepted from a GET here.
  if (!(await hasOrderAccess(order))) {
    return (
      <>
        <OrderFragmentAccess key={order.number} number={order.number} />
        <ShopHero title="Track Your Order" current="Track Your Order" />
        <section className="container-page max-w-xl py-8 sm:py-10">
          <OrderAccessForm number={order.number} />
        </section>
      </>
    );
  }

  const settings = await getSettings();
  const justPlaced = query.new === "1";
  const statusMeta = orderStatuses.find((entry) => entry.value === order.status);
  const paymentLabel =
    paymentStatuses.find((entry) => entry.value === order.paymentStatus)?.label ?? order.paymentStatus;
  const reference = order.payment?.reference || order.payment?.sessionReference || "—";
  const address = order.deliveryAddress;
  const accessKey = await currentOrderAccessKey(order);
  const hasWeightProposal = order.items.some((item) => item.weight?.status === "proposed");
  const weightHold = hasWeightProposal ? weightAdjustmentHoldReason(order) : null;
  const weightApproval = hasWeightProposal && !weightHold ? weightApprovalSnapshot(order) : null;
  const cancelled = order.status === "cancelled" || order.status === "refunded";

  return (
    <>
      <OrderFragmentAccess key={order.number} number={order.number} />
      <ShopHero title="Track Your Order" current="Track Your Order" />

      <section className="container-page py-8 sm:py-10">
        <div className="mx-auto max-w-4xl">
          {/* ---------- just placed: the "order completed" reference ---------- */}
          {justPlaced ? (
            <div className="mb-6">
              <div className="text-center">
                <span className="inline-flex size-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                  <Check size={30} strokeWidth={3} />
                </span>
                <h1 className="mt-4 text-[24px] font-extrabold text-ink-900 sm:text-[30px]" data-order-number>
                  {order.number}
                </h1>
                <p className="mt-1 text-[15px] font-bold text-ink-800">Your order is completed!</p>
                <p className="mt-1 text-[12.5px] text-ink-500">
                  Thank you, {order.customer.name.split(" ")[0]}. Your order has been received.
                  Placed {formatDate(order.createdAt)}.
                </p>
                {accessKey ? <OrderPrivateLink number={order.number} accessKey={accessKey} /> : null}
              </div>

              <div className="mt-5 grid gap-4 rounded-2xl bg-accent-500 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-center">
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-800/70">Order ID</p>
                  <p className="text-[13px] font-extrabold text-ink-900">#{order.number}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-800/70">Payment method</p>
                  <p className="text-[13px] font-bold text-ink-900">{order.paymentMethod}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-800/70">Transaction ID</p>
                  <p className="truncate text-[13px] font-bold text-ink-900" title={reference}>
                    {reference}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-800/70">Payment status</p>
                  <p className="text-[13px] font-bold text-ink-900">{paymentLabel}</p>
                </div>
                <div>
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-ink-800/70">Estimated delivery</p>
                  <p className="text-[13px] font-bold text-ink-900">
                    {order.deliveryEta ? `${order.deliveryEta}${order.deliverySlot ? ` · ${order.deliverySlot}` : ""}` : "—"}
                  </p>
                </div>
                <div className="sm:col-span-2 lg:col-span-5">
                  <Link
                    href={`/order/${order.number}/invoice`}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-600 px-5 text-[12.5px] font-bold text-white transition-colors hover:bg-brand-700"
                  >
                    <Download size={14} /> Download invoice
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-[22px] font-extrabold text-ink-900 sm:text-[26px]">Order Status</h1>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  Order ID : <span className="font-semibold text-ink-800">#{order.number}</span> · placed{" "}
                  {formatDate(order.createdAt)}
                  {order.deliverySlot ? ` · ${order.deliverySlot}` : ""}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11.5px] font-semibold ${statusMeta?.tone ?? ""}`}>
                {statusMeta?.label ?? order.status}
              </span>
            </div>
          )}

          {!justPlaced && accessKey ? <OrderPrivateLink number={order.number} accessKey={accessKey} /> : null}

          {/* ---------- weight approval, only while one is waiting ---------- */}
          {weightApproval ? <WeightConfirmation order={{ number: order.number, items: order.items, total: order.total }} approvalTotal={weightApproval.total} fingerprint={weightApproval.fingerprint} /> : null}
          {hasWeightProposal && weightHold ? <p role="status" className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">This weight change needs a manual review. Please contact the store; the order amount has not been changed here.</p> : null}

          {/* ---------- timeline (reference 3) ---------- */}
          <OrderTimeline order={order} tracking={settings.tracking} />

          {/* ---------- products ---------- */}
          <section className="mt-4 rounded-2xl bg-white ring-1 ring-line" aria-labelledby="order-products">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <h2 id="order-products" className="text-[14.5px] font-extrabold text-ink-900">
                Products
              </h2>
              <span className="text-[11.5px] text-ink-400">
                {order.items.reduce((total, item) => total + item.quantity, 0)} item
                {order.items.reduce((total, item) => total + item.quantity, 0) === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li
                  key={`${item.productId}-${item.variantLabel ?? item.unit}-${item.preparation?.signature ?? ""}`}
                  className="flex items-center gap-3 px-4 py-3 sm:px-5"
                >
                  <span className="inline-flex size-12 shrink-0 overflow-hidden rounded-lg bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image} alt="" className="size-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink-900">{item.name}</span>
                    <span className="text-[11.5px] text-ink-500">
                      {item.variantLabel ?? item.unit} | {item.quantity} Qty.
                    </span>
                    {item.weight ? (
                      <span className="block text-[11.5px] text-ink-500">
                        Sold by weight: {formatGrams(item.weight.estimatedGrams)} estimated
                        {item.weight.actualGrams ? ` · weighed ${formatGrams(item.weight.actualGrams)}` : ""}
                      </span>
                    ) : null}
                    <PreparationLine preparation={item.preparation} />
                  </span>
                  <span className="text-right">
                    <span className="block text-[12.5px] font-semibold tabular-nums text-ink-900">
                      {formatPrice(item.lineTotal)}
                    </span>
                    <span className="text-[11px] text-ink-400">
                      {formatPrice(item.price)} each
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ---------- money / delivery / payment ---------- */}
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.15fr_1fr]">
            <section className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5" aria-labelledby="order-summary">
              <h2 id="order-summary" className="text-[14.5px] font-extrabold text-ink-900">
                Order summary
              </h2>
              <dl className="mt-3 space-y-1.5 text-[12.5px]">
                <div className="flex justify-between">
                  <dt className="text-ink-500">Sub total</dt>
                  <dd className="tabular-nums text-ink-800">{formatPrice(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Delivery charge</dt>
                  <dd className="tabular-nums text-ink-800">
                    {order.deliveryFee === 0 ? "Free" : formatPrice(order.deliveryFee)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">Taxes</dt>
                  <dd className="tabular-nums text-ink-800">{formatPrice(order.tax ?? 0)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-500">
                    Discount{order.couponCode ? ` (${order.couponCode})` : ""}
                  </dt>
                  <dd className="tabular-nums text-brand-700">
                    {order.discount > 0 ? `-${formatPrice(order.discount)}` : formatPrice(0)}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-[15px] font-extrabold text-ink-900">
                  <dt>Total payable</dt>
                  <dd className="tabular-nums">{formatPrice(order.total)}</dd>
                </div>
              </dl>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                <Link
                  href={`/order/${order.number}/invoice`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-[12px] font-semibold text-ink-700 hover:bg-surface"
                >
                  <Download size={12} /> Invoice
                </Link>
                <Link
                  href="/home-grocery"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12px] font-semibold text-white hover:bg-brand-700"
                >
                  Continue shopping <ArrowRight size={12} />
                </Link>
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5" aria-labelledby="delivery-card">
                <h2 id="delivery-card" className="flex items-center gap-1.5 text-[14.5px] font-extrabold text-ink-900">
                  <MapPin size={15} className="text-brand-600" /> Delivery address
                </h2>
                <p className="mt-2 text-[12.5px] font-bold text-ink-800">
                  {order.customer.name}
                  {order.customer.company ? ` · ${order.customer.company}` : ""}
                </p>
                <p className="text-[12px] leading-relaxed text-ink-600">
                  {address?.line1 ?? order.customer.address}
                  {address?.line2 ? <>, {address.line2}</> : null}
                  {address?.city ? <>, {address.city}</> : null}
                  {address?.postalCode ? <> {address.postalCode}</> : null}
                  <br />
                  {order.customer.area}
                </p>
                <p className="mt-1.5 text-[12px] text-ink-600">
                  {order.customer.phone} · {order.customer.email}
                </p>
                {order.customer.notes ? (
                  <p className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-[11.5px] text-ink-600">
                    Note: {order.customer.notes}
                  </p>
                ) : null}
              </section>

              <section className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5" aria-labelledby="payment-card">
                <h2 id="payment-card" className="text-[14.5px] font-extrabold text-ink-900">
                  Payment
                </h2>
                <dl className="mt-2 space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Method</dt>
                    <dd className="font-semibold text-ink-800">{order.paymentMethod}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-ink-500">Status</dt>
                    <dd className="font-semibold text-ink-800">{paymentLabel}</dd>
                  </div>
                  {order.payment?.reference ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-500">Transaction ID</dt>
                      <dd className="font-mono text-[11px] font-semibold text-ink-800">{order.payment.reference}</dd>
                    </div>
                  ) : null}
                  {order.deliverySlot ? (
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-500">Window</dt>
                      <dd className="font-semibold text-ink-800">{order.deliverySlot}</dd>
                    </div>
                  ) : null}
                </dl>

                <ul className="mt-3 space-y-2 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-600">
                  <li className="flex gap-2">
                    <PackageCheck size={14} className="mt-0.5 shrink-0 text-brand-600" />
                    {order.paymentStatus === "awaiting_verification"
                      ? "Your transfer is being verified — we dispatch as soon as it matches."
                      : order.paymentStatus === "paid"
                        ? "Payment received. Thank you."
                        : order.paymentStatus === "failed"
                          ? "This payment did not go through. Contact us to retry or change the method."
                          : "The rider collects payment on delivery."}
                  </li>
                  <li className="flex gap-2">
                    <Truck size={14} className="mt-0.5 shrink-0 text-brand-600" />
                    {cancelled
                      ? "No delivery is scheduled for this order."
                      : "We update this page at every step, so you can follow the rider."}
                  </li>
                </ul>
              </section>
            </div>
          </div>

          {/* ---------- status history ---------- */}
          <section className="mt-4 rounded-2xl bg-white p-4 ring-2 ring-line sm:p-5" aria-labelledby="order-history">
            <h2 id="order-history" className="text-[14.5px] font-extrabold text-ink-900">
              Status history
            </h2>
            <p className="mt-0.5 text-[11.5px] text-ink-400">
              Every update our team makes is recorded here with its time.
            </p>
            <ol className="mt-3 space-y-3">
              {[...order.timeline].reverse().map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="relative border-l border-line pl-3.5">
                  <span className="absolute -left-[3.5px] top-1 size-1.5 rounded-full bg-brand-600" />
                  <p className="text-[12px] font-semibold text-ink-800">
                    {orderStatusLabels.find((status) => status.value === entry.status)?.label ??
                      entry.status.replace(/_/g, " ")}
                  </p>
                  {entry.note ? <p className="text-[11.5px] text-ink-500">{entry.note}</p> : null}
                  <p className="text-[11px] text-ink-400">
                    {formatDate(entry.at)} ·{" "}
                    {new Date(entry.at).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}{" "}
                    · {entry.actor}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/track-order?number=${order.number}`}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-600 px-5 text-[13px] font-bold text-white hover:bg-brand-700"
            >
              Track another order
            </Link>
            <Link
              href="/home-grocery"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-5 text-[13px] font-semibold text-ink-700 hover:bg-surface"
            >
              Continue shopping <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

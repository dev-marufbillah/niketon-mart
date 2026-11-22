import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CancellationReviewForm } from "@/components/admin/cancellation-review-form";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { PaymentVerifyForm } from "@/components/admin/payment-verify-form";
import { requirePermission } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { hasUnresolvedWeights, weightAdjustmentHoldReason } from "@/lib/weights/finance";
import { hasValidPaymentReviewAmount, paymentReviewFingerprint } from "@/lib/payments/review-snapshot";
import { getOrder, getOrderCancellationReview, orderStatuses, paymentStatuses, channelLabels } from "@/lib/repositories/orders";
import { getCustomer } from "@/lib/repositories/customers";
import { getDeliveryPartners } from "@/lib/repositories/operations";
import { formatPrice, formatDate } from "@/lib/utils/format";
import { isSafeTakaAmount } from "@/lib/utils/currency";
import { PreparationLine } from "@/components/checkout/preparation-line";
import { WeightPanel } from "@/components/admin/weight-panel";
import { formatGrams } from "@/lib/weights/weight";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePermission("orders.view");
  const { id } = await params;
  const [order, partners] = await Promise.all([getOrder(id), getDeliveryPartners()]);
  if (!order) notFound();
  const customerSnapshot = order.customerId && can(admin, "customers.manage")
    ? await getCustomer(order.customerId)
    : null;
  const mayViewCancellationReview = can(admin, "orders.manage") &&
    can(admin, "payments.manage") &&
    (!order.customerId || can(admin, "customers.manage")) &&
    (!order.couponCode || can(admin, "marketing.manage"));
  const cancellationReview = order.status === "cancelled" && mayViewCancellationReview
    ? await getOrderCancellationReview(order.id)
    : null;

  const statusMeta = orderStatuses.find((entry) => entry.value === order.status);
  const cancellationStatusOpen = ["pending", "confirmed", "processing"].includes(order.status);
  const cancellationPaymentReady =
    (order.payment?.mode === "offline" && order.paymentStatus === "unpaid") ||
    (order.paymentStatus === "refunded" && Boolean(order.payment?.refundReference && order.payment.refundedAt));
  const cancellationFinancialReady = order.currency === "BDT" && hasValidPaymentReviewAmount(order);
  const cancellationHold = !cancellationStatusOpen
    ? "Only pending, confirmed or processing orders can be reviewed for cancellation."
    : order.inventoryReservationVersion !== 1
      ? "This historical order has no verified stock reservation snapshot."
      : order.customerId && can(admin, "customers.manage") && !customerSnapshot
        ? "The linked customer record is missing and needs review."
      : !cancellationFinancialReady
        ? "The order's BDT financial snapshot is incomplete or invalid."
      : !cancellationPaymentReady
        ? "Payment or refund must be independently reconciled before cancellation."
        : hasUnresolvedWeights(order)
          ? "Complete the weight review before cancelling this order."
          : null;
  const canReviewCancellation = can(admin, "orders.manage") &&
    can(admin, "payments.manage") &&
    (!order.customerId || can(admin, "customers.manage")) &&
    (!order.couponCode || can(admin, "marketing.manage"));

  return (
    <div>
      <AdminPageHeader
        title={`Order ${order.number}`}
        description={`${channelLabels[order.channel]} · placed ${formatDate(order.createdAt)} · ${order.items.length} line item${order.items.length === 1 ? "" : "s"}`}
        backHref={{ href: "/admin/orders", label: "All orders" }}
        meta={`${order.customer.name} · ${order.customer.phone} · ${order.customer.area}`}
      />

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-extrabold text-ink-900">Items</h2>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusMeta?.tone ?? ""}`}>
                {statusMeta?.label ?? order.status}
              </span>
            </div>
            <ul className="divide-y divide-line">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 py-2.5">
                  <span className="inline-flex size-11 shrink-0 overflow-hidden rounded-lg bg-surface">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.image?.trim() || "/images/category-placeholder.svg"} alt="" className="size-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/admin/catalogue/products`}
                      className="block truncate text-[12.5px] font-semibold text-ink-800"
                    >
                      {item.name}
                    </Link>
                    <span className="text-[11px] text-ink-400">
                      {item.quantity} × {formatPrice(item.price)} · {item.variantLabel ?? item.unit}
                      {item.preparationCharge ? ` · incl. +${formatPrice(item.preparationCharge)} prep` : ""}
                    </span>
                    {item.weight ? (
                        <span className="block text-[11px] text-ink-500">
                          Weight: {formatGrams(item.weight.estimatedGrams)} ordered
                          {item.weight.actualGrams ? ` · ${formatGrams(item.weight.actualGrams)} weighed` : ""}
                          {item.weight.status !== "estimated" ? ` · ${item.weight.status}` : ""}
                        </span>
                      ) : null}
                      <PreparationLine preparation={item.preparation} tone="admin" />
                  </span>
                  <span className="text-[12.5px] font-semibold tabular-nums text-ink-800">
                    {formatPrice(item.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-500">Subtotal</dt>
                <dd className="tabular-nums text-ink-800">{formatPrice(order.subtotal)}</dd>
              </div>
              {order.discount > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
                  <dd className="tabular-nums text-brand-700">−{formatPrice(order.discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-ink-500">Delivery</dt>
                <dd className="tabular-nums text-ink-800">
                  {order.deliveryFee === 0 ? "Free" : formatPrice(order.deliveryFee)}
                </dd>
              </div>
              {order.tax > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-ink-500">Tax</dt>
                  <dd className="tabular-nums text-ink-800">{formatPrice(order.tax)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-line pt-2 text-[13.5px] font-extrabold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </section>

          {can(admin, "orders.manage") ? <WeightPanel order={{ id: order.id, items: order.items }} holdReason={weightAdjustmentHoldReason(order)} /> : null}

          {can(admin, "orders.manage") ? <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h2 className="mb-3 text-[14px] font-extrabold text-ink-900">Update order</h2>
            <OrderStatusForm
              order={{ id: order.id, status: order.status, deliveryPartnerId: order.deliveryPartnerId }}
              partners={partners.map((partner) => ({ id: partner.id, name: partner.name, zone: partner.zone }))}
            />
          </section> : null}
          {cancellationStatusOpen ? (
            <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <h2 className="mb-2 text-[14px] font-extrabold text-ink-900">Cancellation review</h2>
              {cancellationHold ? (
                <p className="rounded-xl bg-accent-100 px-3 py-2 text-[11.5px] leading-relaxed text-ink-700">
                  {cancellationHold} No order, inventory, coupon or customer record was changed.
                </p>
              ) : canReviewCancellation ? (
                <CancellationReviewForm
                  orderId={order.id}
                  updatedAt={order.updatedAt}
                  customerId={order.customerId}
                  customerSnapshot={customerSnapshot ? {
                    orderCount: Number.isSafeInteger(customerSnapshot.orderCount) && customerSnapshot.orderCount >= 0
                      ? customerSnapshot.orderCount
                      : null,
                    totalSpent: isSafeTakaAmount(customerSnapshot.totalSpent)
                      ? customerSnapshot.totalSpent
                      : null,
                    updatedAt: customerSnapshot.updatedAt,
                  } : undefined}
                  couponCode={order.couponCode}
                />
              ) : (
                <p className="rounded-xl bg-accent-100 px-3 py-2 text-[11.5px] leading-relaxed text-ink-700">
                  This review requires orders.manage, payments.manage and, when applicable, customers.manage and marketing.manage.
                </p>
              )}
            </section>
          ) : null}
        </div>

        <div className="space-y-3">
          <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h2 className="mb-2 text-[14px] font-extrabold text-ink-900">Customer</h2>
            <p className="text-[12.5px] font-semibold text-ink-800">{order.customer.name}</p>
            <p className="text-[12px] text-ink-500">{order.customer.email}</p>
            <p className="text-[12px] text-ink-500">{order.customer.phone}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-600">
              {order.customer.address}
              <br />
              {order.customer.area}
            </p>
            {order.customer.notes ? (
              <p className="mt-2 rounded-lg bg-surface px-2.5 py-2 text-[11.5px] text-ink-600">
                “{order.customer.notes}”
              </p>
            ) : null}
            {order.customerId ? (
              <Link
                href={`/admin/customers/${order.customerId}`}
                className="mt-3 inline-block text-[11.5px] font-semibold text-brand-700"
              >
                Open customer profile →
              </Link>
            ) : null}
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h2 className="mb-2 text-[14px] font-extrabold text-ink-900">Payment & delivery</h2>
            <dl className="space-y-1.5 text-[12px]">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">Method</dt>
                <dd className="font-semibold text-ink-800">{order.paymentMethod}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">Payment</dt>
                <dd className="font-semibold text-ink-800">
                  {paymentStatuses.find((entry) => entry.value === order.paymentStatus)?.label ??
                    order.paymentStatus}
                </dd>
              </div>
              {order.payment?.mode ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Collected</dt>
                  <dd className="font-semibold text-ink-800">
                    {order.payment.mode === "offline"
                      ? "On delivery"
                      : order.payment.mode === "manual-transfer"
                        ? "Mobile transfer"
                        : "Online gateway"}
                  </dd>
                </div>
              ) : null}
              {order.payment?.reference ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Transaction ID</dt>
                  <dd className="font-mono text-[11.5px] font-semibold text-ink-800">{order.payment.reference}</dd>
                </div>
              ) : null}
              {order.payment?.verifiedBy ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Verified by</dt>
                  <dd className="font-semibold text-ink-800">{order.payment.verifiedBy}</dd>
                </div>
              ) : null}
              {order.payment?.refundReference ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Recorded refund reference</dt>
                  <dd className="font-mono text-[11.5px] font-semibold text-ink-800">{order.payment.refundReference}</dd>
                </div>
              ) : null}
              {order.payment?.refundedBy ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Refund recorded by</dt>
                  <dd className="font-semibold text-ink-800">{order.payment.refundedBy}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-2">
                <dt className="text-ink-500">Area</dt>
                <dd className="font-semibold text-ink-800">{order.customer.area}</dd>
              </div>
              {order.deliverySlot ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Slot</dt>
                  <dd className="font-semibold text-ink-800">{order.deliverySlot}</dd>
                </div>
              ) : null}
              {order.deliveryPartnerId ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Rider</dt>
                  <dd className="font-semibold text-ink-800">
                    {partners.find((partner) => partner.id === order.deliveryPartnerId)?.name ?? "Assigned"}
                  </dd>
                </div>
              ) : null}
            </dl>

            {order.deliveryAddress ? (
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Delivery address</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
                  {order.deliveryAddress.line1}
                  {order.deliveryAddress.line2 ? <>, {order.deliveryAddress.line2}</> : null}
                  {order.deliveryAddress.city ? <>, {order.deliveryAddress.city}</> : null}
                  {order.deliveryAddress.postalCode ? <> {order.deliveryAddress.postalCode}</> : null}
                  <br />
                  {order.deliveryAddress.area}
                </p>
              </div>
            ) : null}
            {order.billingAddress ? (
              <div className="mt-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-400">Billing address</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
                  {order.billingAddress.line1}
                  {order.billingAddress.city ? `, ${order.billingAddress.city}` : ""}
                  {order.billingAddress.postalCode ? ` ${order.billingAddress.postalCode}` : ""}
                </p>
              </div>
            ) : null}
          </section>

          {can(admin, "payments.manage") ? <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h2 className="mb-2 text-[14px] font-extrabold text-ink-900">Verify payment</h2>
            <PaymentVerifyForm
              orderId={order.id}
              paymentStatus={order.paymentStatus}
              reference={order.payment?.reference}
              total={formatPrice(order.total)}
              reviewFingerprint={paymentReviewFingerprint(order)}
            />
          </section> : null}

          <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <h2 className="mb-3 text-[14px] font-extrabold text-ink-900">Timeline</h2>
            <ol className="space-y-3">
              {[...order.timeline].reverse().map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="relative border-l border-line pl-3.5">
                  <span className="absolute -left-[3.5px] top-1 size-1.5 rounded-full bg-brand-600" />
                  <p className="text-[12px] font-semibold capitalize text-ink-800">
                    {entry.status.replace(/_/g, " ")}
                  </p>
                  {entry.note ? <p className="text-[11.5px] text-ink-500">{entry.note}</p> : null}
                  <p className="text-[11px] text-ink-400">
                    {formatDate(entry.at)} · {entry.actor}
                  </p>
                </li>
              ))}
            </ol>
          </section>
          {cancellationReview ? (
            <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
              <h2 className="mb-2 text-[14px] font-extrabold text-ink-900">Private cancellation review</h2>
              <p className="text-[11.5px] text-ink-500">
                Reviewed by {cancellationReview.staffName} · {formatDate(cancellationReview.at)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-700">
                {cancellationReview.note}
              </p>
              {cancellationReview.couponDecision ? (
                <p className="mt-2 text-[11.5px] text-ink-600">
                  Coupon use: {cancellationReview.couponDecision}
                </p>
              ) : null}
              {cancellationReview.customerDecision ? (
                <p className="mt-1 text-[11.5px] text-ink-600">
                  Customer totals: {cancellationReview.customerDecision === "reconcile"
                    ? `${cancellationReview.reconciledOrderCount} orders · ${formatPrice(cancellationReview.reconciledTotalSpent ?? 0)} BDT entered by staff`
                    : "left unchanged after review"}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

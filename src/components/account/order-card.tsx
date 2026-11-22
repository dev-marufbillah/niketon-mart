"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Download, MapPin, PackageSearch, Star } from "lucide-react";
import { cancelOrderAction, type CancelState } from "@/lib/actions/account-orders";
import { formatDate, formatPrice } from "@/lib/utils/format";
import { PreparationLine } from "@/components/checkout/preparation-line";
import type { Order } from "@/lib/repositories/orders";
import { orderStatuses, paymentStatuses } from "@/lib/orders/constants";

/**
 * One order in My Orders — the reference card: a yellow summary row (order id,
 * total, payment method, expected delivery), the product lines, then the status
 * sentence and the actions that are genuinely available for that status.
 */
export function AccountOrderCard({
  order,
  productSlugs = {},
  onlineCancellationAvailable,
}: {
  order: Order;
  onlineCancellationAvailable: boolean;
  /** productId → slug, resolved on the server so links never 404. */
  productSlugs?: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelOrderAction, null);
  const status = orderStatuses.find((entry) => entry.value === order.status);
  const payment = paymentStatuses.find((entry) => entry.value === order.paymentStatus);
  const cancellable = ["pending", "confirmed", "processing"].includes(order.status);
  const trackHref = `/order/${order.number}`;
  const invoiceHref = `/order/${order.number}/invoice`;
  const current = state ?? {};

  /**
   * A cancelled or failed order has no delivery to expect, so it must never
   * carry an "Expected Delivery" date — same rule as the tracking timeline.
   */
  const closed = ["cancelled", "refunded", "failed"].includes(order.status);
  const deliveryHeading = closed ? "Order Closed" : order.status === "delivered" ? "Delivered" : "Expected Delivery";
  const deliveryValue = closed
    ? { cancelled: "Cancelled", refunded: "Refunded", failed: "Payment failed" }[order.status as string] ??
      "Closed"
    : order.status === "delivered"
      ? (order.timeline.find((entry) => entry.status === "delivered")?.at ? formatDate(order.timeline.find((entry) => entry.status === "delivered")!.at) : "—")
      : order.deliverySlot || order.deliveryEta || "Not provided";

  return (
    <article className="overflow-hidden rounded-xl bg-white ring-1 ring-line">
      {/* summary strip */}
      <div className="grid grid-cols-2 gap-y-2 bg-accent-500 px-4 py-3 text-[11.5px] sm:grid-cols-4">
        <div>
          <p className="font-semibold text-brand-900/70">Order ID</p>
          <p className="mt-0.5 text-[12.5px] font-black text-brand-900">#{order.number}</p>
        </div>
        <div>
          <p className="font-semibold text-brand-900/70">Order total</p>
          <p className="mt-0.5 text-[12.5px] font-black text-brand-900">{formatPrice(order.total)}</p>
        </div>
        <div>
          <p className="font-semibold text-brand-900/70">Payment Method</p>
          <p className="mt-0.5 text-[12.5px] font-black text-brand-900">{order.paymentMethod}</p>
        </div>
        <div>
          <p className="font-semibold text-brand-900/70">{deliveryHeading}</p>
          <p className="mt-0.5 text-[12.5px] font-black text-brand-900">{deliveryValue}</p>
        </div>
      </div>

      {/* items */}
      <ul className="divide-y divide-line px-4">
        {order.items.map((item, index) => (
          <li key={`${item.productId}-${item.variantLabel ?? ""}-${index}`} className="flex items-center gap-3 py-2.5">
            <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-surface">
              {item.image ? <Image src={item.image} alt="" fill sizes="44px" className="object-cover" /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <Link
                href={productSlugs[item.productId] ? `/product/${productSlugs[item.productId]}` : "/shop"}
                className="block truncate text-[12.5px] font-semibold text-ink-900 hover:text-brand-700"
              >
                {item.name}
              </Link>
              <span className="text-[10.5px] text-ink-400">
                {item.variantLabel || item.unit} · {item.quantity} Qty.
              </span>
              <PreparationLine preparation={item.preparation} />
            </span>
            <span className="text-[12px] font-semibold tabular-nums text-ink-700">{formatPrice(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      {/* status + actions */}
      <div className="border-t border-line px-4 py-3">
        <p className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10.5px] font-bold ${status?.tone ?? ""}`}>
            {status?.label ?? order.status}
          </span>
          <span className="text-ink-500">
            Order placed {formatDate(order.createdAt)} · {payment?.label ?? order.paymentStatus}
          </span>
        </p>

        {current.ok ? (
          <p role="status" className="mt-2 flex items-start gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[11.5px] font-semibold text-brand-700">
            <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> {current.ok}
          </p>
        ) : null}
        {current.error ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-600">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {current.error}
          </p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Link
            href={trackHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[11.5px] font-bold text-white hover:bg-brand-700"
          >
            <PackageSearch size={13} /> Track Order
          </Link>
          <Link
            href={invoiceHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11.5px] font-semibold text-ink-700 ring-1 ring-line hover:text-brand-700"
          >
            <Download size={13} /> Invoice
          </Link>
          {order.status === "delivered" ? (
            <Link
              href={
                order.items[0] && productSlugs[order.items[0].productId]
                  ? `/product/${productSlugs[order.items[0].productId]}#review`
                  : "/shop"
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11.5px] font-semibold text-ink-700 ring-1 ring-line hover:text-brand-700"
            >
              <Star size={13} /> Add Review
            </Link>
          ) : null}
          {order.deliveryAddress ? (
            <span className="hidden items-center gap-1 text-[11px] text-ink-400 sm:inline-flex">
              <MapPin size={12} /> {order.deliveryAddress.area}
            </span>
          ) : null}

          {cancellable && onlineCancellationAvailable ? (
            <form action={action} className="ml-auto">
              <input type="hidden" name="orderId" value={order.id} />
              <button
                type="submit"
                disabled={pending}
                onClick={(event) => {
                  if (!window.confirm("Cancel this order? The store will stop packing it.")) event.preventDefault();
                }}
                className="text-[11.5px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {pending ? "Cancelling…" : "Cancel Order"}
              </button>
            </form>
          ) : cancellable ? <p className="ml-auto text-[11.5px] text-ink-500">Online cancellation is paused. Contact the store for help.</p> : null}
        </div>
      </div>
    </article>
  );
}

import { ClipboardCheck, Home, Package, ShoppingBag, Truck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Order, OrderStatus } from "@/lib/repositories/orders";
import { orderStatuses } from "@/lib/orders/constants";
import type { SiteSettingsData } from "@/lib/repositories/settings";

/**
 * Customer-facing order timeline (reference: "Order Status").
 *
 * Everything here comes from the order record: the stage the order has actually
 * reached, the timestamp the admin action wrote into the timeline, and — only for
 * steps that have not happened yet — the delivery estimate derived from the
 * admin-managed area ETA and the chosen window. Nothing is invented: a step with
 * no recorded timestamp shows "—", and an order without an ETA shows no date.
 */

const STAGES = [
  { key: "placed", icon: ShoppingBag, statuses: ["pending"] },
  { key: "accepted", icon: ClipboardCheck, statuses: ["confirmed"] },
  { key: "inProgress", icon: Package, statuses: ["processing"] },
  { key: "onTheWay", icon: Truck, statuses: ["out_for_delivery"] },
  { key: "delivered", icon: Home, statuses: ["delivered"] },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

const stageIndexForStatus = (status: OrderStatus) => {
  const index = STAGES.findIndex((stage) => (stage.statuses as readonly string[]).includes(status));
  return index === -1 ? 0 : index;
};

/** The moment a status first appears in the order's own timeline. */
function timestampFor(order: Order, statuses: readonly string[]): string | undefined {
  const entry = order.timeline.find((row) => statuses.includes(row.status));
  return entry?.at;
}

/** Delivery estimate from the area ETA plus the chosen window (both admin data). */
export function estimateDelivery(order: Order): { date?: Date; label?: string; window?: string } {
  if (!order.createdAt) return {};
  const placed = new Date(order.createdAt);
  if (Number.isNaN(placed.getTime())) return {};

  const eta = order.deliveryEta ?? "";
  const nextDay = /next day/i.test(eta);
  const sameDay = /same day/i.test(eta);

  const slot = order.deliverySlot ?? "";
  const windowMatch = slot.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  const window = windowMatch ? `${windowMatch[1]} – ${windowMatch[2]}` : slot || undefined;

  // Only publish a date when the area actually promises one.
  const nextDaySlot = /next day/i.test(slot);
  const sameDaySlot = /same day/i.test(slot);
  if (!(nextDay || sameDay || nextDaySlot || sameDaySlot)) return { window };

  const date = new Date(placed);
  if (nextDay || nextDaySlot) date.setDate(date.getDate() + 1);
  return {
    date,
    window,
    label: date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  };
}

function formatStamp(iso?: string) {
  if (!iso) return { date: "—", time: "" };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: "—", time: "" };
  return {
    date: date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }),
  };
}

export function OrderTimeline({
  order,
  tracking,
}: {
  order: Order;
  tracking: SiteSettingsData["tracking"];
}) {
  const cancelled = order.status === "cancelled" || order.status === "refunded";
  const currentIndex = stageIndexForStatus(order.status);
  const estimate = estimateDelivery(order);
  const showExpected = tracking.showExpectedDates && Boolean(estimate.label);

  return (
    <section className="rounded-2xl bg-white ring-1 ring-line" aria-label="Order status timeline">

      {cancelled ? (
        <div className="px-4 py-5 sm:px-5">
          <p
            role="status"
            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[12.5px] font-semibold text-red-700"
          >
            {order.status === "refunded" ? "This order was refunded." : "This order was cancelled."}{" "}
            <span className="font-normal">{tracking.cancelledNote}</span>
          </p>
          <ol className="mt-4 space-y-2.5">
            {[...order.timeline].reverse().map((entry, index) => {
              const stamp = formatStamp(entry.at);
              return (
                <li key={`${entry.at}-${index}`} className="border-l border-line pl-3.5">
                  <p className="text-[12.5px] font-semibold text-ink-800">
                    {orderStatuses.find((status) => status.value === entry.status)?.label ??
                      entry.status.replace(/_/g, " ")}
                  </p>
                  {entry.note ? <p className="text-[11.5px] text-ink-500">{entry.note}</p> : null}
                  <p className="text-[11px] text-ink-400">
                    {stamp.date}
                    {stamp.time ? ` · ${stamp.time}` : ""} · {entry.actor}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <ol className="grid grid-cols-1 gap-0 px-4 py-5 sm:grid-cols-5 sm:gap-2 sm:px-5">
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const current = index === currentIndex;
            const recordedAt = timestampFor(order, stage.statuses);
            // A later status does not prove every intermediate event happened.
            const done = Boolean(recordedAt) || current;
            const stamp = formatStamp(recordedAt);
            const label = tracking.labels[stage.key as StageKey];
            const description = tracking.descriptions[stage.key as StageKey];

            return (
              <li
                key={stage.key}
                data-stage={stage.key}
                data-state={done ? "done" : "pending"}
                className={cn(
                  "relative flex gap-3 pb-5 sm:flex-col sm:items-center sm:gap-0 sm:pb-0 sm:text-center",
                  index < STAGES.length - 1 && "border-l sm:border-l-0",
                  index < STAGES.length - 1 && (done ? "border-brand-600" : "border-line"),
                )}
              >
                {/* horizontal connector on desktop */}
                {index < STAGES.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-1/2 top-[13px] hidden h-[3px] w-full sm:block",
                      done && Boolean(timestampFor(order, STAGES[index + 1].statuses)) ? "bg-brand-600" : "bg-line",
                    )}
                  />
                ) : null}

                <span
                  className={cn(
                    "relative z-10 -ml-[13px] inline-flex size-7 shrink-0 items-center justify-center rounded-full sm:ml-0",
                    done
                      ? "bg-brand-600 text-white ring-4 ring-white"
                      : "bg-surface text-ink-300 ring-1 ring-line ring-offset-2 ring-offset-white",
                    current && "ring-4 ring-brand-100",
                  )}
                >
                  <Icon size={14} strokeWidth={2} />
                </span>

                <span className="min-w-0 sm:mt-2">
                  <span
                    className={cn(
                      "block text-[12.5px] font-semibold",
                      done ? "text-ink-900" : "text-ink-400",
                    )}
                  >
                    {label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-400">
                    {done ? description : "Awaiting update"}
                  </span>
                  <span className="mt-1 block text-[11px] text-ink-400">
                    {done ? (
                      <>
                        {stamp.date}
                        {stamp.time ? (
                          <>
                            <br />
                            {stamp.time}
                          </>
                        ) : null}
                      </>
                    ) : showExpected && stage.key === "delivered" ? (
                      <>
                        <span className="text-ink-300">Expected</span>
                        <br />
                        {estimate.label}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {!cancelled && estimate.label ? (
        <p className="border-t border-line px-4 py-2.5 text-[11.5px] text-ink-500 sm:px-5">
          Estimated delivery <span className="font-semibold text-ink-700">{estimate.label}</span>
          {estimate.window ? ` · ${estimate.window}` : ""} — we update this page as your order moves.
        </p>
      ) : null}
    </section>
  );
}

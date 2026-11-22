"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Scale } from "lucide-react";
import { recordWeightsAction, settleWeightsAction, type WeightFormState } from "@/lib/admin/weight-actions";
import type { Order } from "@/lib/repositories/orders";
import { formatGrams, weightStatusLabel } from "@/lib/weights/weight";
import { formatPrice } from "@/lib/utils/format";

const tone: Record<string, string> = {
  estimated: "bg-accent-100 text-accent-700",
  proposed: "bg-amber-100 text-amber-800",
  approved: "bg-brand-50 text-brand-700",
  waived: "bg-surface text-ink-600",
};

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-600 px-4 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <Scale size={13} /> {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * The weighing step for fresh orders.
 *
 * Only lines sold by an estimated weight appear here. The shop types what the
 * scale says in grams; the server does the maths. A reading above the estimate
 * becomes a proposal the customer must approve — the panel says so before the
 * admin saves, so nobody is surprised by a blocked total.
 */
export function WeightPanel({ order, holdReason }: { order: Pick<Order, "id" | "items">; holdReason: string | null }) {
  const [state, action] = useActionState<WeightFormState, FormData>(
    recordWeightsAction.bind(null, order.id),
    null,
  );
  const weighed = order.items
    .map((item, index) => ({ item, index }))
    .filter((entry) => entry.item.weight);

  if (weighed.length === 0) return null;

  const proposedTotal = weighed
    .filter((entry) => entry.item.weight?.status === "proposed")
    .reduce((total, entry) => total + Math.max(0, (entry.item.weight?.actualLineTotal ?? entry.item.lineTotal) - entry.item.lineTotal), 0);
  const hasProposal = weighed.some((entry) => entry.item.weight?.status === "proposed");

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="mb-2 flex items-center gap-1.5">
        <Scale size={15} className="text-brand-600" />
        <h2 className="text-[14px] font-extrabold text-ink-900">Weighing</h2>
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-ink-400">
        Enter the scale reading in grams. An amount below the current line price is applied immediately. Any
        increase from the current line price waits for the customer to approve the new total. The checkout discount
        and delivery fee remain fixed; already-paid or unreconciled orders require manual review.
      </p>

      {holdReason ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">{holdReason}</p> : null}
      <form action={action}>
      <fieldset disabled={Boolean(holdReason)}>
      <ul className="mb-3 divide-y divide-line">
        {weighed.map(({ item, index }) => {
          const weight = item.weight!;
          return (
            <li key={`${item.productId}-${index}`} className="py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink-800">{item.name}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    tone[weight.status] ?? tone.estimated
                  }`}
                >
                  {weightStatusLabel(weight.status)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-ink-400">
                Ordered {formatGrams(weight.estimatedGrams)}
                {weight.estimateLabel ? ` · ${weight.estimateLabel}` : ""}
                {weight.actualGrams ? ` · weighed ${formatGrams(weight.actualGrams)}` : ""}
              </p>
              {weight.status === "proposed" && weight.difference ? (
                <p className="text-[11px] font-semibold text-amber-700">
                  {formatPrice(weight.difference)} more, waiting for the customer
                </p>
              ) : null}
              {weight.status === "approved" && weight.difference ? (
                <p className="text-[11px] font-semibold text-brand-700">
                  {weight.difference > 0 ? "+" : ""}
                  {formatPrice(weight.difference)} applied
                </p>
              ) : null}
              {weight.status === "waived" && weight.difference ? (
                <p className="text-[11px] text-ink-500">
                  {formatPrice(weight.difference)} difference waived
                </p>
              ) : null}
              <label className="mt-1.5 flex items-center gap-2">
                <span className="text-[11px] font-semibold text-ink-600">Scale reading</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50000}
                  step={1}
                  name={`grams:${index}`}
                  defaultValue={weight.actualGrams ?? ""}
                  placeholder={String(weight.estimatedGrams)}
                  className="h-8 w-24 rounded-lg border border-line bg-white px-2 text-[12px] tabular-nums"
                />
                <span className="text-[11px] text-ink-400">grams</span>
              </label>
            </li>
          );
        })}
      </ul>

      {state?.errors?.length ? (
        <ul role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="mb-2 rounded-xl bg-brand-50 px-3 py-2 text-[12px] font-semibold text-brand-700">
          {state.success}
        </p>
      ) : null}

        <Save label="Save weights" />
      </fieldset>
      </form>

      {hasProposal && !holdReason ? (
        <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5">
          <p className="text-[11.5px] leading-relaxed text-amber-900">
            {formatPrice(proposedTotal)} is waiting for the customer to approve on their private order page.
            Staff can waive the difference, but cannot approve a higher charge on the customer’s behalf.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SettleButtons orderId={order.id} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SettleButtons({ orderId }: { orderId: string }) {
  const [waiveState, waive] = useActionState<WeightFormState, FormData>(
    async () => settleWeightsAction(orderId, "waive"),
    null,
  );
  const message = waiveState?.success ?? waiveState?.errors?.[0];

  return (
    <>
      <form action={waive}>
        <button
          type="submit"
          className="h-8 rounded-full border border-amber-300 bg-white px-3 text-[11.5px] font-semibold text-amber-800 hover:bg-amber-100"
        >
          Waive the difference
        </button>
      </form>
      {message ? <p className="w-full text-[11px] font-semibold text-amber-900">{message}</p> : null}
    </>
  );
}

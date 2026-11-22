"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Scale } from "lucide-react";
import { respondToWeightChange, type WeightDecisionState } from "@/lib/actions/weight-confirmation";
import type { Order } from "@/lib/repositories/orders";
import { formatGrams } from "@/lib/weights/weight";
import { formatPrice } from "@/lib/utils/format";

function Decide({ value, label, primary }: { value: "approve" | "keep"; label: string; primary?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="decision"
      value={value}
      disabled={pending}
      className={
        primary
          ? "inline-flex h-10 items-center rounded-full bg-brand-600 px-5 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
          : "inline-flex h-10 items-center rounded-full border border-line bg-white px-5 text-[12.5px] font-semibold text-ink-700 hover:bg-surface disabled:opacity-60"
      }
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * The customer's half of the variable-weight workflow.
 *
 * Shown on the order page only while a heavier pack is waiting. Nothing has been
 * changed: the shopper sees the exact difference and chooses. Declining keeps
 * the current line amounts, including any earlier reductions.
 */
export function WeightConfirmation({ order, approvalTotal, fingerprint }: { order: Pick<Order, "number" | "items" | "total">; approvalTotal: number; fingerprint: string }) {
  const [state, action] = useActionState<WeightDecisionState, FormData>(respondToWeightChange, null);
  const proposed = order.items.filter((item) => item.weight?.status === "proposed");
  if (proposed.length === 0) return null;

  return (
    <section
      className="mt-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 sm:p-5"
      aria-labelledby="weight-check"
    >
      <h2 id="weight-check" className="flex items-center gap-1.5 text-[14.5px] font-extrabold text-amber-900">
        <Scale size={16} /> Your fresh items were weighed
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-900/80">
        The latest scale reading would increase the current price of one or more items. The order total remains
        unchanged unless you approve the new amount. You can keep the current amount instead.
      </p>

      <ul className="mt-3 space-y-2">
        {proposed.map((item, index) => (
          <li
            key={`${item.productId}-${index}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 px-3 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold text-ink-900">{item.name}</span>
              <span className="text-[11.5px] text-ink-600">
                Estimated {formatGrams(item.weight?.estimatedGrams)} · weighed{" "}
                {formatGrams(item.weight?.actualGrams)}
              </span>
            </span>
            <span className="text-[12.5px] font-bold tabular-nums text-ink-900">
              {item.weight?.difference && item.weight.difference > 0 ? "+" : ""}
              {formatPrice(item.weight?.difference ?? 0)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[13px] font-extrabold text-amber-900">
        New total if you agree: {formatPrice(approvalTotal)}
        <span className="ml-1 font-semibold text-amber-900/70">
          (current total {formatPrice(order.total)})
        </span>
      </p>

      {state?.error ? (
        <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p role="status" className="mt-2 rounded-xl bg-white px-3 py-2 text-[12px] font-semibold text-brand-700">
          {state.success}
        </p>
      ) : null}

      <form action={action} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="number" value={order.number} />
        <input type="hidden" name="fingerprint" value={fingerprint} />
        <input type="hidden" name="expectedTotal" value={approvalTotal} />
        <Decide value="approve" label="Approve the new weight" primary />
        <Decide value="keep" label="Keep my current amount" />
      </form>
      <p className="mt-2 text-[11px] leading-relaxed text-amber-900/70">
        The checkout discount and delivery fee are retained; the discount cannot exceed the item subtotal.
        If you keep the current amount, the additional weight difference is waived.
      </p>
    </section>
  );
}

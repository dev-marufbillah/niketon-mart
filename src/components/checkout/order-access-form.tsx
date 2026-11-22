"use client";

import { useActionState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { trackOrderAction, type TrackOrderState } from "@/lib/actions/orders";

/**
 * "Track your order" form.
 * Order ID plus a private confirmation key (or a signed-in owner session).
 * Email/phone alone is not proof that the visitor owns an order.
 */
export function OrderAccessForm({
  number = "",
  compact = false,
  plain = false,
}: {
  number?: string;
  compact?: boolean;
  /** `plain` renders the fields straight on the page, exactly like the reference. */
  plain?: boolean;
}) {
  const [state, formAction, pending] = useActionState<TrackOrderState, FormData>(trackOrderAction, null);

  return (
    <div className={compact || plain ? "" : "rounded-2xl bg-white p-5 ring-1 ring-line sm:p-7"}>
      {!compact && !plain ? (
        <>
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <ShieldCheck size={18} />
          </span>
          <h2 className="mt-3 text-[18px] font-extrabold text-ink-900">Where is my order?</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
            Sign in to the account that placed the order, or enter the private key from your confirmation link.
            An email address or phone number alone cannot unlock an order.
          </p>
        </>
      ) : null}

      <form action={formAction} className={compact ? "space-y-3" : plain ? "space-y-4" : "mt-4 space-y-3.5"}>
        <div>
          <label htmlFor="track-number" className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">
            Order ID <span className="text-red-500">*</span>
          </label>
          <input
            id="track-number"
            name="number"
            defaultValue={number}
            placeholder="Enter Your Order ID"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] uppercase outline-none transition-colors placeholder:normal-case placeholder:text-ink-300 focus:border-brand-500"
          />
        </div>

        <div>
          <label htmlFor="track-key" className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">
            Private access key
          </label>
          <input
            id="track-key"
            name="accessToken"
            type="password"
            placeholder="Key from your confirmation link"
            aria-describedby="track-help"
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500"
          />
          <p id="track-help" className="mt-1 text-[11px] text-ink-400">
            For guest orders, use the characters after #token= in your saved private link. Older links may use t=. Signed-in customers can leave this blank for their own orders.
          </p>
        </div>

        {state?.error ? (
          <p
            role="alert"
            className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-600"
          >
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-7 text-[13px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Checking…" : "Track Order"}
        </button>
      </form>
    </div>
  );
}

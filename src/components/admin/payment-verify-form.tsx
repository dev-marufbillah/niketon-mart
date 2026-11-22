"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { verifyPaymentAction } from "@/lib/admin/payment-actions";
import type { AdminFormState } from "@/lib/admin/operations-actions";
import { paymentStatuses } from "@/lib/orders/constants";

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/**
 * Verify a payment for one order.
 * The reference the shopper typed (or the gateway sent) is pre-filled so staff
 * can check it against the merchant statement and mark the order paid, failed or
 * refunded — every change lands in the order timeline with the staff member's name.
 */
export function PaymentVerifyForm({
  orderId,
  paymentStatus,
  reference,
  total,
  reviewFingerprint,
}: {
  orderId: string;
  paymentStatus: string;
  reference?: string;
  total: string;
  reviewFingerprint: string;
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    verifyPaymentAction.bind(null, orderId),
    null,
  );
  // React resets uncontrolled forms after a server action, even on validation
  // errors. Preserve the staff member's selected decision and entered evidence.
  const [selectedStatus, setSelectedStatus] = useState(paymentStatus);
  const [paymentReference, setPaymentReference] = useState(reference ?? "");
  const [refundReference, setRefundReference] = useState("");
  const [note, setNote] = useState("");

  return (
    <form action={action} onReset={(event) => event.preventDefault()} className="space-y-3">
      <input type="hidden" name="reviewFingerprint" value={reviewFingerprint} />
      <p className="text-[11.5px] leading-relaxed text-ink-500">
        Check <span className="font-semibold text-ink-700">{total}</span> in the merchant app, then record what you
        found. This order is currently{" "}
        <span className="font-semibold text-ink-700">{paymentStatus.replace(/_/g, " ")}</span>. This form does not process payments or refunds.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Transaction ID</span>
          <input
            name="reference"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.target.value)}
            maxLength={160}
            placeholder="e.g. 9F2K1M7QAZ"
            className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Mark as</span>
          <select
            name="paymentStatus"
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
            className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
          >
            {paymentStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Separate refund reference (required when recording a refund)</span>
        <input name="refundReference" value={refundReference} onChange={(event) => setRefundReference(event.target.value)} maxLength={160} placeholder="Reference of the completed refund" className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]" />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Verification note (required for a refund)</span>
        <input
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="e.g. Matched against bKash statement 10 Nov"
          className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
        />
      </label>

      {state?.errors?.length ? (
        <ul role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-[12px] font-semibold text-brand-700">
          {state.success}
        </p>
      ) : null}

      <Save label="Save payment status" />
    </form>
  );
}

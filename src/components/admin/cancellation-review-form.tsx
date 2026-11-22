"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { reviewCancellationAction } from "@/lib/admin/cancellation-actions";
import type { AdminFormState } from "@/lib/admin/operations-actions";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-full bg-red-600 px-4 text-[12.5px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Reviewing…" : "Approve reviewed cancellation"}
    </button>
  );
}

export function CancellationReviewForm({
  orderId,
  updatedAt,
  customerId,
  customerSnapshot,
  couponCode,
}: {
  orderId: string;
  updatedAt: string;
  customerId?: string;
  customerSnapshot?: { orderCount: number | null; totalSpent: number | null; updatedAt: string };
  couponCode?: string;
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    reviewCancellationAction.bind(null, orderId),
    null,
  );
  const [customerDecision, setCustomerDecision] = useState("");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reviewedUpdatedAt" value={updatedAt} />
      <p className="text-[11.5px] leading-relaxed text-ink-500">
        Review the order before approving. The order and stock change, plus any selected coupon/customer adjustments,
        commit together in a MongoDB transaction. A refund is never initiated here.
      </p>

      {customerId ? (
        <div className="space-y-2">
          {customerSnapshot ? (
            <>
              <input type="hidden" name="expectedCustomerUpdatedAt" value={customerSnapshot.updatedAt} />
              {customerSnapshot.orderCount !== null && customerSnapshot.totalSpent !== null ? (
                <p className="text-[11.5px] text-ink-500">
                  Current recorded totals: {customerSnapshot.orderCount} orders · BDT {customerSnapshot.totalSpent}
                </p>
              ) : (
                <p className="text-[11.5px] text-accent-700">Current customer totals need reconciliation.</p>
              )}
            </>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">
              Customer totals
            </span>
            <select
              name="customerDecision"
              value={customerDecision}
              onChange={(event) => setCustomerDecision(event.target.value)}
              required
              className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
            >
              <option value="">Choose after reviewing the customer record</option>
              <option value="leave">Leave recorded totals unchanged</option>
              <option value="reconcile">Enter verified totals after cancellation</option>
            </select>
          </label>
          {customerDecision === "reconcile" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Verified order count</span>
                <input
                  name="reconciledOrderCount"
                  type="number"
                  min="0"
                  step="1"
                  required
                  className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Verified total spent (BDT)</span>
                <input
                  name="reconciledTotalSpent"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {couponCode ? (
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">
            Coupon {couponCode}
          </span>
          <select
            name="couponDecision"
            required
            defaultValue=""
            className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
          >
            <option value="">Choose after reviewing coupon usage</option>
            <option value="retain">Retain this coupon use</option>
            <option value="release">Release this coupon use</option>
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Review note</span>
        <textarea
          name="reviewNote"
          minLength={8}
          maxLength={500}
          required
          rows={3}
          placeholder="Record what you checked and why this cancellation is approved"
          className="w-full rounded-xl border border-line bg-white px-2.5 py-2 text-[12.5px]"
        />
      </label>

      {state?.errors?.length ? (
        <ul role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {state.errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-[12px] font-semibold text-brand-700">
          {state.success}
        </p>
      ) : null}

      <SaveButton />
    </form>
  );
}

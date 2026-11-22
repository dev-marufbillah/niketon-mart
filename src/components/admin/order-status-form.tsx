"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateOrderAction, type AdminFormState } from "@/lib/admin/operations-actions";
import { orderStatuses } from "@/lib/orders/constants";
import type { Order } from "@/lib/repositories/orders";

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

export function OrderStatusForm({
  order,
  partners,
}: {
  order: Pick<Order, "id" | "status" | "deliveryPartnerId">;
  partners: { id: string; name: string; zone: string }[];
}) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    updateOrderAction.bind(null, order.id),
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Order status</span>
          <select
            name="status"
            defaultValue={order.status}
            className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
          >
            {orderStatuses.filter((status) => status.value !== "cancelled" || order.status === "cancelled").map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Assign delivery partner</span>
          <select
            name="deliveryPartnerId"
            defaultValue={order.deliveryPartnerId ?? ""}
            className="h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px]"
          >
            <option value="">Not assigned</option>
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name} ({partner.zone})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">
          Note for the customer timeline (optional)
        </span>
        <input
          name="note"
          placeholder="e.g. Rider called — customer asked for evening delivery"
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

      <Save label="Update order" />
    </form>
  );
}

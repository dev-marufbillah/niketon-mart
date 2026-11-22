"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCustomerAction, type AdminFormState } from "@/lib/admin/operations-actions";
import type { AdminCustomerFormData } from "@/lib/admin/customer-dto";

const inputClass =
  "h-9 w-full rounded-xl border border-line bg-white px-2.5 text-[12.5px] outline-none focus:border-brand-500";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save customer"}
    </button>
  );
}

export function CustomerForm({ customer }: { customer: AdminCustomerFormData }) {
  const [state, action] = useActionState<AdminFormState, FormData>(
    updateCustomerAction.bind(null, customer.id),
    null,
  );

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Full name</span>
          <input name="name" defaultValue={customer.name} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Phone</span>
          <input name="phone" defaultValue={customer.phone} className={inputClass} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Delivery address</span>
          <input name="address" defaultValue={customer.address} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Area</span>
          <input name="area" defaultValue={customer.area ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Account</span>
          <select name="status" defaultValue={customer.status} className={inputClass}>
            <option value="active">Active</option>
            <option value="blocked">Blocked — cannot order</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11.5px] font-semibold text-ink-600">Internal notes</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={customer.notes ?? ""}
            placeholder="Delivery preferences, allergies, account history…"
            className="w-full rounded-xl border border-line bg-white px-2.5 py-2 text-[12.5px] outline-none focus:border-brand-500"
          />
        </label>
      </div>

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

      <Submit />
    </form>
  );
}

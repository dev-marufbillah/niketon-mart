"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, KeyRound, LogOut, MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import {
  adminDeleteCustomerAddressAction,
  adminSaveCustomerAddressAction,
  adminSetDefaultCustomerAddressAction,
  adminRevokeCustomerSessionsAction,
  type AdminCustomerState,
} from "@/lib/admin/customer-actions";
import type { CustomerAddress } from "@/lib/repositories/accounts";

/**
 * Admin → Customer detail: account state and the customer's address book.
 *
 * Staff can correct or remove an address and sign the customer out everywhere.
 * There is deliberately no password field and no card data here — those never
 * reach the admin panel.
 */

const field =
  "h-9 w-full rounded-lg border border-line bg-white px-3 text-[12.5px] outline-none focus:border-brand-500";
const labelClass = "mb-1 block text-[11.5px] font-semibold text-ink-700";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save address"}
    </button>
  );
}

function AddressForm({
  customerId,
  areas,
  address,
  defaults,
  onDone,
}: {
  customerId: string;
  areas: { id: string; name: string }[];
  address?: CustomerAddress;
  defaults: { firstName: string; lastName: string; phone: string; email: string };
  onDone: () => void;
}) {
  const action = adminSaveCustomerAddressAction.bind(null, customerId);
  const [state, formAction] = useActionState<AdminCustomerState, FormData>(action, null);

  return (
    <form action={formAction} className="rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-bold text-ink-800">{address ? "Edit address" : "New address"}</p>
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="inline-flex size-6 items-center justify-center rounded-full text-ink-400 hover:bg-white"
        >
          <X size={13} />
        </button>
      </div>
      {address ? <input type="hidden" name="id" value={address.id} /> : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Label</span>
          <input name="label" defaultValue={address?.label ?? ""} className={field} placeholder="Home, Office…" />
        </label>
        <label className="block">
          <span className={labelClass}>First name</span>
          <input name="firstName" required defaultValue={address?.firstName ?? defaults.firstName} className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Last name</span>
          <input name="lastName" required defaultValue={address?.lastName ?? defaults.lastName} className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Phone</span>
          <input name="phone" required defaultValue={address?.phone ?? defaults.phone} className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input name="email" type="email" defaultValue={address?.email ?? defaults.email} className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Company</span>
          <input name="company" defaultValue={address?.company ?? ""} className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Street address</span>
          <input name="address" required defaultValue={address?.address ?? ""} className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Address line 2</span>
          <input name="addressLine2" defaultValue={address?.addressLine2 ?? ""} className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>City</span>
          <input name="city" defaultValue={address?.city ?? ""} className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Postal code</span>
          <input name="postalCode" defaultValue={address?.postalCode ?? ""} className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Delivery area</span>
          <select name="areaId" defaultValue={address?.areaId ?? areas[0]?.id} className={field}>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink-600">
          <input type="checkbox" name="isDefaultShipping" defaultChecked={address?.isDefaultShipping} className="size-3.5 rounded border-line" />
          Default delivery
        </label>
        <label className="flex items-center gap-1.5 text-[11.5px] text-ink-600">
          <input type="checkbox" name="isDefaultBilling" defaultChecked={address?.isDefaultBilling} className="size-3.5 rounded border-line" />
          Default billing
        </label>
      </div>

      {state?.errors?.length ? (
        <ul role="alert" className="mt-2 space-y-0.5 text-[11.5px] font-semibold text-red-600">
          {state.errors.map((error) => (
            <li key={error} className="flex items-start gap-1">
              <AlertCircle size={11} className="mt-0.5 shrink-0" /> {error}
            </li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="mt-2 flex items-center gap-1 text-[11.5px] font-semibold text-brand-700">
          <CheckCircle2 size={11} /> {state.success}
        </p>
      ) : null}

      <div className="mt-2.5">
        <Save />
      </div>
    </form>
  );
}

export function CustomerAccountPanel({
  customerId,
  hasPassword,
  hasGoogle,
  emailVerified,
  lastLoginAt,
  sessionCount,
  addresses,
  areas,
  defaults,
}: {
  customerId: string;
  hasPassword: boolean;
  hasGoogle: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  sessionCount: number;
  addresses: CustomerAddress[];
  areas: { id: string; name: string }[];
  defaults: { firstName: string; lastName: string; phone: string; email: string };
}) {
  const [mode, setMode] = useState<"list" | "add" | string>("list");
  const editing = mode !== "list" && mode !== "add" ? addresses.find((row) => row.id === mode) : undefined;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="mb-2 text-[13.5px] font-extrabold text-ink-900">Account</h2>
        <dl className="grid gap-2 text-[12px] sm:grid-cols-2">
          <div className="rounded-lg bg-surface px-2.5 py-2">
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-400">Sign-in</dt>
            <dd className="mt-0.5 font-semibold text-ink-800">
              {hasPassword && hasGoogle ? "Password and Google" : hasGoogle ? "Google account" : hasPassword ? "Account with password" : "Guest record — no account yet"}
            </dd>
          </div>
          <div className="rounded-lg bg-surface px-2.5 py-2">
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-400">Sessions</dt>
            <dd className="mt-0.5 font-semibold text-ink-800">
              {sessionCount} active device{sessionCount === 1 ? "" : "s"}
            </dd>
          </div>
          <div className="rounded-lg bg-surface px-2.5 py-2">
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-400">Email</dt>
            <dd className="mt-0.5 font-semibold text-ink-800">{emailVerified ? "Verified" : "Not verified"}</dd>
          </div>
          <div className="rounded-lg bg-surface px-2.5 py-2">
            <dt className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-400">Last sign-in</dt>
            <dd className="mt-0.5 font-semibold text-ink-800">{lastLoginAt ? new Date(lastLoginAt).toLocaleString() : "Never"}</dd>
          </div>
        </dl>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <form action={adminRevokeCustomerSessionsAction.bind(null, customerId)}>
            <button
              type="submit"
              disabled={sessionCount === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface px-3 text-[11.5px] font-semibold text-ink-700 ring-1 ring-line hover:text-brand-700 disabled:opacity-50"
            >
              <LogOut size={12} /> Sign out all devices
            </button>
          </form>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-400">
            <KeyRound size={11} /> Passwords are changed by the customer only.
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13.5px] font-extrabold text-ink-900">
            Saved addresses <span className="font-semibold text-ink-400">({addresses.length})</span>
          </h2>
          {mode === "list" ? (
            <button
              type="button"
              onClick={() => setMode("add")}
              className="inline-flex h-8 items-center gap-1 rounded-full bg-brand-600 px-3 text-[11.5px] font-bold text-white hover:bg-brand-700"
            >
              <Plus size={12} /> Add
            </button>
          ) : null}
        </div>

        {mode !== "list" ? (
          <AddressForm
            key={mode}
            customerId={customerId}
            areas={areas}
            address={editing}
            defaults={defaults}
            onDone={() => setMode("list")}
          />
        ) : addresses.length === 0 ? (
          <p className="text-[12px] text-ink-400">
            This customer has not saved an address. Checkout still works — they type it each time.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {addresses.map((address) => (
              <li key={address.id} className="py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-ink-900">
                      <MapPin size={12} className="text-brand-600" />
                      {address.label || "Address"}
                      {address.isDefaultShipping ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-bold text-brand-700">
                          <Star size={8} /> Default
                        </span>
                      ) : null}
                      {address.isDefaultBilling ? (
                        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[9.5px] font-bold text-ink-500 ring-1 ring-line">
                          Billing
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11.5px] text-ink-500">
                      {address.firstName} {address.lastName} · {address.phone}
                    </p>
                    <p className="text-[11.5px] text-ink-500">
                      {[address.address, address.addressLine2, address.city, address.postalCode].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setMode(address.id)}
                      className="inline-flex h-7 items-center gap-1 rounded-full bg-surface px-2 text-[10.5px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700"
                    >
                      <Pencil size={10} /> Edit
                    </button>
                    {!address.isDefaultShipping ? (
                      <form action={adminSetDefaultCustomerAddressAction.bind(null, customerId)}>
                        <input type="hidden" name="id" value={address.id} />
                        <input type="hidden" name="kind" value="shipping" />
                        <button type="submit" className="text-[10.5px] font-semibold text-brand-700 hover:underline">
                          Make default
                        </button>
                      </form>
                    ) : null}
                    <form action={adminDeleteCustomerAddressAction.bind(null, customerId)}>
                      <input type="hidden" name="id" value={address.id} />
                      <button
                        type="submit"
                        aria-label={`Delete ${address.label || "address"}`}
                        onClick={(event) => {
                          if (!window.confirm("Delete this address from the customer's account?")) event.preventDefault();
                        }}
                        className="inline-flex size-7 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={11} />
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import {
  deleteAddressAction,
  saveAddressAction,
  setDefaultAddressAction,
  type FormState,
} from "@/lib/actions/account";
import type { CustomerAddress } from "@/lib/repositories/accounts";
import { cn } from "@/lib/utils/cn";

/**
 * Address book.
 *
 * The form is the same for "add" and "edit" — editing simply posts the address
 * id. Every button here calls a server action; there is no local-only state that
 * survives a refresh, and the checkout reads the same rows.
 */

const field =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";
const labelClass = "mb-1.5 block text-[12px] font-semibold text-ink-700";

type Area = { id: string; name: string };

function Save({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center rounded-full bg-brand-600 px-5 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function AddressForm({
  address,
  areas,
  defaults,
  onDone,
}: {
  address?: CustomerAddress;
  areas: Area[];
  defaults: { firstName: string; lastName: string; phone: string; email: string };
  onDone: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveAddressAction, null);

  useEffect(() => {
    if (state?.success) {
      const timer = setTimeout(onDone, 900);
      return () => clearTimeout(timer);
    }
  }, [state?.success, onDone]);

  return (
    <form action={action} className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14px] font-extrabold text-ink-900">{address ? "Edit address" : "Add new address"}</h2>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex size-7 items-center justify-center rounded-full text-ink-400 hover:bg-surface hover:text-ink-700"
          aria-label="Close address form"
        >
          <X size={15} />
        </button>
      </div>

      {address ? <input type="hidden" name="id" value={address.id} /> : null}

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelClass}>Address label</span>
          <input
            name="label"
            defaultValue={address?.label ?? ""}
            placeholder="Home, Office, Parents…"
            className={field}
          />
        </label>
        <label className="block">
          <span className={labelClass}>
            First name <span className="text-red-500">*</span>
          </span>
          <input name="firstName" required defaultValue={address?.firstName ?? defaults.firstName} className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>
            Last name <span className="text-red-500">*</span>
          </span>
          <input name="lastName" required defaultValue={address?.lastName ?? defaults.lastName} className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>
            Phone <span className="text-red-500">*</span>
          </span>
          <input name="phone" required defaultValue={address?.phone ?? defaults.phone} className={field} />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input name="email" type="email" defaultValue={address?.email ?? defaults.email} className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Company (optional)</span>
          <input name="company" defaultValue={address?.company ?? ""} className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>
            Street address <span className="text-red-500">*</span>
          </span>
          <input
            name="address"
            required
            defaultValue={address?.address ?? ""}
            placeholder="House 12, Road 5, Dhanmondi"
            className={field}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={labelClass}>Apartment, floor, landmark (optional)</span>
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
          <span className={labelClass}>
            Delivery area <span className="text-red-500">*</span>
          </span>
          <select name="areaId" required defaultValue={address?.areaId ?? areas[0]?.id ?? ""} className={field}>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[12px] text-ink-600">
          <input
            type="checkbox"
            name="isDefaultShipping"
            defaultChecked={address?.isDefaultShipping ?? false}
            className="size-4 rounded border-line"
          />
          Default delivery address
        </label>
        <label className="flex items-center gap-2 text-[12px] text-ink-600">
          <input
            type="checkbox"
            name="isDefaultBilling"
            defaultChecked={address?.isDefaultBilling ?? false}
            className="size-4 rounded border-line"
          />
          Default billing address
        </label>
      </div>

      {state?.errors?.length ? (
        <ul role="alert" className="mt-3 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-semibold text-red-600">
          {state.errors.map((error) => (
            <li key={error} className="flex items-start gap-1.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
            </li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="mt-3 flex items-center gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12px] font-semibold text-brand-700">
          <CheckCircle2 size={13} /> {state.success}
        </p>
      ) : null}

      <div className="mt-3">
        <Save label={address ? "Save address" : "Add address"} />
      </div>
    </form>
  );
}

export function AddressManager({
  addresses,
  areas,
  defaults,
}: {
  addresses: CustomerAddress[];
  areas: Area[];
  defaults: { firstName: string; lastName: string; phone: string; email: string };
}) {
  const [mode, setMode] = useState<"list" | "add" | string>("list");
  const editing = mode !== "list" && mode !== "add" ? addresses.find((row) => row.id === mode) : undefined;

  const close = () => setMode("list");

  return (
    <div className="space-y-4">
      {mode === "list" ? (
        <>
          {addresses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center">
              <p className="text-[15px] font-extrabold text-ink-900">No saved addresses yet</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
                Save the places you order to and checkout fills them in for you.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {addresses.map((address) => (
                <li key={address.id} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-extrabold text-ink-900">
                        {address.label || "Address"}
                        {address.isDefaultShipping ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                            <Star size={9} /> Default delivery
                          </span>
                        ) : null}
                        {address.isDefaultBilling ? (
                          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-ink-500 ring-1 ring-line">
                            Billing
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
                        {address.firstName} {address.lastName} · {address.phone}
                      </p>
                      <p className="text-[12px] leading-relaxed text-ink-500">
                        {[address.address, address.addressLine2, address.city, address.postalCode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {areas.find((area) => area.id === address.areaId)?.name ?? address.areaId}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setMode(address.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-full bg-surface px-2.5 text-[11px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700"
                      >
                        <Pencil size={11} /> Edit
                      </button>
                      <form action={deleteAddressAction}>
                        <input type="hidden" name="id" value={address.id} />
                        <button
                          type="submit"
                          onClick={(event) => {
                            if (!window.confirm(`Delete “${address.label || "this address"}”?`)) event.preventDefault();
                          }}
                          aria-label={`Delete ${address.label || "address"}`}
                          className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </form>
                    </div>
                  </div>

                  {!address.isDefaultShipping || !address.isDefaultBilling ? (
                    <div className="mt-2.5 flex flex-wrap gap-2 border-t border-line pt-2.5">
                      {!address.isDefaultShipping ? (
                        <form action={setDefaultAddressAction}>
                          <input type="hidden" name="id" value={address.id} />
                          <input type="hidden" name="kind" value="shipping" />
                          <button
                            type="submit"
                            className="text-[11px] font-semibold text-brand-700 hover:underline"
                          >
                            Use as default delivery address
                          </button>
                        </form>
                      ) : null}
                      {!address.isDefaultBilling ? (
                        <form action={setDefaultAddressAction}>
                          <input type="hidden" name="id" value={address.id} />
                          <input type="hidden" name="kind" value="billing" />
                          <button
                            type="submit"
                            className="text-[11px] font-semibold text-brand-700 hover:underline"
                          >
                            Use as default billing address
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => setMode("add")}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand-300 bg-brand-50/40 text-[12.5px] font-bold text-brand-700",
              "hover:bg-brand-50",
            )}
          >
            <Plus size={14} /> Add a new address
          </button>
        </>
      ) : (
        <AddressForm
          key={mode}
          address={editing}
          areas={areas}
          defaults={defaults}
          onDone={close}
        />
      )}
    </div>
  );
}

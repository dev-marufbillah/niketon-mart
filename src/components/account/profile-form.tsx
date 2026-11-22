"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateProfileAction, type FormState } from "@/lib/actions/account";

/**
 * Personal information.
 * Contact fields are saved to the customer record. Login email changes use a
 * separate password-reauthenticated email-verification flow.
 */

const field =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-700";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-7 text-[13px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Update Changes"}
    </button>
  );
}

export function ProfileForm({
  initial,
  orderCount,
}: {
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    emailVerified: boolean;
    marketingOptIn?: boolean;
  };
  orderCount: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, null);
  const initials = `${initial.firstName[0] ?? ""}${initial.lastName[0] ?? ""}`.toUpperCase() || "NM";

  return (
    <form action={action} className="space-y-4" noValidate>
      <div className="flex items-center gap-4">
        <span className="relative inline-flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[19px] font-black text-brand-700">
          {initials}
        </span>
        <div>
          <p className="text-[13px] font-extrabold text-ink-900">
            {initial.firstName} {initial.lastName}
          </p>
          <p className="text-[11.5px] text-ink-400">
            {orderCount} order{orderCount === 1 ? "" : "s"} · {initial.emailVerified ? "email verified" : "email not verified"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>
            First Name <span className="text-red-500">*</span>
          </span>
          <input name="firstName" required defaultValue={initial.firstName} className={field} autoComplete="given-name" />
        </label>
        <label className="block">
          <span className={labelClass}>
            Last Name <span className="text-red-500">*</span>
          </span>
          <input name="lastName" required defaultValue={initial.lastName} className={field} autoComplete="family-name" />
        </label>
        <label className="block">
          <span className={labelClass}>
            Email <span className="text-red-500">*</span>
          </span>
          <input name="email" type="email" readOnly defaultValue={initial.email} className={`${field} bg-surface-2`} autoComplete="email" aria-describedby="login-email-help" />
          <span id="login-email-help" className="mt-1 block text-[11px] text-ink-500">Verify or change your sign-in email below.</span>
        </label>
        <label className="block">
          <span className={labelClass}>
            Phone <span className="text-red-500">*</span>
          </span>
          <input name="phone" type="tel" required defaultValue={initial.phone} className={field} autoComplete="tel" />
        </label>
        <label className="block">
          <span className={labelClass}>Gender</span>
          <select name="gender" defaultValue={initial.gender} className={field}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer-not">Prefer not to say</option>
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-3 text-[12px] text-ink-600">
          <input
            type="checkbox"
            name="marketingOptIn"
            defaultChecked={Boolean(initial.marketingOptIn)}
            className="size-4 rounded border-line"
          />
          Email me the weekly offers
        </label>
      </div>

      {state?.errors?.length ? (
        <ul role="alert" className="space-y-1 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-semibold text-red-600">
          {state.errors.map((error) => (
            <li key={error} className="flex items-start gap-1.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
            </li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="flex items-start gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {state.success}
        </p>
      ) : null}

      <Save />
    </form>
  );
}

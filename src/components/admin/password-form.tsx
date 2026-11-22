"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction, type PasswordState } from "@/lib/auth/actions";

const input = "h-10 w-full rounded-xl border border-line bg-white px-3 text-[13px] outline-none focus:border-brand-500";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center rounded-full bg-brand-600 px-5 text-[13px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Update password"}
    </button>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<PasswordState, FormData>(changePasswordAction, null);

  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Current password</span>
        <input name="current" type="password" autoComplete="current-password" className={input} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">New password</span>
        <input name="next" type="password" autoComplete="new-password" className={input} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] font-semibold text-ink-700">Repeat new password</span>
        <input name="confirm" type="password" autoComplete="new-password" className={input} />
      </label>

      {state?.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-600">{state.error}</p>
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

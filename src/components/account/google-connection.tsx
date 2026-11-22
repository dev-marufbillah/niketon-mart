"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { linkGoogleAction, unlinkGoogleAction, type GoogleLinkState } from "@/lib/auth/google-actions";

function Submit({ connected, disabled }: { connected: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="inline-flex h-10 items-center justify-center rounded-full bg-brand-600 px-5 text-[12px] font-bold text-white hover:bg-brand-700 disabled:opacity-50">
      {pending ? "Please wait…" : connected ? "Disconnect Google" : "Connect Google"}
    </button>
  );
}

export function GoogleConnection({ connected, hasPassword, staff, configured, notice, error }: {
  connected: boolean; hasPassword: boolean; staff: boolean; configured: boolean; notice?: string; error?: string;
}) {
  const [state, action] = useActionState<GoogleLinkState, FormData>(connected ? unlinkGoogleAction : linkGoogleAction, null);
  return (
    <section className="mt-3 rounded-2xl bg-white p-5 ring-1 ring-line">
      <h2 className="text-[14px] font-extrabold text-ink-900">Google sign-in</h2>
      {notice ? <p role="status" className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-[12px] font-semibold text-brand-700">{notice}</p> : null}
      {error ? <p role="alert" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600">{error}</p> : null}
      {staff ? (
        <p className="mt-2 text-[12px] text-ink-500">Staff access remains protected by your staff password; Google is for customer accounts only.</p>
      ) : connected && !hasPassword ? (
        <p className="mt-2 text-[12px] text-ink-500">Google is connected and is your only sign-in method. Contact the store before changing this method.</p>
      ) : hasPassword ? (
        <form action={action} className="mt-2 space-y-3">
          <p className="text-[12px] leading-relaxed text-ink-500">
            {connected ? "Google is connected. Enter your account password to disconnect it and sign out other sessions." : "Connect the Google account with the same email. For safety, confirm your current account password first."}
          </p>
          {!configured && !connected ? <p className="text-[12px] text-ink-500">Google sign-in is not configured yet.</p> : null}
          <label className="block max-w-sm text-[12px] font-semibold text-ink-700">
            Current password
            <input name="currentPassword" type="password" autoComplete="current-password" required className="mt-1 h-10 w-full rounded-xl border border-line bg-white px-3 text-[13px] outline-none focus:border-brand-500" />
          </label>
          {state?.error ? <p role="alert" className="text-[12px] font-semibold text-red-600">{state.error}</p> : null}
          {state?.success ? <p role="status" className="text-[12px] font-semibold text-brand-700">{state.success}</p> : null}
          <Submit connected={connected} disabled={!configured && !connected} />
        </form>
      ) : (
        <p className="mt-2 text-[12px] text-ink-500">This account has no password. Please contact the store for account help.</p>
      )}
    </section>
  );
}

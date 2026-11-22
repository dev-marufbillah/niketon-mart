"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  completeCustomerEmailVerificationAction, completeCustomerResetAction,
  requestCustomerEmailVerificationAction, requestCustomerResetAction, type CustomerLinkState,
} from "@/lib/auth/customer-link-actions";

const field = "mt-1 block h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] outline-none focus:border-brand-500";
function Submit({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending || disabled} className="rounded-full bg-brand-600 px-6 py-2.5 text-[13px] font-bold text-white hover:bg-brand-700 disabled:opacity-50">{pending ? "Working…" : label}</button>;
}
function Feedback({ state }: { state: CustomerLinkState }) {
  return <>{state?.error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-[12.5px] font-semibold text-red-700">{state.error}</p> : null}
    {state?.success ? <p role="status" className="rounded-xl bg-brand-50 p-3 text-[12.5px] font-semibold text-brand-700">{state.success}</p> : null}</>;
}

/** Link tokens are fragments, not requests or access logs. Read once and clear
 * browser history; no analytics, URL query or local storage receives a token. */
function useLinkToken() {
  const [link, setLink] = useState({ token: "", sequence: 0 });
  useEffect(() => {
    const read = () => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
      if (value) setLink((previous) => ({ token: value, sequence: previous.sequence + 1 }));
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };
    read();
    // Reopening a link while already on this page can be a same-document hash
    // navigation, which does not remount the component.
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return link;
}

export function CustomerResetRequestForm() {
  const [state, action] = useActionState(requestCustomerResetAction, null);
  return <form action={action} className="space-y-4">
    <label className="block text-[13px] font-semibold">Customer email<input className={field} name="email" type="email" required maxLength={254} autoComplete="email" /></label>
    <Feedback state={state} /><Submit label="Request reset link" />
  </form>;
}

export function CustomerResetForm() {
  const link = useLinkToken();
  return <ResetFormForToken key={link.sequence} token={link.token} />;
}
function ResetFormForToken({ token }: { token: string }) {
  const [state, action] = useActionState(completeCustomerResetAction, null);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="token" value={token} />
    {!state?.success ? <>
      <label className="block text-[13px] font-semibold">New password<input className={field} name="password" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /></label>
      <label className="block text-[13px] font-semibold">Confirm new password<input className={field} name="confirm" type="password" required minLength={8} maxLength={256} autoComplete="new-password" /></label>
      <p className="text-[12px] text-ink-500">Use 8–256 characters, including letters and numbers. Never share your password.</p>
      {!token ? <p className="text-[12px] text-ink-500">Open the full link from your email. If it expired, request a new one.</p> : null}
    </> : null}
    <Feedback state={state} />{!state?.success ? <Submit label="Reset password" disabled={!token} /> : <Link href="/my-account/login" className="text-[13px] font-bold text-brand-700 underline">Sign in</Link>}
  </form>;
}

export function CustomerVerifyEmailForm() {
  const link = useLinkToken();
  return <VerifyFormForToken key={link.sequence} token={link.token} />;
}
function VerifyFormForToken({ token }: { token: string }) {
  const [state, action] = useActionState(completeCustomerEmailVerificationAction, null);
  return <form action={action} className="space-y-4">
    <input type="hidden" name="token" value={token} />
    {!token && !state?.success ? <p className="text-[12px] text-ink-500">Open the full verification link from your email.</p> : null}
    <Feedback state={state} />{!state?.success ? <Submit label="Verify email" disabled={!token} /> : <Link href="/my-account/login" className="text-[13px] font-bold text-brand-700 underline">Continue to sign in</Link>}
  </form>;
}

export function CustomerEmailSecurityForm({ email, verified, configured, googleConnected }: { email: string; verified: boolean; configured: boolean; googleConnected: boolean }) {
  const [state, action] = useActionState(requestCustomerEmailVerificationAction, null);
  // React resets uncontrolled form fields after a server action even when the
  // action returns a validation error. Keep the requested address for retry.
  const [targetEmail, setTargetEmail] = useState(email);
  return <section id="verify-email" className="mt-3 rounded-2xl bg-white p-5 ring-1 ring-line">
    <h2 className="text-[15px] font-extrabold text-ink-900">Verify or change your sign-in email</h2>
    <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{verified ? "Your current email is verified." : "Your current email is not verified. Verify it while signed in to enable customer password recovery."} To change it, enter the new address and confirm your current password. Your login email changes only after you open the link sent to that address.</p>
    {googleConnected ? <p className="mt-2 text-[12px] text-ink-600">To change your sign-in email, first disconnect Google sign-in below. You may reconnect it afterwards when the Google and account emails match.</p> : null}
    {!configured ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-[12px] text-amber-900">Verification email is not configured yet. Please contact the store.</p> : null}
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-[12.5px] font-semibold">Email to verify<input className={field} name="email" type="email" required maxLength={254} value={targetEmail} onChange={(event) => setTargetEmail(event.target.value)} autoComplete="email" /></label>
      <label className="block text-[12.5px] font-semibold">Current password<input className={field} name="currentPassword" type="password" required maxLength={256} autoComplete="current-password" /></label>
      <Feedback state={state} /><Submit label="Send verification link" disabled={!configured} />
    </form>
  </section>;
}

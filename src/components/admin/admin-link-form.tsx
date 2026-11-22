"use client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeAdminLinkAction, requestAdminResetAction, type AdminLinkState } from "@/lib/auth/admin-link-actions";
const input = "mt-1 block h-11 w-full rounded-xl border border-line px-3 text-sm";
function Submit({ label }: { label: string }) { const { pending } = useFormStatus(); return <button disabled={pending} className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Working…" : label}</button>; }
function Feedback({ state }: { state: AdminLinkState }) { return <>{state?.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}{state?.success ? <p role="status" className="text-sm text-brand-700">{state.success} <Link className="underline" href="/admin/login">Admin sign in</Link></p> : null}</>; }
export function AdminSetupForm({ purpose }: { purpose: string }) {
  const [token] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "";
  });
  useEffect(() => {
    // Fragments are never sent in HTTP requests or access logs. Clear the URL
    // after reading it; re-open the emailed link if the page is refreshed.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);
  const [state, action] = useActionState(completeAdminLinkAction, null);
  return <form action={action} className="space-y-4"><input type="hidden" name="token" value={token} /><input type="hidden" name="purpose" value={purpose} />
    <label className="block text-sm font-semibold">New password<input className={input} type="password" name="password" required minLength={12} maxLength={256} autoComplete="new-password" /></label>
    <label className="block text-sm font-semibold">Confirm password<input className={input} type="password" name="confirm" required minLength={12} maxLength={256} autoComplete="new-password" /></label>
    <p className="text-xs text-ink-500">Use at least 12 characters. Never share your password.</p><Feedback state={state} />{!state?.success ? <Submit label="Set password" /> : null}
  </form>;
}
export function AdminResetRequestForm() {
  const [state, action] = useActionState(requestAdminResetAction, null);
  return <form action={action} className="space-y-4"><label className="block text-sm font-semibold">Admin email<input className={input} type="email" name="email" required autoComplete="email" /></label><Feedback state={state} /><Submit label="Request reset link" /></form>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { loginCustomerAction, registerCustomerAction, type AuthState } from "@/lib/actions/account";

/**
 * Sign in / create account.
 * One form with two modes (the fields differ, the styling and the server rules
 * do not). Errors come back from the server; the password reveal button is the
 * only client-side state that matters.
 */

const field =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-700";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center rounded-full bg-brand-600 px-6 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}

function PasswordInput({
  name,
  placeholder,
  autoComplete,
}: {
  name: string;
  placeholder: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        name={name}
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`${field} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-lg text-ink-400 hover:text-ink-700"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export function AuthForm({ mode, next, googleEnabled, googleError }: {
  mode: "login" | "register"; next: string; googleEnabled: boolean; googleError?: string;
}) {
  const [state, action] = useActionState<AuthState, FormData>(
    mode === "login" ? loginCustomerAction : registerCustomerAction,
    null,
  );
  const values = state?.values ?? {};

  return (
    <form action={action} className="space-y-3.5" noValidate>
      <input type="hidden" name="next" value={next} />

      <div className="space-y-2 text-center">
        {googleEnabled ? (
          <a href={`/api/auth/google/start?next=${encodeURIComponent(next)}`} className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            <Image src="/brand/google-sign-in.png" alt="Sign in with Google" width={180} height={40} priority />
          </a>
        ) : (
          <div aria-disabled="true" className="inline-flex opacity-60">
            <Image src="/brand/google-sign-in.png" alt="Sign in with Google" width={180} height={40} priority />
          </div>
        )}
        {!googleEnabled ? <p className="text-[11.5px] text-ink-500">Google sign-in is not configured yet.</p> : null}
        <p className="text-[11px] leading-relaxed text-ink-500">
          Google is for customer accounts. Staff sign in with their staff password.
          {mode === "register" ? <> By continuing, you agree to our <Link href="/terms" className="font-semibold text-brand-700">terms</Link> and <Link href="/privacy" className="font-semibold text-brand-700">privacy policy</Link>.</> : null}
        </p>
        {googleError ? <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-left text-[12px] font-semibold text-red-600">{googleError}</p> : null}
        <div className="flex items-center gap-3 py-1 text-[11px] text-ink-400"><span className="h-px flex-1 bg-line" />or continue with email<span className="h-px flex-1 bg-line" /></div>
      </div>

      {mode === "register" ? (
        <div className="grid gap-3.5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>
              First Name <span className="text-red-500">*</span>
            </span>
            <input name="firstName" required defaultValue={values.firstName} placeholder="Ex. John" className={field} />
          </label>
          <label className="block">
            <span className={labelClass}>
              Last Name <span className="text-red-500">*</span>
            </span>
            <input name="lastName" required defaultValue={values.lastName} placeholder="Ex. Doe" className={field} />
          </label>
        </div>
      ) : null}

      <label className="block">
        <span className={labelClass}>
          Email <span className="text-red-500">*</span>
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={values.email}
          placeholder="example@gmail.com"
          className={field}
        />
      </label>

      {mode === "register" ? (
        <label className="block">
          <span className={labelClass}>
            Phone <span className="text-red-500">*</span>
          </span>
          <input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            defaultValue={values.phone}
            placeholder="Enter Phone Number"
            className={field}
          />
        </label>
      ) : null}

      <label className="block">
        <span className={labelClass}>
          Password <span className="text-red-500">*</span>
        </span>
        <PasswordInput
          name="password"
          placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
        />
      </label>

      {mode === "register" ? (
        <label className="block">
          <span className={labelClass}>
            Confirm Password <span className="text-red-500">*</span>
          </span>
          <PasswordInput name="confirmPassword" placeholder="Repeat the password" autoComplete="new-password" />
        </label>
      ) : null}

      {mode === "register" ? (
        <label className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-500">
          <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 rounded border-line" />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-semibold text-brand-700">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-brand-700">
              privacy policy
            </Link>
            .
          </span>
        </label>
      ) : null}

      {state?.error ? (
        <p role="alert" className="flex items-start gap-1.5 rounded-xl bg-red-50 px-3.5 py-2.5 text-[12px] font-semibold text-red-600">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {state.error}
        </p>
      ) : null}

      <Submit label={mode === "login" ? "Sign In" : "Create Account"} />

      {mode === "login" && (
        <p className="text-center text-[11.5px] text-ink-500">
          Customers: <Link href="/my-account/forgot-password" className="font-semibold text-brand-700 hover:underline">forgot password?</Link> {" "}
          Staff: <Link href="/admin/forgot-password" className="font-semibold text-brand-700 hover:underline">reset password</Link>.
        </p>
      )}
      <p className="text-center text-[12px] text-ink-500">
        {mode === "login" ? (
          <>
            New to the store?{" "}
            <Link href={`/my-account/register?next=${encodeURIComponent(next)}`} className="font-bold text-brand-700">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/my-account/login?next=${encodeURIComponent(next)}`} className="font-bold text-brand-700">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

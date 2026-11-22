"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { changePasswordAction, type FormState } from "@/lib/actions/account";
import { cn } from "@/lib/utils/cn";

/**
 * Password manager.
 *
 * The strength meter is feedback, not the rulebook: the server enforces its own
 * requirements (length, letters + digits, must differ from the current one) and
 * its messages are what the shopper sees. Fields are cleared only after the
 * server confirms the change.
 */

const field =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 pr-11 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-700";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center rounded-full bg-brand-600 px-7 text-[13px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Updating…" : "Update Password"}
    </button>
  );
}

function SecretField({
  name,
  label,
  autoComplete,
  value,
  onChange,
}: {
  name: string;
  label: string;
  autoComplete: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className={labelClass}>
        {label} <span className="text-red-500">*</span>
      </span>
      <span className="relative block">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          className={field}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-lg text-ink-400 hover:text-ink-700"
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </span>
    </label>
  );
}

function strengthOf(password: string): { score: number; label: string; tone: string } {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const capped = Math.min(4, score);
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const tones = ["bg-red-400", "bg-red-400", "bg-accent-500", "bg-brand-500", "bg-brand-600"];
  return { score: capped, label: labels[capped], tone: tones[capped] };
}

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePasswordAction, null);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const strength = useMemo(() => strengthOf(newPassword), [newPassword]);

  const mismatch = confirm.length > 0 && confirm !== newPassword;
  const saved = Boolean(state?.success);

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await action(formData);
        setNewPassword("");
        setConfirm("");
      }}
      className="max-w-md space-y-4"
      noValidate
    >
      <SecretField name="currentPassword" label="Current password" autoComplete="current-password" />

      <div>
        <SecretField
          name="newPassword"
          label="New password"
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
        />
        <div className="mt-2 flex items-center gap-2">
          <span className="flex flex-1 gap-1" aria-hidden="true">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  newPassword.length === 0
                    ? "bg-line"
                    : index < strength.score
                      ? strength.tone
                      : "bg-line",
                )}
              />
            ))}
          </span>
          <span className="w-16 text-right text-[11px] font-semibold text-ink-500">
            {newPassword.length === 0 ? "" : strength.label}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-ink-400">At least 8 characters, mixing letters and numbers.</p>
      </div>

      <div>
        <SecretField
          name="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
        />
        {mismatch ? <p className="mt-1 text-[11px] font-semibold text-red-500">The two passwords do not match.</p> : null}
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
      {saved ? (
        <p role="status" className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12px] font-semibold text-brand-700">
          <CheckCircle2 size={13} /> {state?.success}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}

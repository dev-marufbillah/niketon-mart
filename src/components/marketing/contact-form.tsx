"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { contactAction, type ContactState } from "@/lib/actions/contact";

/**
 * Contact form — First name, Last name, Email, Phone, Subject, Message, exactly
 * like the reference. Validation runs on the server (the browser hints are a
 * courtesy only) and the result is announced politely.
 */

const field =
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-700";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center justify-center rounded-full bg-brand-600 px-8 text-[13.5px] font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send a Message"}
    </button>
  );
}

export function ContactForm({ note }: { note?: string }) {
  const [state, action] = useActionState<ContactState, FormData>(contactAction, null);
  // Captured once, on the client, after mount — reading a clock during render is
  // impure, and the value only matters as "roughly when this form appeared".
  const [startedAt] = useState(() => Date.now());
  const values = state?.values ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="startedAt" value={startedAt} />
      {/* Honeypot: hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>
            First Name <span className="text-red-500">*</span>
          </span>
          <input
            name="firstName"
            required
            autoComplete="given-name"
            placeholder="Ex. John"
            defaultValue={values.firstName}
            className={field}
          />
        </label>
        <label className="block">
          <span className={labelClass}>
            Last Name <span className="text-red-500">*</span>
          </span>
          <input
            name="lastName"
            required
            autoComplete="family-name"
            placeholder="Ex. Doe"
            defaultValue={values.lastName}
            className={field}
          />
        </label>
        <label className="block">
          <span className={labelClass}>
            Email <span className="text-red-500">*</span>
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="example@gmail.com"
            defaultValue={values.email}
            className={field}
          />
        </label>
        <label className="block">
          <span className={labelClass}>
            Phone <span className="text-red-500">*</span>
          </span>
          <input
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="Enter Phone Number"
            defaultValue={values.phone}
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>
          Subject <span className="text-red-500">*</span>
        </span>
        <input
          name="subject"
          required
          placeholder="Enter here.."
          defaultValue={values.subject}
          className={field}
        />
      </label>

      <label className="block">
        <span className={labelClass}>
          Your Message <span className="text-red-500">*</span>
        </span>
        <textarea
          name="message"
          required
          rows={6}
          placeholder="Enter here.."
          defaultValue={values.message}
          className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500"
        />
      </label>

      {state?.errors?.length ? (
        <ul
          role="alert"
          className="space-y-1 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-semibold text-red-600"
        >
          {state.errors.map((error) => (
            <li key={error} className="flex items-start gap-1.5">
              <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
            </li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p
          role="status"
          className="flex items-start gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700"
        >
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {state.success}
        </p>
      ) : null}

      <p className="text-[11.5px] leading-relaxed text-ink-400">
        {note || "Fields marked * are required. We use your details only to answer this message."}
      </p>

      <Submit />
    </form>
  );
}

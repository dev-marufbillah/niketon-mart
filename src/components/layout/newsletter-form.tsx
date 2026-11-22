"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { subscribeAction, type SubscribeState } from "@/lib/actions/newsletter";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" size="lg" disabled={pending} className="shrink-0 px-10">
      {pending ? (
        "Subscribing…"
      ) : (
        <span className="inline-flex items-center gap-2">
          <Check size={16} /> {label}
        </span>
      )}
    </Button>
  );
}

export function NewsletterForm({ buttonLabel = "Subscribe" }: { buttonLabel?: string }) {
  const [state, action] = useActionState<SubscribeState, FormData>(subscribeAction, null);

  return (
    <>
      <form
        action={action}
        className="mx-auto mt-7 flex w-full max-w-[520px] flex-col gap-2.5 sm:flex-row"
        noValidate
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          placeholder="Enter Email Address"
          aria-invalid={Boolean(state?.error)}
          className={cn(
            "h-[52px] w-full rounded-full border bg-white px-6 text-sm text-ink-800 shadow-sm outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500",
            state?.error ? "border-red-400" : "border-transparent",
          )}
        />
        <SubmitButton label={buttonLabel} />
      </form>

      <div aria-live="polite" className="mt-2 min-h-[18px] text-xs">
        {state?.error ? <p className="text-red-500">{state.error}</p> : null}
        {state?.success ? <p className="font-semibold text-brand-600">{state.success}</p> : null}
      </div>
    </>
  );
}

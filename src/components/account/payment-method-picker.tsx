"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Banknote, CheckCircle2, CreditCard, Lock, Smartphone, Wallet } from "lucide-react";
import { setDefaultPaymentAction, type FormState } from "@/lib/actions/account";
import { cn } from "@/lib/utils/cn";

/**
 * Payment methods.
 *
 * This page is deliberately honest about what the store can and cannot store:
 *
 *  - It lists the payment methods the store has *enabled* right now (the same
 *    records the admin edits and the checkout renders), each with a plain
 *    explanation of how the money is collected.
 *  - The customer can mark one as their preferred method; checkout preselects it.
 *    That preference is the only thing saved here.
 *  - Card numbers, CVV, wallet PINs and OTPs are never collected or stored —
 *    there is no tokenising provider connected, so pretending to save a card
 *    would be a lie. The notice below says exactly that.
 */

function Save() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center rounded-full bg-brand-600 px-5 text-[12.5px] font-bold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save preference"}
    </button>
  );
}

const icons = {
  cod: Banknote,
  card: CreditCard,
  wallet: Smartphone,
  gateway: Lock,
} as const;

export function PaymentMethodPicker({
  methods,
  current,
}: {
  methods: { id: string; label: string; description: string; type: "cod" | "card" | "wallet" | "gateway"; instructions: string }[];
  current: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(setDefaultPaymentAction, null);

  if (methods.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-10 text-center">
        <Wallet size={24} className="mx-auto text-ink-300" />
        <p className="mt-2 text-[14px] font-extrabold text-ink-900">No payment method is available right now</p>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
          The store has not enabled any payment method. Contact us and we will take your order another way.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <ul className="space-y-2.5">
        {methods.map((method) => {
          const Icon = icons[method.type] ?? CreditCard;
          const selected = method.id === current;
          return (
            <li key={method.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1 transition-colors",
                  selected ? "ring-2 ring-brand-500" : "ring-line hover:ring-brand-200",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethodId"
                  value={method.id}
                  defaultChecked={selected}
                  className="mt-1 size-4 accent-brand-600"
                />
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brand-700">
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-[13px] font-extrabold text-ink-900">
                    {method.label}
                    {selected ? (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                        Preferred
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-500">{method.description}</span>
                  {method.instructions ? (
                    <span className="mt-1 block whitespace-pre-line text-[11.5px] leading-relaxed text-ink-400">
                      {method.instructions}
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

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
        <p role="status" className="flex items-center gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12px] font-semibold text-brand-700">
          <CheckCircle2 size={13} /> {state.success}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Save />
        <p className="text-[11.5px] text-ink-400">Your choice is preselected at checkout. You can always change it there.</p>
      </div>
    </form>
  );
}

"use client";

import { Check, Info, X } from "lucide-react";
import { useStore } from "@/lib/store/store-provider";

export function Toaster() {
  const { toasts, dismissToast } = useStore();

  return (
    <div
      data-toaster=""
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed bottom-5 left-1/2 z-[90] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-6 sm:translate-x-0"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-2xl bg-white p-3.5 shadow-menu ring-1 ring-ink-900/5"
        >
          <span
            className={
              toast.tone === "success"
                ? "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"
                : "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-500"
            }
          >
            {toast.tone === "success" ? <Check size={16} strokeWidth={2.4} /> : <Info size={16} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink-900">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 truncate text-[12px] text-ink-500">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="rounded-full p-1 text-ink-300 hover:text-ink-600"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

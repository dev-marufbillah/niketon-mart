"use client";

import { useRef, useState, useTransition } from "react";

/**
 * Small accessible confirmation dialog used by every destructive admin action.
 * The copy explains what will happen rather than saying "Are you sure?".
 */
export function ConfirmDialog({
  action,
  title,
  description,
  confirmLabel = "Delete",
  triggerLabel,
  tone = "danger",
  triggerClassName,
}: {
  action: () => Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerLabel: string;
  tone?: "danger" | "primary";
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={
          triggerClassName ??
          "rounded-lg px-2 py-1 text-[11.5px] font-semibold text-red-600 transition-colors hover:bg-red-50"
        }
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        className="w-[calc(100%-2rem)] max-w-[420px] rounded-2xl p-0 backdrop:bg-ink-900/40"
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
      >
        <div className="p-5">
          <h2 className="text-[16px] font-extrabold text-ink-900">{title}</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-500">{description}</p>
          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="h-9 rounded-full px-4 text-[12.5px] font-semibold text-ink-600 hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    setError(null);
                    await action();
                    dialogRef.current?.close();
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Something went wrong.");
                  }
                })
              }
              className={
                tone === "danger"
                  ? "h-9 rounded-full bg-red-600 px-4 text-[12.5px] font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  : "h-9 rounded-full bg-brand-600 px-4 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              }
            >
              {pending ? "Working…" : confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  deleteResourceAction,
  duplicateResourceAction,
  moveResourceAction,
  toggleResourceFieldAction,
} from "@/lib/admin/resource-actions";

/** Inline switches and row controls for the resource table. */
export function VisibilityToggle({
  resourceKey,
  id,
  field,
  value,
  label,
}: {
  resourceKey: string;
  id: string;
  field: string;
  value: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleResourceFieldAction(resourceKey, id, field, !value);
          router.refresh();
        })
      }
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        value ? "bg-brand-600" : "bg-ink-300/60"
      } ${pending ? "opacity-60" : ""}`}
    >
      <span
        className={`inline-block size-3.5 transform rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

export function OrderControls({
  resourceKey,
  id,
  canMoveUp,
  canMoveDown,
  name,
}: {
  resourceKey: string;
  id: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const move = (direction: -1 | 1) =>
    startTransition(async () => {
      await moveResourceAction(resourceKey, id, direction);
      router.refresh();
    });

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-label={`Move ${name} up`}
        disabled={!canMoveUp || pending}
        onClick={() => move(-1)}
        className="rounded-md px-1.5 py-1 text-[12px] text-ink-400 hover:bg-surface hover:text-ink-800 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${name} down`}
        disabled={!canMoveDown || pending}
        onClick={() => move(1)}
        className="rounded-md px-1.5 py-1 text-[12px] text-ink-400 hover:bg-surface hover:text-ink-800 disabled:opacity-30"
      >
        ↓
      </button>
    </span>
  );
}

export function RowMenu({
  resourceKey,
  id,
  name,
  canDuplicate,
  canDelete,
}: {
  resourceKey: string;
  id: string;
  name: string;
  canDuplicate: boolean;
  canDelete: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <span className="inline-flex items-center gap-1">
      {canDuplicate ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await duplicateResourceAction(resourceKey, id);
              router.refresh();
            })
          }
          className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-ink-500 hover:bg-surface hover:text-ink-800 disabled:opacity-50"
        >
          Duplicate
        </button>
      ) : null}
      {canDelete ? (
        <ConfirmDialog
          action={deleteResourceAction.bind(null, resourceKey, id)}
          title={`Delete “${name}”?`}
          description="It will disappear from the website immediately. This cannot be undone."
          triggerLabel="Delete"
        />
      ) : null}
    </span>
  );
}

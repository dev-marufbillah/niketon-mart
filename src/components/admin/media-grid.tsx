"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { deleteMediaAction, updateMediaAction, type MediaFormState } from "@/lib/admin/media-actions";
import type { MediaRow } from "@/lib/repositories/media";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 px-2.5 py-1 text-[11.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

function MediaCard({ item }: { item: MediaRow }) {
  const [state, action] = useActionState<MediaFormState, FormData>(
    updateMediaAction.bind(null, item.id),
    null,
  );
  const [copied, setCopied] = useState(false);

  return (
    <li className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
      <div className="relative aspect-[4/3] bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={item.alt} className="size-full object-cover" />
      </div>
      <div className="p-3">
        <form action={action} className="space-y-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink-500">Alt text (describe the image)</span>
            <input
              name="alt"
              defaultValue={item.alt}
              placeholder="Fresh green apples in a wooden crate"
              className="h-8 w-full rounded-lg border border-line px-2 text-[12px] outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-ink-500">Folder</span>
            <input
              name="folder"
              defaultValue={item.folder}
              className="h-8 w-full rounded-lg border border-line px-2 text-[12px] outline-none focus:border-brand-500"
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <SaveButton />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(item.url);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                } catch {
                  setCopied(false);
                }
              }}
              className="rounded-lg bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-600"
            >
              {copied ? "Copied" : "Copy URL"}
            </button>
          </div>
          {state?.errors?.length ? (
            <p role="alert" className="text-[11.5px] text-red-600">{state.errors[0]}</p>
          ) : null}
          {state?.success ? (
            <p role="status" className="text-[11.5px] font-semibold text-brand-700">{state.success}</p>
          ) : null}
        </form>

        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <span className="text-[10.5px] text-ink-400">
            {(item.size / 1024).toFixed(0)} KB · {item.mime.split("/")[1]}
          </span>
          <ConfirmDialog
            action={deleteMediaAction.bind(null, item.id)}
            title="Delete this image?"
            description="Files still used on the website are protected — you will be told where they are used so you can replace them first."
            triggerLabel="Delete"
          />
        </div>
      </div>
    </li>
  );
}

export function MediaUploader({ folders }: { folders: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
      <h2 className="text-[14px] font-extrabold text-ink-900">Upload images</h2>
      <p className="mt-1 text-[11.5px] leading-relaxed text-ink-400">
        JPG, PNG, WebP, GIF or SVG up to 5 MB. Uploads appear in the library and are available in every image
        field.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const file = data.get("file");
          if (!(file instanceof File) || file.size === 0) {
            setError("Choose a file first.");
            return;
          }
          setError(null);
          startTransition(async () => {
            try {
              const response = await fetch("/api/admin/media/upload", { method: "POST", body: data });
              const json = await response.json();
              if (!response.ok) throw new Error(json.error ?? "Upload failed.");
              form.reset();
              router.refresh();
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Upload failed.");
            }
          });
        }}
      >
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink-500">Image file</span>
          <input
            type="file"
            name="file"
            accept="image/*"
            aria-label="Image file"
            className="block w-full max-w-[220px] text-[11.5px] text-ink-600 file:mr-2 file:rounded-lg file:border-0 file:bg-brand-50 file:px-2.5 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-brand-700"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-ink-500">Folder</span>
          <input
            name="folder"
            list="media-folders"
            defaultValue="general"
            className="h-8 w-[130px] rounded-lg border border-line px-2 text-[12px]"
          />
          <datalist id="media-folders">
            {folders.map((folder) => (
              <option key={folder} value={folder} />
            ))}
          </datalist>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-full bg-brand-600 px-3.5 text-[12px] font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-[11.5px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

export function MediaList({ items }: { items: MediaRow[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <p className="text-[15px] font-bold text-ink-800">The library is empty</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
          Upload product photos, banners and lifestyle images here, then pick them in any image field.
        </p>
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} />
      ))}
    </ul>
  );
}

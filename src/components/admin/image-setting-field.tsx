"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type LibraryImage = { id: string; url: string; alt: string };

/**
 * Image picker for the purpose-built admin forms (settings-style screens that
 * are not driven by the generic resource field renderer).
 *
 * Same contract as the `image` field in `field-input.tsx`: paste a path, upload
 * a file to the media library, or pick an existing library image. Uploads go
 * through `/api/admin/media/upload`, which is permission-checked server-side.
 */
export function ImageSettingField({
  label,
  name,
  defaultValue,
  library,
  help,
  folder = "general",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  library: LibraryImage[];
  help?: string;
  folder?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("folder", folder);
      const response = await fetch("/api/admin/media/upload", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Upload failed.");
      setValue(data.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">{label}</span>
      <div className="rounded-xl border border-line bg-white p-2.5">
        <div className="flex items-start gap-3">
          <div className="relative h-[74px] w-[110px] shrink-0 overflow-hidden rounded-lg bg-surface">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-ink-300">
                <ImagePlus size={18} />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                name={name}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="/images/example.jpg or https://…"
                className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12px] text-ink-900 outline-none focus:border-brand-500"
              />
              {value ? (
                <button
                  type="button"
                  onClick={() => setValue("")}
                  aria-label={`Remove ${label}`}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-surface hover:text-ink-700"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-[11.5px] font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-60"
              >
                {uploading ? <Loader2 size={11} className="animate-spin" /> : null}
                {uploading ? "Uploading…" : "Upload"}
              </button>
              {library.length > 0 ? (
                <select
                  aria-label={`Choose ${label} from the media library`}
                  value=""
                  onChange={(event) => {
                    if (event.target.value) setValue(event.target.value);
                  }}
                  className="max-w-[160px] rounded-lg border border-line bg-white px-2 py-1 text-[11.5px] text-ink-600"
                >
                  <option value="">Library…</option>
                  {library.map((item) => (
                    <option key={item.id} value={item.url}>
                      {item.alt || item.url.split("/").pop()}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      {error ? <p className="mt-1 text-[11.5px] font-medium text-red-600">{error}</p> : null}
      {help ? <p className={cn("mt-1 text-[11.5px] leading-relaxed text-ink-400")}>{help}</p> : null}
    </div>
  );
}

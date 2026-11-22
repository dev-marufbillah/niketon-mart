"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, TriangleAlert, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Pick images straight from the admin's computer.
 *
 * Posts to `/api/admin/media/upload` (permission-checked server-side), shows a
 * real progress bar for each file and returns the stored URLs. Drag & drop and
 * the file picker do the same thing, and every failure is shown in words the
 * shop owner can act on.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function ImageUploader({
  folder = "products",
  onUploaded,
  label = "Upload from your computer",
  hint = "JPG, PNG or WebP · up to 5 MB each · you can select several",
  multiple = true,
  compact = false,
  disabled = false,
  onBusyChange,
}: {
  folder?: string;
  onUploaded: (urls: string[]) => void;
  label?: string;
  hint?: string;
  multiple?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    // Permit choosing the same file again after validation or network failure.
    if (inputRef.current) inputRef.current.value = "";
    if (uploadingRef.current || disabled || list.length === 0) return;
    setError(null);

    for (const file of list) {
      if (!ACCEPTED.includes(file.type)) {
        setError(`“${file.name}” is not a JPG, PNG or WebP image.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`“${file.name}” is larger than 5 MB. Resize it and try again.`);
        return;
      }
    }

    uploadingRef.current = true;
    setBusy(true);
    onBusyChange?.(true);
    const uploaded: string[] = [];
    const chosen = multiple ? list : list.slice(0, 1);
    let completed = false;

    try {
      for (let index = 0; index < chosen.length; index += 1) {
        const file = chosen[index];
        setProgress(Math.round((index / chosen.length) * 100));
        const body = new FormData();
        body.append("file", file);
        body.append("folder", folder);

        const url = await new Promise<string>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", "/api/admin/media/upload");
          request.timeout = 120_000;
          request.upload.onprogress = (event) => {
            if (event.lengthComputable) setProgress(Math.round(((index + event.loaded / event.total) / chosen.length) * 100));
          };
          request.onerror = () => reject(new Error("Check your connection and try again."));
          request.onabort = () => reject(new Error("The upload was interrupted. Try again."));
          request.ontimeout = () => reject(new Error("The upload timed out. Check your connection and try again."));
          request.onload = () => {
            let json: { url?: string; error?: string } = {};
            try { json = JSON.parse(request.responseText); } catch { /* use generic message */ }
            if (request.status >= 200 && request.status < 300 && json.url) resolve(json.url);
            else reject(new Error(json.error ?? "The upload failed. Try again."));
          };
          request.send(body);
        });
        uploaded.push(url);
      }
      completed = true;
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The upload could not be completed — try again.");
      setProgress(0);
    } finally {
      try {
        // Keep any files that completed before a later file failed.
        if (uploaded.length) onUploaded(uploaded);
      } catch {
        completed = false;
        setProgress(0);
        setError("The uploaded image could not be applied. Try again.");
      } finally {
        uploadingRef.current = false;
        setBusy(false);
        onBusyChange?.(false);
      }
    }
    if (completed) window.setTimeout(() => setProgress(0), 1200);
  };

  return (
    <div className="space-y-1.5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled && event.dataTransfer?.files?.length) void uploadFiles(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed p-3 text-center transition-colors",
          dragging ? "border-brand-500 bg-brand-50" : "border-line bg-surface",
          compact && "p-2.5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={multiple}
          disabled={busy || disabled}
          className="sr-only"
          id={inputId}
          onChange={(event) => {
            if (event.target.files?.length) void uploadFiles(event.target.files);
          }}
        />
        <label
          htmlFor={inputId}
          aria-disabled={busy || disabled}
          className={cn("inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-[12px] font-semibold text-white", busy || disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-brand-700")}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {busy ? `Uploading ${progress}%` : label}
        </label>
        <p className="mt-1.5 flex items-center justify-center gap-1 text-[10.5px] text-ink-400">
          <UploadCloud size={11} /> or drop {multiple ? "images" : "an image"} here · {hint}
        </p>
        {busy ? (
          <div className="mx-auto mt-2 h-1 w-2/3 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-1 text-[11.5px] text-red-600">
          <TriangleAlert size={12} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}

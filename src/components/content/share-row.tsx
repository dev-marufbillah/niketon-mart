"use client";

import { useState } from "react";
import { Check, Copy, Facebook, Linkedin, Mail } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Share row for an article.
 * Links open the real share endpoints in a new tab (post URL resolved against the
 * current origin, so it works on localhost and in production). "Copy link" writes
 * to the clipboard and confirms; if the browser refuses, the URL is shown instead
 * of pretending the copy worked.
 */
export function ShareRow({ url, title, className }: { url: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const absolute = () => (typeof window === "undefined" ? url : new URL(url, window.location.origin).toString());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(absolute());
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
    }
  };

  const encoded = typeof window === "undefined" ? "" : encodeURIComponent(absolute());
  const target = "_blank";
  const rel = "noreferrer noopener";

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2 text-[11.5px]", className)}>
      <span className="font-semibold uppercase tracking-[0.1em] text-ink-400">Share</span>
      <a
        href={encoded ? `https://www.facebook.com/sharer/sharer.php?u=${encoded}` : "#"}
        target={target}
        rel={rel}
        aria-label="Share on Facebook"
        className="inline-flex size-8 items-center justify-center rounded-full bg-white text-ink-600 ring-1 ring-line hover:text-brand-700"
      >
        <Facebook size={14} />
      </a>
      <a
        href={encoded ? `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}` : "#"}
        target={target}
        rel={rel}
        aria-label="Share on LinkedIn"
        className="inline-flex size-8 items-center justify-center rounded-full bg-white text-ink-600 ring-1 ring-line hover:text-brand-700"
      >
        <Linkedin size={14} />
      </a>
      <a
        href={`mailto:?subject=${encodeURIComponent(title)}`}
        aria-label="Share by email"
        className="inline-flex size-8 items-center justify-center rounded-full bg-white text-ink-600 ring-1 ring-line hover:text-brand-700"
      >
        <Mail size={14} />
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700"
      >
        {copied ? <Check size={12} className="text-brand-600" /> : <Copy size={12} />}
        {copied ? "Copied" : "Copy link"}
      </button>
      {failed ? <span className="text-[10.5px] text-red-500">Copy blocked — select the URL instead.</span> : null}
    </div>
  );
}

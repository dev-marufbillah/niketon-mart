"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

/** Display a bookmarkable link only to a browser that already holds the key. */
export function OrderPrivateLink({ number, accessKey }: { number: string; accessKey: string }) {
  const [message, setMessage] = useState("");
  const href = `/order/${encodeURIComponent(number)}#token=${encodeURIComponent(accessKey)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(new URL(href, window.location.origin).href); setMessage("Private link copied."); }
    catch { setMessage("Copy the private link using your browser’s link menu."); }
  };
  return <div className="mt-3 rounded-xl bg-white p-3 text-left ring-1 ring-line">
    <p className="text-[12px] font-semibold text-ink-800">Save your private tracking link</p>
    <p className="mt-1 text-[11.5px] text-ink-500">Anyone with this link can view the order. Keep it private; order emails are not configured.</p>
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] font-semibold text-brand-700">
      <a href={href} data-private-order-link className="underline underline-offset-2">Private tracking link</a>
      <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5"><Copy size={13} /> Copy link</button>
    </div>
    {message ? <p role="status" className="mt-1 text-[11px] text-ink-600">{message}</p> : null}
  </div>;
}

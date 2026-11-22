"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * "Back to previous page" for the 404 screen.
 * Browser history is the only honest implementation: a link to a fixed URL
 * would lie about where the visitor came from, so this stays a button.
 */
export function BackButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else router.push("/");
      }}
      className="inline-flex h-11 items-center gap-2 rounded-full border border-brand-600/25 bg-white px-6 text-sm font-semibold text-brand-700 transition-colors hover:border-brand-600 hover:bg-brand-50"
    >
      <ArrowLeft size={15} /> {label}
    </button>
  );
}

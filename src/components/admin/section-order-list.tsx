"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveSectionAction, toggleSectionAction } from "@/lib/admin/settings-actions";
import type { HomepageSection } from "@/lib/repositories/homepage";

/** Drag-free ordering: explicit up/down buttons work with keyboard and touch. */
export function SectionOrderList({ sections }: { sections: HomepageSection[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (task: () => Promise<void>) =>
    startTransition(async () => {
      await task();
      router.refresh();
    });

  return (
    <ol className={pending ? "opacity-70" : undefined}>
      {sections.map((section, index) => (
        <li key={section.key} className="flex items-center gap-2 border-b border-line py-2 last:border-0">
          <span className="w-5 text-[11px] font-bold tabular-nums text-ink-300">{index + 1}</span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[12.5px] font-semibold ${section.visible ? "text-ink-800" : "text-ink-400 line-through"}`}>
              {section.label}
            </span>
          </span>
          <button
            type="button"
            aria-label={`Move ${section.label} up`}
            disabled={index === 0 || pending}
            onClick={() => run(() => moveSectionAction(section.key, -1))}
            className="rounded-md px-1.5 py-1 text-[12px] text-ink-400 hover:bg-surface hover:text-ink-800 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move ${section.label} down`}
            disabled={index === sections.length - 1 || pending}
            onClick={() => run(() => moveSectionAction(section.key, 1))}
            className="rounded-md px-1.5 py-1 text-[12px] text-ink-400 hover:bg-surface hover:text-ink-800 disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={section.visible}
            aria-label={`Show ${section.label} on the homepage`}
            disabled={pending}
            onClick={() => run(() => toggleSectionAction(section.key, !section.visible))}
            className={`relative ml-1 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              section.visible ? "bg-brand-600" : "bg-ink-300/60"
            }`}
          >
            <span
              className={`inline-block size-3.5 transform rounded-full bg-white shadow transition-transform ${
                section.visible ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
        </li>
      ))}
    </ol>
  );
}

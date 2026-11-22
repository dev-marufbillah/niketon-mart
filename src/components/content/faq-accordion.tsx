"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type FaqItem = { id: string; question: string; answer: string; categoryId?: string };

/**
 * FAQ accordion — one panel open at a time, green filled header while open, plus /
 * minus affordance. Keyboard accessible (buttons, aria-expanded, aria-controls).
 * Search and category filtering happen on the server; this only owns the open panel.
 */
export function FaqAccordion({ items, defaultOpenId }: { items: FaqItem[]; defaultOpenId?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(defaultOpenId ?? items[0]?.id ?? null);
  const openId = selectedId && items.some((item) => item.id === selectedId)
    ? selectedId
    : items[0]?.id ?? null;

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const open = item.id === openId;
        return (
          <li
            key={item.id}
            className={cn(
              "overflow-hidden rounded-xl ring-1 transition-colors",
              open ? "bg-brand-600 text-white ring-brand-600" : "bg-white ring-line",
            )}
          >
            <h3>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={`faq-answer-${item.id}`}
                id={`faq-question-${item.id}`}
                onClick={() => setSelectedId(open ? null : item.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
              >
                <span
                  className={cn(
                    "text-[13.5px] font-bold leading-snug sm:text-[14px]",
                    open ? "text-white" : "text-ink-900",
                  )}
                >
                  {item.question}
                </span>
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-1",
                    open ? "bg-white/15 text-white ring-white/30" : "bg-white text-ink-400 ring-line",
                  )}
                >
                  {open ? <Minus size={13} strokeWidth={2.6} /> : <Plus size={13} strokeWidth={2.6} />}
                </span>
              </button>
            </h3>
            <div
              id={`faq-answer-${item.id}`}
              role="region"
              aria-labelledby={`faq-question-${item.id}`}
              hidden={!open}
              className="px-4 pb-4 sm:px-5"
            >
              <p className={cn("text-[12.5px] leading-relaxed", open ? "text-white/90" : "text-ink-500")}>
                {item.answer}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

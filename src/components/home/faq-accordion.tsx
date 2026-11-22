"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type FaqItem = { id: string; question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  if (items.length === 0) return null;

  return (
    <div className="mx-auto mt-8 max-w-[1000px] space-y-3">
      {items.map((faq) => {
        const isOpen = openId === faq.id;
        return (
          <div
            key={faq.id}
            className={cn(
              "overflow-hidden rounded-xl transition-colors duration-300",
              isOpen ? "bg-brand-600" : "bg-surface",
            )}
          >
            <h3>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${faq.id}`}
                className="flex w-full items-center justify-between gap-6 px-5 py-5 text-left sm:px-7"
              >
                <span
                  className={cn(
                    "text-[14.5px] font-bold leading-snug sm:text-[16px]",
                    isOpen ? "text-white" : "text-ink-800",
                  )}
                >
                  {faq.question}
                </span>
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
                    isOpen ? "text-accent-500" : "text-ink-500",
                  )}
                >
                  {isOpen ? <Minus size={18} strokeWidth={2.4} /> : <Plus size={18} strokeWidth={2.4} />}
                </span>
              </button>
            </h3>
            <div
              id={`faq-panel-${faq.id}`}
              role="region"
              className={cn(
                "grid transition-all duration-300 ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-[13.5px] leading-relaxed text-white/80 sm:px-7 sm:pb-6 sm:text-sm">
                  {faq.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

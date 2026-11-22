import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

/** Shared, consistently spaced heading for existing admin screens. */
export function AdminPageHeader({
  title,
  description,
  action,
  backHref,
  meta,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  backHref?: { href: string; label: string };
  meta?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#e3ebe5] pb-5">
      <div className="min-w-0 max-w-4xl">
        {backHref ? (
          <Link href={backHref.href} className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#557465] hover:text-brand-700">
            <ArrowLeft size={14} aria-hidden="true" /> {backHref.label}
          </Link>
        ) : null}
        <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#4d7a5d]">Admin workspace</p>
        <h1 className="text-[24px] font-extrabold leading-tight tracking-[-0.035em] text-[#173b2b] sm:text-[29px]">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[#607268] sm:text-[13.5px]">{description}</p> : null}
        {meta ? <p className="mt-2.5 text-[11.5px] font-semibold leading-relaxed text-[#6b8174]">{meta}</p> : null}
      </div>
      {action ? (
        <Link href={action.href} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-[#1b8057] px-4 text-[12.5px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(21,103,67,0.7)] transition-colors hover:bg-[#166b49]">
          <Plus size={16} aria-hidden="true" /> {action.label}
        </Link>
      ) : null}
    </div>
  );
}

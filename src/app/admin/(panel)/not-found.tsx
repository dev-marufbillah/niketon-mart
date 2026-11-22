import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

/**
 * Admin 404.
 * Kept inside the admin panel (no shop header/footer) so a mistyped admin URL
 * does not dump a staff member on the storefront.
 */
export default function AdminNotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-2xl bg-white px-6 py-14 text-center ring-1 ring-line">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-accent-50 text-accent-700">
        <SearchX size={24} />
      </span>
      <h1 className="text-[20px] font-extrabold text-ink-900">This admin page doesn’t exist</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
        The link may be out of date, or the record it pointed at was deleted. Nothing was changed.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-brand-600 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700"
      >
        <ArrowLeft size={15} /> Back to the dashboard
      </Link>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

/**
 * Status pills + order search. Everything is a URL parameter, so a filtered
 * view can be bookmarked, refreshed or shared without losing state.
 */
export function AccountOrderFilters({
  status,
  q,
  counts,
  total,
}: {
  status: string;
  q: string;
  counts: { value: string; label: string; count: number }[];
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const build = (next: { status?: string; q?: string }) => {
    const search = new URLSearchParams(params.toString());
    const nextStatus = next.status ?? status;
    const nextQuery = next.q ?? q;
    if (nextStatus) search.set("status", nextStatus);
    else search.delete("status");
    if (nextQuery) search.set("q", nextQuery);
    else search.delete("q");
    search.delete("page");
    const text = search.toString();
    return text ? `/my-account/orders?${text}` : "/my-account/orders";
  };

  return (
    <div className="mb-4 rounded-2xl bg-white p-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-ink-700">
          {total} order{total === 1 ? "" : "s"} on this account
        </p>
        <form
          action="/my-account/orders"
          method="get"
          role="search"
          className="relative w-full sm:w-64"
          onSubmit={(event) => {
            event.preventDefault();
            const value = String(new FormData(event.currentTarget).get("q") ?? "");
            router.push(build({ q: value }));
          }}
        >
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <label className="relative block">
            <span className="sr-only">Search your orders</span>
            <input
              name="q"
              defaultValue={q}
              placeholder="Order number or product"
              className="h-9 w-full rounded-full border border-line bg-white pl-9 pr-3 text-[12px] outline-none focus:border-brand-500"
            />
            <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          </label>
        </form>
      </div>

      <div className="scrollbar-none -mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1">
        <Link
          href={build({ status: "" })}
          aria-current={!status ? "page" : undefined}
          className={
            !status
              ? "inline-flex shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white"
              : "inline-flex shrink-0 rounded-full bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700"
          }
        >
          All
        </Link>
        {counts.map((entry) => {
          const active = status === entry.value;
          return (
            <Link
              key={entry.value}
              href={build({ status: entry.value })}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "inline-flex shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-[11.5px] font-bold text-white"
                  : "inline-flex shrink-0 rounded-full bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700"
              }
            >
              {entry.label}
              <span className="ml-1 opacity-70">{entry.count}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

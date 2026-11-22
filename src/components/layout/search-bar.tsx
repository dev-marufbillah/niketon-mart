"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { catalogueDisplayPrice } from "@/lib/catalogue/display-price";
import { useStore } from "@/lib/store/store-provider";
import { useCatalogue } from "@/lib/catalogue/catalogue-provider";
import { needsPurchaseChoices } from "@/lib/catalogue/purchase";

export function SearchBar({ className, onNavigate, tone = "dark" }: { className?: string; onNavigate?: () => void; tone?: "dark" | "light" }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const resultsId = useId();
  const { addToCart, requireShopping } = useStore();
  const { search } = useCatalogue();
  const router = useRouter();
  const results = useMemo(() => search(query, 6), [query, search]);
  const hasTerm = query.trim().length > 0;
  const showResults = open && hasTerm;

  const submitSearch = () => {
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/home-grocery?${new URLSearchParams({ q: term }).toString()}`);
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <form role="search" onSubmit={(event) => { event.preventDefault(); submitSearch(); }} className={cn(
        "flex h-12 w-full items-center rounded-full ring-1 ring-inset transition-colors focus-within:ring-2",
        tone === "dark" ? "bg-white/14 ring-white/15 focus-within:bg-white/20 focus-within:ring-white/45" : "bg-surface ring-line focus-within:bg-white focus-within:ring-brand-300",
      )}>
        <Search size={18} aria-hidden="true" className={cn("ml-4 shrink-0", tone === "dark" ? "text-white/70" : "text-ink-400")} />
        <input
          type="search"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search products, brands and more..."
          aria-label="Search for products"
          aria-controls={showResults ? resultsId : undefined}
          autoComplete="off"
          className={cn("h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none [&::-webkit-search-cancel-button]:hidden", tone === "dark" ? "text-white placeholder:text-white/70" : "text-ink-800 placeholder:text-ink-400")}
        />
        {query && <button type="button" onClick={() => { setQuery(""); setOpen(false); }} aria-label="Clear search" className={cn("mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full", tone === "dark" ? "text-white/80 hover:bg-white/10" : "text-ink-500 hover:bg-ink-900/5")}><X size={15} /></button>}
        <button type="submit" aria-label="Search" className="mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-brand-900 transition-colors hover:bg-accent-400"><ArrowRight size={18} /></button>
      </form>

      <p className="sr-only" aria-live="polite">{showResults ? (results.length ? `${results.length} suggested products` : "No matching products") : ""}</p>
      {showResults && (
        <div id={resultsId} className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl bg-white p-2 shadow-menu ring-1 ring-ink-900/5">
          {results.length === 0 ? (
            <p role="status" className="px-3 py-6 text-center text-sm text-ink-500">No products match “{query.trim()}”. Try another search.</p>
          ) : (
            <>
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Products</p>
              <ul className="max-h-[320px] overflow-y-auto">
                {results.map((product) => (
                  <li key={product.id}>
                    <div className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface">
                      <Link href={`/product/${encodeURIComponent(product.slug)}`} onClick={() => { setOpen(false); onNavigate?.(); }} className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface"><Image src={product.image} alt="" fill sizes="48px" className="object-contain p-1" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-800">{product.name}</span><span className="block truncate text-xs text-ink-400">{product.categoryLabel} · {product.unit}</span></span>
                      </Link>
                      <span className="hidden whitespace-nowrap text-sm font-bold text-ink-900 sm:block">{catalogueDisplayPrice(product).label}</span>
                      <button type="button" onClick={() => {
                        if (!requireShopping(`/product/${encodeURIComponent(product.slug)}`)) { setOpen(false); onNavigate?.(); return; }
                        if (needsPurchaseChoices(product)) { setOpen(false); onNavigate?.(); router.push(`/product/${encodeURIComponent(product.slug)}`); }
                        else addToCart(product.id);
                      }} disabled={(product.stock ?? 0) <= 0} aria-label={`${needsPurchaseChoices(product) ? "Choose options for" : "Add"} ${product.name}`} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 transition-colors hover:bg-brand-600 hover:text-white disabled:opacity-50">{needsPurchaseChoices(product) ? "Choose" : "Add"}</button>
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={submitSearch} className="mt-1 flex w-full items-center justify-center gap-1.5 border-t border-line px-3 py-3 text-xs font-bold text-brand-700 hover:text-brand-900">View all results <ArrowRight size={13} /></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

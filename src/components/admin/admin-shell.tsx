"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronRight, LogOut, Menu, Search, X } from "lucide-react";
import { AdminIcon } from "@/components/admin/icons";
import type { NavGroup } from "@/lib/admin/navigation";
import { useBodyScrollLock } from "@/lib/ui/use-body-scroll-lock";
import { cn } from "@/lib/utils/cn";

export type ShellUser = { name: string; email: string; roleLabel: string };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export function AdminShell({
  nav,
  user,
  pendingOrders,
  signOut,
  children,
}: {
  nav: NavGroup[];
  user: ShellUser;
  pendingOrders: number;
  signOut: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useBodyScrollLock(open);

  // The longest matching destination wins; the same product URL can appear
  // in more than one group but only its first entry is marked current.
  const matches = nav.flatMap((group) => group.items.map((item) => ({ group, item })))
    .filter(({ item }) => item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.item.href.length - a.item.href.length);
  const current = matches[0];
  const currentLabel = pathname === "/admin/account" ? "My account" : current?.item.label ?? "Admin";
  const term = query.trim().toLowerCase();
  const visibleGroups = nav.map((group) => ({
    ...group,
    items: group.items.filter((item) => !term || `${group.label} ${item.label}`.toLowerCase().includes(term)),
  })).filter((group) => group.items.length > 0);

  // The drawer is a real modal: lock scrolling, contain keyboard focus, close
  // on Escape or resize, and return focus to the menu button when it closes.
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const returnFocus = menuButton.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === "Tab" && drawer.current) {
        const focusable = Array.from(drawer.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && (document.activeElement === first || !drawer.current.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !drawer.current.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => { if (desktop.matches) setOpen(false); };
    const onHistoryNavigation = () => setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onResize);
    window.addEventListener("popstate", onHistoryNavigation);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onResize);
      window.removeEventListener("popstate", onHistoryNavigation);
      if (!desktop.matches) returnFocus?.focus();
    };
  }, [open]);

  const closeNavigation = () => {
    setOpen(false);
    setQuery("");
  };

  const sidebar = (mobile: boolean) => (
    <div className="flex h-full min-h-0 flex-col text-[#e6f1eb]">
      <div className="flex h-[76px] shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#d8f0df] text-[#14543d]">
          <AdminIcon name="basket" size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-extrabold leading-tight tracking-[-0.02em] text-white">Niketon Mart</span>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#a6c2b2]">Admin workspace</span>
        </span>
        {mobile ? (
          <button ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="Close admin menu"
            className="inline-flex size-10 items-center justify-center rounded-xl text-[#d8e8df] hover:bg-white/10 focus-visible:outline-white">
            <X size={19} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="shrink-0 px-4 pb-2 pt-4">
        <div className="relative">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a8bfb2]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a section…"
            aria-label="Find an admin section"
            className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.07] pl-9 pr-3 text-[12.5px] text-white outline-none placeholder:text-[#a6bdb0] focus:border-[#a4d9bb] focus:bg-white/10 focus-visible:outline-white"
          />
        </div>
      </div>

      <nav aria-label="Admin sections" className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 pt-2 [scrollbar-color:#547b68_transparent] [scrollbar-width:thin]">
        {visibleGroups.length === 0 ? (
          <div className="px-3 py-5 text-[12px] leading-relaxed text-[#c0d3c7]">
            <p>No sections match “{query}”.</p>
            <button type="button" onClick={() => setQuery("")} className="mt-2 font-bold text-white underline underline-offset-4 focus-visible:outline-white">Clear search</button>
          </div>
        ) : visibleGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9fb9aa]">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = current?.item === item;
                return (
                  <li key={`${group.label}:${item.href}`}>
                    <Link
                      href={item.href}
                      onClick={closeNavigation}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-colors focus-visible:outline-white",
                        active
                          ? "bg-[#e5f4e9] text-[#14513a] shadow-sm"
                          : "text-[#d2e2d8] hover:bg-white/[0.08] hover:text-white",
                      )}
                    >
                      <span className={cn("shrink-0", active ? "text-[#1b8057]" : "text-[#aac4b5] group-hover:text-white")}>
                        <AdminIcon name={item.icon} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {item.badge === "orders-pending" && pendingOrders > 0 ? (
                        <span className="rounded-full bg-[#f8d87d] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-[#493a09]">{pendingOrders}</span>
                      ) : null}
                      {active && !(item.badge === "orders-pending" && pendingOrders > 0) ? <span className="size-1.5 rounded-full bg-[#1b8057]" aria-hidden="true" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <Link href="/admin/account" onClick={closeNavigation} className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-white/[0.08] focus-visible:outline-white">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#d8f0df] text-[11px] font-extrabold text-[#14543d]">{initials(user.name) || "A"}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold text-white">{user.name}</span>
            <span className="mt-0.5 block truncate text-[11px] text-[#b2c9ba]">{user.roleLabel} · My account</span>
          </span>
          <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-[#b2c9ba]" />
        </Link>
        <form action={signOut} className="mt-1">
          <button type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12px] font-semibold text-[#bdd0c4] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-white">
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#f5f8f6]">
      <a href="#admin-main" className="sr-only z-[70] rounded-lg bg-white px-4 py-2 text-sm font-bold text-brand-800 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-[#20483a] bg-[#12372a] lg:block">
        {sidebar(false)}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close admin menu backdrop" tabIndex={-1} className="absolute inset-0 bg-[#10251c]/60" onClick={() => setOpen(false)} />
          <aside ref={drawer} id="admin-mobile-menu" role="dialog" aria-modal="true" aria-label="Admin navigation" className="absolute inset-y-0 left-0 w-[88%] max-w-[320px] bg-[#12372a] shadow-2xl">
            {sidebar(true)}
          </aside>
        </div>
      ) : null}

      <div className="min-w-0 lg:pl-[264px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-[#e6ede8] bg-white/95 px-4 backdrop-blur sm:px-6 xl:px-8">
          <button ref={menuButton} type="button" className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e2ebe5] text-[#234b39] hover:bg-[#eff7f1] lg:hidden"
            onClick={() => setOpen(true)} aria-label="Open admin menu" aria-expanded={open} aria-controls={open ? "admin-mobile-menu" : undefined}>
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="hidden items-center gap-2 text-[11px] font-semibold text-[#778b7d] sm:flex">
              <span>Workspace</span><ChevronRight size={12} aria-hidden="true" /><span>{current?.group.label ?? "Account"}</span>
            </p>
            <p className="truncate text-[13px] font-extrabold text-[#1b3728] sm:mt-0.5">{currentLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link href="/home-grocery" target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dce8e0] bg-white px-3 text-[12px] font-bold text-[#24563e] transition-colors hover:bg-[#eff7f1] sm:px-3.5">
              View shop <ArrowUpRight size={14} aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>
            <Link href="/admin/account" title={`Signed in as ${user.email}`} aria-label={`My account, signed in as ${user.email}`} className="inline-flex size-9 items-center justify-center rounded-full bg-[#dcefe2] text-[11px] font-extrabold text-[#20543a] ring-2 ring-white">
              {initials(user.name) || "A"}
            </Link>
          </div>
        </header>
        <main id="admin-main" tabIndex={-1} className="mx-auto min-w-0 max-w-[1600px] px-4 pb-16 pt-6 outline-none sm:px-6 sm:pt-7 xl:px-8">{children}</main>
      </div>
    </div>
  );
}

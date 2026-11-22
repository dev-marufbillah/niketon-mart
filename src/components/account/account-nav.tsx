"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, LogOut, MapPin, Package, UserRound, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Account navigation — one list, used by the sidebar on desktop and the compact
 * horizontal rails on tablet/mobile. The active page is derived from the URL so
 * it stays correct on refresh, deep links and the browser's back button.
 */

export const accountNavItems = [
  { href: "/my-account/personal-information", label: "Personal Information", icon: UserRound },
  { href: "/my-account/orders", label: "My Orders", icon: Package },
  { href: "/my-account/addresses", label: "Manage Address", icon: MapPin },
  { href: "/my-account/payment-methods", label: "Payment Method", icon: CreditCard },
  { href: "/my-account/password", label: "Password Manager", icon: KeyRound },
  { href: "/my-account/logout", label: "Logout", icon: LogOut },
] as const;

export function AccountNav({ variant = "sidebar" }: { variant?: "sidebar" | "rail" }) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "rail") {
    return (
      <nav aria-label="Account sections" className="scrollbar-none -mx-4 overflow-x-auto px-4 lg:hidden">
        <ul className="flex gap-2">
          {accountNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors",
                    active
                      ? "bg-accent-500 text-brand-900"
                      : "bg-white text-ink-600 ring-1 ring-line hover:text-brand-700",
                  )}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Account sections" className="hidden lg:block">
      <ul className="space-y-2">
        {accountNavItems.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-xl px-4 py-3 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-accent-500 text-brand-900 shadow-sm"
                    : "bg-white text-ink-700 ring-1 ring-line hover:text-brand-700",
                  item.href.endsWith("/logout") && !active ? "text-ink-600" : "",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

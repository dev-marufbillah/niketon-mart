"use client";

import Link, { useLinkStatus } from "next/link";
import { useStore } from "@/lib/store/store-provider";

function PendingAccount() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  // Cover the old page while a slow navigation is pending instead of showing
  // its footer. Do not scroll early: that would corrupt Back's saved position.
  return <span role="status" className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 text-sm font-semibold text-brand-700"><span className="mr-3 size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" aria-hidden="true" />Loading your account…</span>;
}

export function AccountLink({ children, className, onClick, ariaLabel }: { children: React.ReactNode; className?: string; onClick?: () => void; ariaLabel?: string }) {
  const { isSignedIn } = useStore();
  const href = isSignedIn ? "/my-account/personal-information" : "/my-account/login?next=%2Fmy-account%2Fpersonal-information";
  return <Link href={href} onClick={onClick} aria-label={ariaLabel} className={className}>{children}<PendingAccount /></Link>;
}

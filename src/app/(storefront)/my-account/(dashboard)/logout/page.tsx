import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { AccountShell } from "@/components/account/account-shell";
import { logoutCustomerAction } from "@/lib/actions/account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Logout", robots: { index: false, follow: false } };

/**
 * Logout.
 * The page is a confirmation, not a redirect: pressing the button runs a server
 * action that deletes the session row and clears the httpOnly cookie, so the
 * account pages are genuinely locked again (including via the back button, which
 * would only re-request a guarded page and be redirected to sign-in).
 */
export default async function LogoutPage() {
  return (
    <AccountShell
      next="/my-account/logout"
      title="Logout" description="Signing out ends this session on this device.">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <p className="text-[14px] font-extrabold text-ink-900">Are you sure you want to log out?</p>
        <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-ink-500">
          Your orders, addresses and preferences stay saved on your account. You can sign back in any time with your
          email and password.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <form action={logoutCustomerAction}>
            <button
              type="submit"
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand-600 px-6 text-[13px] font-bold text-white hover:bg-brand-700"
            >
              <LogOut size={14} /> Yes, Logout
            </button>
          </form>
          <Link
            href="/my-account/personal-information"
            className="inline-flex h-11 items-center rounded-full bg-white px-5 text-[12.5px] font-semibold text-ink-700 ring-1 ring-line hover:text-brand-700"
          >
            Return to my account
          </Link>
        </div>
      </div>
    </AccountShell>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AccountShell } from "@/components/account/account-shell";
import { PasswordForm } from "@/components/account/password-form";
import { getCustomerProfile } from "@/lib/auth/customer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Password manager", robots: { index: false, follow: false } };

/**
 * Password Manager.
 * Changing a password requires the current one, re-hashes with scrypt on the
 * server, signs out every other device, and never writes the password anywhere.
 */
export default async function PasswordPage() {
  const profile = await getCustomerProfile();
  return (
    <AccountShell
      next="/my-account/password"
      title="Password Manager"
      description="Update the password you use to sign in. Other devices are signed out when you do."
    >
      {profile?.staffAdminId ? (
        <div className="rounded-2xl bg-white p-5 text-sm text-ink-700 ring-1 ring-line">
          Your store staff password is managed securely in <Link href="/admin/account" className="font-bold text-brand-700 underline">Admin account settings</Link>.
        </div>
      ) : (
      <>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <PasswordForm />
      </div>

      <div className="mt-3 rounded-2xl bg-white p-4 text-[11.5px] leading-relaxed text-ink-500 ring-1 ring-line">
        Forgot your current password? Use <Link href="/my-account/forgot-password" className="font-semibold text-brand-700">customer password recovery</Link> for an account with a verified email, or <Link href="/contact" className="font-semibold text-brand-700">contact the store</Link> for help. Never share your password with anyone, including staff.
      </div>
      </>
      )}
    </AccountShell>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/account/auth-form";
import { getCustomerSession, safeAccountNext } from "@/lib/auth/customer";
import { getSessionUser } from "@/lib/auth/session";
import { DEFAULT_ACCOUNT_DESTINATION, isAdminDestination } from "@/lib/auth/return-to";
import { getGoogleConfig } from "@/lib/auth/google";
import { googleMessage } from "@/lib/auth/google-messages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Niketon Mart account to track orders, save addresses and keep your preferences.",
  robots: { index: false, follow: false },
};

export default async function AccountRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; google?: string }>;
}) {
  const { next, google } = await searchParams;
  const target = safeAccountNext(next);
  const shopper = await getCustomerSession();
  if (shopper) {
    const admin = isAdminDestination(target) ? await getSessionUser() : null;
    redirect(isAdminDestination(target) && !admin ? DEFAULT_ACCOUNT_DESTINATION : target);
  }

  return (
    <div className="mx-auto max-w-xl rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
      <h1 className="text-[21px] font-black text-ink-900">Create your account</h1>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
        Create a customer account to save your shopping, orders and addresses. Staff access is by invitation only. Earlier guest orders stay available through{" "}
        <span className="font-semibold text-ink-700">Track order</span>.
      </p>
      <div className="mt-5">
        <AuthForm mode="register" next={target} googleEnabled={Boolean(getGoogleConfig())} googleError={googleMessage(google)} />
      </div>
      <p className="mt-4 rounded-xl bg-surface px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-500">
        Passwords are stored as a salted scrypt hash — never in plain text. We do not store card numbers or mobile-wallet
        PINs.
      </p>
    </div>
  );
}

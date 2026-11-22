import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, ShieldCheck, Truck } from "lucide-react";
import { AuthForm } from "@/components/account/auth-form";
import { getCustomerSession, safeAccountNext } from "@/lib/auth/customer";
import { getSessionUser } from "@/lib/auth/session";
import { isAdminDestination } from "@/lib/auth/return-to";
import { getGoogleConfig } from "@/lib/auth/google";
import { googleMessage } from "@/lib/auth/google-messages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to see your orders, saved addresses and payment preferences.",
  robots: { index: false, follow: false },
};

/** Sign in. `?next=` returns the shopper to the account page they asked for. */
export default async function AccountLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signedOut?: string; google?: string }>;
}) {
  const { next, signedOut, google } = await searchParams;
  const target = safeAccountNext(next);
  const [shopper, admin] = await Promise.all([getCustomerSession(), getSessionUser()]);
  // A customer visiting an admin link may sign in with staff credentials here;
  // a customer cookie alone is never sufficient for the dashboard.
  if (shopper && (!isAdminDestination(target) || admin)) redirect(target);

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_360px]">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-line sm:p-6">
        <h1 className="text-[21px] font-black text-ink-900">Sign in</h1>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
          Customers and store staff can sign in here with their own email and password.
        </p>

        {signedOut ? (
          <p
            role="status"
            className="mt-4 flex items-start gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12px] font-semibold text-brand-700"
          >
            <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> You are signed out. Your session was ended on this
            device.
          </p>
        ) : null}

        <div className="mt-5">
          <AuthForm mode="login" next={target} googleEnabled={Boolean(getGoogleConfig())} googleError={googleMessage(google)} />
        </div>
      </section>

      <aside className="space-y-3">
        <div className="rounded-2xl bg-brand-900 p-5 text-white">
          <p className="text-[13.5px] font-extrabold">What your account gives you</p>
          <ul className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-white/80">
            <li className="flex gap-2">
              <Truck size={14} className="mt-0.5 shrink-0 text-accent-400" /> Every order you placed while signed in, in
              one list.
            </li>
            <li className="flex gap-2">
              <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent-400" /> Saved addresses that fill themselves
              in at checkout.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-accent-400" /> Your preferred payment method,
              remembered.
            </li>
          </ul>
        </div>
        <p className="rounded-2xl bg-white p-4 text-[11.5px] leading-relaxed text-ink-500 ring-1 ring-line">
          Orders placed as a guest can still be tracked any time with the order number and access code — no account
          needed.
        </p>
      </aside>
    </div>
  );
}

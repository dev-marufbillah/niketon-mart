import type { Metadata } from "next";
import { AccountShell } from "@/components/account/account-shell";
import { ProfileForm } from "@/components/account/profile-form";
import { GoogleConnection } from "@/components/account/google-connection";
import { CustomerEmailSecurityForm } from "@/components/account/customer-security-forms";
import { isCustomerMailConfigured } from "@/lib/auth/admin-mail";
import { getCustomerProfile } from "@/lib/auth/customer";
import { getGoogleConfig } from "@/lib/auth/google";
import { googleMessage } from "@/lib/auth/google-messages";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Personal information", robots: { index: false, follow: false } };

/** Personal information — real customer record, edited through a server action. */
export default async function PersonalInformationPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const [profile, { google }] = await Promise.all([getCustomerProfile(), searchParams]);

  return (
    <AccountShell
      next="/my-account/personal-information"
      title="Personal Information"
      description="Your name, contact details and preferences. Order emails and delivery updates use these details."
    >
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
        {profile ? (
          <ProfileForm
            initial={{
              firstName: profile.firstName || profile.name.split(" ")[0] || "",
              lastName: profile.lastName || profile.name.split(" ").slice(1).join(" ") || "",
              email: profile.email,
              phone: profile.phone,
              gender: profile.gender ?? "",
              emailVerified: Boolean(profile.emailVerified),
              marketingOptIn: Boolean(profile.marketingOptIn),
            }}
            orderCount={profile.orderCount}
          />
        ) : (
          <p className="text-[13px] text-ink-500">Your profile could not be loaded. Please sign in again.</p>
        )}
      </div>

      {profile && profile.passwordHash && !profile.staffAdminId ? (
        <CustomerEmailSecurityForm email={profile.email} verified={Boolean(profile.emailVerified)} configured={isCustomerMailConfigured()} googleConnected={Boolean(profile.googleSubjectHash)} />
      ) : profile ? (
        <p className="mt-3 rounded-2xl bg-white p-4 text-[12px] text-ink-500 ring-1 ring-line">{profile.staffAdminId ? "Staff sign-in email is managed in Admin account settings." : "Google-only sign-in email changes require account help from the store."}</p>
      ) : null}

      {profile ? (
        <GoogleConnection connected={Boolean(profile.googleSubjectHash)} hasPassword={Boolean(profile.passwordHash)}
          staff={Boolean(profile.staffAdminId)} configured={Boolean(getGoogleConfig())}
          notice={google === "linked" ? "Google is connected. You can use it to sign in to this customer account." : undefined}
          error={googleMessage(google)} />
      ) : null}

      <div className="mt-3 rounded-2xl bg-white p-4 text-[11.5px] leading-relaxed text-ink-500 ring-1 ring-line">
        Need your account removed? Send a request from the <Link href="/contact" className="font-semibold text-brand-700">contact page</Link>. The store will review your request.
      </div>
    </AccountShell>
  );
}

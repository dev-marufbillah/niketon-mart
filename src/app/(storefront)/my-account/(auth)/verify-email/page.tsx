import type { Metadata } from "next";
import Link from "next/link";
import { CustomerVerifyEmailForm } from "@/components/account/customer-security-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify customer email", robots: { index: false, follow: false } };

export default function CustomerVerifyEmailPage() {
  return <section className="mx-auto max-w-xl rounded-2xl bg-white p-5 ring-1 ring-line sm:p-7">
    <h1 className="text-[21px] font-black text-ink-900">Verify your customer email</h1>
    <p className="mb-5 mt-2 text-[13px] leading-relaxed text-ink-500">Confirm the email address for your customer account. This one-time link expires after one hour. If you did not request this, do not continue.</p>
    <CustomerVerifyEmailForm />
    <p className="mt-5 text-[12px] text-ink-500">Need a new link? Sign in and visit <Link className="font-bold text-brand-700 underline" href="/my-account/personal-information">Personal Information</Link>.</p>
  </section>;
}

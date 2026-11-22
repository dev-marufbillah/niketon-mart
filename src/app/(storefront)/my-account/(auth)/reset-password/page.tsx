import type { Metadata } from "next";
import Link from "next/link";
import { CustomerResetForm } from "@/components/account/customer-security-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set a new customer password", robots: { index: false, follow: false } };

export default function CustomerResetPasswordPage() {
  return <section className="mx-auto max-w-xl rounded-2xl bg-white p-5 ring-1 ring-line sm:p-7">
    <h1 className="text-[21px] font-black text-ink-900">Set a new customer password</h1>
    <p className="mb-5 mt-2 text-[13px] leading-relaxed text-ink-500">Reset links can be used once and expire after 30 minutes. This does not change a staff password.</p>
    <CustomerResetForm />
    <p className="mt-5 text-[12px] text-ink-500"><Link className="font-bold text-brand-700 underline" href="/my-account/forgot-password">Request a new link</Link> or <Link className="font-bold text-brand-700 underline" href="/contact">contact the store</Link>.</p>
  </section>;
}

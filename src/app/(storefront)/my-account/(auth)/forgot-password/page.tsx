import type { Metadata } from "next";
import Link from "next/link";
import { CustomerResetRequestForm } from "@/components/account/customer-security-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Customer password recovery", robots: { index: false, follow: false } };

export default function CustomerForgotPasswordPage() {
  return <section className="mx-auto max-w-xl rounded-2xl bg-white p-5 ring-1 ring-line sm:p-7">
    <h1 className="text-[21px] font-black text-ink-900">Reset your customer password</h1>
    <p className="mb-5 mt-2 text-[13px] leading-relaxed text-ink-500">Enter the verified email associated with your customer password account. For security, we do not confirm whether an account exists. Unverified or Google-only accounts need account help from the store.</p>
    <CustomerResetRequestForm />
    <p className="mt-5 text-[12px] text-ink-500">Store staff use <Link className="font-bold text-brand-700 underline" href="/admin/forgot-password">staff password recovery</Link>. <Link className="font-bold text-brand-700 underline" href="/my-account/login">Back to sign in</Link>.</p>
  </section>;
}

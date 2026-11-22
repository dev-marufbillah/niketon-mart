import type { Metadata } from "next";
import { AdminResetRequestForm } from "@/components/admin/admin-link-form";
export const metadata: Metadata = { title: "Reset admin password", robots: { index: false, follow: false } };
export default function ForgotPassword() { return <main className="flex min-h-dvh items-center justify-center bg-surface-2 px-5"><div className="w-full max-w-md rounded-2xl bg-white p-6 ring-1 ring-line"><h1 className="mb-2 text-2xl font-bold">Reset admin password</h1><p className="mb-5 text-sm text-ink-500">We will send a private link if your account is eligible.</p><AdminResetRequestForm /></div></main>; }

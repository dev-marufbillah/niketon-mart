import type { Metadata } from "next";
import { AdminSetupForm } from "@/components/admin/admin-link-form";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set admin password", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ purpose?: string }> }) {
  const { purpose = "" } = await searchParams;
  return <main className="flex min-h-dvh items-center justify-center bg-surface-2 px-5"><div className="w-full max-w-md rounded-2xl bg-white p-6 ring-1 ring-line"><h1 className="mb-2 text-2xl font-bold">Set your admin password</h1><p className="mb-5 text-sm text-ink-500">Links are time-limited and can be used once.</p><AdminSetupForm purpose={purpose} /></div></main>;
}

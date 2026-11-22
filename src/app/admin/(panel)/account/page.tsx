import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PasswordForm } from "@/components/admin/password-form";
import { requireAdmin } from "@/lib/auth/session";
import { roleDefinitions } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "My account" };

export default async function AdminAccountPage() {
  const user = await requireAdmin();

  return (
    <div>
      <AdminPageHeader
        title="My account"
        description="Your sign-in details. Passwords are stored as salted scrypt hashes — nobody, including the owner, can read them."
        meta={`${user.email} · ${roleDefinitions[user.role].label}`}
      />
      <div className="max-w-[460px] rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
        <h2 className="mb-3 text-[14px] font-extrabold text-ink-900">Change password</h2>
        <PasswordForm />
      </div>
    </div>
  );
}

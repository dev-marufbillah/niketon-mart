import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New admin user" };

export default async function NewAdminUserPage() {
  await requirePermission("users.manage");
  return (
    <div>
      <AdminPageHeader
        title="Invite admin user"
        description="Choose a role and send a secure invitation. Your teammate sets their own password."
        backHref={{ href: "/admin/users", label: "Admin users" }}
      />
      <div className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
        <AdminUserForm />
      </div>
    </div>
  );
}

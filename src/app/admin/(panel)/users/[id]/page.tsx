import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { requirePermission } from "@/lib/auth/session";
import { ensureDatabase } from "@/lib/db";
import { isSuperAdminIdentity } from "@/lib/auth/super-admin";
import type { AdminRole, Permission } from "@/lib/auth/permissions";
import type { Row } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit admin user" };

export default async function EditAdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("users.manage");
  const { id } = await params;
  const db = await ensureDatabase();
  const user = await db.get<Row & { name: string; email: string; role: AdminRole; active: boolean; permissions?: Permission[]; invitationStatus?: string }>(
    "admin_users",
    id,
  );
  if (!user) notFound();

  return (
    <div>
      <AdminPageHeader
        title={user.name}
        description="Update role and account status. Passwords are set privately through email links."
        backHref={{ href: "/admin/users", label: "Admin users" }}
        meta={user.email}
      />
      <div className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-5">
        {isSuperAdminIdentity(user.email) ? <p className="text-sm text-ink-600">This Super Admin identity, role and active status are protected. Change your own password in My account.</p> :
          <AdminUserForm user={{ id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, permissions: user.permissions, invitationStatus: user.invitationStatus }} />}
      </div>
    </div>
  );
}

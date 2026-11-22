import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { requirePermission } from "@/lib/auth/session";
import { roleDefinitions, type AdminRole } from "@/lib/auth/permissions";
import { deleteAdminUserAction } from "@/lib/admin/user-actions";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import { isSuperAdminIdentity } from "@/lib/auth/super-admin";
import { isAdminMailConfigured } from "@/lib/auth/admin-mail";
import { formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Admin users" };

type AdminRow = Row & {
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt?: string;
  mustChangePassword?: boolean;
  invitationStatus?: string;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await requirePermission("users.manage");
  const params = await searchParams;
  const db = await ensureDatabase();
  const query = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const users = (await db.list<AdminRow>("admin_users")).filter((user) => !query || `${user.name} ${user.email}`.toLowerCase().includes(query)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div>
      <AdminPageHeader
        title="Admin users"
        description="Who can sign in to the admin panel and what they are allowed to do. Every action they take is recorded in the activity log."
        action={{ href: "/admin/users/new", label: "Add admin user" }}
      />

      {!isAdminMailConfigured() ? <p role="alert" className="mb-4 rounded-xl bg-accent-50 px-3 py-2 text-xs text-accent-700">Invitations and password-reset emails are disabled until the mail provider, sender and site URL are configured.</p> : null}
      <form className="mb-4 flex gap-2"><input name="q" aria-label="Search admin users" defaultValue={query} placeholder="Search name or email" className="h-10 w-full max-w-sm rounded-xl border border-line px-3 text-sm" /><button className="rounded-full bg-brand-600 px-4 text-xs font-semibold text-white">Search</button></form>
      {typeof params.invited === "string" ? <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-700">Invitation accepted by the email provider; the account remains inactive until setup.</p> : null}
      {typeof params.saved === "string" ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700">
          Account saved.
        </p>
      ) : null}
      {typeof params.deleted === "string" ? (
        <p role="status" className="mb-4 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700">
          Account deleted and signed out everywhere.
        </p>
      ) : null}

      <ul className="space-y-2">
        {users.map((user) => (
          <li key={user.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-line">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
              {user.name
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0]?.toUpperCase())
                .join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-ink-900">
                {user.name}
                {user.id === current.id ? <span className="ml-2 text-[10.5px] font-bold text-brand-600">YOU</span> : null}
              </span>
              <span className="block truncate text-[11.5px] text-ink-400">{user.email}</span>
            </span>
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-600">
              {roleDefinitions[user.role]?.label ?? user.role}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                user.active ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-600"
              }`}
            >
              {user.active ? "Active" : user.invitationStatus === "sent" ? "Invitation sent" : user.invitationStatus === "pending" ? "Invitation pending" : user.invitationStatus === "failed" ? "Delivery failed" : "Disabled"}
            </span>
            <span className="hidden text-[11px] text-ink-400 sm:block">
              {user.lastLoginAt ? `Last sign-in ${formatDate(user.lastLoginAt)}` : "Never signed in"}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              {!isSuperAdminIdentity(user.email) ? <Link
                href={`/admin/users/${user.id}`}
                className="rounded-lg bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-ink-700 hover:bg-brand-50 hover:text-brand-700"
              >
                Edit
              </Link> : <span className="text-xs font-semibold text-brand-700">Protected</span>}
              {user.id !== current.id && !isSuperAdminIdentity(user.email) ? (
                <ConfirmDialog
                  action={deleteAdminUserAction.bind(null, user.id)}
                  title={`Delete ${user.name}'s account?`}
                  description="They will be signed out immediately and will no longer be able to open the admin panel. Orders and content they created stay untouched."
                  triggerLabel="Delete"
                />
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <section className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-line">
        <h2 className="text-[14px] font-extrabold text-ink-900">What each role can do</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {(Object.keys(roleDefinitions) as AdminRole[]).map((role) => (
            <li key={role} className="rounded-xl bg-surface-2 p-3">
              <p className="text-[12.5px] font-bold text-ink-900">{roleDefinitions[role].label}</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{roleDefinitions[role].description}</p>
              <p className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">
                {roleDefinitions[role].permissions.length} permissions
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { AdminShell } from "@/components/admin/admin-shell";
import { adminNav } from "@/lib/admin/navigation";
import { can, roleDefinitions } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { signOutAction } from "@/lib/auth/actions";
import { getOrderStats } from "@/lib/repositories/orders";

export const dynamic = "force-dynamic";

/**
 * Authenticated admin shell.
 * Every page below this layout is guaranteed to have a signed-in admin; the
 * navigation is filtered by the account's role so a permission can never be
 * bypassed by typing a URL (each page also guards itself).
 */
export default async function PanelLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdmin();
  const stats = can(user, "orders.view") ? await getOrderStats() : null;

  const nav = adminNav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => can(user, item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <AdminShell
      nav={nav}
      user={{ name: user.name, email: user.email, roleLabel: roleDefinitions[user.role].label }}
      pendingOrders={stats?.pending ?? 0}
      signOut={signOutAction}
    >
      {children}
    </AdminShell>
  );
}

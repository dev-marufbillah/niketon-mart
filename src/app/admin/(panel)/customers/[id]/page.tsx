import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/page-header";
import { CustomerForm } from "@/components/admin/customer-form";
import { toAdminCustomerFormData } from "@/lib/admin/customer-dto";
import { requirePermission } from "@/lib/auth/session";
import { getCustomer, getCustomerOrders } from "@/lib/repositories/customers";
import { CustomerAccountPanel } from "@/components/admin/customer-account-panel";
import { countActiveSessions, getProfile, listAddresses } from "@/lib/repositories/accounts";
import { getDeliveryAreas } from "@/lib/repositories/operations";
import { orderStatuses } from "@/lib/repositories/orders";
import { formatPrice, formatDate } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("customers.view");
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const orders = await getCustomerOrders(customer.email, customer.id);
  const [profile, addresses, areas, sessionCount] = await Promise.all([
    getProfile(customer.id),
    listAddresses(customer.id),
    getDeliveryAreas(),
    countActiveSessions(customer.id),
  ]);

  return (
    <div>
      <AdminPageHeader
        title={customer.name}
        description={`${customer.orderCount} order${customer.orderCount === 1 ? "" : "s"} · ${formatPrice(customer.totalSpent)} lifetime value · joined ${formatDate(customer.createdAt)}`}
        backHref={{ href: "/admin/customers", label: "All customers" }}
        meta={`${customer.email} · ${customer.phone}`}
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-3 text-[14px] font-extrabold text-ink-900">Profile</h2>
          <CustomerForm customer={toAdminCustomerFormData(customer)} />
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-line">
          <h2 className="mb-3 text-[14px] font-extrabold text-ink-900">Order history</h2>
          {orders.length === 0 ? (
            <p className="text-[12.5px] text-ink-400">No orders recorded for this customer yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((order) => {
                const status = orderStatuses.find((entry) => entry.value === order.status);
                return (
                  <li key={order.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/admin/orders/${order.id}`} className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold text-ink-900">{order.number}</span>
                      <span className="text-[11px] text-ink-400">
                        {formatDate(order.createdAt)} · {order.items.length} items
                      </span>
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status?.tone ?? ""}`}>
                      {status?.label ?? order.status}
                    </span>
                    <span className="w-[74px] text-right text-[12.5px] font-semibold tabular-nums text-ink-800">
                      {formatPrice(order.total)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <CustomerAccountPanel
          customerId={customer.id}
          hasPassword={Boolean(profile?.passwordHash)}
          hasGoogle={Boolean(profile?.googleSubjectHash)}
          emailVerified={Boolean(profile?.emailVerified)}
          lastLoginAt={profile?.lastLoginAt}
          sessionCount={sessionCount}
          addresses={addresses}
          areas={areas.map((area) => ({ id: area.id, name: area.name }))}
          defaults={{
            firstName: profile?.firstName ?? customer.name.split(" ")[0] ?? "",
            lastName: profile?.lastName ?? customer.name.split(" ").slice(1).join(" ") ?? "",
            phone: customer.phone,
            email: customer.email,
          }}
        />
      </div>
    </div>
  );
}

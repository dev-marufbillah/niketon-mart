import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PackageOpen } from "lucide-react";
import { AccountShell } from "@/components/account/account-shell";
import { AccountOrderCard } from "@/components/account/order-card";
import { AccountOrderFilters } from "@/components/account/order-filters";
import { getCustomerSession } from "@/lib/auth/customer";
import { ensureDatabase } from "@/lib/db";
import { orderStatuses, type Order } from "@/lib/repositories/orders";
import type { Product } from "@/lib/types/domain";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My orders", robots: { index: false, follow: false } };

const PER_PAGE = 5;

/**
 * My Orders.
 *
 * Only orders proven to have been placed while signed in and whose `customerId` matches the signed-in customer are read — the
 * browser cannot influence that filter. Status and payment figures are exactly
 * what the admin panel writes, so a change made there appears here on refresh.
 */
export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const session = await getCustomerSession();
  const { status = "", q = "", page = "1" } = await searchParams;

  const db = await ensureDatabase();
  const all = (await db.list<Order>("orders")).filter((order) => order.customerWasAuthenticated === true && order.customerId === session?.id);
  const search = q.trim().toLowerCase();

  const filtered = all
    .filter((order) => (status ? order.status === status : true))
    .filter((order) =>
      search
        ? order.number.toLowerCase().includes(search) ||
          order.items.some((item) => item.name.toLowerCase().includes(search))
        : true,
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const currentPage = Math.max(1, Number(page) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const visible = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  // Slugs for the "view product" and "add review" links.
  const productSlugs = Object.fromEntries(
    (await db.list<Product>("products")).map((product) => [product.id, product.slug]),
  );

  const counts = orderStatuses.map((entry) => ({
    ...entry,
    count: all.filter((order) => order.status === entry.value).length,
  }));

  const hrefFor = (patch: { status?: string; page?: number }) => {
    const params = new URLSearchParams();
    const nextStatus = patch.status ?? status;
    if (nextStatus) params.set("status", nextStatus);
    if (q) params.set("q", q);
    if ((patch.page ?? 1) > 1) params.set("page", String(patch.page ?? 1));
    const text = params.toString();
    return text ? `/my-account/orders?${text}` : "/my-account/orders";
  };

  return (
    <AccountShell
      next="/my-account/orders"
      title="My Orders"
      description="Every order you placed while signed in, with its real status from the store."
    >
      <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-white ring-1 ring-line" />}>
        <AccountOrderFilters
          status={status}
          q={q}
          counts={counts.filter((entry) => entry.count > 0 || entry.value === status)}
          total={all.length}
        />
      </Suspense>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center">
          <PackageOpen size={26} className="mx-auto text-ink-300" />
          <p className="mt-2 text-[15px] font-extrabold text-ink-900">
            {all.length === 0 ? "No orders on this account yet" : "Nothing matches that filter"}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-ink-500">
            {all.length === 0
              ? "Orders placed while signed in appear here automatically. Guest orders stay reachable with their order number and access code."
              : "Try a different status, or clear the search."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {all.length === 0 ? (
              <>
                <Link
                  href="/home-grocery"
                  className="inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[12px] font-bold text-white hover:bg-brand-700"
                >
                  Start shopping
                </Link>
                <Link
                  href="/track-order"
                  className="inline-flex h-9 items-center rounded-full bg-surface px-4 text-[12px] font-semibold text-ink-700 ring-1 ring-line hover:bg-white"
                >
                  Track a guest order
                </Link>
              </>
            ) : (
              <Link
                href="/my-account/orders"
                className="inline-flex h-9 items-center rounded-full bg-surface px-4 text-[12px] font-semibold text-ink-700 ring-1 ring-line hover:bg-white"
              >
                Show all orders
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((order) => (
            <AccountOrderCard key={order.id} order={{ ...order, accessToken: undefined, accessTokenHash: undefined, idempotencyKey: undefined, idempotencyFingerprint: undefined }} productSlugs={productSlugs} onlineCancellationAvailable={false} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav aria-label="Order pages" className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((target) => (
            <Link
              key={target}
              href={hrefFor({ page: target })}
              aria-current={target === currentPage ? "page" : undefined}
              className={
                target === currentPage
                  ? "inline-flex size-9 items-center justify-center rounded-full bg-brand-600 text-[12.5px] font-bold text-white"
                  : "inline-flex size-9 items-center justify-center rounded-full bg-white text-[12.5px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700"
              }
            >
              {target}
            </Link>
          ))}
        </nav>
      ) : null}
    </AccountShell>
  );
}

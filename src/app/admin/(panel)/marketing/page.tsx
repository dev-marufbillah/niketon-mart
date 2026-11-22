import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { can } from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/session";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import { getMarketingOverview } from "@/lib/repositories/marketing";
import { wishlistStats } from "@/lib/repositories/wishlists";
import { listOrders } from "@/lib/repositories/orders";
import { getSettings } from "@/lib/repositories/settings";
import { formatDate, formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marketing",
  description: "Coupons, audience, banners and the announcement bar in one place.",
};

type Banner = Row & { title: string; badge?: string; visible: boolean; order?: number };

export default async function MarketingPage() {
  const user = await requireAdmin();

  if (!can(user, "marketing.manage")) {
    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-line">
        <h1 className="text-[18px] font-extrabold text-ink-900">You do not have access</h1>
        <p className="mt-1.5 text-[13px] text-ink-500">
          Marketing tools are limited to owners, managers and content editors.
        </p>
      </div>
    );
  }

  const [overview, orders, settings, db, wishlists] = await Promise.all([
    getMarketingOverview(),
    listOrders(),
    getSettings(),
    ensureDatabase(),
    wishlistStats(),
  ]);
  const banners = (await db.list<Banner>("promo_banners")).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  );

  const couponOrders = orders.filter((order) => Boolean(order.couponCode) && order.status !== "cancelled");
  const discountGiven = couponOrders.reduce((total, order) => total + (order.discount ?? 0), 0);
  const revenueFromCoupons = couponOrders.reduce((total, order) => total + order.total, 0);
  const byCoupon = new Map<string, { count: number; discount: number; revenue: number }>();
  for (const order of couponOrders) {
    const code = String(order.couponCode);
    const entry = byCoupon.get(code) ?? { count: 0, discount: 0, revenue: 0 };
    entry.count += 1;
    entry.discount += order.discount ?? 0;
    entry.revenue += order.total;
    byCoupon.set(code, entry);
  }
  const topCoupons = [...byCoupon.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  const monthStart = new Date();
  monthStart.setDate(1);
  const newSubscribers = overview.subscribers.filter(
    (subscriber) => new Date(subscriber.createdAt) >= monthStart,
  ).length;
  const activeSubscribers = overview.subscribers.filter(
    (subscriber) => subscriber.status === "subscribed",
  );

  const cards = [
    {
      label: "Discounts given",
      value: formatPrice(discountGiven),
      hint: `${couponOrders.length} order${couponOrders.length === 1 ? "" : "s"} used a coupon · ${formatPrice(revenueFromCoupons)} revenue`,
    },
    {
      label: "Active coupons",
      value: String(overview.stats.activeCoupons),
      hint: `${overview.stats.redemptions} total redemptions recorded`,
    },
    {
      label: "Newsletter audience",
      value: String(activeSubscribers.length),
      hint: `${newSubscribers} joined this month`,
    },
    {
      label: "Wishlist saves",
      value: String(wishlists.items),
      hint: `${wishlists.lists} list${wishlists.lists === 1 ? "" : "s"} · ${wishlists.averageItems} product${
        wishlists.averageItems === 1 ? "" : "s"
      } on average`,
    },
    {
      label: "Visible banners",
      value: String(banners.filter((banner) => banner.visible).length),
      hint: `${banners.length} banner${banners.length === 1 ? "" : "s"} configured`,
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Marketing"
        description="One place to see what is promoting the store and what it is costing: coupons and their real redemption data, the newsletter audience, homepage banners and the announcement bar."
        action={{ href: "/admin/r/coupons/new", label: "New coupon" }}
        meta="All figures come from orders, coupons and subscribers stored in the database"
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">{card.label}</span>
            <p className="mt-2 text-[22px] font-extrabold leading-none tabular-nums text-ink-900">{card.value}</p>
            <p className="mt-1.5 text-[11.5px] leading-snug text-ink-400">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* ---------- wishlist demand ---------- */}
      <section className="mt-4 rounded-2xl bg-white ring-1 ring-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-extrabold text-ink-900">Wishlist demand</h2>
            <p className="text-[11.5px] text-ink-400">
              What shoppers saved but have not bought yet. Aggregate only — no customer lists are shown.
            </p>
          </div>
          <span className="text-[11.5px] text-ink-400">
            {wishlists.lists === 0
              ? "No saves yet"
              : `Updated ${wishlists.lastUpdatedAt ? formatDate(wishlists.lastUpdatedAt) : "—"}`}
          </span>
        </div>

        {wishlists.mostWishlisted.length === 0 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-ink-500">
            Nobody has saved a product yet. Wishlist saves appear here as shoppers use the heart button.
          </p>
        ) : (
          <div className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Most wishlisted</p>
              <ul className="divide-y divide-line">
                {wishlists.mostWishlisted.map((product) => (
                  <li key={product.productId} className="flex items-center gap-3 py-2.5">
                    <span className="inline-flex size-9 shrink-0 overflow-hidden rounded-lg bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={product.image} alt="" className="size-full object-cover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link
                        href="/admin/catalogue/products"
                        className="block truncate text-[12.5px] font-semibold text-ink-800"
                      >
                        {product.name}
                      </Link>
                      <span className="text-[11px] text-ink-400">
                        {formatPrice(product.price)} · {product.stock > 0 ? `${product.stock} in stock` : "out of stock"}
                      </span>
                    </span>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">
                      {product.saved} saved
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl bg-surface/70 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">Restock signal</p>
              {wishlists.outOfStockDemand.length === 0 ? (
                <p className="text-[12px] leading-relaxed text-ink-500">
                  Every saved product is in stock right now — nothing is blocked.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {wishlists.outOfStockDemand.map((product) => (
                    <li key={product.productId} className="text-[12px] leading-relaxed text-ink-600">
                      <span className="font-semibold text-ink-800">{product.name}</span> — out of stock,{" "}
                      {product.saved} shopper{product.saved === 1 ? "" : "s"} waiting
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                Wishlist lists are anonymous records; they attach to a customer account once customer login exists.
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl bg-white ring-1 ring-line lg:col-span-2">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-[14px] font-extrabold text-ink-900">Coupons</h2>
              <p className="text-[11.5px] text-ink-400">Redemptions are counted when an order is placed.</p>
            </div>
            <Link href="/admin/r/coupons" className="text-[11.5px] font-semibold text-brand-700">
              Manage all →
            </Link>
          </div>
          {overview.coupons.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] font-semibold text-ink-700">No coupons yet</p>
              <p className="mt-1 text-[12px] text-ink-400">Create a code to reward repeat orders or win back customers.</p>
              <Link
                href="/admin/r/coupons/new"
                className="mt-3 inline-flex h-9 items-center rounded-full bg-brand-600 px-4 text-[12.5px] font-semibold text-white"
              >
                Create a coupon
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {overview.coupons.slice(0, 6).map((coupon) => {
                const usage = coupon.usageLimit > 0 ? Math.min(100, (coupon.usedCount / coupon.usageLimit) * 100) : null;
                const live =
                  coupon.active &&
                  (!coupon.endsAt || coupon.endsAt >= new Date().toISOString().slice(0, 10)) &&
                  (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit);
                return (
                  <li key={coupon.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[12.5px] font-bold text-ink-900">
                          <span className="rounded-md bg-surface-50 px-1.5 py-0.5 font-mono text-[11.5px]">{coupon.code}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              live ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                            }`}
                          >
                            {live ? "Live" : "Not running"}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-[11.5px] text-ink-400">
                          {coupon.description || "No description"} ·{" "}
                          {coupon.type === "percent"
                            ? `${coupon.value}% off`
                            : coupon.type === "fixed"
                              ? `${formatPrice(coupon.value)} off`
                              : "Free shipping"}
                          {coupon.endsAt ? ` · ends ${formatDate(coupon.endsAt)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-semibold tabular-nums text-ink-900">
                          {coupon.usedCount}
                          {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""} used
                        </p>
                        <Link href={`/admin/r/coupons/${coupon.id}`} className="text-[11.5px] font-semibold text-brand-700">
                          Edit →
                        </Link>
                      </div>
                    </div>
                    {usage !== null ? (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-100">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${usage}%` }} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-extrabold text-ink-900">Announcement bar</h2>
              <Link href="/admin/settings" className="text-[11.5px] font-semibold text-brand-700">
                Edit →
              </Link>
            </div>
            <p className="rounded-xl bg-surface-50 px-3 py-2 text-[12px] text-ink-700">
              {settings.announcement.enabled ? settings.announcement.message : "Hidden — no message is showing."}
            </p>
            <p className="mt-2 text-[11.5px] text-ink-400">
              {settings.announcement.enabled
                ? `Button: ${settings.announcement.ctaLabel || "none"} → ${settings.announcement.ctaHref || "no link"}`
                : "Turn it on in Site settings → Announcement bar."}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-extrabold text-ink-900">Homepage banners</h2>
              <Link href="/admin/r/promo_banners" className="text-[11.5px] font-semibold text-brand-700">
                Manage →
              </Link>
            </div>
            <ul className="space-y-1.5">
              {banners.slice(0, 4).map((banner) => (
                <li key={banner.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="truncate text-ink-700">{banner.title}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      banner.visible ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {banner.visible ? "Live" : "Hidden"}
                  </span>
                </li>
              ))}
              {banners.length === 0 ? <li className="text-[12px] text-ink-400">No banners configured.</li> : null}
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-4 ring-1 ring-line">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-extrabold text-ink-900">Top performing codes</h2>
              <Link href="/admin/orders" className="text-[11.5px] font-semibold text-brand-700">
                Orders →
              </Link>
            </div>
            {topCoupons.length === 0 ? (
              <p className="text-[12px] text-ink-400">No coupon has been used yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {topCoupons.map(([code, entry]) => (
                  <li key={code} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="font-mono text-[11.5px] font-semibold text-ink-900">{code}</span>
                    <span className="text-ink-500">
                      {entry.count} order{entry.count === 1 ? "" : "s"} · −{formatPrice(entry.discount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl bg-white ring-1 ring-line">
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[14px] font-extrabold text-ink-900">Newsletter subscribers</h2>
            <p className="text-[11.5px] text-ink-400">Collected from the footer sign-up form on the storefront.</p>
          </div>
          <Link href="/admin/r/subscribers" className="text-[11.5px] font-semibold text-brand-700">
            Manage all →
          </Link>
        </div>
        {overview.subscribers.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-ink-400">
            No subscribers yet. The footer form on every storefront page feeds this list.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-[0.06em] text-ink-400">
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Source</th>
                  <th className="px-4 py-2 font-semibold">Joined</th>
                  <th className="px-4 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.subscribers.slice(0, 6).map((subscriber) => (
                  <tr key={subscriber.id}>
                    <td className="px-4 py-2.5 text-[12.5px] text-ink-800">{subscriber.email}</td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-500">{subscriber.source}</td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-500">{formatDate(subscriber.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          subscriber.status === "subscribed" ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500"
                        }`}
                      >
                        {subscriber.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

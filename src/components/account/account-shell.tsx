import Link from "next/link";
import { redirect } from "next/navigation";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { AccountNav } from "@/components/account/account-nav";
import { getCustomerProfile, getCustomerSession } from "@/lib/auth/customer";
import { countActiveSessions, listAddresses } from "@/lib/repositories/accounts";

/**
 * Shared frame for every My Account page: banner, page title, the sidebar (or
 * mobile rail), the content column, then the store's service strip and
 * newsletter. Guarding here means a new account page cannot forget the check.
 */
export async function AccountShell({
  title,
  description,
  next,
  children,
}: {
  title: string;
  description?: string;
  /** Where to return after signing in — the page that needed the session. */
  next: string;
  children: React.ReactNode;
}) {
  const session = await getCustomerSession();
  if (!session) redirect(`/my-account/login?next=${encodeURIComponent(next)}`);

  const profile = await getCustomerProfile();
  if (!profile) redirect(`/my-account/login?next=${encodeURIComponent(next)}`);

  const [addresses, sessions] = await Promise.all([listAddresses(profile.id), countActiveSessions(profile.id)]);

  const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "NM";

  return (
    <>
      <ShopHero title="My Account" current="My Account" />

      <section className="container-page py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-[250px_1fr] lg:gap-8">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-line">
              <span className="relative inline-flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-[15px] font-black text-brand-700">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-extrabold text-ink-900">{profile.name}</p>
                <p className="truncate text-[11.5px] text-ink-400">{profile.email}</p>
              </div>
            </div>

            <div className="lg:sticky lg:top-4">
              <AccountNav />
              <div className="mt-3 hidden rounded-xl bg-surface p-3 text-[11.5px] leading-relaxed text-ink-500 lg:block">
                {addresses.length} saved address{addresses.length === 1 ? "" : "es"} · signed in on {sessions} device
                {sessions === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="text-[21px] font-black text-ink-900 sm:text-[24px]">{title}</h1>
                {description ? (
                  <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-500">{description}</p>
                ) : null}
              </div>
              <Link
                href="/track-order"
                className="hidden rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700 sm:inline-flex"
              >
                Track an order
              </Link>
            </div>

            <AccountNav variant="rail" />

            <div className="mt-4">{children}</div>
          </div>
        </div>
      </section>

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

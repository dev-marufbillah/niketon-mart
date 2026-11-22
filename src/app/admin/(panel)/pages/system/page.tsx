import type { Metadata } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ComingSoonSettingsForm, NotFoundSettingsForm } from "@/components/admin/system-pages-form";
import { requirePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/repositories/settings";
import { listMedia } from "@/lib/repositories/media";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Error & launch pages" };

/**
 * Error page (404) and Coming Soon page.
 *
 * Both are purpose-built pages of the storefront that carry no URL of their own
 * in the CMS (`/404`, `/coming-soon`), so their copy lives in the `settings`
 * singleton next to the rest of the site identity — not in a second content
 * store. The launch switch is the only way the shop can be replaced, and it
 * never touches the admin panel.
 */
export default async function SystemPagesAdmin() {
  await requirePermission("content.view");
  const [settings, media] = await Promise.all([getSettings(), listMedia()]);
  const library = media.map((item) => ({ id: item.id, url: item.url, alt: item.alt }));

  return (
    <div>
      <AdminPageHeader
        title="Error & launch pages"
        description="The custom 404 screen and the Coming Soon page. Copy, illustration and buttons are saved to the site settings and appear immediately."
        backHref={{ href: "/admin/r/pages", label: "All pages" }}
        meta="Managed under Website in the sidebar · noindex is respected by search engines"
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <NotFoundSettingsForm settings={settings} media={library} />
          <section className="rounded-2xl bg-white p-4 text-[11.5px] leading-relaxed text-ink-500 ring-1 ring-line">
            <p className="font-semibold text-ink-700">How the 404 screen is used</p>
            <p className="mt-1">
              It renders automatically for any unknown URL and for missing products, blog posts, pages and categories —
              always with a real HTTP 404 so search engines drop the dead link. The shop header and footer come from the
              shared layout.
            </p>
            <p className="mt-1.5">
              Try it:{" "}
              <Link href="/this-page-does-not-exist" className="font-semibold text-brand-700" target="_blank">
                /this-page-does-not-exist
              </Link>
              {" "}or a missing product such as{" "}
              <Link href="/product/no-such-product" className="font-semibold text-brand-700" target="_blank">
                /product/no-such-product
              </Link>
              .
            </p>
          </section>
        </div>

        <div className="space-y-3">
          <ComingSoonSettingsForm settings={settings} media={library} />
          <section className="rounded-2xl bg-white p-4 text-[11.5px] leading-relaxed text-ink-500 ring-1 ring-line">
            <p className="font-semibold text-ink-700">
              Launch mode is currently{" "}
              <span className={settings.comingSoon.activated ? "text-brand-700" : "text-ink-700"}>
                {settings.comingSoon.activated ? "ON — the shop is hidden from shoppers" : "OFF — the shop is live"}
              </span>
            </p>
            <p className="mt-1">
              The page is always reachable at{" "}
              <Link href="/coming-soon" className="font-semibold text-brand-700" target="_blank">
                /coming-soon
              </Link>{" "}
              so it can be shared before launch. Newsletter signups land in Marketing → Subscribers with the source{" "}
              <code className="rounded bg-surface px-1 py-0.5">coming-soon</code>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

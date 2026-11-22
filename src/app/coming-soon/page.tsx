import type { Metadata } from "next";
import { ComingSoonPage } from "@/components/coming-soon/coming-soon-page";
import { getSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = [settings.comingSoon.heading, settings.comingSoon.headingAccent].filter(Boolean).join(" ");
  return {
    title: title || "Coming soon",
    description: settings.comingSoon.newsletterLabel || settings.description,
    // A holding page should not compete with the real shop in search results
    // until the store actually switches launch mode on.
    robots: settings.comingSoon.activated ? undefined : { index: false, follow: false },
  };
}

/**
 * Coming Soon page (`/coming-soon`).
 *
 * Lives outside the storefront route group on purpose: the reference design has
 * no shop header or footer. The page is always reachable so it can be shared
 * before launch; it only *replaces* the shop when an admin switches launch mode
 * on (see the storefront layout), and the admin panel is never affected.
 */
export default async function ComingSoonRoute() {
  const settings = await getSettings();

  return (
    <ComingSoonPage
      data={{
        eyebrow: settings.comingSoon.eyebrow,
        heading: settings.comingSoon.heading,
        headingAccent: settings.comingSoon.headingAccent,
        imageUrl: settings.comingSoon.imageUrl,
        imageAlt: settings.comingSoon.imageAlt,
        newsletterEnabled: settings.comingSoon.newsletterEnabled,
        newsletterLabel: settings.comingSoon.newsletterLabel,
        subscribeLabel: settings.comingSoon.subscribeLabel,
        countdownEnabled: settings.comingSoon.countdownEnabled,
        countdownEndsAt: settings.comingSoon.countdownEndsAt,
        showSocials: settings.comingSoon.showSocials,
        contactEnabled: settings.comingSoon.contactEnabled,
        ctaEnabled: settings.comingSoon.ctaEnabled,
        ctaLabel: settings.comingSoon.ctaLabel,
        ctaHref: settings.comingSoon.ctaHref,
        showCopyright: settings.comingSoon.showCopyright,
      }}
      store={{
        name: settings.siteName,
        phone: settings.phone,
        phoneHref: settings.phoneHref,
        email: settings.email,
        address: settings.address,
        socials: settings.socials,
        copyright: settings.footer.copyright,
      }}
    />
  );
}

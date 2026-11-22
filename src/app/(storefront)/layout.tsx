import { redirect } from "next/navigation";
import { getRenderStorefrontCatalogue } from "@/lib/catalogue/repository";
import { getRenderSettings } from "@/lib/repositories/settings";
import { SiteSettingsProvider } from "@/lib/settings-provider";
import { CatalogueProvider } from "@/lib/catalogue/catalogue-provider";
import { StoreProvider } from "@/lib/store/store-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CartDrawer, WishlistDrawer } from "@/components/layout/cart-drawer";
import { Toaster } from "@/components/layout/toaster";
import { NavigationEffects } from "@/components/layout/navigation-effects";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { getCustomerSession } from "@/lib/auth/customer";
import { getSessionUser } from "@/lib/auth/session";

/**
 * Storefront shell: header, footer, cart/wishlist drawers and toasts.
 * Only routes inside this group carry the shop chrome.
 *
 * The catalogue snapshot is resolved once per request here and shared with the
 * cart, search and product widgets, so admin edits (price, stock, visibility)
 * are reflected everywhere without a redeploy.
 */
export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [catalogue, settings, shopper, admin] = await Promise.all([
    getRenderStorefrontCatalogue(), getRenderSettings(), getCustomerSession(), getSessionUser(),
  ]);

  /*
   * Launch mode (Admin → Error & launch pages). Off by default: the shop only
   * steps aside when an admin explicitly turns it on, and /coming-soon lives
   * outside this group so there is no loop. The admin panel and /api are not
   * inside this layout, so staff can keep working while the shop is closed.
   */
  if (settings.comingSoon.activated) redirect("/coming-soon");

  return (
    <SiteSettingsProvider
      settings={{
        name: settings.siteName,
        tagline: settings.tagline,
        description: settings.description,
        phone: settings.phone,
        phoneHref: settings.phoneHref,
        email: settings.email,
        address: settings.address,
        supportHours: settings.supportHours,
        socials: settings.socials,
        announcement: settings.announcement,
        freeShippingThreshold: settings.commerce.freeShippingThreshold,
        currencySymbol: settings.commerce.currencySymbol,
        footerNote: settings.footer.description,
        copyright: settings.footer.copyright,
      }}
    >
    <CatalogueProvider catalogue={catalogue}>
      <StoreProvider key={`${shopper?.id ?? "guest"}:${admin ? "staff" : "customer"}`} shopperId={shopper?.id ?? null} isAdmin={Boolean(admin)}>
      <NavigationEffects />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-brand-600 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
        <MobileBottomNav />
        <CartDrawer />
        <WishlistDrawer />
        <Toaster />
      </StoreProvider>
    </CatalogueProvider>
    </SiteSettingsProvider>
  );
}

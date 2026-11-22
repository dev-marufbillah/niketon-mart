import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/config/site";
import { configuredSiteOrigin } from "@/lib/seo/origin";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
});

/**
 * Metadata is generated from the `settings` document, so renaming the store in
 * the admin changes the browser title, social cards and SEO description.
 */
export async function generateMetadata(): Promise<Metadata> {
  let name: string = siteConfig.name;
  let tagline: string = siteConfig.tagline;
  let description: string = siteConfig.description;
  let favicon = "/favicon.svg";

  try {
    const { getRenderSettings } = await import("@/lib/repositories/settings");
    const settings = await getRenderSettings();
    name = settings.siteName || name;
    tagline = settings.tagline || tagline;
    description = settings.seo.description || settings.description || description;
    favicon = settings.faviconUrl || favicon;
  } catch {
    // Database not reachable yet — fall back to the static brand defaults.
  }

  return {
    metadataBase: configuredSiteOrigin(),
    title: {
      default: `${name} — ${tagline}`,
      template: `%s | ${name}`,
    },
    description,
    openGraph: { title: `${name} — ${tagline}`, description, type: "website" },
    icons: { icon: [{ url: favicon }] },
  };
}


export const viewport: Viewport = {
  themeColor: "#1B8057",
  width: "device-width",
  initialScale: 1,
};

/**
 * Root layout owns only the document and fonts.
 * Storefront chrome (catalogue + cart providers, header/footer/drawers) lives in
 * the `(storefront)` route group so admin screens render with their own shell.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh bg-white antialiased">
        {children}
      </body>
    </html>
  );
}

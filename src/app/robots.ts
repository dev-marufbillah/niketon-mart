import type { MetadataRoute } from "next";
import { configuredSiteOrigin } from "@/lib/seo/origin";

export const dynamic = "force-dynamic";
export default function robots(): MetadataRoute.Robots {
  const origin = configuredSiteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/my-account", "/account", "/order/", "/checkout", "/cart"] },
    ...(origin ? { sitemap: new URL("/sitemap.xml", origin).toString() } : {}),
  };
}

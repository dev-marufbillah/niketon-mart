import type { MetadataRoute } from "next";
import { configuredSiteOrigin } from "@/lib/seo/origin";

export const dynamic = "force-dynamic";
/** Only anonymously accessible pages belong in the public sitemap. Product
 * detail pages now require a session; the public catalogue remains indexable. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = configuredSiteOrigin();
  if (!origin) return [];
  const paths = ["/", "/home-grocery", "/fresh-market", "/grocery", "/categories", "/about", "/contact", "/faq", "/blogs"];
  return paths.map((path) => ({ url: new URL(path, origin).toString() }));
}

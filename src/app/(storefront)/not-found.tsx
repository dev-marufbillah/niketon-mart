import type { Metadata } from "next";
import { NotFoundView } from "@/components/system/not-found-view";
import { getSettings } from "@/lib/repositories/settings";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * Storefront 404.
 * Next.js renders this for any unknown URL inside the shop and for every
 * `notFound()` thrown by a dynamic route (product, blog post, page, category),
 * inside the shared header/footer layout, with a real 404 status.
 */
export default async function StorefrontNotFound() {
  const settings = await getSettings();
  return <NotFoundView notFound={settings.notFound} />;
}

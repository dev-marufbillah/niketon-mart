import { redirect } from "next/navigation";

/**
 * Legacy `/shop` entry point.
 *
 * The homepage nav, category tiles and old links still point at `/shop?category=…`;
 * the real listing lives at `/home-grocery`. Forwarding (instead of 404ing) keeps
 * every existing link working and preserves the query string.
 */
export default async function ShopRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    (Array.isArray(value) ? value : [value]).forEach((entry) => query.append(key, entry));
  }
  const search = query.toString();
  redirect(search ? `/home-grocery?${search}` : "/home-grocery");
}

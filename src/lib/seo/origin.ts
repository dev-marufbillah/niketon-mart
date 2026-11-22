/** Use only an explicitly configured absolute site origin for public metadata. */
export function configuredSiteOrigin(value = process.env.NEXT_PUBLIC_SITE_URL): URL | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    if ((process.env.NODE_ENV === "production" || process.env.VERCEL) && url.protocol !== "https:") return undefined;
    return new URL(url.origin);
  } catch { return undefined; }
}

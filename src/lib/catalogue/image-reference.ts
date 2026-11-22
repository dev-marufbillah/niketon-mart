/** Persistent image references supported by next.config.ts and the uploader.
 * Temporary blob:/data: URIs never belong in the database. Runtime uploads on
 * Vercel must use Blob storage, not the ephemeral /uploads filesystem. */
export function isAllowedImageReference(value: unknown, allowLocalUploads: boolean): boolean {
  if (typeof value !== "string") return false;
  const input = value.trim();
  if (!input || input.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(input)) return false;
  if (input.startsWith("/") && !input.startsWith("//")) {
    try {
      const pathname = decodeURIComponent(input.split(/[?#]/, 1)[0]);
      if (/[\u0000-\u001f\u007f\\]/.test(pathname) || pathname.split("/").some((part) => part === "." || part === "..")) return false;
      return pathname.startsWith("/images/") || (allowLocalUploads && pathname.startsWith("/uploads/"));
    } catch { return false; }
  }
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
    const host = url.hostname.toLowerCase();
    return host === "images.unsplash.com" || host === "images.pexels.com" || /^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(host);
  } catch { return false; }
}

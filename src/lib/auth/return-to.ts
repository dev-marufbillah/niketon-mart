/** Safe internal destinations for the shared sign-in/sign-up flow. */
export const DEFAULT_ACCOUNT_DESTINATION = "/my-account/personal-information";

export function safeAccountNext(value: FormDataEntryValue | string | null | undefined): string {
  const text = typeof value === "string" ? value : "";
  // Backslashes, controls, scheme-relative URLs and very long input have no
  // legitimate use here. Never let an untrusted `next` become an open redirect.
  if (!text.startsWith("/") || text.startsWith("//") || text.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(text)) {
    return DEFAULT_ACCOUNT_DESTINATION;
  }
  try {
    const base = "https://return.invalid";
    const url = new URL(text, base);
    if (url.origin !== base) return DEFAULT_ACCOUNT_DESTINATION;
    const path = url.pathname;
    const account = /^\/my-account(?:\/(?:personal-information|orders|addresses|payment-methods|password))?$/.test(path);
    const product = /^\/product\/[a-z0-9][a-z0-9-]{0,79}$/.test(path);
    const shopping = path === "/cart" || path === "/wishlist" || path === "/checkout";
    const admin = /^\/admin(?:\/[a-z0-9_-]+)*$/.test(path) && !["/admin/login", "/admin/setup", "/admin/forgot-password"].includes(path);
    if (!account && !product && !shopping && !admin) return DEFAULT_ACCOUNT_DESTINATION;
    const hash = /^#[a-zA-Z0-9_-]{1,64}$/.test(url.hash) ? url.hash : "";
    return `${path}${url.search}${hash}`;
  } catch {
    return DEFAULT_ACCOUNT_DESTINATION;
  }
}

export function isAdminDestination(next: string): boolean {
  return next === "/admin" || next.startsWith("/admin/") || next.startsWith("/admin?");
}

export function registrationHref(next: string): string {
  return `/my-account/register?next=${encodeURIComponent(safeAccountNext(next))}`;
}

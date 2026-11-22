import "server-only";

/** Only intentional server configuration can change the installation's owner. */
export function superAdminEmail(): string {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "marufsalauddin76@gmail.com").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("SUPER_ADMIN_EMAIL is invalid.");
  return email;
}
export function isSuperAdminIdentity(email: unknown): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === superAdminEmail();
}

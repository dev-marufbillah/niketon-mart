import "server-only";

/** Real transactional delivery through Resend. Never log a setup URL or token. */
function configuration(audience: "admin" | "customer" = "admin") {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = audience === "customer"
    ? process.env.CUSTOMER_EMAIL_FROM?.trim() || process.env.ADMIN_EMAIL_FROM?.trim()
    : process.env.ADMIN_EMAIL_FROM?.trim();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!key || !from || !origin) return null;
  let url: URL;
  try { url = new URL(origin); } catch { return null; }
  const production = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  if ((production && url.protocol !== "https:") || !["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
  let endpoint = "https://api.resend.com/emails";
  // Only a deliberately configured loopback mock in development; never usable on Vercel.
  if (!production && process.env.ADMIN_MAIL_TEST_URL) {
    try {
      const test = new URL(process.env.ADMIN_MAIL_TEST_URL);
      if (test.protocol !== "http:" || test.hostname !== "127.0.0.1") return null;
      endpoint = test.toString();
    } catch { return null; }
  }
  return { key, from, origin: url.origin, endpoint };
}
export function isAdminMailConfigured(): boolean { return Boolean(configuration()); }
export function isCustomerMailConfigured(): boolean { return Boolean(configuration("customer")); }

export async function sendAdminLink(email: string, token: string, kind: "invite" | "reset"): Promise<boolean> {
  const config = configuration();
  if (!config) return false;
  const link = `${config.origin}/admin/setup?purpose=${kind}#token=${encodeURIComponent(token)}`;
  const subject = kind === "invite" ? "Your Niketon Mart admin invitation" : "Reset your Niketon Mart admin password";
  const text = kind === "invite"
    ? `You have been invited to manage Niketon Mart. Set your own password using this single-use link within 48 hours:\n\n${link}\n\nIf you did not expect this invitation, ignore this email.`
    : `Use this single-use link within 30 minutes to reset your Niketon Mart admin password:\n\n${link}\n\nIf you did not request this, ignore this email.`;
  try {
    const response = await fetch(config.endpoint, {
      method: "POST", headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [email], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch { return false; }
}

/** Provider acceptance is not inbox delivery. Links stay in URL fragments and
 * raw tokens never go to application logs, analytics or database rows. */
export async function sendCustomerLink(email: string, token: string, kind: "verify" | "reset"): Promise<boolean> {
  const config = configuration("customer");
  if (!config) return false;
  const path = kind === "verify" ? "/my-account/verify-email" : "/my-account/reset-password";
  const link = `${config.origin}${path}#token=${encodeURIComponent(token)}`;
  const subject = kind === "verify" ? "Verify your Niketon Mart email" : "Reset your Niketon Mart password";
  const text = kind === "verify"
    ? `Verify this email address for your Niketon Mart customer account with this single-use link within one hour:\n\n${link}\n\nIf you did not request it, ignore this message.`
    : `Reset your Niketon Mart customer password using this single-use link within 30 minutes:\n\n${link}\n\nIf you did not request it, ignore this message.`;
  try {
    const response = await fetch(config.endpoint, {
      method: "POST", headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: config.from, to: [email], subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch { return false; }
}

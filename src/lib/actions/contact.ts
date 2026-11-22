"use server";

import { headers } from "next/headers";
import { ensureDatabase } from "@/lib/db";
import type { Row } from "@/lib/db/types";
import { logActivity } from "@/lib/repositories/activity";

/**
 * Contact form
 * ------------
 * Every message is validated on the server, checked for spam, stored in
 * `contact_messages` and then visible in Admin → Marketing → Contact messages.
 *
 * Spam protection has three cheap layers that need no third party:
 *  - a honeypot field that people never see but bots fill;
 *  - a minimum time-on-form (a form submitted in under two seconds is a bot);
 *  - a per-address throttle (five messages per ten minutes, kept in memory).
 *
 * Notifications: no email is sent because no provider is configured. The UI says
 * so honestly (see docs/LIMITATIONS.md §3) — it never claims a mail went out.
 */

export type ContactState = { errors?: string[]; success?: string; values?: Record<string, string> } | null;

export type ContactMessage = Row & {
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: "new" | "read" | "replied";
  source?: string;
  createdAt: string;
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const attempts = new Map<string, number[]>();

function throttled(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  return false;
}

async function clientKey(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
  return ip;
}

export async function contactAction(_state: ContactState, formData: FormData): Promise<ContactState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const honeypot = String(formData.get("website") ?? "").trim();
  const startedAt = Number(formData.get("startedAt") ?? 0);

  const values = { firstName, lastName, email, phone, subject, message };

  const errors: string[] = [];
  if (firstName.length < 2) errors.push("Enter your first name.");
  if (lastName.length < 2) errors.push("Enter your last name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("Enter a valid email address.");
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) errors.push("Enter a phone number we can reach you on.");
  }
  if (message.length < 10) errors.push("Tell us how we can help (at least 10 characters).");
  if (message.length > 4000) errors.push("Keep the message under 4000 characters.");
  // Validation comes first so a real person always sees what to fix. Only a
  // *valid* message that arrives suspiciously fast is treated as automated.
  if (errors.length) return { errors, values };
  if (honeypot || (startedAt && Date.now() - startedAt < 1500)) {
    return { errors: ["The message could not be submitted. Please review the form and try again."], values };
  }

  if (throttled(await clientKey())) {
    return {
      errors: ["You have sent several messages already. Give us a few minutes to reply, or call the store."],
      values,
    };
  }

  const db = await ensureDatabase();
  await db.insert<ContactMessage>("contact_messages", {
    name: [firstName, lastName].filter(Boolean).join(" "),
    firstName,
    lastName,
    email,
    phone,
    subject: subject || "General enquiry",
    message,
    status: "new",
    source: "contact-page",
    createdAt: new Date().toISOString(),
  });

  await logActivity({
    actor: "website",
    action: "contact",
    entity: "contact_messages",
    summary: `New contact message from ${firstName} ${lastName}`,
  });

  return {
    success:
      "Thank you — your message has been saved for the store team. No email confirmation is sent.",
  };
}

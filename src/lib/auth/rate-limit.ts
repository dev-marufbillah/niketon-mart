import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Best-effort per-instance throttle. This is NOT a distributed rate limiter:
 * production must additionally configure Vercel WAF or another shared limiter.
 * Avoid storing raw emails/IPs in the map. Never use the header as authority.
 */
const windows = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_KEYS = 10_000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function checkGoogleOAuthRateLimit(): Promise<boolean> {
  const store = await headers();
  const ip = (store.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
  const key = `google-oauth:ip:${digest(ip)}`;
  const now = Date.now();
  if (windows.size > MAX_KEYS) {
    for (const [entry, timestamps] of windows) {
      if (!timestamps.some((time) => now - time < WINDOW_MS)) windows.delete(entry);
      if (windows.size <= MAX_KEYS) break;
    }
    if (windows.size > MAX_KEYS) return false;
  }
  const recent = (windows.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= 30) return false;
  windows.set(key, [...recent, now]);
  return true;
}

export async function checkLoginRateLimit(scope: "admin" | "customer" | "admin-invite" | "admin-setup" | "admin-reset" | "customer-reset" | "customer-setup" | "customer-email" | "order-access", email: string): Promise<boolean> {
  const store = await headers();
  const ip = (store.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
  const keys = [`${scope}:email:${digest(email.trim().toLowerCase())}`, `${scope}:ip:${digest(ip)}`];
  const limits = [8, 30];
  const now = Date.now();
  if (windows.size > MAX_KEYS) {
    for (const [key, timestamps] of windows) {
      const recent = timestamps.filter((time) => now - time < WINDOW_MS);
      if (!recent.length) windows.delete(key);
      if (windows.size <= MAX_KEYS) break;
    }
    // Avoid unbounded per-instance memory in the face of arbitrary headers.
    if (windows.size > MAX_KEYS) return false;
  }
  const current = keys.map((key) => (windows.get(key) ?? []).filter((time) => now - time < WINDOW_MS));
  if (current.some((attempts, index) => attempts.length >= limits[index])) return false;
  keys.forEach((key, index) => windows.set(key, [...current[index], now]));
  return true;
}

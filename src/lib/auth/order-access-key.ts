import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Order } from "@/lib/repositories/orders";

/** New order credentials are stored as SHA-256 digests, not bearer keys. */
export const hashOrderAccessKey = (key: string) => createHash("sha256").update(key).digest("hex");
export function verifyOrderAccessKey(order: Pick<Order, "accessToken" | "accessTokenHash">, key: string): boolean {
  if (!/^[a-f0-9]{32,64}$/i.test(key)) return false;
  if (order.accessTokenHash && /^[a-f0-9]{64}$/i.test(order.accessTokenHash)) {
    return timingSafeEqual(Buffer.from(order.accessTokenHash, "hex"), Buffer.from(hashOrderAccessKey(key), "hex"));
  }
  // Existing plaintext random keys remain valid until a reviewed migration.
  const stored = order.accessToken ?? "";
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(key, "utf8");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

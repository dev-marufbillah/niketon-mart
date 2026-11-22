"use server";

import { getCustomerSession } from "@/lib/auth/customer";
import { getAccountWishlist, saveAccountWishlist, type WishlistItem } from "@/lib/repositories/wishlists";

export type WishlistResult =
  | { ok: true; shareToken: string | null; items: WishlistItem[]; updatedAt: string | null }
  | { ok: false; error: string };

/** Only the server-verified session selects the owner. The expected id is a
 * rejection-only guard against a stale tab writing after an account switch. */
async function shopperFor(expectedShopperId: string) {
  const user = await getCustomerSession();
  return user && user.id === expectedShopperId ? user : null;
}

export async function loadWishlistAction(expectedShopperId: string): Promise<WishlistResult> {
  try {
    const user = await shopperFor(expectedShopperId);
    if (!user) return { ok: false, error: "Your session changed. Please sign in again and refresh." };
    const list = await getAccountWishlist(user.id);
    return { ok: true, shareToken: list?.shareToken && list.shareToken !== list.token ? list.shareToken : null, items: list?.items ?? [], updatedAt: list?.updatedAt ?? null };
  } catch {
    console.error("[wishlist] load failed");
    return { ok: false, error: "We could not load your wishlist. Please try again." };
  }
}

export async function syncWishlistAction(payload: { expectedShopperId: string; items?: unknown }): Promise<WishlistResult> {
  try {
    const user = await shopperFor(payload?.expectedShopperId);
    if (!user) return { ok: false, error: "Your session changed. Please sign in again and refresh." };
    const list = await saveAccountWishlist(user.id, payload?.items ?? []);
    return { ok: true, shareToken: list?.shareToken ?? null, items: list?.items ?? [], updatedAt: list?.updatedAt ?? null };
  } catch {
    console.error("[wishlist] sync failed");
    return { ok: false, error: "We could not save your wishlist. Please try again." };
  }
}

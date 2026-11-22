"use server";

import { quoteCart, type Quote } from "@/lib/checkout/quote";
import { parseCartItems } from "@/lib/checkout/parse-items";
import { getCustomerSession } from "@/lib/auth/customer";

/**
 * Cart quote.
 * The cart and the checkout summary call this whenever the basket, the coupon or
 * the delivery area changes. It re-reads the catalogue and returns authoritative
 * prices, stock ceilings, discount, delivery fee, tax and total — so the browser
 * only ever displays numbers the server calculated.
 */

export type QuotePayload = {
  items: {
    productId: string;
    quantity: number;
    variantLabel?: string;
    /** Group name → chosen option labels. The server re-derives the charge. */
    preparation?: { choices: { group: string; label: string }[]; instructions?: string };
  }[];
  couponCode?: string;
  areaId?: string;
  channel?: "grocery" | "basket";
};

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; error: string };

export async function quoteCartAction(payload: QuotePayload): Promise<QuoteResult> {
  try {
    if (!(await getCustomerSession())) return { ok: false, error: "Please sign in or create an account to use your cart." };
    const parsed = parseCartItems(payload?.items);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const items = parsed.items;

    const channel =
      payload?.channel === "basket" ? payload.channel : "grocery";

    const quote = await quoteCart({
      items,
      couponCode: typeof payload?.couponCode === "string" ? payload.couponCode.slice(0, 40) : undefined,
      areaId: typeof payload?.areaId === "string" ? payload.areaId : undefined,
      channel,
    });

    return { ok: true, quote };
  } catch {
    console.error("[cart] quote failed");
    return { ok: false, error: "We could not price your basket just now. Please refresh and try again." };
  }
}

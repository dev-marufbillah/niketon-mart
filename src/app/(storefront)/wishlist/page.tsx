import type { Metadata } from "next";
import { WishlistView } from "@/components/shop/wishlist-view";
import { SharedWishlist } from "@/components/shop/shared-wishlist";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { getSharedWishlistProducts } from "@/lib/repositories/wishlists";
import { requireShopper } from "@/lib/auth/customer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Products you saved for later at Niketon Mart.",
  robots: { index: false, follow: false },
};

/**
 * Wishlist.
 * Layout follows the approved reference: page banner → product table with the
 * yellow header and the share/clear bar → service benefits → newsletter.
 *
 * `?list=<token>` opens somebody's shared list read-only (that is what the
 * "Copy Link" button hands out) with a one-click import into your own wishlist.
 */
export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sharedToken = typeof params.list === "string" ? params.list.slice(0, 80) : "";
  const validToken = /^[a-f0-9]{16,40}$/i.test(sharedToken);
  await requireShopper(validToken ? `/wishlist?list=${encodeURIComponent(sharedToken)}` : "/wishlist");
  const shared = sharedToken ? await getSharedWishlistProducts(sharedToken) : null;

  return (
    <>
      <ShopHero title="Wishlist" current="Wishlist" />

      <section className="container-page py-8 sm:py-10">
        {shared ? (
          <SharedWishlist token={sharedToken} items={shared.items} />
        ) : sharedToken ? (
          <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-line">
            <p className="text-[16px] font-bold text-ink-800">That wishlist link is not valid</p>
            <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-ink-500">
              The list may have been cleared. Your own wishlist is still here below.
            </p>
          </div>
        ) : null}

        <WishlistView />
      </section>

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

import type { Metadata } from "next";
import { CartView } from "@/components/checkout/cart-view";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { requireShopper } from "@/lib/auth/customer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review the groceries in your cart, apply a coupon and continue to a secure checkout.",
  robots: { index: false, follow: false },
};

/**
 * Shopping cart.
 * Layout follows the approved reference: banner → product table → coupon row →
 * order summary. Cart, coupon and delivery settings are read fresh from the
 * database on every request, so an admin change is reflected immediately.
 */
export default async function CartPage() {
  await requireShopper("/cart");
  return (
    <>
      <ShopHero title="Shopping Cart" current="Shopping Cart" />
      <section className="container-page py-8 sm:py-10">
        <CartView />
      </section>
      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

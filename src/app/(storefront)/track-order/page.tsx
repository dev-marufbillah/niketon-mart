import type { Metadata } from "next";
import Link from "next/link";
import { ShopHero } from "@/components/shop/shop-hero";
import { OrderAccessForm } from "@/components/checkout/order-access-form";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Sign in or use your private confirmation key to see the status of your order.",
};

/**
 * Track your order.
 * Layout follows the approved reference: page banner → short instruction →
 * Order ID + Billing Email fields directly on the page → Track Order button →
 * service benefits → newsletter.
 *
 * The lookup requires an authenticated owner or the private key; email and
 * phone alone do not unlock an order.
 */
export default async function TrackOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const number = typeof params.number === "string" ? params.number.trim().toUpperCase() : "";

  return (
    <>
      <ShopHero title="Track Your Order" current="Track Your Order" />

      <section className="container-page py-8 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-[13px] leading-relaxed text-ink-600">
            Enter your Order ID below. Sign in to the account that placed it, or enter the private key from the
            confirmation link saved after checkout. Email notifications are not currently configured.
          </p>

          <div className="mt-6">
            <OrderAccessForm number={number} plain />
          </div>

          <p className="mt-6 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-500">
            Lost the order ID? It is the <span className="font-semibold text-ink-700">NM-…</span> reference at the top
            of your confirmation. Our team can also look an order up for you —{" "}
            <Link href="/contact" className="font-semibold text-brand-700 underline">
              contact us
            </Link>{" "}
            with as much detail as you have.
          </p>
        </div>
      </section>

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

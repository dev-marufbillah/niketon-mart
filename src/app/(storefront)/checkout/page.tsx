import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { getAvailableCheckoutMethods, getDeliveryAreas } from "@/lib/repositories/operations";
import { getSettings } from "@/lib/repositories/settings";
import { getCustomerProfile, requireShopper } from "@/lib/auth/customer";
import { listAddresses, toSavedAddress } from "@/lib/repositories/accounts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Enter your delivery details, choose a payment method and place your grocery order.",
  robots: { index: false, follow: false },
};

/**
 * Checkout.
 * Layout follows the approved reference: page banner → billing step → payment
 * step → order completed. Every delivery area, time slot, fee and payment
 * method below is read from the admin-managed collections on each request.
 */
export default async function CheckoutPage() {
  const shopper = await requireShopper("/checkout");
  const [areas, methods, settings] = await Promise.all([
    getDeliveryAreas(),
    getAvailableCheckoutMethods(),
    getSettings(),
  ]);

  // Signed-in shoppers get only their own saved addresses and preferences.
  const safetyHold = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  const profile = await getCustomerProfile();
  const account = profile
    ? {
        firstName: profile.firstName ?? profile.name.split(" ")[0] ?? "",
        lastName: profile.lastName ?? profile.name.split(" ").slice(1).join(" ") ?? "",
        email: profile.email,
        phone: profile.phone,
        addresses: (await listAddresses(profile.id)).map(toSavedAddress),
        defaultPaymentMethodId:
          profile.defaultPaymentMethodId && methods.some((method) => method.id === profile.defaultPaymentMethodId)
            ? profile.defaultPaymentMethodId
            : undefined,
      }
    : null;

  return (
    <>
      <ShopHero title="Checkout" current="Checkout" parent={{ label: "Shopping Cart", href: "/cart" }} />

      <section className="container-page py-8 sm:py-10">
        {safetyHold || areas.length === 0 || methods.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 ring-1 ring-line">
            <p className="text-[15px] font-bold text-ink-900">Checkout is not available right now</p>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-ink-500">
              {safetyHold ? "Online ordering is temporarily paused. Please contact the store." : areas.length === 0
                ? "No delivery area is enabled at the moment, so we cannot take orders. Please contact the store."
                : "No payment method is enabled at the moment, so we cannot take orders. Please contact the store."}
            </p>
          </div>
        ) : (
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-white ring-1 ring-line" />}>
            <CheckoutFlow
              key={shopper.id}
              shopperId={shopper.id}
              account={account}
              areas={areas.map((area) => ({
                id: area.id,
                name: area.name,
                fee: area.fee,
                minOrder: area.minOrder,
                eta: area.eta,
                note: area.note,
                slots: area.slots ?? [],
              }))}
              methods={methods.map((method) => ({
                id: method.id,
                label: method.label,
                description: method.description,
                type: method.type,
                mode: method.mode,
                instructions: method.instructions,
                requiresReference: method.requiresReference,
              }))}
              settings={{
                ...settings.checkout,
                currencySymbol: settings.commerce.currencySymbol,
                taxRate: settings.commerce.taxRate,
                minOrderValue: settings.commerce.minOrderValue,
                freeShippingThreshold: settings.commerce.freeShippingThreshold,
              }}
            />
          </Suspense>
        )}
      </section>

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

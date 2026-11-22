import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";

/**
 * Sign-in / create-account frame. Deliberately outside the dashboard layout:
 * each page can inspect its own safe return destination before redirecting an
 * already signed-in shopper. Staff and customers share this same form.
 */
export default function AccountAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ShopHero title="My Account" current="My Account" />
      <section className="container-page py-9 sm:py-12">{children}</section>
      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

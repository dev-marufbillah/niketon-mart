import type { Metadata } from "next";
import { getShopData } from "@/lib/catalogue/repository";
import { shopRequestKey } from "@/lib/catalogue/query";
import { ShopHero } from "@/components/shop/shop-hero";
import { ShopBrowser } from "@/components/shop/shop-browser";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";

export const metadata: Metadata = {
  title: "Shop — Home Grocery",
  description:
    "Browse fresh produce, dairy, bakery and household essentials. Filter by category, price, rating, brand and availability.",
};

/** Data + filter state are request-specific, so this page is always rendered live. */
export const dynamic = "force-dynamic";

export default async function HomeGroceryShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, shop] = await Promise.all([searchParams, getShopData()]);

  return (
    <>
      <ShopHero current="Home Grocery" />
      <ShopBrowser key={shopRequestKey("/home-grocery", params)} products={shop.products} facets={shop.facets} initialSearchParams={params} />
      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

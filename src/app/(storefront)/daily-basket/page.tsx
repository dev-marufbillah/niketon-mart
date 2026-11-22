import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBaskets, resolveBasketItems } from "@/lib/repositories/packages";
import { formatPrice } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily baskets",
  description: "Ready-made weekly baskets packed with everyday essentials, priced as one package.",
};

export default async function DailyBasketPage() {
  const baskets = await getBaskets();
  const resolved = await Promise.all(
    baskets.map(async (basket) => ({ basket, items: await resolveBasketItems(basket) })),
  );

  return (
    <div className="container-page py-10">
      <header className="max-w-2xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-brand-600">Daily basket</p>
        <h1 className="mt-2 text-[28px] font-extrabold leading-tight text-ink-900 sm:text-[36px]">
          One basket, <span className="text-brand-600">everything you need</span>
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">
          Curated packages at a lower price than buying each item separately. Built by our team and managed in
          the admin panel, so contents and prices are always current.
        </p>
      </header>

      {resolved.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-white p-6 text-[13px] text-ink-500 ring-1 ring-line">
          No baskets are available right now. Please check back soon.
        </p>
      ) : (
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {resolved.map(({ basket, items }) => {
            const savings = basket.compareAtPrice ? basket.compareAtPrice - basket.price : 0;
            return (
              <li key={basket.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
                <div className="relative aspect-[16/8] bg-surface">
                  {basket.image ? (
                    <Image src={basket.image} alt={basket.name} fill sizes="(max-width: 768px) 92vw, 520px" className="object-cover" />
                  ) : null}
                  <span className="absolute left-3 top-3 rounded-full bg-brand-600 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white">
                    {basket.cadence}
                  </span>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[17px] font-extrabold text-ink-900">{basket.name}</h2>
                    <div className="text-right">
                      <p className="text-[17px] font-extrabold text-ink-900">{formatPrice(basket.price)}</p>
                      {basket.compareAtPrice ? (
                        <p className="text-[11.5px] text-ink-400 line-through">{formatPrice(basket.compareAtPrice)}</p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">{basket.description}</p>

                  {savings > 0 ? (
                    <p className="mt-2 inline-flex rounded-full bg-accent-100 px-2.5 py-1 text-[11px] font-bold text-accent-700">
                      Save {formatPrice(savings)}
                    </p>
                  ) : null}

                  <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                    {items.map(({ product, quantity }) => (
                      <li key={product.id} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="min-w-0 flex-1 truncate text-ink-600">
                          {quantity} × {product.name}
                        </span>
                        <span className="text-ink-400">{formatPrice(product.price * quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  {items.length !== basket.items.length ? (
                    <p className="mt-2 text-[11px] text-accent-700">
                      Some items are temporarily unavailable and are not included.
                    </p>
                  ) : null}

                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/product/${items[0]?.product.slug ?? ""}`}
                      className={`inline-flex h-10 flex-1 items-center justify-center rounded-full text-[12.5px] font-bold ${
                        basket.available
                          ? "bg-brand-600 text-white hover:bg-brand-700"
                          : "bg-surface text-ink-400"
                      }`}
                      aria-disabled={!basket.available}
                    >
                      {basket.available ? "Shop the items" : "Currently unavailable"}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-[12.5px] text-ink-400">
        Want a specific cut? <Link href="/shop?category=fish" className="font-semibold text-brand-700">Browse the fresh fish counter →</Link>
      </p>
    </div>
  );
}

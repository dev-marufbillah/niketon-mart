"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Facebook, Heart, Link2, Loader2, Minus, Plus, Star, Truck } from "lucide-react";
import type { Brand, Category, Product, ProductType } from "@/lib/types/domain";
import type { PublicReview, ReviewSummary } from "@/lib/reviews/model";
import { ProductGallery } from "@/components/product/product-gallery";
import { PreparationPicker } from "@/components/product/preparation-picker";
import { AdditionalInformation } from "@/components/product/additional-info";
import { ReviewSection } from "@/components/product/review-section";
import { useStore } from "@/lib/store/store-provider";
import { unitCompareAt, unitPrice, unitStock } from "@/lib/store/cart-line";
import { catalogueDisplayPrice } from "@/lib/catalogue/display-price";
import {
  defaultPreparationSelections,
  maxInstructionLength,
  preparationCharge,
  preparationEnabled,
  toCartPreparation,
} from "@/lib/preparation/model";
import { cn } from "@/lib/utils/cn";
import { formatPrice } from "@/lib/utils/format";

/**
 * The complete Product Details experience.
 *
 * One page, one client island: the gallery, the variation selector, the price,
 * the Add to Cart / Buy Now actions and the three tabs (Description, Additional
 * Information, Reviews) all share the same selection, so switching tabs never
 * loses the chosen product context.
 */

type TabKey = "description" | "additional" | "review";

const tabs: { key: TabKey; label: string; id: string }[] = [
  { key: "description", label: "Description", id: "tab-description" },
  { key: "additional", label: "Additional Information", id: "tab-additional" },
  { key: "review", label: "Review", id: "tab-review" },
];

function discountPercent(price: number, compareAt?: number) {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function ProductExperience({
  product,
  reviews,
  summary,
  category,
  brand,
  productType,
  reviewer,
  preparationNote,
  weightDisclaimer,
}: {
  product: Product;
  reviews: PublicReview[];
  summary: ReviewSummary;
  category: Category | null;
  brand: Brand | null;
  productType: ProductType | null;
  /** Signed-in shopper, used to prefill the review form. */
  reviewer?: { name: string; email: string };
  /** Admin copy from Settings → Fresh market. */
  preparationNote?: string;
  weightDisclaimer?: string;
}) {
  const router = useRouter();
  const { addToCart, wishlist, toggleWishlist } = useStore();

  const [tab, setTab] = useState<TabKey>("description");

  // Deep links such as /product/x#review (used by "Add Review" in My Orders)
  // open the matching tab instead of dumping the shopper on Description.
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "review" || hash === "additional" || hash === "description") setTab(hash as TabKey);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);
  const [quantity, setQuantity] = useState(() => Math.max(1, product.selling?.minQuantity ?? 1));
  const hasPreparation = preparationEnabled(product);
  const [prepSelections, setPrepSelections] = useState<Record<string, string[]>>(() =>
    defaultPreparationSelections(product.preparation),
  );
  const [prepInstructions, setPrepInstructions] = useState("");
  const prepCharge = preparationCharge(product.preparation, prepSelections);
  const [adding, setAdding] = useState(false);
  const [buying, setBuying] = useState(false);
  const [copied, setCopied] = useState(false);

  const groups = (product.options ?? []).filter((group) => group.values.length > 0);
  const variationNeedsReview = catalogueDisplayPrice(product).amount === undefined;
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of product.options ?? []) {
      const value = group.values.find((entry) => entry.isDefault) ?? group.values[0];
      if (value) initial[group.name] = value.label;
    }
    return initial;
  });

  const variantLabel = useMemo(
    () =>
      groups
        .map((group) => selection[group.name])
        .filter(Boolean)
        .join(" · ") || undefined,
    [groups, selection],
  );

  const basePrice = unitPrice(product, variantLabel);
  const price = basePrice + prepCharge;
  const compareAt = unitCompareAt(product, variantLabel);
  const stock = unitStock(product, variantLabel);
  const soldOut = stock <= 0;
  const off = discountPercent(price, compareAt);
  const saved = wishlist.includes(product.id);

  const variantImage = useMemo(() => {
    for (const group of groups) {
      const value = group.values.find((entry) => entry.label === selection[group.name]);
      if (value?.image) return value.image;
    }
    return undefined;
  }, [groups, selection]);

  const pick = (groupName: string, label: string) => {
    setSelection((current) => ({ ...current, [groupName]: label }));
    setQuantity(Math.max(1, product.selling?.minQuantity ?? 1));
  };

  const step = Math.max(1, product.selling?.step ?? 1);
  const minQuantity = Math.max(1, product.selling?.minQuantity ?? 1);
  const instructionsLimit = maxInstructionLength(product.preparation);

  const preparationPayload = () =>
    hasPreparation
      ? toCartPreparation(product.preparation, prepSelections, prepInstructions)
      : undefined;

  const add = async () => {
    if (soldOut || adding || variationNeedsReview) return;
    setAdding(true);
    await addToCart(product.id, quantity, variantLabel, preparationPayload());
    setAdding(false);
  };

  const buyNow = async () => {
    if (soldOut || buying || variationNeedsReview) return;
    setBuying(true);
    await addToCart(product.id, quantity, variantLabel, preparationPayload());
    router.push("/checkout");
  };

  // Resolved after mount so the server render and the client render match.
  const [shareUrl, setShareUrl] = useState(`/product/${product.slug}`);
  useEffect(() => {
    const timer = window.setTimeout(() => setShareUrl(window.location.href), 0);
    return () => window.clearTimeout(timer);
  }, [product.slug]);
  const shareText = `${product.name} at Niketon Mart`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const ratingStars = Math.round(summary.average);

  return (
    <section className="bg-white py-8">
      <div className="container-page">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
          <ProductGallery
            images={product.images && product.images.length > 0 ? product.images : [product.image]}
            name={product.name}
            imageMode={product.imageMode}
            discount={variationNeedsReview ? null : off}
            activeImage={variantImage}
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {category ? (
                <Link
                  href={`/home-grocery?category=${category.id}`}
                  className="text-[12.5px] font-semibold text-brand-600 transition-colors hover:text-brand-800"
                >
                  {product.categoryLabel}
                </Link>
              ) : (
                <span className="text-[12.5px] font-semibold text-brand-600">{product.categoryLabel}</span>
              )}
              {brand ? <span className="text-[12px] text-ink-300">•</span> : null}
              {brand ? <span className="text-[12.5px] text-ink-500">{brand.name}</span> : null}
              {productType ? (
                <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink-500">
                  {productType.name}
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-[26px] leading-tight text-ink-900 sm:text-[32px]">{product.name}</h1>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide",
                  soldOut
                    ? "bg-ink-100 text-ink-500"
                    : stock <= 10
                      ? "bg-accent-100 text-accent-700"
                      : "bg-brand-50 text-brand-700",
                )}
              >
                {soldOut ? "Out of stock" : stock <= 10 ? `Only ${stock} left` : "In stock"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    size={15}
                    strokeWidth={1.5}
                    className={index < ratingStars ? "fill-star text-star" : "fill-ink-200 text-ink-200"}
                  />
                ))}
              </span>
              <span className="text-[13px] font-bold text-ink-800 tabular-nums">
                {summary.average.toFixed(1)}
              </span>
              <span className="text-[12.5px] text-ink-400">
                ({summary.total} Review{summary.total === 1 ? "" : "s"})
              </span>
              <span className="text-[12px] text-ink-300">·</span>
              <span className="text-[12.5px] text-ink-500">{product.unit}</span>
            </div>

            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <span
                data-pdp-price
                className="text-[30px] font-extrabold leading-none text-ink-900 tabular-nums"
              >
                {variationNeedsReview ? "Price under review" : formatPrice(price)}
              </span>
              {!variationNeedsReview && compareAt && compareAt > price ? (
                <span className="text-[15px] text-ink-400 line-through tabular-nums">
                  {formatPrice(compareAt)}
                </span>
              ) : null}
              {!variationNeedsReview && off !== null ? (
                <span className="rounded-full bg-accent-100 px-2.5 py-1 text-[11.5px] font-bold text-accent-700">
                  Save {off}%
                </span>
              ) : null}
              {!variationNeedsReview && prepCharge > 0 ? (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">
                  includes +{formatPrice(prepCharge)} preparation
                </span>
              ) : null}
            </div>
            {product.selling?.estimatedWeight ? (
              <p className="mt-1.5 text-[11.5px] text-ink-500">
                {product.selling.estimatedWeight}
                {product.selling.variableWeight ? " · Any increase above the estimate requires your explicit approval." : ""}
                {product.selling.variableWeight && weightDisclaimer && !weightDisclaimer.includes("total is adjusted by the same per-kg rate") ? ` ${weightDisclaimer}` : ""}
              </p>
            ) : null}

            <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-ink-600">{product.description}</p>
            {variationNeedsReview ? (
              <p role="status" className="mt-3 rounded-xl bg-surface px-3 py-2 text-[12px] text-ink-600">
                This product&apos;s price or options need store review. Please contact the store before ordering.
              </p>
            ) : null}

            {groups.length > 0 ? (
              <div className="mt-5 space-y-3">
                {groups.map((group) => (
                  <div key={group.name} role="group" aria-label={group.name}>
                    <p className="mb-1.5 text-[12.5px] font-semibold text-ink-700">
                      {group.name}
                      {selection[group.name] ? (
                        <span className="ml-2 font-normal text-ink-400">{selection[group.name]}</span>
                      ) : null}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.values.map((value) => {
                        const active = selection[group.name] === value.label;
                        const valueStock = typeof value.stock === "number" ? value.stock : product.stock ?? 0;
                        return (
                          <button
                            key={value.label}
                            type="button"
                            onClick={() => pick(group.name, value.label)}
                            aria-pressed={active}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
                              active
                                ? "border-brand-600 bg-brand-50 text-brand-800"
                                : "border-line bg-white text-ink-600 hover:border-brand-300 hover:text-brand-700",
                              valueStock <= 0 && "opacity-50",
                            )}
                          >
                            {value.label}
                            {valueStock <= 0 ? <span className="text-[10px] uppercase">sold out</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {hasPreparation ? (
              <PreparationPicker
                product={product}
                selections={prepSelections}
                onChange={setPrepSelections}
                instructions={prepInstructions}
                onInstructionsChange={(value) => setPrepInstructions(value.slice(0, instructionsLimit))}
                note={preparationNote}
              />
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <div
                className={cn(
                  "inline-flex h-12 items-center rounded-full bg-surface px-1.5 ring-1 ring-line",
                  soldOut && "opacity-50",
                )}
              >
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(minQuantity, value - step))}
                  disabled={soldOut || quantity <= minQuantity}
                  aria-label="Decrease quantity"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-white text-ink-700 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                >
                  <Minus size={15} />
                </button>
                <span className="w-10 text-center text-[14px] font-bold tabular-nums text-ink-900" aria-live="polite">
                  {soldOut ? 0 : quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.min(stock, value + step))}
                  disabled={soldOut || quantity >= stock}
                  aria-label="Increase quantity"
                  className="inline-flex size-9 items-center justify-center rounded-full bg-white text-ink-700 shadow-sm transition-colors hover:bg-brand-50 hover:text-brand-700 disabled:opacity-40"
                >
                  <Plus size={15} />
                </button>
              </div>

              <button
                type="button"
                onClick={add}
                disabled={soldOut || adding || variationNeedsReview}
                aria-busy={adding}
                className="inline-flex h-12 min-w-[150px] flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-[13.5px] font-semibold text-white shadow-cta transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300 disabled:shadow-none sm:flex-none"
              >
                {adding ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                Add to Cart
              </button>

              <button
                type="button"
                onClick={buyNow}
                disabled={soldOut || buying || variationNeedsReview}
                aria-busy={buying}
                className="inline-flex h-12 min-w-[130px] items-center justify-center gap-2 rounded-full bg-accent-500 px-6 text-[13.5px] font-bold text-brand-900 shadow-[0_10px_24px_-14px_rgba(216,167,12,0.9)] transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-ink-200 disabled:text-ink-500"
              >
                {buying ? <Loader2 size={16} className="animate-spin" /> : null}
                Buy Now
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-pressed={saved}
                aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                className={cn(
                  "inline-flex size-12 items-center justify-center rounded-full border transition-colors",
                  saved
                    ? "border-accent-400 bg-accent-50 text-accent-600"
                    : "border-line bg-white text-ink-500 hover:border-brand-300 hover:text-brand-700",
                )}
              >
                <Heart size={18} className={saved ? "fill-accent-500" : undefined} />
              </button>
            </div>

            {soldOut ? (
              <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-[12px] text-ink-500">
                This option is sold out. Pick another weight or{" "}
                <Link href="/contact" className="font-semibold text-brand-700 underline underline-offset-2">
                  ask us when it returns
                </Link>
                .
              </p>
            ) : null}

            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[12.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-semibold text-ink-700">SKU:</dt>
                <dd className="font-mono text-[11.5px] text-ink-500">{product.sku ?? "—"}</dd>
              </div>
              {product.tags && product.tags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="font-semibold text-ink-700">Tags:</dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {product.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={`/home-grocery?q=${encodeURIComponent(tag)}`}
                        className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-500 hover:text-brand-700"
                      >
                        {tag}
                      </Link>
                    ))}
                  </dd>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-semibold text-ink-700">Share:</dt>
                <dd className="flex items-center gap-1.5">
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on Facebook"
                    className="inline-flex size-7 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700"
                  >
                    <Facebook size={13} />
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on WhatsApp"
                    className="inline-flex size-7 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white hover:bg-brand-700"
                  >
                    W
                  </a>
                  <a
                    href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Share on X"
                    className="inline-flex size-7 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white hover:bg-brand-700"
                  >
                    X
                  </a>
                  <button
                    type="button"
                    onClick={copyLink}
                    aria-label="Copy product link"
                    className="inline-flex size-7 items-center justify-center rounded-full bg-brand-600 text-white hover:bg-brand-700"
                  >
                    <Link2 size={13} />
                  </button>
                  <span
                    role="status"
                    aria-live="polite"
                    className={cn("text-[11px] font-semibold text-brand-700", !copied && "sr-only")}
                  >
                    {copied ? "Link copied" : ""}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* ------------------------------------------------------------ tabs */}
        <div id="product-tabs" className="mt-12 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
            <div role="tablist" aria-label="Product information" className="flex flex-wrap gap-1 sm:gap-2">
              {tabs.map((entry) => {
                const active = tab === entry.key;
                return (
                  <button
                    key={entry.key}
                    id={entry.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    aria-controls="product-tab-panel"
                    onClick={() => setTab(entry.key)}
                    className={cn(
                      "-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-[13.5px] font-semibold transition-colors sm:px-4",
                      active
                        ? "border-brand-600 text-brand-700"
                        : "border-transparent text-ink-500 hover:text-ink-800",
                    )}
                  >
                    {entry.label}
                    {entry.key === "review" ? (
                      <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10.5px] font-bold text-ink-500">
                        {summary.total}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="hidden pb-3 text-[11.5px] text-ink-400 sm:block">
              {product.name} · {variantLabel ?? product.unit} · {variationNeedsReview ? "Price under review" : formatPrice(price)}
            </p>
          </div>

          <div
            id="product-tab-panel"
            role="tabpanel"
            aria-labelledby={tabs.find((entry) => entry.key === tab)?.id}
            className="pt-6"
          >
            {tab === "description" ? (
              <div className="max-w-3xl">
                <p className="text-[13.5px] leading-relaxed text-ink-600">{product.description}</p>
                {(product.details?.features ?? []).length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {(product.details?.features ?? []).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-[13px] text-ink-600">
                        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                          <Check size={12} strokeWidth={3} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {product.details?.storage ? (
                  <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink-500">
                    <span className="font-semibold text-ink-700">Storage: </span>
                    {product.details.storage}
                  </p>
                ) : null}
                <p className="mt-4 text-[12px] text-ink-400">
                  Looking for specifications?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("additional")}
                    className="font-semibold text-brand-700 underline underline-offset-2"
                  >
                    Open Additional Information
                  </button>
                  .
                </p>
              </div>
            ) : null}

            {tab === "additional" ? <AdditionalInformation product={product} /> : null}

            {tab === "review" ? (
              <ReviewSection
                productId={product.id}
                productName={product.name}
                reviews={reviews}
                summary={summary}
                defaultName={reviewer?.name}
                defaultEmail={reviewer?.email}
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

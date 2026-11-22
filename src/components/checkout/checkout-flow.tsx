"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  Banknote,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  Loader2,
  Lock,
  MapPin,
  Smartphone,
  Truck,
} from "lucide-react";
import { useStore } from "@/lib/store/store-provider";
import { cartLineKey } from "@/lib/store/cart-line";
import { quoteCartAction } from "@/lib/actions/cart";
import { checkoutAction, type CheckoutState } from "@/lib/actions/checkout";
import type { Quote } from "@/lib/checkout/quote";
import type {
  CheckoutAreaOption,
  CheckoutMethodOption,
  CheckoutSettings,
  SavedAddress,
} from "@/lib/checkout/view-types";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Checkout — one connected journey.
 *
 *   Shopping cart → Billing address → Payment → Order completed
 *
 * Both steps live on the same route (`/checkout` and `/checkout?step=payment`)
 * and share one draft, persisted in sessionStorage so a refresh — or a trip back
 * to fix an address — never loses what was typed. The payment step posts one
 * payload; the server re-prices everything and writes the order. The completed
 * page is only reachable with the order's access token.
 */

type Draft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  address: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  areaId: string;
  deliverySlot: string;
  notes: string;
  billingSameAsDelivery: "same" | "different";
  billingAddress: string;
  billingCity: string;
  billingPostalCode: string;
  paymentMethodId: string;
  paymentReference: string;
  acceptTerms: boolean;
  saveAddress: boolean;
  idempotencyKey: string;
};

// Keep legacy unscoped drafts and addresses untouched, never auto-assign them
// to a different signed-in customer on a shared browser.
const DRAFT_KEY = "nm.checkout.v3:";

const field =
  "h-11 w-full rounded-xl border bg-white px-3.5 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";
const labelClass = "mb-1.5 block text-[12.5px] font-semibold text-ink-700";

function newIdempotencyKey() {
  try {
    return crypto.randomUUID();
  } catch {
    return `ck-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

/**
 * Starting point for the area picker: the cheapest active area, which is the
 * same fee the cart quotes before an address is known. Shoppers switch to their
 * own zone and the fee updates live.
 */
function defaultAreaId(areas: CheckoutAreaOption[]): string {
  return [...areas].sort((a, b) => a.fee - b.fee || a.name.localeCompare(b.name))[0]?.id ?? "";
}

function emptyDraft(areaId: string, methodId: string): Draft {
  return {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    company: "",
    address: "",
    addressLine2: "",
    city: "",
    postalCode: "",
    areaId,
    deliverySlot: "",
    notes: "",
    billingSameAsDelivery: "same",
    billingAddress: "",
    billingCity: "",
    billingPostalCode: "",
    paymentMethodId: methodId,
    paymentReference: "",
    acceptTerms: false,
    saveAddress: false,
    idempotencyKey: newIdempotencyKey(),
  };
}

function methodIcon(type: CheckoutMethodOption["type"]) {
  if (type === "cod") return Banknote;
  if (type === "wallet") return Smartphone;
  return CreditCard;
}

function PlaceOrderButton({
  total,
  label,
  blocked,
}: {
  total: number;
  label: string;
  blocked?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || blocked}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 text-[14px] font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : null}
      {pending ? "Placing your order…" : `${label} · ${formatPrice(total)}`}
    </button>
  );
}

function StepBar({ step }: { step: "address" | "payment" }) {
  const steps = [
    { key: "address", label: "Billing details" },
    { key: "payment", label: "Payment" },
    { key: "done", label: "Order completed" },
  ] as const;
  const activeIndex = step === "address" ? 0 : 1;

  return (
    <ol
      className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-[12px] font-semibold"
      aria-label="Checkout progress"
    >
      {steps.map((entry, index) => {
        const state = index < activeIndex ? "done" : index === activeIndex ? "current" : "todo";
        return (
          <li key={entry.key} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                state === "done" && "bg-brand-600 text-white",
                state === "current" && "bg-accent-500 text-ink-900",
                state === "todo" && "bg-white text-ink-400 ring-1 ring-line",
              )}
              aria-current={state === "current" ? "step" : undefined}
            >
              {state === "done" ? <Check size={12} strokeWidth={3} /> : index + 1}
            </span>
            <span className={cn(state === "todo" ? "text-ink-400" : "text-ink-800")}>{entry.label}</span>
            {index < steps.length - 1 ? <ChevronRight size={13} className="text-ink-300" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function CheckoutFlow({
  areas,
  methods,
  settings,
  account,
  shopperId,
  channel = "grocery",
}: {
  shopperId: string;
  areas: CheckoutAreaOption[];
  methods: CheckoutMethodOption[];
  settings: CheckoutSettings;
  channel?: "grocery" | "basket";
  /** The current signed-in shopper profile, if still available. */
  account?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    addresses: SavedAddress[];
    defaultPaymentMethodId?: string;
  } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, coupon, subtotal, isHydrated, clearCart } = useStore();
  const [state, formAction] = useActionState<CheckoutState, FormData>(checkoutAction, null);

  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultAreaId(areas), methods[0]?.id ?? ""));
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteRevision, setQuoteRevision] = useState(0);
  // Acknowledgement is tied to this exact server response, not future conflicts.
  const [acknowledgedConflict, setAcknowledgedConflict] = useState<CheckoutState>(null);
  const retryConflictAcknowledged = Boolean(state && state === acknowledgedConflict);
  const savedAddresses = account?.addresses ?? [];
  const draftKey = `${DRAFT_KEY}${shopperId}`;
  const topRef = useRef<HTMLDivElement>(null);

  const step: "address" | "payment" = searchParams.get("step") === "payment" ? "payment" : "address";

  /* ---------------------- restore the draft once ---------------------- */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(draftKey);
        const stored = raw ? (JSON.parse(raw) as Partial<Draft>) : null;
        setDraft((current) => {
        const merged: Draft = { ...current, ...stored };
        if (!areas.some((area) => area.id === merged.areaId)) merged.areaId = defaultAreaId(areas);
        if (!methods.some((method) => method.id === merged.paymentMethodId)) {
          merged.paymentMethodId = methods[0]?.id ?? "";
        }
        if (!merged.idempotencyKey) merged.idempotencyKey = newIdempotencyKey();
        return merged;
        });
        // Only server-owned addresses for the current signed-in account are shown.
        // Unscoped browser addresses may belong to a previous user; leave them untouched.
        const accountAddresses = account?.addresses ?? [];

        // Prefill the form from the account the first time this browser checks out.
        const hasDraft = Boolean(stored?.address);
        if (account && !hasDraft) {
        const preferred = accountAddresses[0];
        setDraft((current) => ({
          ...current,
          firstName: current.firstName || account.firstName,
          lastName: current.lastName || account.lastName,
          email: current.email || account.email,
          phone: current.phone || account.phone,
          address: preferred?.address ?? current.address,
          addressLine2: preferred?.addressLine2 ?? current.addressLine2,
          city: preferred?.city ?? current.city,
          postalCode: preferred?.postalCode ?? current.postalCode,
          company: preferred?.company ?? current.company,
          areaId:
            preferred && areas.some((area) => area.id === preferred.areaId) ? preferred.areaId : current.areaId,
          paymentMethodId:
            account.defaultPaymentMethodId &&
            methods.some((method) => method.id === account.defaultPaymentMethodId)
              ? account.defaultPaymentMethodId
              : current.paymentMethodId,
        }));
        }
      } catch {
        /* corrupted storage — start with a blank form */
      }
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* storage full or blocked */
    }
  }, [draft, ready, draftKey]);

  /* --------------------------- server quote --------------------------- */
  const items = useMemo(
    () =>
      cart.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        variantLabel: line.variantLabel,
        preparation: line.preparation
          ? {
              choices: line.preparation.options.map((option) => ({ group: option.group, label: option.label })),
              instructions: line.preparation.instructions,
            }
          : undefined,
      })),
    [cart],
  );

  useEffect(() => {
    if (!isHydrated || items.length === 0) {
      queueMicrotask(() => setQuote(null));
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setQuoting(true);
      const result = await quoteCartAction({
        items,
        couponCode: coupon?.code,
        areaId: draft.areaId,
        channel,
      });
      if (!active) return;
      setQuoting(false);
      if (result.ok) setQuote(result.quote);
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [items, coupon?.code, draft.areaId, channel, isHydrated, quoteRevision]);

  /* ------------------------- order completion ------------------------- */
  useEffect(() => {
    if (!state?.ok) return;
    clearCart();
    try {
      window.sessionStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
    const token = "?new=1";
    // A gateway order continues on the provider's page; its verified callback
    // brings the shopper back to the order.
    if (state.redirectUrl) {
      window.location.assign(state.redirectUrl);
      return;
    }
    router.replace(`/order/${state.number}${token}`);
  }, [state, clearCart, router, draftKey]);

  const set = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }, []);

  const area = areas.find((entry) => entry.id === draft.areaId);
  const method = methods.find((entry) => entry.id === draft.paymentMethodId);
  const slots = area?.slots ?? [];

  const subtotalValue = quote?.subtotal ?? subtotal;
  const discount = quote?.discount ?? 0;
  const deliveryFee = quote?.deliveryFee ?? 0;
  const tax = quote?.tax ?? 0;
  const total = quote?.total ?? subtotalValue;
  const belowAreaMinimum = Boolean(area && subtotalValue > 0 && subtotalValue < area.minOrder);
  const stockBlocked = Boolean(quote && quote.lines.some((line) => line.shortOnStock));
  const referenceNeeded = Boolean(method?.requiresReference) && draft.paymentReference.trim().length < 6;
  const termsNeeded = Boolean(settings.termsRequired) && !draft.acceptTerms;

  const priceChanged = useMemo(() => {
    if (!quote) return false;
    return cart.some((line) => {
      const server = quote.lines.find(
        (entry) =>
          entry.productId === line.productId &&
          entry.variantLabel === line.variantLabel &&
          (entry.preparation?.signature ?? "none") === (line.preparation?.signature ?? "none"),
      );
      const expected = (line.variantPrice ?? 0) + (line.preparation?.chargePerUnit ?? 0);
      return Boolean(server && line.variantPrice && Math.abs(server.totalUnitPrice - expected) > 0.001);
    });
  }, [quote, cart]);

  /* --------------------------- step 1 submit -------------------------- */
  const validateAddress = () => {
    const next: Record<string, string> = {};
    if (draft.firstName.trim().length < 2) next.firstName = "Enter your first name.";
    if (draft.lastName.trim().length < 2) next.lastName = "Enter your last name.";
    if (draft.phone.replace(/\D/g, "").length < 7) next.phone = "Enter a phone number we can call.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (draft.address.trim().length < 8) next.address = "Enter your house, road and area.";
    if (!draft.areaId) next.areaId = "Choose the delivery area.";
    if (settings.cityEnabled && !draft.city.trim()) next.city = "Enter your city.";
    if (
      settings.billingAddressEnabled &&
      draft.billingSameAsDelivery === "different" &&
      draft.billingAddress.trim().length < 8
    ) {
      next.billingAddress = "Enter the billing address.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goToPayment = () => {
    if (!validateAddress()) {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    router.push("/checkout?step=payment");
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applySaved = (entry: SavedAddress) => {
    setDraft((current) => ({
      ...current,
      firstName: entry.firstName,
      lastName: entry.lastName,
      phone: entry.phone,
      email: entry.email,
      company: entry.company,
      address: entry.address,
      addressLine2: entry.addressLine2,
      city: entry.city,
      postalCode: entry.postalCode,
      areaId: areas.some((row) => row.id === entry.areaId) ? entry.areaId : current.areaId,
    }));
    setErrors({});
  };

  /* ---------------------------- guards ------------------------------- */
  if (!isHydrated || !ready) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]" aria-busy="true" aria-label="Loading checkout">
        <div className="h-96 animate-pulse rounded-2xl bg-white ring-1 ring-line" />
        <div className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-line" />
      </div>
    );
  }

  if (cart.length === 0 && !state?.ok) {
    return (
      <div className="rounded-2xl bg-white px-6 py-14 text-center ring-1 ring-line">
        <h2 className="text-[19px] font-extrabold text-ink-900">Your cart is empty</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-500">
          Add a few groceries and come back — your delivery details will be waiting.
        </p>
        <Link
          href="/home-grocery"
          className="mt-5 inline-flex h-11 items-center rounded-full bg-brand-600 px-5 text-[13.5px] font-semibold text-white hover:bg-brand-700"
        >
          Browse groceries
        </Link>
      </div>
    );
  }

  const err = (key: string) =>
    errors[key] ? (
      <p role="alert" className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold text-red-600">
        <AlertCircle size={12} /> {errors[key]}
      </p>
    ) : null;

  const borderFor = (key: string) => (errors[key] ? "border-red-400" : "border-line");

  /* ------------------------------ summary ----------------------------- */
  const summaryCard = (footer: React.ReactNode) => (
    <aside className="lg:sticky lg:top-[150px] lg:self-start" aria-labelledby="summary-heading">
      <div className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <h2 id="summary-heading" className="text-[15px] font-extrabold text-ink-900">
          Order Summary
        </h2>

        <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
          {cart.map((line) => {
            const server = quote?.lines.find(
              (entry) =>
                entry.productId === line.productId &&
                entry.variantLabel === line.variantLabel &&
                (entry.preparation?.signature ?? "none") === (line.preparation?.signature ?? "none"),
            );
            return (
              <li key={cartLineKey(line)} className="flex items-center gap-2.5">
                <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
                  {server ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={server.image} alt="" className="size-full object-cover" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold text-ink-800">
                    {server?.name ?? line.productId}
                  </span>
                  <span className="text-[11px] text-ink-400">
                    {line.variantLabel ? `${line.variantLabel} · ` : ""}
                    {line.quantity} × {formatPrice(server?.totalUnitPrice ?? 0)}
                  </span>
                  {line.preparation?.options.length ? (
                    <span className="block text-[10.5px] font-semibold text-brand-700">
                      {line.preparation.options.map((option) => option.label).join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span className="text-[12px] font-semibold tabular-nums text-ink-700">
                  {formatPrice(server?.lineTotal ?? 0)}
                </span>
              </li>
            );
          })}
        </ul>

        <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[12.5px]">
          <div className="flex justify-between">
            <dt className="text-ink-500">Sub Total</dt>
            <dd className="tabular-nums text-ink-800" data-summary-subtotal>
              {formatPrice(subtotalValue)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Shipping</dt>
            <dd className="tabular-nums text-ink-800" data-summary-shipping>
              {quoting && !quote ? "…" : deliveryFee === 0 ? "Free" : formatPrice(deliveryFee)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Taxes{quote?.settings.taxRate ? ` (${quote.settings.taxRate}%)` : ""}</dt>
            <dd className="tabular-nums text-ink-800" data-summary-tax>
              {formatPrice(tax)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-500">Coupon Discount</dt>
            <dd className="font-semibold tabular-nums text-brand-700" data-summary-discount>
              {discount > 0 ? `-${formatPrice(discount)}` : formatPrice(0)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2.5 text-[15px] font-extrabold text-ink-900">
            <dt>Total</dt>
            <dd className="tabular-nums" data-summary-total>
              {formatPrice(total)}
            </dd>
          </div>
        </dl>

        {coupon ? (
          <p className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-800">
            <Check size={11} /> {coupon.code} applied
          </p>
        ) : (
          <Link href="/cart" className="mt-3 block text-[11.5px] font-semibold text-brand-700 hover:underline">
            Add a coupon in your cart →
          </Link>
        )}

        {priceChanged ? (
          <p className="mt-3 rounded-xl bg-accent-50 px-3 py-2 text-[11.5px] font-semibold text-accent-800">
            Prices changed since you added these items — the current prices above are what you will be charged.
          </p>
        ) : null}

        {belowAreaMinimum && area ? (
          <p className="mt-3 rounded-xl bg-accent-50 px-3 py-2 text-[11.5px] font-semibold text-accent-700">
            Minimum order for {area.name} is {formatPrice(area.minOrder)} — add{" "}
            {formatPrice(area.minOrder - subtotalValue)} more.
          </p>
        ) : null}

        {quote && !quote.ok ? (
          <ul role="alert" className="mt-3 space-y-1 rounded-xl bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-600">
            {quote.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        ) : null}

        {state && !state.ok && state.errors.length > 0 ? (
          <div role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[12px] text-red-600">
            <ul className="space-y-1">{state.errors.map((error) => <li key={error}>{error}</li>)}</ul>
            {state.code === "IDEMPOTENCY_CONFLICT" ? (
              <div className="mt-2 flex flex-wrap gap-3 font-semibold underline">
                <Link href="/my-account/orders">Check My Orders</Link>
                {!retryConflictAcknowledged ? (
                  <button type="button" onClick={() => {
                    set("idempotencyKey", newIdempotencyKey());
                    setAcknowledgedConflict(state);
                  }}>I checked; start a new attempt</button>
                ) : <span className="no-underline">New attempt prepared. Review details before placing it.</span>}
              </div>
            ) : (
              <button type="button" className="mt-2 font-semibold underline" onClick={() => setQuoteRevision((value) => value + 1)}>Refresh prices</button>
            )}
          </div>
        ) : null}

        <div className="mt-4">{footer}</div>

        <p className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-ink-400">
          <Truck size={12} /> {deliveryFee === 0 ? "Free delivery on this order" : `Delivery ${formatPrice(deliveryFee)}`}
          {draft.deliverySlot ? (
            <>
              <Clock size={12} className="ml-1" /> {draft.deliverySlot}
            </>
          ) : null}
        </p>
      </div>
    </aside>
  );

  /* -------------------------- address step --------------------------- */
  const addressCard = (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-6" aria-labelledby="billing-heading">
      <h2 id="billing-heading" className="text-[17px] font-extrabold text-ink-900">
        Billing Details
      </h2>
      <p className="mt-0.5 text-[12px] text-ink-400">
        We only use these details to deliver this order and to reach you about it.
      </p>

      {savedAddresses.length > 0 ? (
        <div className="mt-4">
          <p className={labelClass}>Saved addresses</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {savedAddresses.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-line bg-surface/40 p-3">
                <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink-800">
                  <MapPin size={12} className="text-brand-600" /> {entry.label || "Saved address"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-ink-500">
                  {entry.address}
                  {entry.addressLine2 ? `, ${entry.addressLine2}` : ""}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => applySaved(entry)}
                    className="inline-flex h-8 items-center rounded-full bg-brand-600 px-3 text-[11.5px] font-bold text-white hover:bg-brand-700"
                  >
                    Use this address
                  </button>
                  <Link href="/my-account/addresses" className="text-[11.5px] font-semibold text-ink-500 underline hover:text-brand-700">
                    Manage addresses
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>First name *</span>
          <input
            name="firstName"
            autoComplete="given-name"
            value={draft.firstName}
            onChange={(event) => set("firstName", event.target.value)}
            placeholder="Ex. John"
            aria-invalid={Boolean(errors.firstName)}
            className={cn(field, borderFor("firstName"))}
          />
          {err("firstName")}
        </label>
        <label className="block">
          <span className={labelClass}>Last name *</span>
          <input
            name="lastName"
            autoComplete="family-name"
            value={draft.lastName}
            onChange={(event) => set("lastName", event.target.value)}
            placeholder="Ex. Doe"
            aria-invalid={Boolean(errors.lastName)}
            className={cn(field, borderFor("lastName"))}
          />
          {err("lastName")}
        </label>

        {settings.companyEnabled ? (
          <label className="block sm:col-span-2">
            <span className={labelClass}>Company name (optional)</span>
            <input
              name="company"
              autoComplete="organization"
              value={draft.company}
              onChange={(event) => set("company", event.target.value)}
              placeholder="For a business invoice"
              className={cn(field, borderFor("company"))}
            />
          </label>
        ) : null}

        <label className="block sm:col-span-2">
          <span className={labelClass}>Street address *</span>
          <input
            name="address"
            autoComplete="street-address"
            value={draft.address}
            onChange={(event) => set("address", event.target.value)}
            placeholder="House 12, Road 5, Dhanmondi"
            aria-invalid={Boolean(errors.address)}
            className={cn(field, borderFor("address"))}
          />
          {err("address")}
        </label>

        {settings.addressLine2Enabled ? (
          <label className="block sm:col-span-2">
            <span className={labelClass}>Apartment, floor, landmark (optional)</span>
            <input
              name="addressLine2"
              value={draft.addressLine2}
              onChange={(event) => set("addressLine2", event.target.value)}
              placeholder="Flat 4B, 3rd floor, beside the mosque"
              className={cn(field, borderFor("addressLine2"))}
            />
          </label>
        ) : null}

        {settings.cityEnabled ? (
          <label className="block">
            <span className={labelClass}>City *</span>
            <input
              name="city"
              autoComplete="address-level2"
              value={draft.city}
              onChange={(event) => set("city", event.target.value)}
              placeholder="Dhaka"
              aria-invalid={Boolean(errors.city)}
              className={cn(field, borderFor("city"))}
            />
            {err("city")}
          </label>
        ) : null}

        <label className="block">
          <span className={labelClass}>Delivery area *</span>
          <select
            name="areaId"
            value={draft.areaId}
            onChange={(event) => {
              set("areaId", event.target.value);
              set("deliverySlot", "");
            }}
            aria-invalid={Boolean(errors.areaId)}
            className={cn(field, borderFor("areaId"))}
          >
            {areas.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} — {formatPrice(entry.fee)} · {entry.eta}
              </option>
            ))}
          </select>
          {err("areaId")}
          {area?.note ? <p className="mt-1 text-[11px] text-ink-400">{area.note}</p> : null}
        </label>

        {settings.postalCodeEnabled ? (
          <label className="block">
            <span className={labelClass}>Postal code (optional)</span>
            <input
              name="postalCode"
              autoComplete="postal-code"
              value={draft.postalCode}
              onChange={(event) => set("postalCode", event.target.value)}
              placeholder="1209"
              className={cn(field, borderFor("postalCode"))}
            />
          </label>
        ) : null}

        <label className="block">
          <span className={labelClass}>Phone *</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            value={draft.phone}
            onChange={(event) => set("phone", event.target.value)}
            placeholder="+880 17 0000 0000"
            aria-invalid={Boolean(errors.phone)}
            className={cn(field, borderFor("phone"))}
          />
          {err("phone")}
        </label>

        <label className="block sm:col-span-2">
          <span className={labelClass}>Email *</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={(event) => set("email", event.target.value)}
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            className={cn(field, borderFor("email"))}
          />
          {err("email")}
          <p className="mt-1 text-[11px] text-ink-400">
            Save the private access link shown after checkout; your email alone cannot reopen a guest order.
          </p>
        </label>

        {slots.length > 0 ? (
          <label className="block sm:col-span-2">
            <span className={labelClass}>Delivery time</span>
            <select
              name="deliverySlot"
              value={draft.deliverySlot}
              onChange={(event) => set("deliverySlot", event.target.value)}
              className={cn(field, borderFor("deliverySlot"))}
            >
              <option value="">Earliest available ({area?.eta})</option>
              {slots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {settings.billingAddressEnabled ? (
          <fieldset className="sm:col-span-2">
            <legend className={labelClass}>Billing address</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "same", label: "Same as delivery address" },
                { value: "different", label: "Use a different billing address" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-colors",
                    draft.billingSameAsDelivery === option.value
                      ? "border-brand-500 bg-brand-50 text-brand-800"
                      : "border-line bg-white text-ink-600",
                  )}
                >
                  <input
                    type="radio"
                    name="billingSameAsDelivery"
                    value={option.value}
                    checked={draft.billingSameAsDelivery === option.value}
                    onChange={() => set("billingSameAsDelivery", option.value as "same" | "different")}
                    className="size-3.5 accent-brand-600"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {settings.billingAddressEnabled && draft.billingSameAsDelivery === "different" ? (
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={labelClass}>Billing street address *</span>
              <input
                name="billingAddress"
                value={draft.billingAddress}
                onChange={(event) => set("billingAddress", event.target.value)}
                placeholder="Street, building, area"
                aria-invalid={Boolean(errors.billingAddress)}
                className={cn(field, borderFor("billingAddress"))}
              />
              {err("billingAddress")}
            </label>
            <label className="block">
              <span className={labelClass}>Billing city</span>
              <input
                name="billingCity"
                value={draft.billingCity}
                onChange={(event) => set("billingCity", event.target.value)}
                className={cn(field, borderFor("billingCity"))}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Billing postal code</span>
              <input
                name="billingPostalCode"
                value={draft.billingPostalCode}
                onChange={(event) => set("billingPostalCode", event.target.value)}
                className={cn(field, borderFor("billingPostalCode"))}
              />
            </label>
          </div>
        ) : null}

        {settings.notesEnabled ? (
          <label className="block sm:col-span-2">
            <span className={labelClass}>Order notes (optional)</span>
            <textarea
              name="notes"
              rows={2}
              value={draft.notes}
              onChange={(event) => set("notes", event.target.value)}
              placeholder="Gate code, call before arriving, leave with the guard…"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-500"
            />
          </label>
        ) : null}
      </div>

      <label className="mt-4 flex items-start gap-2 text-[12px] text-ink-600">
        <input
          type="checkbox"
          checked={draft.saveAddress}
          onChange={(event) => set("saveAddress", event.target.checked)}
          className="mt-0.5 size-4 accent-brand-600"
        />
        {account
          ? "Save this address to my account for next time."
          : "Save this address on this device for next time."}
      </label>
      {account ? (
        <p className="mt-1.5 text-[11px] text-ink-400">
          Signed in as {account.email}. Everything in{" "}
          <Link href="/my-account/addresses" className="font-semibold text-brand-700">
            Manage address
          </Link>{" "}
          is available above.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/cart"
          className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-white px-5 text-[13px] font-semibold text-ink-700 hover:bg-surface"
        >
          ← Back to cart
        </Link>
        <button
          type="button"
          onClick={goToPayment}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-600 px-6 text-[13.5px] font-bold text-white hover:bg-brand-700"
        >
          Continue to payment <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );

  /* -------------------------- payment step --------------------------- */
  const paymentCard = (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-line sm:p-6" aria-labelledby="payment-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="payment-heading" className="text-[17px] font-extrabold text-ink-900">
            Select Payment Method
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-400">
            Only the methods this store has switched on are shown.
          </p>
        </div>
        <Link
          href="/checkout"
          className="shrink-0 text-[12px] font-semibold text-brand-700 hover:underline"
        >
          Edit address
        </Link>
      </div>

      <div className="mt-3 rounded-xl bg-surface/70 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-ink-600">
        <p className="font-bold text-ink-800">Delivering to</p>
        <p>
          {draft.firstName} {draft.lastName} · {draft.phone}
        </p>
        <p>
          {draft.address}
          {draft.addressLine2 ? `, ${draft.addressLine2}` : ""}
          {draft.city ? `, ${draft.city}` : ""} · {area?.name}
          {draft.deliverySlot ? ` · ${draft.deliverySlot}` : ` · ${area?.eta}`}
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {methods.map((entry) => {
          const Icon = methodIcon(entry.type);
          const active = draft.paymentMethodId === entry.id;
          return (
            <li key={entry.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
                  active ? "border-brand-500 bg-brand-50/50" : "border-line bg-white hover:bg-surface/60",
                )}
              >
                <input
                  type="radio"
                  name="paymentMethodId"
                  value={entry.id}
                  checked={active}
                  onChange={() => {
                    set("paymentMethodId", entry.id);
                    set("paymentReference", "");
                  }}
                  className="mt-1 size-4 accent-brand-600"
                />
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-line">
                  <Icon size={17} className="text-brand-700" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-ink-900">{entry.label}</span>
                  <span className="block text-[11.5px] leading-relaxed text-ink-500">{entry.description}</span>
                  {active && entry.instructions ? (
                    <span className="mt-1.5 block rounded-lg bg-white px-2.5 py-2 text-[11.5px] leading-relaxed text-ink-600 ring-1 ring-line">
                      {entry.instructions}
                    </span>
                  ) : null}
                  {active && entry.requiresReference ? (
                    <span className="mt-2 block">
                      <span className={labelClass}>Transaction ID *</span>
                      <input
                        name="paymentReference"
                        value={draft.paymentReference}
                        onChange={(event) => set("paymentReference", event.target.value)}
                        placeholder="e.g. 8N7A2K4Q1X"
                        aria-invalid={Boolean(errors.paymentReference)}
                        className={cn(field, "h-10", borderFor("paymentReference"))}
                      />
                      <span className="mt-1 block text-[11px] text-ink-400">
                        Your order is confirmed only after we verify this transaction.
                      </span>
                    </span>
                  ) : null}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {methods.length === 0 ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600">
          No payment method is available right now. Please contact the store.
        </p>
      ) : null}

      {settings.termsRequired ? (
        <label className="mt-4 flex items-start gap-2 text-[12px] text-ink-600">
          <span className="sr-only">Terms</span>
          <input
            type="checkbox"
            name="acceptTerms"
            checked={draft.acceptTerms}
            onChange={(event) => set("acceptTerms", event.target.checked)}
            className="mt-0.5 size-4 accent-brand-600"
          />
          <span>
            {settings.termsLabel}{" "}
            <Link href={settings.termsHref} className="font-semibold text-brand-700 underline">
              Read them
            </Link>
          </span>
        </label>
      ) : null}
      {err("acceptTerms")}
      {err("paymentMethodId")}

      <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-ink-400">
        <Lock size={12} /> Card details are never collected or stored by this store.
      </p>
    </section>
  );

  return (
    <div ref={topRef}>
      <StepBar step={step} />

      {settings.notice ? (
        <p className="mb-4 rounded-xl border border-accent-200 bg-accent-50 px-4 py-2.5 text-[12.5px] font-semibold text-accent-800">
          {settings.notice}
        </p>
      ) : null}

      {step === "address" ? (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="min-w-0">{addressCard}</div>
          {summaryCard(
            <button
              type="button"
              onClick={goToPayment}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 text-[14px] font-bold text-white transition-colors hover:bg-brand-700"
            >
              Proceed to Payment <ChevronRight size={16} />
            </button>,
          )}
        </div>
      ) : (
        <form
          action={formAction}
          noValidate
          onSubmit={(event) => {
            const next: Record<string, string> = {};
            if (!draft.paymentMethodId) next.paymentMethodId = "Choose a payment method.";
            if (method?.requiresReference && draft.paymentReference.trim().length < 6) {
              next.paymentReference = "Enter the transaction ID from your payment app.";
            }
            if (settings.termsRequired && !draft.acceptTerms) {
              next.acceptTerms = "Please accept the terms before placing your order.";
            }
            if (Object.keys(next).length > 0) {
              event.preventDefault();
              setErrors(next);
              topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        >
          {/* The address lives on the previous step — carried as hidden fields. */}
          <input type="hidden" name="name" value={`${draft.firstName} ${draft.lastName}`.trim()} />
          <input type="hidden" name="firstName" value={draft.firstName} />
          <input type="hidden" name="lastName" value={draft.lastName} />
          <input type="hidden" name="company" value={draft.company} />
          <input type="hidden" name="address" value={draft.address} />
          <input type="hidden" name="addressLine2" value={draft.addressLine2} />
          <input type="hidden" name="city" value={draft.city} />
          <input type="hidden" name="postalCode" value={draft.postalCode} />
          <input type="hidden" name="phone" value={draft.phone} />
          <input type="hidden" name="email" value={draft.email} />
          <input type="hidden" name="areaId" value={draft.areaId} />
          <input type="hidden" name="deliverySlot" value={draft.deliverySlot} />
          <input type="hidden" name="notes" value={draft.notes} />
          <input type="hidden" name="billingSameAsDelivery" value={draft.billingSameAsDelivery} />
          <input type="hidden" name="billingAddress" value={draft.billingAddress} />
          <input type="hidden" name="billingCity" value={draft.billingCity} />
          <input type="hidden" name="billingPostalCode" value={draft.billingPostalCode} />
          <input type="hidden" name="coupon" value={coupon?.code ?? ""} />
          <input type="hidden" name="channel" value={channel} />
          <input type="hidden" name="idempotencyKey" value={draft.idempotencyKey} />
          <input type="hidden" name="expectedTotal" value={quote?.total ?? ""} />
          <input type="hidden" name="saveAddress" value={draft.saveAddress ? "on" : ""} />
          <input
            type="hidden"
            name="items"
            value={JSON.stringify(
              cart.map((line) => ({
                productId: line.productId,
                quantity: line.quantity,
                variantLabel: line.variantLabel,
                preparation: line.preparation
                  ? {
                      choices: line.preparation.options.map((option) => ({
                        group: option.group,
                        label: option.label,
                      })),
                      instructions: line.preparation.instructions,
                    }
                  : undefined,
              })),
            )}
          />

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <div className="min-w-0 space-y-4">
              {paymentCard}
              <button
                type="button"
                onClick={() => router.push("/checkout")}
                className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-white px-5 text-[13px] font-semibold text-ink-700 hover:bg-surface"
              >
                ← Back to billing details
              </button>
            </div>

            {summaryCard(
              <>
                <PlaceOrderButton
                  total={total}
                  label={method?.requiresReference ? "Confirm payment" : "Place order"}
                  blocked={
                    stockBlocked || belowAreaMinimum || methods.length === 0 || referenceNeeded || termsNeeded || quoting || !quote?.ok ||
                    Boolean(state && !state.ok && state.code === "IDEMPOTENCY_CONFLICT" && !retryConflictAcknowledged)
                  }
                />
                {referenceNeeded ? (
                  <p className="mt-2 text-center text-[11.5px] font-semibold text-accent-700">
                    Enter the transaction ID to continue.
                  </p>
                ) : termsNeeded ? (
                  <p className="mt-2 text-center text-[11.5px] font-semibold text-accent-700">
                    Accept the terms to continue.
                  </p>
                ) : null}
                <p className="mt-2 text-center text-[11px] leading-relaxed text-ink-400">
                  The final total is calculated on our server when the order is created.
                </p>
              </>,
            )}
          </div>
        </form>
      )}
    </div>
  );
}

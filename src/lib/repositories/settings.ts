import "server-only";

import { cache } from "react";
import { ensureDatabase } from "@/lib/db";
import type { Database, Row } from "@/lib/db/types";
import { freshMarketDefaults, type FreshMarketSettings } from "@/lib/fresh-market/settings";

/**
 * Site settings
 * -------------
 * One singleton document owns everything that appears in the header, footer,
 * announcement bar, checkout rules and SEO defaults. The admin settings screen
 * (and only it) writes here; every storefront surface reads from it.
 */

export type CataloguePageKey = "freshMarket" | "grocery" | "categories";
export type CataloguePageCopy = { title: string; description: string };

export type SiteSettingsData = {
  /** Headings and introductory/SEO copy for the live catalogue pages. */
  cataloguePages: Record<CataloguePageKey, CataloguePageCopy>;
  siteName: string;
  tagline: string;
  description: string;
  logoText: string;
  logoMark: string;
  logoUrl: string;
  faviconUrl: string;
  phone: string;
  phoneHref: string;
  email: string;
  address: string;
  supportHours: string;
  announcement: {
    enabled: boolean;
    message: string;
    ctaLabel: string;
    ctaHref: string;
  };
  socials: { label: string; href: string; icon: string }[];
  seo: { title: string; description: string; keywords: string };
  commerce: {
    currency: string;
    currencySymbol: string;
    taxRate: number;
    freeShippingThreshold: number;
    defaultDeliveryFee: number;
    minOrderValue: number;
    codEnabled: boolean;
    orderPrefix: string;
  };
  /** Checkout-step configuration — which fields the checkout asks for. */
  checkout: {
    addressLine2Enabled: boolean;
    cityEnabled: boolean;
    postalCodeEnabled: boolean;
    companyEnabled: boolean;
    notesEnabled: boolean;
    /** Ask the shopper to accept the terms before the order is placed. */
    termsRequired: boolean;
    termsLabel: string;
    termsHref: string;
    /** Optional notice shown at the top of checkout (delivery cut-off, holidays…). */
    notice: string;
    /** Allow a billing address that differs from the delivery address. */
    billingAddressEnabled: boolean;
  };
  /**
   * Customer-facing order tracking copy. The five stages are fixed (they map to
   * the order statuses), but their labels and the sentence under each one are
   * written by the shop, and future delivery dates can be hidden entirely.
   */
  tracking: {
    labels: {
      placed: string;
      accepted: string;
      inProgress: string;
      onTheWay: string;
      delivered: string;
    };
    descriptions: {
      placed: string;
      accepted: string;
      inProgress: string;
      onTheWay: string;
      delivered: string;
    };
    /** Extra line shown instead of a timeline when an order is cancelled. */
    cancelledNote: string;
    /** Show the estimated delivery date under steps that have not happened yet. */
    showExpectedDates: boolean;
  };
  /** Contact page copy — the address, phone and email come from the fields above. */
  contact: {
    /** Opening hours shown on the contact page. */
    hours: string;
    /** One line explaining what the support desk handles. */
    supportNote: string;
    /** Heading above the contact form. */
    formHeading: string;
    /** Sentence under the form fields. */
    formNote: string;
  };
  footer: { description: string; copyright: string };
  maintenance: { storefrontEnabled: boolean; message: string };
  /**
   * Custom 404 screen (Admin → Error & launch pages). The page itself is a
   * Next.js not-found boundary, so only the copy, illustration and buttons are
   * editable — the status code stays a real 404.
   */
  notFound: {
    heading: string;
    description: string;
    imageUrl: string;
    /** Primary "go home" button. */
    showHomeButton: boolean;
    homeButtonLabel: string;
    homeButtonHref: string;
    /** Optional secondary "back" button (uses browser history). */
    showBackButton: boolean;
    backButtonLabel: string;
    /** Keep error pages out of search results. */
    noindex: boolean;
  };
  /**
   * Launch page at /coming-soon. It never replaces the shop unless `activated`
   * is switched on by an admin, and the admin panel stays reachable either way.
   */
  comingSoon: {
    activated: boolean;
    eyebrow: string;
    heading: string;
    headingAccent: string;
    imageUrl: string;
    imageAlt: string;
    /** Newsletter capture (writes to the same subscribers collection). */
    newsletterEnabled: boolean;
    newsletterLabel: string;
    subscribeLabel: string;
    countdownEnabled: boolean;
    /** ISO timestamp (UTC) the counter counts down to. */
    countdownEndsAt: string;
    showSocials: boolean;
    /** Optional contact block, reusing the site phone/email. */
    contactEnabled: boolean;
    /** Optional promo button under the form. */
    ctaEnabled: boolean;
    ctaLabel: string;
    ctaHref: string;
    showCopyright: boolean;
  };
  /**
   * Fresh-market rules shown to shoppers: how preparation instructions are
   * limited and whether cut/cleaned items can be exchanged.
   */
  freshMarket: FreshMarketSettings;
  updatedAt: string;
};

export type SiteSettings = Row & SiteSettingsData;

export const settingsDefaults: SiteSettingsData = {
  cataloguePages: {
    freshMarket: { title: "Fresh Market", description: "Explore fresh produce and market favourites." },
    grocery: { title: "Grocery", description: "Browse everyday groceries and household essentials." },
    categories: { title: "Categories", description: "Browse the store by category." },
  },
  siteName: "Niketon Mart",
  tagline: "Your Online Grocery Store",
  description: "Everyday grocery and a fresh market: vegetables, fruit, fish, meat, eggs and dairy.",
  logoText: "Niketon Mart",
  logoMark: "basket",
  logoUrl: "",
  faviconUrl: "",
  phone: "",
  phoneHref: "",
  email: "",
  address: "",
  supportHours: "",
  announcement: { enabled: false, message: "", ctaLabel: "", ctaHref: "" },
  socials: [],
  seo: { title: "", description: "", keywords: "" },
  commerce: {
    currency: "BDT",
    currencySymbol: "৳",
    taxRate: 0,
    freeShippingThreshold: 0,
    defaultDeliveryFee: 0,
    minOrderValue: 0,
    codEnabled: true,
    orderPrefix: "NM",
  },
  checkout: {
    addressLine2Enabled: true,
    cityEnabled: true,
    postalCodeEnabled: true,
    companyEnabled: true,
    notesEnabled: true,
    termsRequired: false,
    termsLabel: "I agree to the terms and conditions and the return policy.",
    termsHref: "/terms",
    notice: "",
    billingAddressEnabled: true,
  },
  tracking: {
    labels: {
      placed: "Order Placed",
      accepted: "Accepted",
      inProgress: "In Progress",
      onTheWay: "On the Way",
      delivered: "Delivered",
    },
    descriptions: {
      placed: "We received your order and payment details.",
      accepted: "Our team confirmed it and started picking.",
      inProgress: "Your groceries are being packed.",
      onTheWay: "A rider is on the way to your address.",
      delivered: "Handed over at your door.",
    },
    cancelledNote: "Nothing will be delivered and no further charges will be made.",
    showExpectedDates: true,
  },
  contact: {
    hours: "",
    supportNote: "",
    formHeading: "Send us a message",
    formNote: "",
  },
  footer: { description: "", copyright: "" },
  maintenance: { storefrontEnabled: true, message: "" },
  notFound: {
    heading: "Oops! Page not found",
    description: "The page you are looking for cannot be found. Take a break before trying again.",
    imageUrl: "/images/errors/404-fruit.png",
    showHomeButton: true,
    homeButtonLabel: "Go To Home Page",
    homeButtonHref: "/",
    showBackButton: false,
    backButtonLabel: "Back to previous page",
    noindex: true,
  },
  comingSoon: {
    activated: false,
    eyebrow: "Coming Soon",
    heading: "Get Notified",
    headingAccent: "When We Launch!",
    imageUrl: "/images/coming-soon/hero.jpg",
    imageAlt: "A shopper holding a net bag of fresh fruit on a city street",
    newsletterEnabled: true,
    newsletterLabel: "Get notified when site goes live:",
    subscribeLabel: "Subscribe",
    countdownEnabled: false,
    countdownEndsAt: "",
    showSocials: true,
    contactEnabled: false,
    ctaEnabled: false,
    ctaLabel: "Preview the shop",
    ctaHref: "/",
    showCopyright: true,
  },
  freshMarket: freshMarketDefaults,
  updatedAt: new Date(0).toISOString(),
};

function mergeObject<T extends object>(value: unknown): Partial<T> {
  return value && typeof value === "object" ? (value as Partial<T>) : {};
}

/** Settings are a singleton document; defaults cover any field added later. */
export async function getSettings(transaction?: Database): Promise<SiteSettings> {
  const db = transaction ?? await ensureDatabase();
  const row = await db.get<SiteSettings>("settings", "site");
  if (!row) return { ...settingsDefaults, id: "site" } as SiteSettings;
  return {
    ...settingsDefaults,
    ...row,
    cataloguePages: {
      freshMarket: { ...settingsDefaults.cataloguePages.freshMarket, ...mergeObject<CataloguePageCopy>(row.cataloguePages?.freshMarket) },
      grocery: { ...settingsDefaults.cataloguePages.grocery, ...mergeObject<CataloguePageCopy>(row.cataloguePages?.grocery) },
      categories: { ...settingsDefaults.cataloguePages.categories, ...mergeObject<CataloguePageCopy>(row.cataloguePages?.categories) },
    },
    announcement: { ...settingsDefaults.announcement, ...mergeObject<SiteSettingsData["announcement"]>(row.announcement) },
    seo: { ...settingsDefaults.seo, ...mergeObject<SiteSettingsData["seo"]>(row.seo) },
    commerce: { ...settingsDefaults.commerce, ...mergeObject<SiteSettingsData["commerce"]>(row.commerce) },
    checkout: { ...settingsDefaults.checkout, ...mergeObject<SiteSettingsData["checkout"]>(row.checkout) },
    tracking: {
      ...settingsDefaults.tracking,
      ...mergeObject<SiteSettingsData["tracking"]>(row.tracking),
      labels: {
        ...settingsDefaults.tracking.labels,
        ...mergeObject<SiteSettingsData["tracking"]["labels"]>(
          (row.tracking as SiteSettingsData["tracking"] | undefined)?.labels,
        ),
      },
      descriptions: {
        ...settingsDefaults.tracking.descriptions,
        ...mergeObject<SiteSettingsData["tracking"]["descriptions"]>(
          (row.tracking as SiteSettingsData["tracking"] | undefined)?.descriptions,
        ),
      },
    },
    contact: { ...settingsDefaults.contact, ...mergeObject<SiteSettingsData["contact"]>(row.contact) },
    footer: { ...settingsDefaults.footer, ...mergeObject<SiteSettingsData["footer"]>(row.footer) },
    maintenance: { ...settingsDefaults.maintenance, ...mergeObject<SiteSettingsData["maintenance"]>(row.maintenance) },
    notFound: { ...settingsDefaults.notFound, ...mergeObject<SiteSettingsData["notFound"]>(row.notFound) },
    comingSoon: { ...settingsDefaults.comingSoon, ...mergeObject<SiteSettingsData["comingSoon"]>(row.comingSoon) },
    freshMarket: {
      ...settingsDefaults.freshMarket,
      ...mergeObject<SiteSettingsData["freshMarket"]>(row.freshMarket),
    },
    socials: Array.isArray(row.socials) ? row.socials : [],
  };
}

/** Deduplicate settings reads within a render, never across customer requests. */
export const getRenderSettings = cache(getSettings);

export async function saveSettings(patch: Partial<SiteSettingsData>): Promise<SiteSettings> {
  const db = await ensureDatabase();
  const current = await getSettings();
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  delete (next as { id?: string }).id;
  const updated = await db.update<SiteSettings>("settings", "site", next);
  return updated ?? current;
}

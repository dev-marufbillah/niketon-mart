"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Site settings for client components.
 * The storefront layout resolves the settings document on the server and hands
 * the values down here, so the header, footer and announcement bar always match
 * what the admin saved.
 */

export type ClientSiteSettings = {
  name: string;
  tagline: string;
  description: string;
  phone: string;
  phoneHref: string;
  email: string;
  address: string;
  supportHours: string;
  socials: { label: string; href: string; icon: string }[];
  announcement: { enabled: boolean; message: string; ctaLabel: string; ctaHref: string };
  freeShippingThreshold: number;
  currencySymbol: string;
  footerNote: string;
  copyright: string;
};

const SettingsContext = createContext<ClientSiteSettings | null>(null);

export function SiteSettingsProvider({
  settings,
  children,
}: {
  settings: ClientSiteSettings;
  children: ReactNode;
}) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSiteSettings(): ClientSiteSettings {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSiteSettings must be used inside SiteSettingsProvider");
  }
  return value;
}

/**
 * Shapes the checkout page hands to its client component.
 * Kept free of `server-only` imports so the client can type against them.
 */

export type CheckoutAreaOption = {
  id: string;
  name: string;
  fee: number;
  minOrder: number;
  eta: string;
  note?: string;
  slots: string[];
};

export type CheckoutMethodOption = {
  id: string;
  label: string;
  description: string;
  type: "cod" | "card" | "wallet" | "gateway";
  mode: "offline" | "manual-transfer" | "gateway";
  instructions: string;
  requiresReference: boolean;
};

export type CheckoutSettings = {
  addressLine2Enabled: boolean;
  cityEnabled: boolean;
  postalCodeEnabled: boolean;
  companyEnabled: boolean;
  notesEnabled: boolean;
  termsRequired: boolean;
  termsLabel: string;
  termsHref: string;
  notice: string;
  billingAddressEnabled: boolean;
  currencySymbol: string;
  taxRate: number;
  minOrderValue: number;
  freeShippingThreshold: number;
};

export type SavedAddress = {
  id: string;
  label: string;
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
};

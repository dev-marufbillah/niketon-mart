"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/session";
import { saveSettings, type CataloguePageKey, type SiteSettingsData } from "@/lib/repositories/settings";
import { getHomepage, moveSection, saveSectionCopy, saveSections, toggleSection } from "@/lib/repositories/homepage";
import { sectionSchemas, type HomeSectionKey } from "@/lib/content/section-schema";
import { logActivity } from "@/lib/repositories/activity";
import { CURRENCY_CODE, CURRENCY_SYMBOL, isSafeTakaAmount } from "@/lib/utils/currency";

export type SettingsFormState = { errors?: string[]; success?: string } | null;

const nullIfBlank = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
};

/**
 * Site settings
 * -------------
 * One form owns the name, contact details, announcement bar, SEO, commerce
 * rules and footer text. Everything is validated before it reaches storage.
 */
export async function saveSettingsAction(
  _state: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await assertPermission("settings.manage");

  const errors: string[] = [];
  const siteName = String(formData.get("siteName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const freeShipping = Number(formData.get("freeShippingThreshold") ?? 0);
  const deliveryFee = Number(formData.get("defaultDeliveryFee") ?? 0);
  const taxRate = Number(formData.get("taxRate") ?? 0);
  const minOrder = Number(formData.get("minOrderValue") ?? 0);

  if (siteName.length < 2) errors.push("Store name is required.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push("Enter a valid contact email.");
  if (phone.replace(/\D/g, "").length < 6) errors.push("Enter a contact phone number.");
  if (!isSafeTakaAmount(freeShipping)) errors.push("Free shipping threshold must be a non-negative BDT amount with at most two decimals.");
  if (!isSafeTakaAmount(deliveryFee)) errors.push("Delivery fee must be a non-negative BDT amount with at most two decimals.");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || Math.abs(taxRate * 100 - Math.round(taxRate * 100)) > 0.0000001) errors.push("Tax rate must be between 0 and 100 with at most two decimals.");
  if (!isSafeTakaAmount(minOrder)) errors.push("Minimum order value must be a non-negative BDT amount with at most two decimals.");

  const termsHref = String(formData.get("termsHref") ?? "").trim();
  if (termsHref && !/^(\/|https?:\/\/)/.test(termsHref)) {
    errors.push("The terms link must start with / or https://.");
  }

  const readCataloguePage = (key: CataloguePageKey, label: string) => {
    const title = String(formData.get(`${key}PageTitle`) ?? "").trim();
    const description = String(formData.get(`${key}PageDescription`) ?? "").trim();
    if (title.length < 2 || title.length > 80) errors.push(`${label} page title must be 2–80 characters.`);
    if (description.length > 300) errors.push(`${label} page description must be 300 characters or fewer.`);
    return { title, description };
  };
  const cataloguePages = {
    freshMarket: readCataloguePage("freshMarket", "Fresh Market"),
    grocery: readCataloguePage("grocery", "Grocery"),
    categories: readCataloguePage("categories", "Categories"),
  };

  const announcementEnabled = formData.get("announcementEnabled") === "on";
  const announcementCtaHref = String(formData.get("announcementCtaHref") ?? "").trim();
  if (announcementCtaHref && !/^(\/|https?:\/\/)/.test(announcementCtaHref)) {
    errors.push("Announcement link must start with / or https://.");
  }

  if (errors.length) return { errors };

  const socials: { label: string; href: string; icon: string }[] = [];
  for (const key of ["facebook", "twitter", "pinterest", "instagram", "youtube"]) {
    const href = nullIfBlank(formData.get(`social_${key}`));
    if (href) {
      if (!/^https?:\/\//.test(href)) {
        return { errors: [`The ${key} link must start with https://.`] };
      }
      socials.push({ label: key[0].toUpperCase() + key.slice(1), href, icon: key });
    }
  }

  const patch: Partial<SiteSettingsData> = {
    cataloguePages,
    siteName,
    tagline: String(formData.get("tagline") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    logoText: String(formData.get("logoText") ?? "").trim() || siteName,
    logoUrl: String(formData.get("logoUrl") ?? "").trim(),
    faviconUrl: String(formData.get("faviconUrl") ?? "").trim(),
    phone,
    phoneHref: `tel:${phone.replace(/[^\d+]/g, "")}`,
    email,
    address: String(formData.get("address") ?? "").trim(),
    supportHours: String(formData.get("supportHours") ?? "").trim(),
    contact: {
      hours: String(formData.get("contactHours") ?? "").trim(),
      supportNote: String(formData.get("contactSupportNote") ?? "").trim(),
      formHeading: String(formData.get("contactFormHeading") ?? "").trim() || "Send us a message",
      formNote: String(formData.get("contactFormNote") ?? "").trim(),
    },
    announcement: {
      enabled: announcementEnabled,
      message: String(formData.get("announcementMessage") ?? "").trim(),
      ctaLabel: String(formData.get("announcementCtaLabel") ?? "").trim(),
      ctaHref: announcementCtaHref,
    },
    socials,
    seo: {
      title: String(formData.get("seoTitle") ?? "").trim(),
      description: String(formData.get("seoDescription") ?? "").trim(),
      keywords: String(formData.get("seoKeywords") ?? "").trim(),
    },
    commerce: {
      // The store is Bangladeshi Taka only — the currency is not editable.
      currency: CURRENCY_CODE,
      currencySymbol: CURRENCY_SYMBOL,
      taxRate,
      freeShippingThreshold: freeShipping,
      defaultDeliveryFee: deliveryFee,
      minOrderValue: minOrder,
      codEnabled: formData.get("codEnabled") === "on",
      orderPrefix: String(formData.get("orderPrefix") ?? "NM").trim().toUpperCase().slice(0, 6) || "NM",
    },
    freshMarket: {
      preparationNote: String(formData.get("prepNote") ?? "").trim(),
      maxInstructionLength: Math.min(
        300,
        Math.max(40, Number(formData.get("prepInstructionLimit")) || 160),
      ),
      weightDisclaimer: String(formData.get("weightDisclaimer") ?? "").trim(),
      preparedItemsReturnable: formData.get("preparedItemsReturnable") === "on",
      preparedReturnNote: String(formData.get("preparedReturnNote") ?? "").trim(),
    },
    tracking: {
      labels: {
        placed: String(formData.get("trackLabel_placed") ?? "").trim() || "Order Placed",
        accepted: String(formData.get("trackLabel_accepted") ?? "").trim() || "Accepted",
        inProgress: String(formData.get("trackLabel_inProgress") ?? "").trim() || "In Progress",
        onTheWay: String(formData.get("trackLabel_onTheWay") ?? "").trim() || "On the Way",
        delivered: String(formData.get("trackLabel_delivered") ?? "").trim() || "Delivered",
      },
      descriptions: {
        placed: String(formData.get("trackDesc_placed") ?? "").trim(),
        accepted: String(formData.get("trackDesc_accepted") ?? "").trim(),
        inProgress: String(formData.get("trackDesc_inProgress") ?? "").trim(),
        onTheWay: String(formData.get("trackDesc_onTheWay") ?? "").trim(),
        delivered: String(formData.get("trackDesc_delivered") ?? "").trim(),
      },
      cancelledNote:
        String(formData.get("trackingCancelledNote") ?? "").trim() ||
        "This order was cancelled. Nothing will be delivered and no further charges will be made.",
      showExpectedDates: formData.get("showExpectedDates") === "on",
    },
    footer: {
      description: String(formData.get("footerDescription") ?? "").trim(),
      copyright: String(formData.get("footerCopyright") ?? "").trim(),
    },
    maintenance: {
      storefrontEnabled: formData.get("storefrontEnabled") === "on",
      message: String(formData.get("maintenanceMessage") ?? "").trim(),
    },
    checkout: {
      addressLine2Enabled: formData.get("addressLine2Enabled") === "on",
      cityEnabled: formData.get("cityEnabled") === "on",
      postalCodeEnabled: formData.get("postalCodeEnabled") === "on",
      companyEnabled: formData.get("companyEnabled") === "on",
      notesEnabled: formData.get("notesEnabled") === "on",
      billingAddressEnabled: formData.get("billingAddressEnabled") === "on",
      termsRequired: formData.get("termsRequired") === "on",
      termsLabel: String(formData.get("termsLabel") ?? "").trim(),
      termsHref: termsHref || "/terms",
      notice: String(formData.get("checkoutNotice") ?? "").trim(),
    },
  };

  await saveSettings(patch);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "settings",
    entity: "settings",
    entityId: "site",
    summary: "Updated site settings",
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/settings");
  return { success: "Settings saved. The storefront has been updated." };
}

/* -------------------------------------------------------------------------- */
/* Homepage layout & section copy                                              */
/* -------------------------------------------------------------------------- */

export type HomepageFormState = { errors?: string[]; success?: string } | null;

export async function saveSectionCopyAction(
  key: HomeSectionKey,
  _state: HomepageFormState,
  formData: FormData,
): Promise<HomepageFormState> {
  const user = await assertPermission("content.manage");
  const schema = sectionSchemas[key];
  if (!schema) return { errors: ["Unknown homepage section."] };
  if (!schema.fields.length) return { errors: [`${schema.label} is managed by its dedicated editor.`] };

  const values: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of schema.fields) {
    if (field.type === "product-picker" || field.type === "repeater") {
      const raw = String(formData.get(field.name) ?? "[]");
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("not an array");
        values[field.name] = parsed;
      } catch {
        errors.push(`${field.label} could not be read. Remove the last row and add it again.`);
        values[field.name] = [];
      }
      continue;
    }

    if (field.type === "boolean") {
      values[field.name] = formData.get(field.name) === "on";
      continue;
    }

    const raw = String(formData.get(field.name) ?? "").trim();
    if (field.type === "number" || field.type === "price") {
      const number = Number(raw);
      if (raw !== "" && !Number.isFinite(number)) errors.push(`${field.label} must be a number.`);
      values[field.name] = raw === "" ? 0 : number;
      continue;
    }

    if (field.required && !raw) errors.push(`${field.label} is required.`);
    if (["primaryHref", "secondaryHref", "ctaHref"].includes(field.name) && raw && !/^(#|\/|https?:\/\/)/.test(raw)) {
      errors.push(`${field.label} must start with #, / or https://.`);
    }
    values[field.name] = raw;
  }

  if (errors.length) return { errors };

  await saveSectionCopy(key, values, user.name);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "content",
    entity: "homepage",
    entityId: key,
    summary: `Updated the “${schema.label}” section copy`,
  });

  revalidatePath("/");
  revalidatePath("/admin/homepage");
  return { success: `${schema.label} saved.` };
}

export async function toggleSectionAction(key: string, visible: boolean): Promise<void> {
  const user = await assertPermission("content.manage");
  await toggleSection(key, visible, user.name);
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "toggle",
    entity: "homepage",
    entityId: key,
    summary: `${visible ? "Showed" : "Hid"} the homepage section “${key}”`,
  });
  revalidatePath("/");
  revalidatePath("/admin/homepage");
}

export async function moveSectionAction(key: string, direction: -1 | 1): Promise<void> {
  const user = await assertPermission("content.manage");
  await moveSection(key, direction, user.name);
  revalidatePath("/");
  revalidatePath("/admin/homepage");
}

export async function saveSectionOrderAction(order: string[]): Promise<void> {
  const user = await assertPermission("content.manage");
  const homepage = await getHomepage();
  const visibility = new Map(homepage.sections.map((section) => [section.key, section.visible]));
  await saveSections(
    order.map((key, index) => ({ key, visible: visibility.get(key as never) ?? true, order: index + 1 })),
    user.name,
  );
  revalidatePath("/");
  revalidatePath("/admin/homepage");
}

/* -------------------------------------------------------------------------- */
/* 404 page & Coming Soon page                                                 */
/* -------------------------------------------------------------------------- */

export type SystemPageFormState = { errors?: string[]; success?: string } | null;

const safeHref = (value: string) => value === "" || /^(\/|https?:\/\/)/.test(value);
const utcIso = (value: string) => {
  // The admin field is a `datetime-local` labelled UTC, so a value without a
  // timezone is read as UTC instead of the server's local zone.
  const text = value.trim();
  if (!text) return "";
  const normalised = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)
    ? `${text}:00Z`
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)
      ? `${text}Z`
      : text;
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

/** Custom 404 screen — copy, illustration and buttons. */
export async function saveNotFoundAction(
  _state: SystemPageFormState,
  formData: FormData,
): Promise<SystemPageFormState> {
  const user = await assertPermission("content.manage");

  const heading = String(formData.get("notFoundHeading") ?? "").trim();
  const description = String(formData.get("notFoundDescription") ?? "").trim();
  const imageUrl = String(formData.get("notFoundImageUrl") ?? "").trim();
  const homeButtonLabel = String(formData.get("notFoundHomeButtonLabel") ?? "").trim();
  const homeButtonHref = String(formData.get("notFoundHomeButtonHref") ?? "").trim();
  const backButtonLabel = String(formData.get("notFoundBackButtonLabel") ?? "").trim();
  const showHomeButton = formData.get("notFoundShowHomeButton") === "on";
  const showBackButton = formData.get("notFoundShowBackButton") === "on";

  const errors: string[] = [];
  if (heading.length < 3) errors.push("The 404 heading needs at least 3 characters.");
  if (heading.length > 80) errors.push("Keep the 404 heading under 80 characters.");
  if (description.length > 320) errors.push("Keep the 404 description under 320 characters.");
  if (showHomeButton && homeButtonLabel.length < 2) errors.push("Give the home button a label.");
  if (showHomeButton && !safeHref(homeButtonHref)) {
    errors.push("The home button link must start with / or https://.");
  }
  if (showBackButton && backButtonLabel.length < 2) errors.push("Give the back button a label.");
  if (imageUrl && !safeHref(imageUrl)) errors.push("The 404 illustration must be a path or an https:// URL.");

  if (errors.length) return { errors };

  const current = await import("@/lib/repositories/settings").then((mod) => mod.getSettings());
  await saveSettings({
    notFound: {
      ...current.notFound,
      heading,
      description,
      imageUrl,
      showHomeButton,
      homeButtonLabel: homeButtonLabel || "Go To Home Page",
      homeButtonHref: homeButtonHref || "/",
      showBackButton,
      backButtonLabel: backButtonLabel || "Back to previous page",
      noindex: formData.get("notFoundNoindex") === "on",
    },
  });
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "settings",
    entity: "settings",
    entityId: "site",
    summary: "Updated the 404 page",
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/pages/system");
  return { success: "404 page saved." };
}

/** Coming Soon page — content, countdown, newsletter and launch mode. */
export async function saveComingSoonAction(
  _state: SystemPageFormState,
  formData: FormData,
): Promise<SystemPageFormState> {
  const user = await assertPermission("content.manage");

  const eyebrow = String(formData.get("comingEyebrow") ?? "").trim();
  const heading = String(formData.get("comingHeading") ?? "").trim();
  const headingAccent = String(formData.get("comingHeadingAccent") ?? "").trim();
  const imageUrl = String(formData.get("comingImageUrl") ?? "").trim();
  const imageAlt = String(formData.get("comingImageAlt") ?? "").trim();
  const newsletterLabel = String(formData.get("comingNewsletterLabel") ?? "").trim();
  const subscribeLabel = String(formData.get("comingSubscribeLabel") ?? "").trim();
  const countdownEndsAtRaw = String(formData.get("comingCountdownEndsAt") ?? "").trim();
  const ctaLabel = String(formData.get("comingCtaLabel") ?? "").trim();
  const ctaHref = String(formData.get("comingCtaHref") ?? "").trim();
  const countdownEnabled = formData.get("comingCountdownEnabled") === "on";
  const ctaEnabled = formData.get("comingCtaEnabled") === "on";

  const errors: string[] = [];
  if (heading.length < 2) errors.push("The launch heading is required.");
  if (heading.length > 60 || headingAccent.length > 60) {
    errors.push("Keep each heading line under 60 characters so it fits on a phone.");
  }
  if (imageUrl && !safeHref(imageUrl)) errors.push("The launch image must be a path or an https:// URL.");
  if (ctaEnabled && ctaLabel.length < 2) errors.push("Give the launch button a label.");
  if (ctaEnabled && !safeHref(ctaHref)) errors.push("The launch button link must start with / or https://.");
  if (newsletterLabel.length > 120) errors.push("Keep the newsletter label under 120 characters.");

  const countdownEndsAt = utcIso(countdownEndsAtRaw);
  if (countdownEnabled && !countdownEndsAt) {
    errors.push("Enter a valid launch date and time for the countdown.");
  }

  if (errors.length) return { errors };

  const current = await import("@/lib/repositories/settings").then((mod) => mod.getSettings());
  await saveSettings({
    comingSoon: {
      ...current.comingSoon,
      activated: formData.get("comingActivated") === "on",
      eyebrow,
      heading,
      headingAccent,
      imageUrl,
      imageAlt,
      newsletterEnabled: formData.get("comingNewsletterEnabled") === "on",
      newsletterLabel,
      subscribeLabel: subscribeLabel || "Subscribe",
      countdownEnabled,
      countdownEndsAt: countdownEndsAt || current.comingSoon.countdownEndsAt,
      showSocials: formData.get("comingShowSocials") === "on",
      contactEnabled: formData.get("comingContactEnabled") === "on",
      ctaEnabled,
      ctaLabel: ctaLabel || "Preview the shop",
      ctaHref: ctaHref || "/",
      showCopyright: formData.get("comingShowCopyright") === "on",
    },
  });
  await logActivity({
    actor: { id: user.id, name: user.name },
    action: "settings",
    entity: "settings",
    entityId: "site",
    summary: "Updated the Coming Soon page",
  });

  revalidatePath("/", "layout");
  revalidatePath("/coming-soon");
  revalidatePath("/admin/pages/system");
  return { success: "Coming Soon page saved." };
}

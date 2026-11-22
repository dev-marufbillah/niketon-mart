"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSettingsAction, type SettingsFormState } from "@/lib/admin/settings-actions";
import type { SiteSettings } from "@/lib/repositories/settings";
import { CURRENCY_CODE, CURRENCY_SYMBOL } from "@/lib/utils/currency";
import Link from "next/link";

const input =
  "h-10 w-full rounded-xl border border-[#dce8df] bg-[#fbfdfb] px-3 text-[13px] outline-none transition-colors focus:border-brand-500";
const label = "mb-1.5 block text-[12px] font-bold text-[#4e6858]";
const help = "mt-1 text-[11px] leading-relaxed text-ink-500";
const sectionId = (title: string) => `settings-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
const settingsSections = ["Store identity", "Contact details", "Contact page", "Announcement bar", "Social links", "Search engine listing", "Catalogue pages", "Currency, tax & delivery", "Fresh market", "Checkout", "Order tracking", "Footer", "Storefront status"];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={sectionId(title)} className="scroll-mt-24 rounded-[20px] border border-[#e4ece6] bg-white p-4 sm:p-5">
      <h2 className="text-[15px] font-extrabold text-[#254734]">{title}</h2>
      <p className="mb-4 mt-1 text-[12px] leading-relaxed text-[#5e7465]">{description}</p>
      <div className="grid gap-3.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function SaveBar({ state }: { state: SettingsFormState }) {
  const { pending } = useFormStatus();
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-[#dce8df] bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-20px_rgba(24,64,41,0.4)] backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-[11.5px] leading-relaxed text-[#5d7365]">
          <p className="font-bold text-[#254734]">Save all settings</p>
          {state?.errors?.length ? <p aria-hidden="true" className="text-red-700">Could not save: {state.errors[0]}{state.errors.length > 1 ? " See the full list at the top." : ""}</p> : state?.success ? <p aria-hidden="true" className="text-brand-700">{state.success}</p> : <p>Changes apply after you save.</p>}
        </div>
        <button type="submit" disabled={pending} className="inline-flex h-10 shrink-0 items-center rounded-xl bg-brand-600 px-5 text-[13px] font-bold text-white hover:bg-brand-700 disabled:opacity-60">{pending ? "Saving…" : "Save settings"}</button>
      </div>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, action] = useActionState<SettingsFormState, FormData>(saveSettingsAction, null);

  return (
    <form action={action} className="space-y-3">
      <nav aria-label="Settings sections" className="rounded-[20px] border border-[#e4ece6] bg-white p-4 sm:p-5">
        <p className="text-[13px] font-extrabold text-[#254734]">Jump to a section</p>
        <p className="mt-1 text-[11.5px] text-[#5e7465]">Choose an area below. Remember to save after making changes.</p>
        <div className="mt-3 flex flex-wrap gap-2">{settingsSections.map((title) => (
          <a key={title} href={`#${sectionId(title)}`} className="inline-flex min-h-8 items-center rounded-lg bg-[#f1f7f2] px-3 py-1.5 text-[11.5px] font-semibold text-[#476c55] hover:bg-[#e2f2e7] hover:text-brand-700">{title}</a>
        ))}</div>
      </nav>
      {state?.errors?.length ? (
        <ul role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600">
          {state.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {state?.success ? (
        <p role="status" className="rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700">
          {state.success}
        </p>
      ) : null}

      <Section title="Store identity" description="Shown in the header, footer, browser tab and admin panel.">
        <label className="block">
          <span className={label}>Store name</span>
          <input name="siteName" defaultValue={settings.siteName} className={input} />
        </label>
        <label className="block">
          <span className={label}>Logo text</span>
          <input name="logoText" defaultValue={settings.logoText} className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Tagline</span>
          <input name="tagline" defaultValue={settings.tagline} className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Short description</span>
          <textarea
            name="description"
            rows={2}
            defaultValue={settings.description}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500"
          />
        </label>
        <label className="block">
          <span className={label}>Logo image URL</span>
          <input name="logoUrl" defaultValue={settings.logoUrl} placeholder="/uploads/logo.png" className={input} />
          <span className={help}>Leave empty to use the basket mark + logo text.</span>
        </label>
        <label className="block">
          <span className={label}>Favicon URL</span>
          <input name="faviconUrl" defaultValue={settings.faviconUrl} placeholder="/favicon.ico" className={input} />
        </label>
      </Section>

      <Section title="Contact details" description="Used in the header, footer, contact page and order emails.">
        <label className="block">
          <span className={label}>Phone</span>
          <input name="phone" defaultValue={settings.phone} className={input} />
        </label>
        <label className="block">
          <span className={label}>Email</span>
          <input name="email" type="email" defaultValue={settings.email} className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Address</span>
          <input name="address" defaultValue={settings.address} className={input} />
        </label>
        <label className="block">
          <span className={label}>Support hours</span>
          <input name="supportHours" defaultValue={settings.supportHours} className={input} />
        </label>
      </Section>

      <Section
        title="Contact page"
        description="Opening hours, the heading above the form and the sentence under it. The address, phone and email come from Contact details above."
      >
        <label className="block sm:col-span-3">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">Opening hours</span>
          <input
            name="contactHours"
            defaultValue={settings.contact.hours}
            placeholder="Saturday – Thursday, 8:00 am – 10:00 pm"
            className={input}
          />
        </label>
        <label className="block sm:col-span-3">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">What the support desk handles</span>
          <input
            name="contactSupportNote"
            defaultValue={settings.contact.supportNote}
            placeholder="Order support, delivery changes and returns."
            className={input}
          />
        </label>
        <label className="block sm:col-span-1">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">Form heading</span>
          <input name="contactFormHeading" defaultValue={settings.contact.formHeading} className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-700">Note under the form</span>
          <input name="contactFormNote" defaultValue={settings.contact.formNote} className={input} />
        </label>
        <p className="text-[11.5px] leading-relaxed text-ink-400 sm:col-span-3">
          The photo beside the form and the map block are edited in the{" "}
          <Link href="/admin/pages/contact" className="font-semibold text-brand-700">
            Contact page builder
          </Link>
          .
        </p>
      </Section>

      <Section title="Announcement bar" description="The thin strip above the header. Hidden when switched off.">
        <label className="flex items-start gap-2.5 sm:col-span-2">
          <input
            type="checkbox"
            name="announcementEnabled"
            defaultChecked={settings.announcement.enabled}
            className="mt-0.5 size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Show the announcement bar</span>
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Message</span>
          <input name="announcementMessage" defaultValue={settings.announcement.message} className={input} />
          <span className="mt-1 block text-[11px] text-ink-400">
            Shown in the yellow strip at the very top of every storefront page, next to the phone number.
          </span>
        </label>
        <label className="block">
          <span className={label}>Link label</span>
          <input name="announcementCtaLabel" defaultValue={settings.announcement.ctaLabel} className={input} />
        </label>
        <label className="block">
          <span className={label}>Link URL</span>
          <input name="announcementCtaHref" defaultValue={settings.announcement.ctaHref} placeholder="/home-grocery" className={input} />
        </label>
      </Section>

      <Section title="Social links" description="Leave a field empty to hide that icon.">
        {["facebook", "twitter", "pinterest", "instagram", "youtube"].map((network) => (
          <label key={network} className="block">
            <span className={`${label} capitalize`}>{network}</span>
            <input
              name={`social_${network}`}
              defaultValue={settings.socials.find((social) => social.icon === network)?.href ?? ""}
              placeholder="https://"
              className={input}
            />
          </label>
        ))}
      </Section>

      <Section title="Search engine listing" description="Defaults used when a page has no SEO text of its own.">
        <label className="block sm:col-span-2">
          <span className={label}>SEO title</span>
          <input name="seoTitle" defaultValue={settings.seo.title} className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>SEO description</span>
          <textarea
            name="seoDescription"
            rows={2}
            defaultValue={settings.seo.description}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Keywords</span>
          <input name="seoKeywords" defaultValue={settings.seo.keywords} className={input} />
        </label>
      </Section>

      <Section title="Catalogue pages" description="Edit the heading and introduction for the Fresh Market, Grocery and Categories pages. The introduction also supplies the search-engine description.">
        {([
          { key: "freshMarket", name: "Fresh Market" },
          { key: "grocery", name: "Grocery" },
          { key: "categories", name: "Categories" },
        ] as const).map(({ key, name }) => (
          <div key={key} className="grid gap-3 rounded-xl bg-surface-2 p-3 sm:col-span-2 sm:grid-cols-2">
            <label className="block">
              <span className={label}>{name} page title</span>
              <input name={`${key}PageTitle`} defaultValue={settings.cataloguePages[key].title} minLength={2} maxLength={80} required className={input} />
            </label>
            <label className="block">
              <span className={label}>{name} page description</span>
              <textarea name={`${key}PageDescription`} defaultValue={settings.cataloguePages[key].description} maxLength={300} rows={2} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500" />
            </label>
          </div>
        ))}
        <p className="text-[11.5px] leading-relaxed text-ink-400 sm:col-span-2">
          Products and category images, order, visibility and navigation groups are managed in <Link href="/admin/catalogue/taxonomy" className="font-semibold text-brand-700">Categories &amp; brands</Link>. English navigation labels remain fixed as requested.
        </p>
      </Section>

      <Section title="Currency, tax & delivery" description="Applied by checkout to every order. Prices are always recalculated on the server.">
        <div className="sm:col-span-2">
          <span className={label}>Currency</span>
          <input
            value={`${CURRENCY_CODE} (${CURRENCY_SYMBOL}) — Bangladeshi Taka`}
            disabled
            readOnly
            className={input + " cursor-not-allowed bg-surface text-ink-500"}
          />
          <span className="mt-1 block text-[11.5px] text-ink-400">
            Fixed for this store: every price, charge, delivery fee and total is Bangladeshi Taka.
          </span>
        </div>
        <label className="block">
          <span className={label}>Free shipping over</span>
          <input
            name="freeShippingThreshold"
            type="number"
            step="0.01"
            min="0"
            defaultValue={settings.commerce.freeShippingThreshold}
            className={input}
          />
        </label>
        <label className="block">
          <span className={label}>Default delivery fee</span>
          <input
            name="defaultDeliveryFee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={settings.commerce.defaultDeliveryFee}
            className={input}
          />
        </label>
        <label className="block">
          <span className={label}>Tax rate (%)</span>
          <input name="taxRate" type="number" step="0.1" min="0" max="100" defaultValue={settings.commerce.taxRate} className={input} />
        </label>
        <label className="block">
          <span className={label}>Minimum order value</span>
          <input
            name="minOrderValue"
            type="number"
            step="0.01"
            min="0"
            defaultValue={settings.commerce.minOrderValue}
            className={input}
          />
        </label>
        <label className="block">
          <span className={label}>Order number prefix</span>
          <input name="orderPrefix" defaultValue={settings.commerce.orderPrefix} maxLength={6} className={input} />
        </label>
        <label className="flex items-center gap-2.5">
          <input type="checkbox" name="codEnabled" defaultChecked={settings.commerce.codEnabled} className="size-4 accent-brand-600" />
          <span className="text-[12.5px] font-semibold text-ink-700">Allow cash on delivery</span>
        </label>
      </Section>

      <Section
        title="Fresh market"
        description="How cut, cleaned and prepared products behave on the product page, in the cart and in the returns policy."
      >
        <label className="block">
          <span className={label}>Preparation note (product page)</span>
          <input
            name="prepNote"
            defaultValue={settings.freshMarket.preparationNote}
            maxLength={240}
            className={input}
          />
        </label>
        <label className="block">
          <span className={label}>Instruction limit (characters)</span>
          <input
            name="prepInstructionLimit"
            type="number"
            min={40}
            max={300}
            defaultValue={settings.freshMarket.maxInstructionLength}
            className={input}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Weight note (shown when the final weight may differ)</span>
          <input
            name="weightDisclaimer"
            defaultValue={settings.freshMarket.weightDisclaimer}
            maxLength={280}
            className={input}
          />
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="preparedItemsReturnable"
            defaultChecked={settings.freshMarket.preparedItemsReturnable}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Cut items can be returned</span>
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Returns note for prepared items</span>
          <input
            name="preparedReturnNote"
            defaultValue={settings.freshMarket.preparedReturnNote}
            maxLength={280}
            className={input}
          />
        </label>
      </Section>

      <Section
        title="Checkout"
        description="What the checkout asks for and what a shopper must accept before an order is placed."
      >
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="addressLine2Enabled"
            defaultChecked={settings.checkout.addressLine2Enabled}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Ask for apartment / floor</span>
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="cityEnabled"
            defaultChecked={settings.checkout.cityEnabled}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Ask for city</span>
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="postalCodeEnabled"
            defaultChecked={settings.checkout.postalCodeEnabled}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Ask for postal code</span>
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="companyEnabled"
            defaultChecked={settings.checkout.companyEnabled}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Ask for company (optional field)</span>
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="notesEnabled"
            defaultChecked={settings.checkout.notesEnabled}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Allow order notes</span>
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="billingAddressEnabled"
            defaultChecked={settings.checkout.billingAddressEnabled}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Allow a separate billing address</span>
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="termsRequired"
            defaultChecked={settings.checkout.termsRequired}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Require accepting the terms</span>
        </label>
        <label className="block">
          <span className={label}>Terms checkbox label</span>
          <input name="termsLabel" defaultValue={settings.checkout.termsLabel} className={input} />
        </label>
        <label className="block">
          <span className={label}>Terms link</span>
          <input name="termsHref" defaultValue={settings.checkout.termsHref} className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Checkout notice</span>
          <textarea
            name="checkoutNotice"
            rows={2}
            defaultValue={settings.checkout.notice}
            placeholder="e.g. Deliveries run 9am–9pm. Call us if you need a different time."
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500"
          />
        </label>
        <p className="text-[11.5px] leading-relaxed text-ink-400 sm:col-span-2">
          Guests can always check out — a customer account is not required. Delivery areas, fees and payment methods are
          managed under Operations.
        </p>
      </Section>

      <Section
        title="Order tracking"
        description="What customers read on their order page. The five stages follow the real order statuses — these are their labels and the sentence under each one."
      >
        {(
          [
            ["placed", "Stage 1 — order placed"],
            ["accepted", "Stage 2 — accepted"],
            ["inProgress", "Stage 3 — processing"],
            ["onTheWay", "Stage 4 — out for delivery"],
            ["delivered", "Stage 5 — delivered"],
          ] as const
        ).map(([key, heading]) => (
          <div key={key} className="sm:col-span-2">
            <p className="mb-1 text-[11.5px] font-bold uppercase tracking-wide text-ink-400">{heading}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Label</span>
                <input name={`trackLabel_${key}`} defaultValue={settings.tracking.labels[key]} className={input} />
              </label>
              <label className="block">
                <span className={label}>Description</span>
                <input name={`trackDesc_${key}`} defaultValue={settings.tracking.descriptions[key]} className={input} />
              </label>
            </div>
          </div>
        ))}
        <label className="block sm:col-span-2">
          <span className={label}>Cancelled order message</span>
          <textarea
            name="trackingCancelledNote"
            rows={2}
            defaultValue={settings.tracking.cancelledNote}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="showExpectedDates"
            defaultChecked={settings.tracking.showExpectedDates}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">
            Show the estimated date under steps that have not happened yet
          </span>
        </label>
        <p className="text-[11.5px] leading-relaxed text-ink-400 sm:col-span-2">
          The estimate comes from the delivery area&apos;s promise and the window the shopper chose — it is never
          invented. Status changes themselves are made from the order screen, and the customer page updates
          immediately.
        </p>
      </Section>

      <Section title="Footer" description="The wording under the logo and the copyright line.">
        <label className="block sm:col-span-2">
          <span className={label}>Footer description</span>
          <textarea
            name="footerDescription"
            rows={2}
            defaultValue={settings.footer.description}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand-500"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Copyright line</span>
          <input name="footerCopyright" defaultValue={settings.footer.copyright} className={input} />
        </label>
      </Section>

      <Section title="Storefront status" description="Close the shop while you restock. The admin panel stays available.">
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="storefrontEnabled"
            defaultChecked={settings.maintenance.storefrontEnabled}
            className="size-4 accent-brand-600"
          />
          <span className="text-[12.5px] font-semibold text-ink-700">Storefront is open</span>
        </label>
        <label className="block">
          <span className={label}>Message shown when closed</span>
          <input name="maintenanceMessage" defaultValue={settings.maintenance.message} className={input} />
        </label>
      </Section>

      <p className="text-[11px] text-ink-400">
        Last saved {new Date(settings.updatedAt).toLocaleString()}
      </p>

      <SaveBar state={state} />
    </form>
  );
}

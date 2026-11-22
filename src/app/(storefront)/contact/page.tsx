import type { Metadata } from "next";
import Image from "next/image";
import { Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import { ContactForm } from "@/components/marketing/contact-form";
import { notFound } from "next/navigation";
import { getPageBySlug, getPageRecord, getPageSections, pageSectionData } from "@/lib/repositories/content";
import { getRenderSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPageBySlug("contact"), getRenderSettings()]);
  const title = page?.seoTitle || page?.title || "Contact us";
  const description =
    page?.seoDescription || page?.subtitle || `Get in touch with ${settings.siteName} — phone, email and the contact form.`;
  return {
    title,
    description,
    alternates: { canonical: "/contact" },
    openGraph: { title, description, url: "/contact", type: "website" },
  };
}

/**
 * Contact page (reference 1)
 * --------------------------
 * Form on the left, shopper photo on the right, three contact cards under them,
 * then the map strip. Everything on the page is database-driven:
 *  - address / phone / email / socials / opening hours: Site settings;
 *  - the photo, the note under the form and the map block: the Contact page builder;
 *  - the form itself writes to `contact_messages` and shows up in the admin inbox.
 */
export default async function ContactPage() {
  const [record, page, settings, sections] = await Promise.all([
    getPageRecord("contact"),
    getPageBySlug("contact"),
    getRenderSettings(),
    getPageSections("contact"),
  ]);
  if (record && (!record.published || !record.visible)) notFound();

  const media = sections.find((section) => section.type === "media");
  const map = sections.find((section) => section.type === "map");
  const mediaData = media ? pageSectionData<{ image?: string; note?: string }>(media) : {};
  const mapData = map
    ? pageSectionData<{ embedUrl?: string; linkLabel?: string; caption?: string }>(map)
    : {};

  const mapHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;

  const cards = [
    {
      icon: MapPin,
      label: "Address",
      value: settings.address,
      href: mapHref,
      external: true,
      hint: settings.contact.hours,
    },
    {
      icon: Phone,
      label: "Phone",
      value: settings.phone,
      href: settings.phoneHref,
      external: false,
      hint: settings.contact.supportNote,
    },
    {
      icon: Mail,
      label: "Email",
      value: settings.email,
      href: `mailto:${settings.email}`,
      external: false,
      hint: "",
    },
  ];

  return (
    <>
      <ShopHero title={page?.title || "Contact Us"} current="Contact Us" />

      <section className="container-page py-9 sm:py-12">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-10">
          <div>
            <h2 className="text-[20px] font-extrabold text-ink-900 sm:text-[22px]">
              {settings.contact.formHeading || "Send us a message"}
            </h2>
            {(page?.subtitle || settings.contact.formNote) ? (
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-500">
                {page?.subtitle || settings.contact.formNote}
              </p>
            ) : null}
            <div className="mt-5">
              <ContactForm note={mediaData.note} />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-surface lg:aspect-auto">
            {mediaData.image ? (
              <div className="relative h-[280px] w-full sm:h-[360px] lg:h-full lg:min-h-[460px]">
                <Image
                  src={mediaData.image}
                  alt="A shopper picking up fresh groceries"
                  fill
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-center text-[13px] text-ink-400">
                Add a photo in Admin → Website → Contact page.
              </div>
            )}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -right-10 size-40 rounded-full bg-accent-500/25 blur-2xl"
            />
          </div>
        </div>

        {/* ---------- contact cards ---------- */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {cards.filter((card) => Boolean(card.value)).map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl bg-white p-5 text-center ring-1 ring-line transition-shadow hover:shadow-[0_10px_30px_-18px_rgba(15,61,46,0.45)]"
              >
                <span className="mx-auto inline-flex size-12 items-center justify-center rounded-xl bg-accent-500 text-brand-900 shadow-sm">
                  <Icon size={20} strokeWidth={2.2} />
                </span>
                <p className="mt-3 text-[14px] font-extrabold text-ink-900">{card.label}</p>
                {card.href ? (
                  <a
                    href={card.href}
                    {...(card.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                    className="mt-1 block text-[12.5px] leading-relaxed text-ink-600 hover:text-brand-700"
                  >
                    {card.value}
                  </a>
                ) : (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-600">{card.value}</p>
                )}
                {card.hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-ink-400">{card.hint}</p> : null}
              </div>
            );
          })}
        </div>

        {/* ---------- hours + socials ---------- */}
        <div className="mt-4 grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-line sm:grid-cols-2">
          <div className="flex gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Clock size={16} />
            </span>
            <div>
              <p className="text-[13px] font-extrabold text-ink-900">Business hours</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">
                {settings.contact.hours || settings.supportHours}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Send size={16} />
            </span>
            <div>
              <p className="text-[13px] font-extrabold text-ink-900">Follow the store</p>
              {settings.socials.length > 0 ? (
                <p className="mt-1 flex flex-wrap gap-2">
                  {settings.socials.map((social) => (
                    <a
                      key={social.href}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex rounded-full bg-surface px-3 py-1 text-[11.5px] font-semibold text-ink-600 ring-1 ring-line hover:text-brand-700"
                    >
                      {social.label}
                    </a>
                  ))}
                </p>
              ) : (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">
                  Social links are added in Admin → Site settings.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- map strip ---------- */}
      {map ? (
        <section aria-label="Store location" className="relative">
          {mapData.embedUrl ? (
            <iframe
              src={mapData.embedUrl}
              title="Store location map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[300px] w-full border-0 sm:h-[360px]"
            />
          ) : (
            <div className="grocery-pattern relative overflow-hidden border-y border-line bg-surface-2">
              <div className="container-page flex h-[220px] flex-col items-center justify-center text-center sm:h-[280px]">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                  <MapPin size={20} />
                </span>
                <p className="mt-3 text-[14px] font-extrabold text-ink-900">{settings.siteName}</p>
                <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-500">{settings.address}</p>
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 inline-flex h-9 items-center rounded-full bg-white px-4 text-[12px] font-semibold text-brand-700 ring-1 ring-line hover:bg-brand-50"
                >
                  {mapData.linkLabel || "Open in Google Maps"}
                </a>
                <p className="mt-2 text-[10.5px] text-ink-400">
                  A live map appears here as soon as an embed URL is added in the admin.
                </p>
              </div>
            </div>
          )}
          {mapData.caption ? (
            <p className="bg-white py-2 text-center text-[11.5px] text-ink-400">{mapData.caption}</p>
          ) : null}
        </section>
      ) : null}

      <ServiceFeatures />
      <Newsletter />

    </>
  );
}

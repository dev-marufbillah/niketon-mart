import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BadgeCheck, Eye, Heart, Leaf, Shield, Star, Target } from "lucide-react";
import { ShopHero } from "@/components/shop/shop-hero";
import { ServiceFeatures } from "@/components/home/service-features";
import { Newsletter } from "@/components/layout/newsletter";
import {
  getPageBySlug,
  getPageRecord,
  getPageSections,
  pageSectionData,
  type PageSectionRow,
} from "@/lib/repositories/content";
import { getRenderSettings } from "@/lib/repositories/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings, sections] = await Promise.all([getPageBySlug("about"), getRenderSettings(), getPageSections("about")]);
  const title = page?.seoTitle || page?.title || "About us";
  const description =
    page?.seoDescription ||
    page?.subtitle ||
    `About ${settings.siteName}.`;
  return {
    title,
    description,
    ...(!sections.length && !page?.body?.trim() && !page?.subtitle?.trim() ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: "/about" },
    openGraph: { title, description, url: "/about", type: "website" },
  };
}

/* -------------------------------------------------------------- blocks -- */

type HeroData = {
  badgeValue?: string;
  badgeLabel?: string;
  image?: string;
  eyebrow?: string;
  title?: string;
  titleAccent?: string;
  text?: string;
  bullets?: { text?: string }[];
  signature?: string;
  signatureName?: string;
  signatureRole?: string;
};

type BannerData = { image?: string; rating?: string; ratingLabel?: string; showRating?: boolean | string };

type PillarItem = { title?: string; icon?: string; text?: string };
type TeamMember = { name?: string; role?: string; image?: string };

const pillarIcons = {
  target: Target,
  eye: Eye,
  leaf: Leaf,
  heart: Heart,
  shield: Shield,
} as const;

function HeroBlock({ data }: { data: HeroData }) {
  const bullets = (data.bullets ?? []).map((item) => item.text).filter(Boolean) as string[];
  const signatureIsImage = Boolean(data.signature && /^(\/|https?:)/.test(data.signature));

  return (
    <section className="container-page py-10 sm:py-12 lg:py-14">
      <div className="grid items-center gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12">
        <div className="relative">
          {data.image ? (
            <div className="relative aspect-[4/3.4] overflow-hidden rounded-2xl bg-surface sm:aspect-[4/3] lg:aspect-[4/3.2]">
              <Image
                src={data.image}
                alt={data.eyebrow || "Our team at work"}
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
                priority
              />
              <span aria-hidden="true" className="absolute inset-0 bg-brand-900/10" />
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-surface text-[12.5px] text-ink-400">
              Add a portrait photo in the admin.
            </div>
          )}

          {data.badgeValue ? (
            <div className="absolute -left-1 top-4 rounded-xl bg-accent-500 px-4 py-3 text-brand-900 shadow-lg shadow-brand-900/10 sm:top-6">
              <p className="text-[26px] font-black leading-none">{data.badgeValue}</p>
              <p className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.06em]">{data.badgeLabel}</p>
            </div>
          ) : null}

          <a
            href="#about-team"
            aria-label="Meet the team"
            className="absolute bottom-4 left-1/2 inline-flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-lg ring-4 ring-white/40 transition-transform hover:scale-105"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-600 text-white">
              <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden="true">
                <path d="M8 5.5v13l11-6.5-11-6.5Z" />
              </svg>
            </span>
          </a>
        </div>

        <div>
          {data.eyebrow ? (
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">{data.eyebrow}</p>
          ) : null}
          <h2 className="mt-2 text-[26px] leading-[1.15] font-black text-ink-900 sm:text-[32px] lg:text-[36px]">
            {data.title}
            {data.titleAccent ? <span className="block text-brand-600">{data.titleAccent}</span> : null}
          </h2>
          {data.text ? (
            <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-ink-500">{data.text}</p>
          ) : null}

          {bullets.length > 0 ? (
            <ul className="mt-4 space-y-2.5">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-[13px] font-semibold text-ink-800">
                  <BadgeCheck size={17} className="mt-px shrink-0 text-brand-600" strokeWidth={2.4} />
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}

          {data.signatureName || data.signature ? (
            <div className="mt-6 flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 rounded-full bg-brand-50" aria-hidden="true">
                <span className="flex h-full w-full items-center justify-center text-[15px] font-black text-brand-700">
                  {(data.signatureName || data.signature || "?")
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
              </div>
              <div>
                {data.signature ? (
                  signatureIsImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={data.signature}
                      alt={`${data.signatureName || "Founder"} signature`}
                      className="h-9 w-auto"
                    />
                  ) : (
                    <p className="font-serif text-[20px] italic leading-tight text-ink-900">{data.signature}</p>
                  )
                ) : null}
                <p className="text-[12px] font-semibold text-ink-700">
                  {data.signatureName}
                  {data.signatureRole ? <span className="font-normal text-ink-400"> · {data.signatureRole}</span> : null}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function BannerBlock({ data }: { data: BannerData }) {
  const showRating = data.showRating === true || data.showRating === "true";
  if (!data.image) return null;
  return (
    <section aria-label="Inside the store" className="container-page py-2 pb-8 sm:pb-10">
      <div className="relative aspect-[16/7.4] overflow-hidden rounded-2xl bg-surface sm:aspect-[16/6.4]">
        <Image
          src={data.image}
          alt="Shoppers picking fresh produce in the store"
          fill
          sizes="(max-width: 1024px) 100vw, 1160px"
          className="object-cover"
        />
        {showRating && data.rating ? (
          <div className="absolute bottom-4 left-4 flex items-center gap-2.5 rounded-full bg-accent-500 px-3 py-2 shadow-lg shadow-brand-900/15 sm:bottom-6 sm:left-6 sm:px-4">
            <span className="flex items-center gap-1">
              <Star size={15} className="fill-brand-900 text-brand-900" />
              <span className="text-[13.5px] font-black text-brand-900">{data.rating}</span>
            </span>
            <span className="text-[12px] font-bold text-brand-900/90">{data.ratingLabel || "Star"}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PillarsBlock({ data }: { data: { items?: PillarItem[] } }) {
  const items = data.items ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-label="Vision and mission" className="container-page py-6 sm:py-8">
      <div className="grid gap-6 sm:grid-cols-2 lg:gap-10">
        {items.map((item) => {
          const Icon = pillarIcons[(item.icon as keyof typeof pillarIcons) ?? "target"] ?? Target;
          return (
            <div key={item.title} className="flex gap-4">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
                <Icon size={19} strokeWidth={2.2} />
              </span>
              <div>
                <h3 className="text-[16px] font-extrabold text-ink-900">{item.title}</h3>
                {item.text ? (
                  <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-ink-500">{item.text}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TeamBlock({
  data,
  id,
}: {
  data: { eyebrow?: string; title?: string; titleAccent?: string; members?: TeamMember[] };
  id: string;
}) {
  const members = data.members ?? [];
  if (members.length === 0) return null;
  return (
    <section id={id} aria-labelledby="about-team-title" className="bg-surface-2 py-12 sm:py-14">
      <div className="container-page">
        <div className="mx-auto max-w-xl text-center">
          {data.eyebrow ? (
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-brand-600">{data.eyebrow}</p>
          ) : null}
          <h2 id="about-team-title" className="mt-2 text-[24px] leading-tight font-black text-ink-900 sm:text-[30px]">
            {data.title}
            {data.titleAccent ? <span className="block text-brand-600">{data.titleAccent}</span> : null}
          </h2>
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {members.map((member) => (
            <li key={`${member.name}-${member.role}`} className="overflow-hidden rounded-xl bg-white ring-1 ring-line">
              <div className="relative aspect-[4/4.6] bg-surface">
                {member.image ? (
                  <Image
                    src={member.image}
                    alt={member.name || "Team member"}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[12px] text-ink-300">
                    No photo
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <p className="text-[13.5px] font-extrabold text-ink-900">{member.name}</p>
                <p className="mt-0.5 text-[11.5px] text-ink-400">{member.role}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- page --- */

/**
 * About page (reference 2)
 * ------------------------
 * Four blocks, no more: intro + badge + signature, wide store banner with the
 * rating chip, the vision/mission pair and the team grid. The order, visibility
 * and every word/image come from `page_sections` and are edited in
 * Admin → Website → About page. Service strip and newsletter are shared
 * components driven by their own admin screens.
 */
export default async function AboutPage() {
  const [record, page, sections] = await Promise.all([
    getPageRecord("about"),
    getPageBySlug("about"),
    getPageSections("about"),
  ]);
  // A page that exists but is switched off (draft or hidden) is not public.
  if (record && (!record.published || !record.visible)) notFound();

  return (
    <>
      <ShopHero
        title={page?.title || "About Us"}
        current="About Us"
        subtitle={page?.subtitle || undefined}
      />

      {sections.length === 0 ? (
        <section className="container-page py-10 text-[14px] leading-relaxed text-ink-600">
          {page?.body?.trim() ? page.body.split(/\n{2,}/).map((paragraph, index) => <p key={index} className="mb-4">{paragraph}</p>)
            : <p>Information about the store has not been added yet.</p>}
        </section>
      ) : null}

      {sections.map((section: PageSectionRow) => {
        switch (section.type) {
          case "hero":
            return <HeroBlock key={section.id} data={pageSectionData<HeroData>(section)} />;
          case "banner":
            return <BannerBlock key={section.id} data={pageSectionData<BannerData>(section)} />;
          case "pillars":
            return <PillarsBlock key={section.id} data={pageSectionData<{ items?: PillarItem[] }>(section)} />;
          case "team":
            return (
              <TeamBlock
                key={section.id}
                id="about-team"
                data={pageSectionData<{ members?: TeamMember[] }>(section)}
              />
            );
          default:
            return null;
        }
      })}

      <ServiceFeatures />
      <Newsletter />
    </>
  );
}

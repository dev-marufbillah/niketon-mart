"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Check, Loader2, Mail, MapPin, Phone } from "lucide-react";
import { subscribeAction, type SubscribeState } from "@/lib/actions/newsletter";
import { socialPaths } from "@/config/site";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

export type ComingSoonData = {
  eyebrow: string;
  heading: string;
  headingAccent: string;
  imageUrl: string;
  imageAlt: string;
  newsletterEnabled: boolean;
  newsletterLabel: string;
  subscribeLabel: string;
  countdownEnabled: boolean;
  countdownEndsAt: string;
  showSocials: boolean;
  contactEnabled: boolean;
  ctaEnabled: boolean;
  ctaLabel: string;
  ctaHref: string;
  showCopyright: boolean;
};

type Remaining = { days: number; hours: number; minutes: number; seconds: number } | null;

function remainingUntil(iso: string): Remaining {
  const target = new Date(iso).getTime();
  if (!iso || Number.isNaN(target)) return null;
  const diff = target - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1_000) % 60),
  };
}

/** Live counter. Starts empty and fills after mount so SSR and hydration agree. */
function Countdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState<Remaining>(null);

  useEffect(() => {
    const initial = window.setTimeout(() => setRemaining(remainingUntil(endsAt)), 0);
    const timer = window.setInterval(() => setRemaining(remainingUntil(endsAt)), 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [endsAt]);

  // The launch time has passed: the counter disappears instead of showing zeros.
  if (!remaining) return null;

  const blocks = [
    { label: "Days", value: remaining?.days },
    { label: "Hours", value: remaining?.hours },
    { label: "Minutes", value: remaining?.minutes },
    { label: "Seconds", value: remaining?.seconds },
  ];

  return (
    <div className="mt-7 flex items-start" role="timer" aria-live="off">
      {blocks.map((block, index) => (
        <div
          key={block.label}
          className={cn(
            "min-w-[68px] flex-1 px-3 sm:min-w-[86px] sm:px-5",
            index > 0 && "border-l border-line",
            index === 0 && "pl-0",
          )}
        >
          <p className="text-[34px] leading-none font-extrabold tabular-nums text-ink-900 sm:text-[44px]">
            {block.value === undefined ? "—" : String(block.value).padStart(2, "0")}
          </p>
          <p className="mt-2 text-[12.5px] font-medium text-ink-400 sm:text-[13.5px]">{block.label}</p>
        </div>
      ))}
    </div>
  );
}

function SubscribeButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60 sm:h-12 sm:px-7"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : null}
      {pending ? "Sending…" : label}
    </button>
  );
}

function NotifyForm({ label, button }: { label: string; button: string }) {
  const [state, action] = useActionState<SubscribeState, FormData>(subscribeAction, null);

  return (
    <div className="mt-7">
      {label ? <p className="mb-2 text-[12.5px] font-medium text-ink-600">{label}</p> : null}
      <form action={action} className="flex flex-col gap-2 sm:flex-row" noValidate>
        <input type="hidden" name="source" value="coming-soon" />
        <label htmlFor="coming-soon-email" className="sr-only">
          Email address
        </label>
        <div className="relative flex-1">
          <Mail size={15} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-300" />
          <input
            id="coming-soon-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Enter your email"
            aria-invalid={Boolean(state?.error)}
            className={cn(
              "h-11 w-full rounded-lg border bg-white pr-4 pl-10 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500 sm:h-12",
              state?.error ? "border-red-400" : "border-line",
            )}
          />
        </div>
        <SubscribeButton label={button} />
      </form>
      <div aria-live="polite" className="mt-2 min-h-[18px] text-[12px]">
        {state?.error ? <p className="font-medium text-red-600">{state.error}</p> : null}
        {state?.success ? (
          <p className="inline-flex items-center gap-1.5 font-semibold text-brand-700">
            <Check size={13} /> {state.success}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Coming Soon page.
 * Left panel is the content column from the reference design, right panel is the
 * lifestyle image. Everything here is text the admin can edit; nothing is faked —
 * the form writes to the same subscribers collection as the homepage newsletter,
 * and the counter is a real clock to the launch time the store set.
 */
export function ComingSoonPage({
  data,
  store,
}: {
  data: ComingSoonData;
  store: { name: string; phone: string; phoneHref: string; email: string; address: string; socials: { label: string; href: string; icon: string }[]; copyright: string };
}) {
  const socials = store.socials.slice(0, 6);
  const year = new Date().getFullYear();

  return (
    <main className="min-h-dvh bg-white">
      <div className="flex min-h-dvh flex-col lg:flex-row">
        {/* --------------------------------------------------------- content */}
        <div className="flex flex-1 flex-col px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12 xl:px-20">
          <Link href="/" aria-label={`${store.name} — home`} className="inline-flex w-fit items-center gap-2.5">
            <span className="relative inline-flex size-9 items-center justify-center rounded-full bg-accent-500 text-brand-800" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" className="size-5" strokeWidth={1.9} stroke="currentColor">
                <path d="M5.6 9h12.8l-1.1 8.2a2.4 2.4 0 0 1-2.38 2.1H9.08a2.4 2.4 0 0 1-2.38-2.1L5.6 9Z" strokeLinejoin="round" />
                <path d="M9.2 9c0-2.1 1.25-3.6 2.8-3.6S14.8 6.9 14.8 9" strokeLinecap="round" />
                <path d="M9.6 12.4v3.2M14.4 12.4v3.2" strokeLinecap="round" opacity=".55" />
              </svg>
            </span>
            <span className="text-[19px] font-extrabold tracking-tight text-ink-900">
              {store.name}
              <span className="text-brand-600">.</span>
            </span>
          </Link>

          <div className="mt-12 max-w-[540px] sm:mt-16 lg:mt-[9vh]">
            {data.eyebrow ? (
              <p className="text-[13px] font-medium text-ink-500 sm:text-[14px]">{data.eyebrow}</p>
            ) : null}

            <h1 className="mt-2 text-[30px] leading-[1.14] font-extrabold tracking-tight text-ink-900 sm:text-[38px] lg:text-[42px]">
              {data.heading}
              {data.headingAccent ? (
                <>
                  <br />
                  <span className="text-brand-600">{data.headingAccent}</span>
                </>
              ) : null}
            </h1>

            {data.countdownEnabled ? <Countdown endsAt={data.countdownEndsAt} /> : null}

            {data.newsletterEnabled ? (
              <NotifyForm label={data.newsletterLabel} button={data.subscribeLabel} />
            ) : null}

            {data.ctaEnabled ? (
              <a
                href={data.ctaHref || "/"}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand-600 px-6 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-700"
              >
                {data.ctaLabel} <ArrowRight size={15} />
              </a>
            ) : null}

            {data.contactEnabled ? (
              <ul className="mt-6 space-y-1.5 text-[12.5px] text-ink-600">
                <li className="flex items-center gap-2">
                  <Phone size={13} className="text-brand-600" />
                  <a href={store.phoneHref} className="hover:text-brand-700">
                    {store.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail size={13} className="text-brand-600" />
                  <a href={`mailto:${store.email}`} className="hover:text-brand-700">
                    {store.email}
                  </a>
                </li>
                {store.address ? (
                  <li className="flex items-start gap-2">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>{store.address}</span>
                  </li>
                ) : null}
              </ul>
            ) : null}

            {data.showSocials && socials.length > 0 ? (
              <ul className="mt-8 flex flex-wrap items-center gap-2.5">
                {socials.map((social) => (
                  <li key={`${social.label}-${social.href}`}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="inline-flex size-9 items-center justify-center rounded-full bg-accent-500 text-brand-900 transition-colors hover:bg-accent-400"
                    >
                      <svg viewBox="0 0 24 24" className="size-[15px] fill-current">
                        <path d={socialPaths[social.icon as keyof typeof socialPaths] ?? socialPaths.facebook} />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {data.showCopyright ? (
            <p className="mt-auto pt-10 text-[11.5px] text-ink-400">
              {store.copyright || `© ${year} ${store.name}. All rights reserved.`}
            </p>
          ) : null}
        </div>

        {/* ----------------------------------------------------------- image */}
        <div className="relative min-h-[320px] p-3 pl-0 sm:p-4 sm:pl-0 lg:w-[46%] lg:min-h-0 lg:p-4 lg:pl-0">
          <div className="relative h-full min-h-[320px] overflow-hidden rounded-2xl bg-surface lg:min-h-[calc(100dvh-2rem)]">
            {data.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageUrl}
                alt={data.imageAlt}
                className="absolute inset-0 size-full object-cover object-[50%_28%]"
              />
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

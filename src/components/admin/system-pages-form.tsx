"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { ImageSettingField, type LibraryImage } from "@/components/admin/image-setting-field";
import {
  saveComingSoonAction,
  saveNotFoundAction,
  type SystemPageFormState,
} from "@/lib/admin/settings-actions";
import type { SiteSettings } from "@/lib/repositories/settings";

const label = "mb-1.5 block text-[12.5px] font-semibold text-ink-700";
const input =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13.5px] text-ink-900 outline-none transition-colors placeholder:text-ink-300 focus:border-brand-500";
const help = "mt-1 text-[11.5px] leading-relaxed text-ink-400";
const card = "rounded-2xl bg-white p-4 ring-1 ring-line";

function SaveButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center justify-center rounded-full bg-brand-600 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? busy : idle}
    </button>
  );
}

function Feedback({ state }: { state: SystemPageFormState }) {
  if (!state) return null;
  if (state.errors?.length) {
    return (
      <ul
        role="alert"
        className="space-y-1 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] font-semibold text-red-600"
      >
        {state.errors.map((error) => (
          <li key={error} className="flex items-start gap-1.5">
            <AlertCircle size={13} className="mt-0.5 shrink-0" /> {error}
          </li>
        ))}
      </ul>
    );
  }
  if (state.success) {
    return (
      <p
        role="status"
        className="flex items-start gap-1.5 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-brand-700"
      >
        <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> {state.success}
      </p>
    );
  }
  return null;
}

function Toggle({
  name,
  defaultChecked,
  title,
  note,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  note?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 rounded border-line" />
      <span>
        <span className="block text-[12.5px] font-semibold text-ink-800">{title}</span>
        {note ? <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-400">{note}</span> : null}
      </span>
    </label>
  );
}

/** 404 error page — copy, illustration, buttons and indexing. */
export function NotFoundSettingsForm({
  settings,
  media,
}: {
  settings: SiteSettings;
  media: LibraryImage[];
}) {
  const [state, action] = useActionState<SystemPageFormState, FormData>(saveNotFoundAction, null);
  const value = settings.notFound;

  return (
    <form action={action} className="space-y-3" noValidate>
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-extrabold text-ink-900">404 — page not found</h2>
          <a
            href="/this-page-does-not-exist"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold text-brand-700 hover:underline"
          >
            Preview the 404 page ↗
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={label}>Heading</span>
            <input name="notFoundHeading" defaultValue={value.heading} className={input} maxLength={80} required />
          </label>

          <label className="block sm:col-span-2">
            <span className={label}>Description</span>
            <textarea
              name="notFoundDescription"
              defaultValue={value.description}
              rows={3}
              maxLength={320}
              className={input}
            />
            <span className={help}>Two short lines read best. Leave empty to hide the paragraph.</span>
          </label>

          <div className="sm:col-span-2">
            <ImageSettingField
              label="Illustration"
              name="notFoundImageUrl"
              defaultValue={value.imageUrl}
              library={media}
              folder="errors"
              help="Shown above the heading. Upload a transparent PNG or pick one from the library."
            />
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Toggle
              name="notFoundShowHomeButton"
              defaultChecked={value.showHomeButton}
              title="Show the “go home” button"
              note="The green button in the middle of the page."
            />
            <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
              <label className="block">
                <span className={label}>Button label</span>
                <input name="notFoundHomeButtonLabel" defaultValue={value.homeButtonLabel} className={input} />
              </label>
              <label className="block">
                <span className={label}>Button link</span>
                <input
                  name="notFoundHomeButtonHref"
                  defaultValue={value.homeButtonHref}
                  placeholder="/"
                  className={input}
                />
              </label>
            </div>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Toggle
              name="notFoundShowBackButton"
              defaultChecked={value.showBackButton}
              title="Show a “back to previous page” button"
              note="Uses the visitor’s browser history; hidden by default because it does nothing when someone lands here from a search engine."
            />
            <label className="block sm:max-w-[320px]">
              <span className={label}>Back button label</span>
              <input name="notFoundBackButtonLabel" defaultValue={value.backButtonLabel} className={input} />
            </label>
          </div>

          <div className="sm:col-span-2">
            <Toggle
              name="notFoundNoindex"
              defaultChecked={value.noindex}
              title="Keep error pages out of search results"
              note="Adds a noindex tag. Recommended: broken URLs should not be indexed."
            />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <Feedback state={state} />
          <SaveButton idle="Save 404 page" busy="Saving…" />
        </div>
      </section>
    </form>
  );
}

/** Coming Soon page — content, countdown, newsletter and launch mode. */
export function ComingSoonSettingsForm({
  settings,
  media,
}: {
  settings: SiteSettings;
  media: LibraryImage[];
}) {
  const [state, action] = useActionState<SystemPageFormState, FormData>(saveComingSoonAction, null);
  const value = settings.comingSoon;

  return (
    <form action={action} className="space-y-3" noValidate>
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[14px] font-extrabold text-ink-900">Coming Soon — /coming-soon</h2>
          <a
            href="/coming-soon"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold text-brand-700 hover:underline"
          >
            Open the page ↗
          </a>
        </div>

        <div className="mb-3">
          <Toggle
            name="comingActivated"
            defaultChecked={value.activated}
            title="Launch mode — show this page instead of the shop"
            note="Off by default. When on, shoppers are sent to /coming-soon instead of the storefront; the admin panel and /api keep working so you can finish setting up. Turn it off to open the shop again."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Eyebrow</span>
            <input name="comingEyebrow" defaultValue={value.eyebrow} className={input} placeholder="Coming Soon" />
          </label>
          <label className="block">
            <span className={label}>Heading (first line)</span>
            <input name="comingHeading" defaultValue={value.heading} className={input} maxLength={60} required />
          </label>
          <label className="block">
            <span className={label}>Heading (green line)</span>
            <input
              name="comingHeadingAccent"
              defaultValue={value.headingAccent}
              className={input}
              maxLength={60}
              placeholder="When We Launch!"
            />
            <span className={help}>Rendered in brand green under the first line.</span>
          </label>

          <div className="sm:col-span-2">
            <ImageSettingField
              label="Side image"
              name="comingImageUrl"
              defaultValue={value.imageUrl}
              library={media}
              folder="coming-soon"
              help="Portrait crop works best; it fills the right half of the page."
            />
          </div>
          <label className="block sm:col-span-2">
            <span className={label}>Image description (for screen readers)</span>
            <input name="comingImageAlt" defaultValue={value.imageAlt} className={input} />
          </label>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-[14px] font-extrabold text-ink-900">Countdown &amp; newsletter</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Toggle
              name="comingCountdownEnabled"
              defaultChecked={value.countdownEnabled}
              title="Show the countdown"
              note="Hides itself once the launch date has passed — no negative numbers."
            />
          </div>
          <label className="block sm:col-span-2">
            <span className={label}>Launch date &amp; time (UTC)</span>
            <input
              type="datetime-local"
              name="comingCountdownEndsAt"
              defaultValue={value.countdownEndsAt ? value.countdownEndsAt.slice(0, 16) : ""}
              className={input}
            />
            <span className={help}>
              Stored as <code className="rounded bg-surface px-1 py-0.5">{value.countdownEndsAt || "—"}</code>. The
              store timezone is {Intl.DateTimeFormat().resolvedOptions().timeZone} in your browser — enter the time in
              UTC.
            </span>
          </label>

          <div className="sm:col-span-2">
            <Toggle
              name="comingNewsletterEnabled"
              defaultChecked={value.newsletterEnabled}
              title="Show the “get notified” email form"
              note="Addresses are saved to Marketing → Subscribers, exactly like the homepage newsletter."
            />
          </div>
          <label className="block">
            <span className={label}>Form label</span>
            <input name="comingNewsletterLabel" defaultValue={value.newsletterLabel} className={input} />
          </label>
          <label className="block">
            <span className={label}>Button label</span>
            <input name="comingSubscribeLabel" defaultValue={value.subscribeLabel} className={input} />
          </label>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 text-[14px] font-extrabold text-ink-900">Footer of the page</h2>
        <div className="space-y-2">
          <Toggle
            name="comingShowSocials"
            defaultChecked={value.showSocials}
            title="Show the social buttons"
            note="Uses the links in Site settings → Social profiles, in yellow circles."
          />
          <Toggle
            name="comingContactEnabled"
            defaultChecked={value.contactEnabled}
            title="Show the store phone and email"
            note="Pulled from Site settings, so there is only one place to change them."
          />
          <Toggle
            name="comingShowCopyright"
            defaultChecked={value.showCopyright}
            title="Show the copyright line"
            note="Uses Site settings → Footer copyright, or the store name and year when that is empty."
          />
        </div>

        <div className="mt-3 space-y-2">
          <Toggle
            name="comingCtaEnabled"
            defaultChecked={value.ctaEnabled}
            title="Add a button under the form"
            note="Optional — the reference design has none, so it is off by default."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Button label</span>
              <input name="comingCtaLabel" defaultValue={value.ctaLabel} className={input} />
            </label>
            <label className="block">
              <span className={label}>Button link</span>
              <input name="comingCtaHref" defaultValue={value.ctaHref} className={input} placeholder="/" />
            </label>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <Feedback state={state} />
          <SaveButton idle="Save Coming Soon page" busy="Saving…" />
        </div>
      </section>
    </form>
  );
}

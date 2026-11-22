"use client";

import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { footerColumns, socialPaths } from "@/config/site";
import { CURRENCY_CODE, CURRENCY_SYMBOL } from "@/lib/utils/currency";
import { useSiteSettings } from "@/lib/settings-provider";
import { Logo } from "@/components/layout/logo";
import { AccountLink } from "@/components/layout/account-link";

export function SiteFooter() {
  const settings = useSiteSettings();

  return (
    <footer className="bg-white">
      <div className="container-page pb-6 pt-2">
        <div className="overflow-hidden rounded-2xl bg-brand-600">
          <div className="grid gap-10 px-6 py-12 sm:px-10 lg:grid-cols-[1.35fr_2.4fr_1.1fr] lg:gap-8 lg:py-14">
            <div className="max-w-[290px]">
              <Logo />
              <p className="mt-4 text-[13.5px] leading-relaxed text-white/75">
                {settings.footerNote || settings.description}
              </p>
              <ul className="mt-5 flex items-center gap-2">
                {settings.socials.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className="inline-flex size-8 items-center justify-center rounded-full bg-white text-brand-700 transition-colors hover:bg-accent-500 hover:text-brand-900"
                    >
                      <svg viewBox="0 0 24 24" className="size-4 fill-current">
                        <path d={socialPaths[social.icon as keyof typeof socialPaths]} />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
              {footerColumns.map((column) => (
                <nav key={column.title} aria-label={column.title}>
                  <h3 className="text-[15px] font-bold text-white">{column.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        {link.href === "/my-account" ? (
                          <AccountLink className="text-[13.5px] text-white/75 transition-colors hover:text-accent-400">{link.label}</AccountLink>
                        ) : (
                          <Link href={link.href} className="text-[13.5px] text-white/75 transition-colors hover:text-accent-400">{link.label}</Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>

            <div>
              <h3 className="text-[15px] font-bold text-white">Contact Info</h3>
              <ul className="mt-4 space-y-3 text-[13.5px] text-white/75">
                {settings.phone && settings.phoneHref ? <li><a href={settings.phoneHref} className="inline-flex items-start gap-2 transition-colors hover:text-accent-400"><Phone size={15} className="mt-0.5 shrink-0 text-accent-400" />{settings.phone}</a></li> : null}
                {settings.email ? <li><a href={`mailto:${settings.email}`} className="inline-flex items-start gap-2 transition-colors hover:text-accent-400"><Mail size={15} className="mt-0.5 shrink-0 text-accent-400" />{settings.email}</a></li> : null}
                {settings.address ? <li className="inline-flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-accent-400" /><span className="max-w-[210px] leading-relaxed">{settings.address}</span></li> : null}
                {!settings.phone && !settings.email && !settings.address ? <li>Contact details have not been added yet.</li> : null}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/15 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <p className="text-[12.5px] text-white/70">
              {settings.copyright || `© ${new Date().getFullYear()} ${settings.name}. All rights reserved.`}
            </p>
            <div className="flex items-center gap-4">
              <span aria-label="Language" className="text-[13px] font-medium text-white/85">English</span>
              <span className="h-4 w-px bg-white/25" aria-hidden="true" />
              <span aria-label="Currency" className="text-[13px] font-medium text-white/85">{CURRENCY_CODE} ({CURRENCY_SYMBOL})</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

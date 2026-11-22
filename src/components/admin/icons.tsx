"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Small icon set used by the admin navigation (kept inline, no icon font). */
const paths: Record<string, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.6" />
      <rect x="14" y="3" width="7" height="5" rx="1.6" />
      <rect x="14" y="12" width="7" height="9" rx="1.6" />
      <rect x="3" y="16" width="7" height="5" rx="1.6" />
    </>
  ),
  orders: (
    <>
      <path d="M6 2h12l1.5 4H4.5L6 2Z" />
      <path d="M4 6h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" />
      <path d="M9 11h6" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6" />
      <path d="M17 14a5.5 5.5 0 0 1 4 5.5" />
    </>
  ),
  inventory: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  products: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.6" />
      <rect x="13" y="3" width="8" height="8" rx="1.6" />
      <rect x="3" y="13" width="8" height="8" rx="1.6" />
      <rect x="13" y="13" width="8" height="8" rx="1.6" />
    </>
  ),
  tag: (
    <>
      <path d="M20.5 13.5 13 21a2 2 0 0 1-2.8 0L3 13.8V4a1 1 0 0 1 1-1h9.8l6.7 6.7a2 2 0 0 1 0 2.8Z" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V21h13V9.5" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.8 4.6L18.5 9.5l-4.7 1.9L12 16l-1.8-4.6L5.5 9.5l4.7-1.9L12 3Z" />
      <path d="M18 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.4" />
      <circle cx="8.5" cy="9" r="1.6" />
      <path d="m4 17 5.5-5 4 3.5L18 11l2 2" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4a1 1 0 0 0 1 1h2l9 5V4L7 9H5a1 1 0 0 0-1 1Z" />
      <path d="M19 9a4 4 0 0 1 0 6" />
    </>
  ),
  article: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.3c-.8.5-1.2 1-1.2 2" />
      <path d="M12 17h.01" />
    </>
  ),
  quote: (
    <>
      <path d="M9 6c-2.8 0-5 2.2-5 5v7h6v-7H6" />
      <path d="M20 6c-2.8 0-5 2.2-5 5v7h6v-7h-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v6c0 4.4-3.3 7.9-8 9-4.7-1.1-8-4.6-8-9V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  pages: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h7M9 16h5" />
    </>
  ),
  media: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 15 4.5-4 3.5 3 3-2.5L21 17" />
      <circle cx="8" cy="9" r="1.2" />
    </>
  ),
  basket: (
    <>
      <path d="M4 9h16l-1.5 10.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 9Z" />
      <path d="M8.5 9 11 3M15.5 9 13 3" />
    </>
  ),
  prep: (
    <>
      <path d="M4 20 20 4" />
      <path d="M14 4h6v6" />
      <path d="M4 14h6v6H4z" />
    </>
  ),
  fish: (
    <>
      <path d="M3 12c3.5-4 6.5-6 10-6 3.5 0 6.5 2.5 8 6-1.5 3.5-4.5 6-8 6-3.5 0-6.5-2-10-6Z" />
      <circle cx="16" cy="10" r=".8" />
      <path d="M3 12c1.6.6 2.8 1.6 3.6 2.8" />
    </>
  ),
  coupon: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z" />
      <path d="M14 6v3M14 15v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </>
  ),
  map: (
    <>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  truck: (
    <>
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7z" />
      <circle cx="7" cy="18" r="1.8" />
      <circle cx="17.5" cy="18" r="1.8" />
    </>
  ),
  payment: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.4" />
      <path d="M2.5 10h19" />
      <path d="M6 15h4" />
    </>
  ),
  invoice: (
    <>
      <path d="M5 3.5h14v17l-3.5-2-3.5 2-3.5-2L5 20.5z" />
      <path d="M9 8.5h6M9 12.5h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 22.4 11a2 2 0 1 1 0 4Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 4.5a3.4 3.4 0 0 1 0 7" />
      <path d="M17.5 14.5A6 6 0 0 1 21 20" />
    </>
  ),
  activity: (
    <>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  star: (
    <>
      <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 3Z" />
    </>
  ),
};

export function AdminIcon({ name, size = 17 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.dashboard}
    </svg>
  );
}

/** Kept for backwards compatibility with components that import `Icon`. */
export const Icon = AdminIcon;
export const IconContext = createContext<{ size?: number }>({});
export const useIcon = () => useContext(IconContext);

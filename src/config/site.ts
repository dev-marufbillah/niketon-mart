import type { NavLink } from "@/lib/types/domain";

export const siteConfig = {
  name: "Niketon Mart",
  tagline: "Grocery & Fresh Market",
  description:
    "Everyday grocery and fresh-market essentials.",
  phone: "",
  phoneHref: "",
  email: "",
  address: "",
  defaultLocation: "",
  freeShippingThreshold: 50,
  supportHours: "",
  socials: [
    { label: "Facebook", href: "https://facebook.com", icon: "facebook" },
    { label: "Twitter", href: "https://twitter.com", icon: "twitter" },
    { label: "Pinterest", href: "https://pinterest.com", icon: "pinterest" },
    { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
    { label: "YouTube", href: "https://youtube.com", icon: "youtube" },
  ],
} as const;

/** Shared English navigation for desktop and mobile storefronts. */
export const mainNav: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/home-grocery" },
  { label: "Categories", href: "/categories" },
  { label: "Fresh Market", href: "/fresh-market" },
  { label: "Grocery", href: "/grocery" },
  { label: "About Us", href: "/about" },
];

export const footerColumns = [
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Blog", href: "/blogs" },
      { label: "Contact Us", href: "/contact" },
      { label: "Career", href: "/careers" },
    ],
  },
  {
    title: "Customer Services",
    links: [
      { label: "My Account", href: "/my-account" },
      { label: "Track Your Order", href: "/track-order" },
      { label: "Return", href: "/returns" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Our Information",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "User Terms & Condition", href: "/terms" },
      { label: "Return Policy", href: "/return-policy" },
    ],
  },
] as const;

/** Brand glyph paths (24×24) so the header and footer share one icon set. */
export const socialPaths = {
  facebook:
    "M13.5 21v-7.2h2.4l.4-2.9h-2.8V9.1c0-.8.2-1.4 1.4-1.4h1.5V5.1c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8.1v2.9h2.4V21h3Z",
  twitter:
    "M17.3 5h2.3l-5 5.7L20.6 19h-4.4l-3.4-4.5L8.9 19H6.6l5.3-6.1L5.6 5h4.5l3.1 4.1L17.3 5Zm-.8 12.4h1.3L9.9 6.5H8.5l8 10.9Z",
  pinterest:
    "M12 4a8 8 0 0 0-3 15.4c-.1-1 0-2.2.2-3.2l1-4.2s-.2-.5-.2-1.2c0-1.1.6-2 1.4-2 .7 0 1 .5 1 1.1 0 .7-.4 1.7-.7 2.7-.2.8.4 1.5 1.3 1.5 1.6 0 2.8-1.7 2.8-4.1 0-2.1-1.5-3.6-3.7-3.6a4 4 0 0 0-4.2 4c0 .8.3 1.7.7 2.1.1.1.1.2.1.3l-.3 1c0 .2-.1.2-.3.1-1.2-.6-2-2.4-2-3.8 0-3.1 2.3-6 6.5-6 3.4 0 6.1 2.4 6.1 5.7 0 3.4-2.1 6.1-5.1 6.1-1 0-1.9-.5-2.2-1.1l-.6 2.3c-.2.8-.8 1.9-1.2 2.5A8 8 0 1 0 12 4Z",
  instagram:
    "M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Zm0 7.6a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm5.9-7.8a1.07 1.07 0 1 1-2.14 0 1.07 1.07 0 0 1 2.14 0ZM20.8 8.5c-.1-1.4-.4-2.6-1.4-3.6s-2.2-1.3-3.6-1.4c-1.4-.1-5.7-.1-7.1 0-1.4.1-2.6.4-3.6 1.4S3.8 7.1 3.7 8.5c-.1 1.4-.1 5.7 0 7.1.1 1.4.4 2.6 1.4 3.6s2.2 1.3 3.6 1.4c1.4.1 5.7.1 7.1 0 1.4-.1 2.6-.4 3.6-1.4s1.3-2.2 1.4-3.6c.1-1.4.1-5.7 0-7.1Zm-1.7 8.6a3 3 0 0 1-1.7 1.7c-1.2.5-4.1.4-5.4.4s-4.2.1-5.4-.4a3 3 0 0 1-1.7-1.7c-.5-1.2-.4-4.1-.4-5.4s-.1-4.2.4-5.4a3 3 0 0 1 1.7-1.7c1.2-.5 4.1-.4 5.4-.4s4.2-.1 5.4.4a3 3 0 0 1 1.7 1.7c.5 1.2.4 4.1.4 5.4s.1 4.2-.4 5.4Z",
  youtube:
    "M21.6 8.4a2.5 2.5 0 0 0-1.8-1.8C18.2 6.2 12 6.2 12 6.2s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 8.4C2 10 2 12 2 12s0 2 .4 3.6a2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-3.6.4-3.6s0-2-.4-3.6ZM10.2 15V9l5.2 3-5.2 3Z",
} as const;

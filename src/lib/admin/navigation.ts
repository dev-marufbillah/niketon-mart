import type { Permission } from "@/lib/auth/permissions";

/**
 * Admin navigation
 * ----------------
 * Single source of truth for the sidebar, the mobile drawer and the dashboard
 * shortcuts. Every item names the permission that unlocks it, so a role can
 * never see a link it cannot open. Items with `soon: true` are hidden.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  permission: Permission;
  badge?: "orders-pending";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const adminNav: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Dashboard", icon: "dashboard", permission: "dashboard.view" }],
  },
  {
    label: "Sales",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "orders", permission: "orders.view", badge: "orders-pending" },
      { href: "/admin/customers", label: "Customers", icon: "customers", permission: "customers.view" },
      { href: "/admin/inventory", label: "Inventory", icon: "inventory", permission: "inventory.manage" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/catalogue/products", label: "Products", icon: "products", permission: "products.view" },
      { href: "/admin/catalogue/taxonomy", label: "Categories & brands", icon: "tag", permission: "products.manage" },
      { href: "/admin/reviews", label: "Reviews", icon: "star", permission: "content.view" },
    ],
  },
  {
    label: "CMS",
    items: [
      { href: "/admin/homepage", label: "Homepage", icon: "home", permission: "content.view" },
      { href: "/admin/home/our-top-picks", label: "Our Top Picks", icon: "sparkles", permission: "content.manage" },
      { href: "/admin/r/hero_slides", label: "Hero slides", icon: "image", permission: "content.view" },
      { href: "/admin/r/promo_banners", label: "Promo banners", icon: "megaphone", permission: "content.view" },
      { href: "/admin/r/posts", label: "Blog posts", icon: "article", permission: "content.view" },
      { href: "/admin/r/blog_categories", label: "Blog categories", icon: "tag", permission: "content.view" },
      { href: "/admin/r/authors", label: "Blog authors", icon: "customers", permission: "content.view" },
      { href: "/admin/r/faqs", label: "FAQs", icon: "help", permission: "content.view" },
      { href: "/admin/r/faq_categories", label: "FAQ categories", icon: "tag", permission: "content.view" },
      { href: "/admin/r/testimonials", label: "Testimonials", icon: "quote", permission: "content.view" },
      { href: "/admin/r/service_features", label: "Service benefits", icon: "shield", permission: "content.view" },
      { href: "/admin/pages/about", label: "About page", icon: "pages", permission: "content.view" },
      { href: "/admin/pages/contact", label: "Contact page", icon: "mail", permission: "content.view" },
      { href: "/admin/r/pages", label: "Pages", icon: "pages", permission: "content.view" },
      { href: "/admin/pages/system", label: "404 & Coming Soon", icon: "help", permission: "content.view" },
      { href: "/admin/settings", label: "Site settings", icon: "settings", permission: "settings.manage" },
      { href: "/admin/media", label: "Media library", icon: "media", permission: "media.manage" },
    ],
  },
  {
    label: "Fresh market",
    items: [
      { href: "/admin/preparation", label: "Preparation & cutting", icon: "prep", permission: "products.view" },
      { href: "/admin/catalogue/products", label: "Fish, meat & produce", icon: "fish", permission: "products.view" },
      { href: "/admin/r/baskets", label: "Daily baskets", icon: "basket", permission: "content.view" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/marketing", label: "Marketing overview", icon: "megaphone", permission: "marketing.manage" },
      { href: "/admin/r/coupons", label: "Coupons", icon: "coupon", permission: "marketing.manage" },
      { href: "/admin/r/subscribers", label: "Subscribers", icon: "mail", permission: "marketing.manage" },
      { href: "/admin/r/contact_messages", label: "Contact messages", icon: "quote", permission: "content.view" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/r/delivery_areas", label: "Delivery areas", icon: "map", permission: "delivery.manage" },
      { href: "/admin/r/delivery_partners", label: "Delivery partners", icon: "truck", permission: "delivery.manage" },
      { href: "/admin/r/payment_methods", label: "Payment methods", icon: "payment", permission: "payments.manage" },
      { href: "/admin/payments", label: "Payment records", icon: "invoice", permission: "payments.manage" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/admin/users", label: "Admin users", icon: "users", permission: "users.manage" },
      { href: "/admin/activity", label: "Activity log", icon: "activity", permission: "settings.manage" },
    ],
  },
];

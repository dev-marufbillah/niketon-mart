import { products as productSeed } from "@/lib/data/products";
import { categories as categorySeed } from "@/lib/data/categories";
import { brandSeed, productTypeSeed } from "@/lib/data/brands";
import { freshMarketProducts, preparationPresetSeed } from "@/lib/data/fresh-market";
import { faqs, testimonials } from "@/lib/data/content";
import { siteConfig } from "@/config/site";
import { buildSeedReviews, detailsFor, optionsFor } from "@/lib/db/seed-product-details";
import {
  authorsSeed,
  blogCategoriesSeed,
  faqCategoriesSeed,
  faqCategoryAssignments,
  pageSectionsSeed,
  postsSeed,
} from "@/lib/db/seed-content";
import type { Row } from "@/lib/db/types";

/**
 * Seed data
 * ---------
 * The database is created from this file the first time the app runs. It is the
 * only place sample content lives; every row is written to the database and is
 * then owned by the admin panel.
 *
 * `SEED_VERSION` lets future releases add new collections/rows without touching
 * existing ones (see `ensureSeed` in `lib/db/index.ts`).
 */

export const SEED_VERSION = 13;

const now = Date.now();
const daysAgo = (days: number) => new Date(now - days * 86_400_000).toISOString();

/** Seeded reviews, reused to derive each product's starting star rating. */
const seededReviews = buildSeedReviews(productSeed);

const ratingFor = (productId: string) => {
  const approved = seededReviews.filter(
    (review) => review.productId === productId && review.status === "approved",
  );
  if (approved.length === 0) return undefined;
  const average = approved.reduce((total, review) => total + review.rating, 0) / approved.length;
  return { rating: Math.round(average * 10) / 10, reviewCount: approved.length };
};

/** Delivery windows offered by the Dhaka areas. */
const morningSlots = ["09:00 – 12:00", "12:00 – 15:00", "15:00 – 18:00", "18:00 – 21:00"];

export const seedCollections: Record<string, Row[]> = {
  settings: [
    {
      id: "site",
      siteName: "Niketon Mart",
      tagline: "Your Online Grocery Store",
      description:
        "Everyday grocery and a fresh market — vegetables, fruit, fish, meat, eggs and dairy — delivered the same day.",
      logoText: "Niketon Mart",
      logoMark: "basket",
      phone: siteConfig.phone,
      phoneHref: siteConfig.phoneHref,
      email: siteConfig.email,
      address: siteConfig.address,
      supportHours: "24×7 Support",
      announcement: {
        enabled: true,
        message: "Sign up and GET 25% OFF for your first order.",
        ctaLabel: "Shop now",
        ctaHref: "/home-grocery",
      },
      socials: siteConfig.socials.map((social) => ({ ...social })),
      seo: {
        title: "Niketon Mart — Online Grocery Store",
        description:
          "Order everyday grocery and fresh market produce from Niketon Mart: vegetables, fruit, fish, meat, eggs and dairy.",
        keywords: "online grocery, fresh fish, fresh meat, vegetables, fruit, eggs, dairy, Dhaka",
      },
      commerce: {
        currency: "BDT",
        currencySymbol: "৳",
        taxRate: 0,
        freeShippingThreshold: siteConfig.freeShippingThreshold,
        defaultDeliveryFee: 3.5,
        minOrderValue: 10,
        codEnabled: true,
        orderPrefix: "NM",
      },
      contact: {
        hours: "Saturday – Thursday, 8:00 am – 10:00 pm · Friday, 2:00 pm – 10:00 pm",
        supportNote: "Order support, delivery changes and returns — one team, one number.",
        formHeading: "Send us a message",
        formNote: "Tell us what happened and include your order ID if you have one. We reply within one working day.",
      },
      footer: {
        description:
          "Niketon Mart brings the grocery aisle and the fresh market to your door — fruit, vegetables, fish and meat cleaned and cut exactly how you cook.",
        copyright: "© 2026 Niketon Mart. All rights reserved.",
      },
      maintenance: { storefrontEnabled: true, message: "" },
      updatedAt: new Date(now).toISOString(),
    },
  ],

  /* ---------------------------------------------------------------- catalogue */
  products: [...productSeed, ...freshMarketProducts].map((product) => {
    const { options, images } = optionsFor(product);
    const derived = ratingFor(product.id);
    return {
      ...product,
      ...(derived ?? {}),
      stock: product.stock ?? 0,
      status: product.status ?? "active",
      visibility: product.visibility ?? "visible",
      attributes: product.attributes ?? [],
      createdAt: product.createdAt ?? daysAgo(60),
      soldCount: product.soldCount ?? 0,
      // Product Details experience: gallery, variations and the additional
      // information record are part of the seed so a fresh database is complete.
      images: product.images?.length ? product.images : images,
      // A variation set authored in the fresh-market seed wins over the generic
      // one derived from the weight label.
      ...(product.options?.length ? {} : options ? { options } : {}),
      details: detailsFor(product),
    };
  }),
  preparation_presets: preparationPresetSeed.map((preset) => ({ ...preset })),
  // A user-requested starter category for a brand-new local demo store only.
  // Production seeding skips categories; existing stores are never migrated or
  // matched by name. After creation this row is edited/deleted in the admin.
  categories: [
    ...categorySeed.map((category) => ({ ...category, visible: category.visible ?? true })),
    { id: "dates", slug: "dates", name: "Dates", icon: "", group: "pantry", visible: true,
      showOnHome: false, showInNavigation: true, showInPrimaryNavigation: true, familyFiltersOnly: true },
    ...[
      { id: "dates-ajwa", name: "Ajwa" }, { id: "dates-medjool", name: "Medjool" },
      { id: "dates-mabroom", name: "Mabroom" }, { id: "dates-safawi", name: "Safawi" },
      { id: "dates-sukkari", name: "Sukkari" },
    ].map(({ id, name }) => ({ id, slug: id, name, icon: "", group: "pantry", parentId: "dates", visible: true,
      showOnHome: false, showInNavigation: true, showInPrimaryNavigation: false })),
  ],
  brands: brandSeed.map((brand) => ({ ...brand, visible: brand.visible ?? true })),
  product_types: productTypeSeed.map((type) => ({ ...type, visible: type.visible ?? true })),

  /* ---------------------------------------------------------------- homepage */
  homepage: [
    {
      id: "homepage",
      sections: [
        { key: "hero", label: "Hero banner", visible: true, order: 1 },
        { key: "categories", label: "Featured categories", visible: true, order: 2 },
        { key: "promos", label: "Promo banners", visible: true, order: 3 },
        { key: "featured", label: "Featured products", visible: true, order: 4 },
        { key: "campaign", label: "Discount countdown", visible: true, order: 5 },
        { key: "deals", label: "Deals of the day", visible: true, order: 6 },
        { key: "weekly", label: "Weekly deals banner", visible: true, order: 7 },
        { key: "topPicks", label: "Our Top Picks", visible: true, order: 8 },
        { key: "testimonials", label: "Testimonials", visible: true, order: 9 },
        { key: "blog", label: "News & blogs", visible: true, order: 10 },
        { key: "faq", label: "FAQ", visible: true, order: 11 },
        { key: "services", label: "Service benefits", visible: true, order: 12 },
        { key: "lifestyle", label: "Lifestyle strip", visible: true, order: 13 },
        { key: "newsletter", label: "Newsletter", visible: true, order: 14 },
      ],
      copy: {
        hero: {
          badge: "Your Online Grocery Store",
          title: "Your One-Stop Shop for",
          titleAccent: "Quality Groceries",
          subtitle:
            "Fresh produce, pantry staples and everyday essentials delivered to your door the same day.",
          primaryLabel: "Shop Now",
          primaryHref: "/home-grocery",
          secondaryLabel: "View All Products",
          secondaryHref: "/home-grocery",
          rating: "4.8 Ratings+",
          customers: "Trusted by 75k+ Customers",
          image: "/images/hero-woman.png",
        },
        categories: {
          eyebrow: "Categories",
          title: "Featured",
          titleAccent: "Categories",
        },
        promos: { eyebrow: "", title: "Promotions", titleAccent: "" },
        featured: {
          eyebrow: "Products",
          title: "Featured",
          titleAccent: "Products",
          ctaLabel: "View All Products",
          ctaHref: "/home-grocery",
          productIds: [],
        },
        campaign: {
          eyebrow: "Seasonal offer",
          title: "Summer",
          titleAccent: "Discount",
          subtitle: "Get 50% off - Limited Time Offer!",
          ctaLabel: "Shop Now",
          ctaHref: "/home-grocery?campaign=summer",
          endsAt: "",
          leftImage: "/images/lifestyle/countdown-left.jpg",
          rightImage: "/images/lifestyle/produce-bin.jpg",
        },
        deals: {
          eyebrow: "Today Deals",
          title: "Deals",
          titleAccent: "of the Day",
          description:
            "Hand-picked savings on the products our customers buy most. Prices refresh every morning.",
          productIds: [],
        },
        weekly: {
          eyebrow: "Weekly Deals",
          title: "Unbeatable Offers: Your",
          titleAccent: "Weekly Grocery Specials",
          subtitle: "A new basket of savings every Monday — while stocks last.",
          ctaLabel: "Shop Now",
          ctaHref: "/home-grocery?collection=weekly",
          image: "/images/deals-basket.png",
        },
        testimonials: {
          eyebrow: "Testimonials",
          title: "Testimonials from",
          titleAccent: "Our Loyal Customers",
        },
        blog: {
          eyebrow: "News & Blogs",
          title: "Our Latest",
          titleAccent: "News & Blogs",
          ctaLabel: "View All",
          ctaHref: "/blog",
          postIds: [],
        },
        faq: {
          eyebrow: "FAQ",
          title: "Frequently Asked",
          titleAccent: "Questions",
        },
        services: { eyebrow: "", title: "Why shop with us", titleAccent: "" },
        lifestyle: { eyebrow: "", title: "Fresh groceries in real kitchens", titleAccent: "" },
        newsletter: {
          eyebrow: "Our Newsletter",
          title: "Subscribe to Our Newsletter to Get",
          titleAccent: "Updates on Our Latest Offers",
          subtitle: "Join the store's mailing list for future updates.",
          buttonLabel: "Subscribe",
        },
      },
      updatedAt: new Date(now).toISOString(),
    },
  ],

  hero_slides: [
    {
      id: "slide_default",
      badge: "Your Online Grocery Store",
      title: "Your One-Stop Shop for",
      titleAccent: "Quality Groceries",
      subtitle:
        "Fresh produce, pantry staples and everyday essentials delivered to your door the same day.",
      image: "/images/hero-woman.png",
      primaryLabel: "Shop Now",
      primaryHref: "/home-grocery",
      secondaryLabel: "View All Products",
      secondaryHref: "/home-grocery",
      visible: true,
      order: 1,
    },
  ],

  promo_banners: [
    {
      id: "promo_veg",
      badge: "Flat 20% Discount",
      title: "Purely Fresh",
      titleAccent: "Vegetables",
      description: "Crisp, farm-picked vegetables at prices that make the weekly shop easy.",
      href: "/home-grocery?category=vegetables",
      image: "/images/promo-vegetables.png",
      tone: "light",
      visible: true,
      order: 1,
    },
    {
      id: "promo_fruit",
      badge: "Flat 25% Discount",
      title: "Fresh Fruits,",
      titleAccent: "Pure Quality",
      description: "Seasonal fruit boxes packed the morning they are delivered.",
      href: "/home-grocery?category=fresh-fruits",
      image: "/images/promo-fruits.png",
      tone: "yellow",
      visible: true,
      order: 2,
    },
  ],

  testimonials: testimonials.map((testimonial, index) => ({
    ...testimonial,
    visible: true,
    order: index + 1,
  })),

  reviews: seededReviews,

  faq_categories: faqCategoriesSeed,

  faqs: faqs.map((faq, index) => ({
    ...faq,
    categoryId: faqCategoryAssignments[faq.id] ?? "",
    visible: true,
    order: index + 1,
  })),

  blog_categories: blogCategoriesSeed,

  authors: authorsSeed,

  posts: postsSeed,

  page_sections: pageSectionsSeed,

  service_features: [
    {
      id: "svc_shipping",
      title: "Free Shipping",
      description: "Free delivery on orders over ৳ 50",
      icon: "shipping",
      visible: true,
      order: 1,
    },
    {
      id: "svc_payment",
      title: "Flexible Payment",
      description: "Cash on delivery or pay online",
      icon: "payment",
      visible: true,
      order: 2,
    },
    {
      id: "svc_support",
      title: "24×7 Support",
      description: "Real people, every day of the week",
      icon: "support",
      visible: true,
      order: 3,
    },
  ],

  pages: [
    {
      id: "page_about",
      slug: "about",
      title: "About Us",
      subtitle: "A neighbourhood grocer built for how people actually shop.",
      heroImage: "/images/lifestyle/strip-1.jpg",
      body: "Niketon Mart started as a single delivery route and grew into a full grocery service for homes and workplaces. We buy directly from growers, pack the same morning and deliver the same day.\n\nOur promise is simple: honest prices, fresher produce and a delivery you can plan around.",
      seoTitle: "About Niketon Mart",
      seoDescription: "How Niketon Mart sources, packs and delivers fresh groceries.",
      visible: true,
      published: true,
      updatedAt: daysAgo(12),
    },
    {
      id: "page_contact",
      slug: "contact",
      title: "Contact Us",
      subtitle: "We answer every message within one working day.",
      heroImage: "",
      body: "Call us on +123-456-789, email example@gmail.com or use the form below. Our support desk is open 24×7.",
      seoTitle: "Contact Niketon Mart",
      seoDescription: "Get in touch with the Niketon Mart team.",
      visible: true,
      published: true,
      updatedAt: daysAgo(20),
    },
    {
      id: "page_privacy",
      slug: "privacy",
      title: "Privacy policy",
      subtitle: "What we collect, why we collect it and how to remove it.",
      heroImage: "",
      body: "We collect only the information needed to fulfil your order: your name, contact details and delivery address. We never sell customer data.\n\nYou can request a copy or deletion of your data at any time by emailing example@gmail.com.",
      seoTitle: "Privacy policy",
      seoDescription: "How Niketon Mart handles customer data.",
      visible: true,
      published: true,
      updatedAt: daysAgo(45),
    },
    {
      id: "page_terms",
      slug: "terms",
      title: "Terms & conditions",
      subtitle: "The rules that apply when you order from us.",
      heroImage: "",
      body: "Orders are confirmed when payment is authorised. Prices include applicable taxes. Delivery windows are estimates and may move during peak hours.\n\nPerishable goods can be returned within 24 hours of delivery if they do not meet our quality standard.",
      seoTitle: "Terms & conditions",
      seoDescription: "Niketon Mart terms of service.",
      visible: true,
      published: true,
      updatedAt: daysAgo(45),
    },
    {
      id: "page_returns",
      slug: "return-policy",
      title: "Return & refund policy",
      subtitle: "If something is not right, we fix it.",
      heroImage: "",
      body: "Report an issue within 24 hours of delivery for fresh items, or 7 days for packaged goods. Refunds are issued to the original payment method within 3–5 working days.",
      seoTitle: "Return & refund policy",
      seoDescription: "How returns and refunds work at Niketon Mart.",
      visible: true,
      published: true,
      updatedAt: daysAgo(45),
    },
  ],

  coupons: [
    {
      id: "coupon_welcome",
      code: "WELCOME25",
      description: "25% off the first order",
      type: "percent",
      value: 25,
      minSubtotal: 20,
      maxDiscount: 15,
      usageLimit: 0,
      usedCount: 0,
      startsAt: daysAgo(30).slice(0, 10),
      endsAt: "",
      active: true,
      appliesTo: "all",
      channels: ["grocery", "basket"],
    },
    {
      id: "coupon_fresh15",
      code: "FRESH15",
      description: "15% off fresh fruit and vegetables",
      type: "percent",
      value: 15,
      minSubtotal: 15,
      maxDiscount: 10,
      usageLimit: 0,
      usedCount: 0,
      startsAt: daysAgo(14).slice(0, 10),
      endsAt: "",
      active: true,
      appliesTo: "categories",
      categoryIds: ["fresh-fruits", "vegetables"],
      channels: ["grocery"],
    },
    {
      id: "coupon_freeship",
      code: "FREESHIP",
      description: "Free delivery on orders over ৳ 30",
      type: "free-shipping",
      value: 0,
      minSubtotal: 30,
      maxDiscount: 0,
      usageLimit: 0,
      usedCount: 0,
      startsAt: daysAgo(30).slice(0, 10),
      endsAt: "",
      active: true,
      appliesTo: "all",
      channels: ["grocery", "basket"],
    },
  ],

  delivery_areas: [
    {
      id: "area_dhanmondi",
      name: "Dhanmondi",
      fee: 2,
      minOrder: 10,
      eta: "Same day",
      active: true,
      slots: morningSlots,
      note: "Deliveries every day, 9am to 9pm.",
    },
    {
      id: "area_gulshan",
      name: "Gulshan",
      fee: 3,
      minOrder: 15,
      eta: "Same day",
      active: true,
      slots: morningSlots,
      note: "Order before 6pm for same-day delivery.",
    },
    {
      id: "area_banani",
      name: "Banani",
      fee: 3,
      minOrder: 15,
      eta: "Same day",
      active: true,
      slots: morningSlots,
      note: "Order before 6pm for same-day delivery.",
    },
    {
      id: "area_uttara",
      name: "Uttara",
      fee: 4,
      minOrder: 20,
      eta: "Next day",
      active: true,
      slots: ["09:00 – 12:00", "15:00 – 18:00"],
      note: "Next-day delivery only.",
    },
  ],

  delivery_partners: [
    { id: "dp_rafiq", name: "Rafiq Hasan", phone: "+8801711000111", zone: "Dhanmondi", active: true },
    { id: "dp_sumaiya", name: "Sumaiya Akter", phone: "+8801711000222", zone: "Gulshan", active: true },
    { id: "dp_bikash", name: "Bikash Das", phone: "+8801711000333", zone: "Uttara", active: false },
  ],

  payment_methods: [
    {
      id: "pay_cod",
      label: "Cash on delivery",
      description: "Pay the rider in cash when your order arrives.",
      type: "cod",
      mode: "offline",
      instructions: "Please keep the exact amount ready — riders carry limited change.",
      active: true,
      order: 1,
    },
    {
      id: "pay_card",
      label: "Card on delivery",
      description: "Tap or insert your card on the rider's terminal at the door.",
      type: "card",
      mode: "offline",
      instructions: "",
      active: false,
      order: 2,
    },
    {
      id: "pay_bkash",
      label: "bKash",
      description: "Send money to our bKash merchant number, then enter the transaction ID.",
      type: "wallet",
      mode: "manual-transfer",
      instructions:
        "bKash (Send Money): 01711-000000 — Niketon Mart. After sending, enter the TrxID from your bKash message. We verify it before dispatch.",
      active: false,
      order: 3,
    },
    {
      id: "pay_nagad",
      label: "Nagad",
      description: "Send money to our Nagad merchant number, then enter the transaction ID.",
      type: "wallet",
      mode: "manual-transfer",
      instructions:
        "Nagad (Send Money): 01711-000000 — Niketon Mart. After sending, enter the TrxID from your Nagad confirmation. We verify it before dispatch.",
      active: false,
      order: 4,
    },
    {
      id: "pay_sslcommerz",
      label: "Card / pay online (SSLCommerz)",
      description: "Pay now with Visa, Mastercard, bKash or Nagad through SSLCommerz.",
      type: "gateway",
      mode: "gateway",
      provider: "sslcommerz",
      instructions: "",
      active: false,
      order: 5,
    },
  ],

  baskets: [
    {
      id: "basket_daily",
      slug: "daily-essentials-basket",
      name: "Daily Essentials Basket",
      cadence: "daily",
      description: "Milk, eggs, bread, seasonal fruit and two vegetables — the everyday top-up.",
      price: 24,
      compareAtPrice: 30,
      items: [
        { productId: "p-eggs", quantity: 1 },
        { productId: "p-almond-milk", quantity: 1 },
        { productId: "p-bread", quantity: 1 },
        { productId: "p-bananas", quantity: 1 },
        { productId: "p-tomatoes", quantity: 1 },
      ],
      image: "/images/deals-basket.png",
      visible: true,
      available: true,
      order: 1,
    },
    {
      id: "basket_weekly",
      slug: "weekly-family-basket",
      name: "Weekly Family Basket",
      cadence: "weekly",
      description: "A full week of produce for a family of four, packed in one delivery.",
      price: 58,
      compareAtPrice: 72,
      items: [
        { productId: "p-oranges", quantity: 1 },
        { productId: "p-tomatoes", quantity: 1 },
        { productId: "p-cabbage", quantity: 1 },
        { productId: "p-red-onion", quantity: 1 },
        { productId: "p-bananas", quantity: 1 },
        { productId: "p-green-apple", quantity: 1 },
        { productId: "p-eggs", quantity: 1 },
      ],
      image: "/images/promo-vegetables.png",
      visible: true,
      available: true,
      order: 2,
    },
    {
      id: "basket_fruit",
      slug: "fruit-reset-basket",
      name: "Fruit Reset Basket",
      cadence: "weekly",
      description: "Six fruits, chosen for the season and packed the morning of delivery.",
      price: 32,
      compareAtPrice: 40,
      items: [
        { productId: "p-oranges", quantity: 1 },
        { productId: "p-green-apple", quantity: 1 },
        { productId: "p-blueberries", quantity: 1 },
        { productId: "p-pomegranate", quantity: 1 },
        { productId: "p-pineapple", quantity: 1 },
      ],
      image: "/images/promo-fruits.png",
      visible: true,
      available: true,
      order: 3,
    },
  ],


  customers: [],
  orders: [],
  stock_movements: productSeed.slice(0, 8).map((product, index) => ({
    id: `mv_seed_${index}`,
    productId: product.id,
    productName: product.name,
    delta: product.stock ?? 0,
    balance: product.stock ?? 0,
    reason: "initial-stock",
    reference: "seed",
    note: "Opening balance",
    actor: "system",
    createdAt: daysAgo(60),
  })),
  subscribers: [
    { id: "sub_demo1", email: "hello@northwind.example", source: "homepage", status: "subscribed", createdAt: daysAgo(6) },
    { id: "sub_demo2", email: "maiya@example.com", source: "shop", status: "subscribed", createdAt: daysAgo(2) },
  ],
  media: [
    {
      id: "media_hero",
      url: "/images/hero-woman.png",
      filename: "hero-woman.png",
      alt: "Shopper holding a basket of fresh vegetables",
      folder: "hero",
      size: 0,
      mime: "image/png",
      createdAt: daysAgo(90),
    },
    {
      id: "media_veg",
      url: "/images/promo-vegetables.png",
      filename: "promo-vegetables.png",
      alt: "Fresh vegetables promotion",
      folder: "promotions",
      size: 0,
      mime: "image/png",
      createdAt: daysAgo(90),
    },
    {
      id: "media_fruit",
      url: "/images/promo-fruits.png",
      filename: "promo-fruits.png",
      alt: "Fresh fruit promotion",
      folder: "promotions",
      size: 0,
      mime: "image/png",
      createdAt: daysAgo(90),
    },
  ],
  activity: [],
  admin_sessions: [],
  customer_sessions: [],
  customer_addresses: [],
};

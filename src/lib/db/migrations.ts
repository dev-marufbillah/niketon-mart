import "server-only";

import type { Database } from "@/lib/db/types";
import type { Product } from "@/lib/types/domain";
import { detailsFor, optionsFor, ratingFromReviews, buildSeedReviews } from "@/lib/db/seed-product-details";
import {
  authorsSeed,
  blogCategoriesSeed,
  faqCategoriesSeed,
  faqCategoryAssignments,
  pageSectionsSeed,
  postsSeed,
} from "@/lib/db/seed-content";

/**
 * Seed migrations
 * ---------------
 * Seeding never overwrites a collection that already has rows, so new product
 * fields (gallery, variations, additional information) would never reach an
 * existing database. Migrations fill those fields in for products that do not
 * have them yet — admin edits are preserved because a field is only written when
 * it is missing.
 */
export async function runSeedMigrations(db: Database, fromVersion: number): Promise<void> {
  const products = await db.list<Product>("products");

  // Currency and historical copy are never relabelled or fabricated here.
  // Existing records require an owner-reviewed migration and backup.

  // v11 — sold-by-weight.
  //
  // The weighing panel needs to know how many grams one selling unit is. Older
  // rows only carry the label ("1 kg"), so the value is derived from it and
  // written once. Products that already describe an estimated weight start
  // showing the weight note; both fields are only written when missing, so an
  // admin's own edits always win.
  if (fromVersion < 11) {
    const { gramsFromUnitLabel } = await import("@/lib/weights/weight");
    for (const product of products) {
      const selling = product.selling;
      if (!selling) continue;
      const patch: Record<string, unknown> = {};
      if (!selling.unitGrams) {
        const grams = gramsFromUnitLabel(selling.unit);
        if (grams) patch.unitGrams = grams;
      }
      if (selling.variableWeight === undefined && selling.estimatedWeight) {
        patch.variableWeight = true;
      }
      if (Object.keys(patch).length === 0) continue;
      await db.update("products", product.id, { selling: { ...selling, ...patch } });
    }
  }

  // v10 — Niketon Mart becomes a grocery & fresh market.
  //
  // * The fresh-market categories (fish, meat & poultry, daily grocery) and the
  //   fresh products are added to databases that predate them.
  // * Preparation presets ship as a new collection.
  // * Nothing is deleted: pantry/corporate rows that may exist in an old
  //   database are archived by `scripts/archive-corporate-data.mjs` and left
  //   untouched until the owner signs off on removing them.
  if (fromVersion < 10) {
    const { categories, getCategoryBySlug } = await import("@/lib/data/categories");
    const { freshMarketProducts, preparationPresetSeed } = await import("@/lib/data/fresh-market");

    const existingCategories = await db.list<{ id: string; slug: string }>("categories");
    for (const category of categories) {
      if (existingCategories.some((row) => row.id === category.id || row.slug === category.slug)) continue;
      await db.insert("categories", { ...category, visible: category.visible ?? true });
    }

    const existingProducts = await db.list<{ id: string; slug: string }>("products");
    for (const product of freshMarketProducts) {
      if (existingProducts.some((row) => row.id === product.id || row.slug === product.slug)) continue;
      await db.insert("products", { ...product });
    }

    if ((await db.count("preparation_presets")) === 0) {
      await db.putMany(
        "preparation_presets",
        preparationPresetSeed.map((row) => ({ ...row })),
      );
    }

    // Older rows may still carry the retired `verticals` tag; it is no longer
    // read anywhere, so it is left in place rather than rewritten record by
    // record (an admin can never see it, and deleting data is a separate step).
    void getCategoryBySlug;
  }

  // v7 — customer accounts: sessions and the address book. Both start empty;
  // Existing guest customers remain separate from new accounts with the same email.
  if (fromVersion < 7) {
    for (const collection of ["customer_sessions", "customer_addresses"]) {
      if ((await db.count(collection)) === 0) await db.putMany(collection, []);
    }
  }

  // v6 — the content release: blog posts (which had no rows at all), blog
  // categories, authors, FAQ categories, CMS page sections, and the contact
  // copy block. Every insert is skipped when the collection already has rows,
  // so nothing an admin has edited is ever overwritten.
  if (fromVersion < 6) {
    const seedIfEmpty = async (collection: string, rows: { id: string }[]) => {
      if ((await db.count(collection)) > 0) return;
      await db.putMany(
        collection,
        rows.map((row) => ({ ...row })),
      );
    };

    await seedIfEmpty("blog_categories", blogCategoriesSeed);
    await seedIfEmpty("authors", authorsSeed);
    await seedIfEmpty("posts", postsSeed);
    await seedIfEmpty("faq_categories", faqCategoriesSeed);
    await seedIfEmpty("page_sections", pageSectionsSeed);

    // Existing FAQs get their category; only fills a missing value.
    for (const faq of await db.list<{ id: string; categoryId?: string }>("faqs")) {
      if (faq.categoryId) continue;
      const categoryId = faqCategoryAssignments[faq.id];
      if (categoryId) await db.update("faqs", faq.id, { categoryId });
    }

    // Blog posts that predate categories keep their label and gain the id.
    const categories = await db.list<{ id: string; name: string }>("blog_categories");
    for (const post of await db.list<{ id: string; category?: string; categoryId?: string }>("posts")) {
      if (post.categoryId) continue;
      const match = categories.find((category) => category.name === post.category);
      if (match) await db.update("posts", post.id, { categoryId: match.id });
    }

    // The contact copy block on the settings singleton.
    const settings = await db.get<{ id: string; contact?: unknown }>("settings", "site");
    if (settings && !settings.contact) {
      await db.update("settings", "site", {
        contact: {
          hours: "Saturday – Thursday, 8:00 am – 10:00 pm · Friday, 2:00 pm – 10:00 pm",
          supportNote: "Order support, delivery changes and returns — one team, one number.",
          formHeading: "Send us a message",
          formNote:
            "Tell us what happened and include your order ID if you have one. We reply within one working day.",
        },
      });
    }
  }

  // v5 — checkout: delivery windows on each area, a collection mode on every
  // payment method, and the two transfer methods the store now accepts.
  // Only fills what is missing, so admin edits are never overwritten.
  if (fromVersion < 5) {
    const defaultSlots = ["09:00 – 12:00", "12:00 – 15:00", "15:00 – 18:00", "18:00 – 21:00"];
    for (const area of await db.list<{ id: string; slots?: string[] }>("delivery_areas")) {
      if (!Array.isArray(area.slots) || area.slots.length === 0) {
        await db.update("delivery_areas", area.id, { slots: defaultSlots });
      }
    }

    for (const method of await db.list<{ id: string; type?: string; mode?: string; order?: number }>(
      "payment_methods",
    )) {
      if (!method.mode) {
        await db.update("payment_methods", method.id, {
          mode: method.type === "wallet" ? "manual-transfer" : "offline",
        });
      }
    }

    const existing = new Set((await db.list<{ id: string }>("payment_methods")).map((row) => row.id));
    const additions = [
      {
        id: "pay_bkash",
        label: "bKash",
        description: "Send money to our bKash merchant number, then enter the transaction ID.",
        type: "wallet",
        mode: "manual-transfer",
        instructions:
          "bKash (Send Money): 01711-000000 — Niketon Mart. After sending, enter the TrxID from your bKash message. We verify it before dispatch.",
        active: true,
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
        active: true,
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
        active: true,
        order: 5,
      },
    ];
    for (const method of additions) {
      if (!existing.has(method.id)) await db.insert("payment_methods", method as never);
    }
  }

  // v4 — every produce product gets a small gallery so the product page has
  // thumbnails out of the box. Only applied to products with a single image.
  if (fromVersion < 4) {
    const produce = new Set(["fresh-fruits", "vegetables"]);
    for (const product of products) {
      if (!produce.has(product.categoryId)) continue;
      if ((product.images ?? []).length > 1) continue;
      await db.update("products", product.id, {
        images: [
          product.image,
          "/images/lifestyle/produce-bin.jpg",
          "/images/lifestyle/countdown-left.jpg",
        ],
      });
    }
  }

  if (fromVersion >= 3) return;

  for (const product of products) {
    const { options, images } = optionsFor(product);
    const patch: Record<string, unknown> = {};
    if (!product.images || product.images.length === 0) patch.images = images;
    if (!product.options && options) patch.options = options;
    if (!product.details) patch.details = detailsFor(product);
    if (Object.keys(patch).length) await db.update("products", product.id, patch);
  }

  // Reviews were introduced in the same release — give existing catalogues a
  // first set of real rows (and matching ratings) if there are none yet.
  const reviewCount = await db.count("reviews");
  if (reviewCount === 0) {
    const seeded = buildSeedReviews(products);
    await db.putMany(
      "reviews",
      seeded.map((review) => ({ ...review })),
    );
  }

  // Ratings are derived from approved reviews, so the numbers on the cards and
  // the product page agree with the review list from day one.
  const rows = await db.list<{ id: string; productId: string; status: string; rating: number }>("reviews");
  for (const product of products) {
    const rating = ratingFromReviews(product.id, rows);
    if (rating) {
      await db.update("products", product.id, {
        rating: rating.rating,
        reviewCount: rating.reviewCount,
      });
    }
  }

}

import "server-only";

import type { Database, Row } from "@/lib/db/types";
import { createFileDatabase } from "@/lib/db/file";
import { createMongoDatabase } from "@/lib/db/mongo";
import { protectDatabase } from "@/lib/db/protected-database";
import { superAdminEmail } from "@/lib/auth/super-admin";
import { hashPasswordSync, isBlockedLegacyPassword } from "@/lib/auth/password";
import { SEED_VERSION, seedCollections } from "@/lib/db/seed";
import { runSeedMigrations } from "@/lib/db/migrations";

/**
 * Database access point.
 *
 * MongoDB is required on Vercel. A configured but unavailable MongoDB must
 * fail closed: falling back to an ephemeral database would lose real orders.
 * The JSON driver is for local development or persistent self-hosted disks.
 * Existing non-BDT or untagged historical financial data is never relabelled
 * automatically; it must be reviewed and migrated with explicit approval.
 */

let databasePromise: Promise<Database> | null = null;
let seedPromise: Promise<void> | null = null;

export async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = (async () => {
      if (process.env.VERCEL && !process.env.MONGODB_URI?.trim()) {
        throw new Error("MONGODB_URI is required on Vercel; refusing to use the ephemeral filesystem for store data.");
      }
      const mongo = await createMongoDatabase();
      if (mongo) {
        console.info("[db] using MongoDB driver");
        return protectDatabase(mongo);
      }
      console.info("[db] using file driver (.data/db.json)");
      return protectDatabase(createFileDatabase());
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

async function seedDatabase(db: Database) {
  const meta = await db.get<Row & { version?: number }>("_meta", "seed");
  const currentVersion = Number(meta?.version ?? 0);

  // Guard BEFORE seeding or migrations. Relabelling an old USD amount as BDT
  // is not a conversion and would falsify history. Never guess an old order's
  // currency either. The operator must back up and review those records first.
  const settings = await db.get<Row & { commerce?: { currency?: string } }>("settings", "site");
  const existingCurrency = settings?.commerce?.currency?.trim().toUpperCase();
  if (existingCurrency && existingCurrency !== "BDT") {
    throw new Error("Legacy non-BDT database detected. Back up and review currency migration before enabling the store; no amounts were changed.");
  }
  const orders = await db.list<Row & { currency?: string }>("orders");
  if (!existingCurrency && ((await db.count("products")) > 0 || orders.length > 0)) {
    throw new Error("Existing financial data has no store currency. Back up and review it before enabling the store.");
  }
  if (orders.some((order) => !order.currency || order.currency.trim().toUpperCase() !== "BDT")) {
    throw new Error("Historical orders have missing or non-BDT currency. Back up and review them before enabling the store; no amounts were changed.");
  }

  if (!meta) {
    const production = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
    // Sample products, reviews, customers and promotional material are useful
    // locally, but are not real business records and must not be seeded into a
    // new production database. Admin can create them in the existing panel.
    const demoCollections = new Set([
      "products", "categories", "brands", "product_types", "reviews", "testimonials",
      "hero_slides", "promo_banners", "faqs", "faq_categories", "blog_categories", "authors",
      "posts", "service_features", "coupons", "delivery_areas", "delivery_partners", "baskets",
      "stock_movements", "subscribers", "media", "pages", "page_sections",
    ]);
    for (const [collection, originalRows] of Object.entries(seedCollections)) {
      if (production && demoCollections.has(collection)) continue;
      if ((await db.count(collection)) > 0) continue;
      let rows = originalRows;
      if (production && collection === "settings") rows = originalRows.map((row) => ({
        ...row, description: "Everyday grocery and a fresh market: vegetables, fruit, fish, meat, eggs and dairy.",
        phone: "", phoneHref: "", email: "", address: "", supportHours: "",
        announcement: { enabled: false, message: "", ctaLabel: "", ctaHref: "" }, socials: [],
        commerce: { ...(row.commerce as object), freeShippingThreshold: 0, defaultDeliveryFee: 0, minOrderValue: 0 },
        contact: { hours: "", supportNote: "", formHeading: "Send us a message", formNote: "" },
        footer: { description: "Shop grocery and fresh-market essentials with Niketon Mart.", copyright: "© Niketon Mart. All rights reserved." },
      }));
      if (production && collection === "payment_methods") rows = originalRows.map((row) => ({
        ...row, active: false, instructions: "",
      }));
      if (production && collection === "homepage") rows = originalRows.map((row) => {
        const sections = (row.sections as { key: string; visible: boolean }[]).map((section) => ({
          ...section, visible: ["hero", "categories", "featured", "topPicks"].includes(section.key),
        }));
        sections.push({ key: "freshMarket", visible: false });
        const copy = row.copy as Record<string, Record<string, unknown>>;
        return { ...row, sections, copy: { ...copy, hero: { ...copy.hero, subtitle: "Shop grocery and fresh-market essentials.", rating: "", customers: "" } } };
      });
      await db.putMany(collection, rows.map((row) => ({ ...row })) as Row[]);
    }
    await db.insert("_meta", { id: "seed", version: SEED_VERSION, seededAt: new Date().toISOString() });
  } else if (currentVersion < SEED_VERSION) {
    // Earlier migrations contain starter products, testimonials and blog content.
    // Never run those automatically against an unknown production database.
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      throw new Error("Legacy seed migrations require an offline backup and review before production deployment.");
    }
    // Never advance the version after a failed migration.
    await runSeedMigrations(db, currentVersion);
    await db.update("_meta", "seed", { version: SEED_VERSION, updatedAt: new Date().toISOString() });
  }
  await ensureSuperAdmin(db);
}

async function ensureSuperAdmin(db: Database): Promise<void> {
  const email = superAdminEmail();
  const users = await db.list<Row & { email?: string; role?: string; active?: boolean; passwordHash?: string }>("admin_users");
  const matches = users.filter((entry) => entry.email?.trim().toLowerCase() === email);
  if (matches.length > 1) throw new Error("Duplicate Super Admin email. Back up and resolve admin identities before starting.");
  if (matches.length === 1) {
    const owner = matches[0];
    // Never silently elevate, reactivate, or overwrite an existing account.
    if (owner.role !== "owner" || !owner.active || !owner.passwordHash) {
      throw new Error("Existing protected email is not an active owner. Review the database and recover it using a controlled procedure.");
    }
    return;
  }
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
  if (password.length < 12 || password.length > 256 || isBlockedLegacyPassword(password)) {
    throw new Error("Provisioning the Super Admin requires a unique SUPER_ADMIN_PASSWORD between 12 and 256 characters in server configuration.");
  }
  try {
    await db.insert("admin_users", {
      id: "usr_super_admin", name: "Store Owner", email, role: "owner", active: true,
      passwordHash: hashPasswordSync(password), mustChangePassword: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Multiple serverless instances may bootstrap at once. Accept only the same
    // protected identity once it exists; all other failures remain failures.
    const owner = (await db.list<Row & { email?: string; role?: string; active?: boolean; passwordHash?: string }>("admin_users"))
      .find((entry) => entry.email?.trim().toLowerCase() === email);
    if (!owner || owner.role !== "owner" || !owner.active || !owner.passwordHash) throw error;
  }
}

/** Runs once per process; safe to call from every request path. */
export async function ensureDatabase(): Promise<Database> {
  const db = await getDatabase();
  if (!seedPromise) {
    seedPromise = seedDatabase(db).catch((error) => {
      seedPromise = null;
      console.error("[db] initialisation failed; store writes are disabled.");
      throw error;
    });
  }
  await seedPromise;
  return db;
}

export async function dbInfo() {
  const db = await ensureDatabase();
  return {
    driver: db.driver,
    mongoConfigured: Boolean(process.env.MONGODB_URI),
    database: process.env.MONGODB_DB ?? "niketon_mart",
  };
}

export type { Database } from "@/lib/db/types";

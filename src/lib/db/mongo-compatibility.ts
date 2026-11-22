import "server-only";

import type { Db } from "mongodb";

/**
 * Read-only preflight before ANY index creation or seeding.
 *
 * The linked GitHub main identified during the 2026 handover uses a different
 * Better Auth/Mongoose application and can share collection names with this
 * reconstructed app. Treat its records as foreign rather than attempting to
 * assign identities, reinterpret money or create indexes in that database.
 *
 * This is a conservative tripwire, not proof that a database without these
 * markers is compatible. An empty isolated database and a reviewed migration,
 * backups and restore tests are still required. No record is copied or changed.
 */
export async function assertMongoApplicationCompatibility(db: Db): Promise<void> {
  const foreignCollections = [
    "users", "accounts", "sessions", "verifications", "customerProfiles", "cmsSections", "businessRecords",
    "inventory", "carts", "mediaFiles", "staffRoles", "newsletterSubscriptions",
    "companies", "companyEmployees", "mealSchedules", "employeeMealOrders", "corporateContracts",
    "quotations", "invoices", "payments", "deliveries", "contactMessages", "corporateInquiries", "promotions",
  ];
  for (const name of foreignCollections) {
    // Projection avoids loading user details, account tokens or content.
    if (await db.collection(name).findOne({}, { projection: { _id: 1 } })) {
      throw new Error("This database contains records from a different store/authentication system. No application indexes or seed data were changed. Use an isolated database and complete a reviewed backup and migration first.");
    }
  }

  const sharedCollections = [
    "products", "orders", "categories", "brands", "product_types", "coupons", "customers", "admin_users", "settings", "stock_movements", "reviews", "media", "activity", "_meta", "counters", "admin_sessions", "customer_sessions", "customer_addresses", "delivery_areas", "payment_methods", "wishlists",
  ];
  for (const name of sharedCollections) {
    const incompatible = await db.collection(name).findOne({
      $or: [
        // $expr checks the field itself, not a string inside an array.
        { $expr: { $ne: [{ $type: "$id" }, "string"] } },
        { id: "" },
      ],
    }, { projection: { _id: 1 } });
    if (incompatible) {
      throw new Error("This database contains records incompatible with this store's identity format. No application indexes or seed data were changed. Back up, review and migrate into a separate isolated database before connecting it.");
    }
  }
}

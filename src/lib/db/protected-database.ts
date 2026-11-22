import "server-only";
import type { Database, Row } from "@/lib/db/types";
import { isSuperAdminIdentity } from "@/lib/auth/super-admin";

/** Defence in depth for application database writes. Direct Mongo credentials
 * must also be restricted; an external DB administrator can bypass this layer. */
export function protectDatabase(db: Database): Database {
  const validateAdminPatch = (current: Row, patch: Partial<Row>) => {
    const currentIsOwner = isSuperAdminIdentity(current.email);
    const nextEmail = Object.prototype.hasOwnProperty.call(patch, "email") ? patch.email : current.email;
    const nextRole = Object.prototype.hasOwnProperty.call(patch, "role") ? patch.role : current.role;
    if (currentIsOwner) {
      if (nextEmail !== current.email || nextRole !== "owner" ||
          (Object.prototype.hasOwnProperty.call(patch, "active") && patch.active !== true)) {
        throw new Error("The protected Super Admin identity, role and status cannot be changed.");
      }
    } else if (isSuperAdminIdentity(nextEmail) || nextRole === "owner") {
      throw new Error("Only the configured Super Admin may hold the owner role.");
    }
    if (nextRole !== "owner" && Array.isArray(patch.permissions) && patch.permissions.includes("users.manage")) {
      throw new Error("Admin user management cannot be delegated.");
    }
  };
  return {
    ...db,
    ...(db.withTransaction ? {
      withTransaction<T>(work: (transaction: Database) => Promise<T>) {
        // The transaction receives the same owner-protection wrapper; a
        // transactional callback must never bypass the normal write guards.
        return db.withTransaction!(async (transaction) => work(protectDatabase(transaction)));
      },
    } : {}),
    async insert<T extends Row>(collection: string, row: Omit<T, "id"> & { id?: string }) {
      if (collection === "admin_users") {
        const candidate = row as Row;
        const owner = isSuperAdminIdentity(candidate.email);
        if ((candidate.role === "owner") !== owner || (owner && candidate.active !== true)) {
          throw new Error("Invalid protected admin identity or owner role.");
        }
        if (Array.isArray(candidate.permissions) && candidate.permissions.includes("users.manage") && !owner) {
          throw new Error("Admin user management cannot be delegated.");
        }
        const all = await db.list<Row>("admin_users");
        if (all.some((entry) => typeof entry.email === "string" && typeof candidate.email === "string" &&
          entry.email.trim().toLowerCase() === candidate.email.trim().toLowerCase())) {
          throw new Error("That admin email already exists.");
        }
      }
      return db.insert<T>(collection, row);
    },
    async update<T extends Row>(collection: string, id: string, patch: Partial<T>) {
      if (collection === "admin_users") {
        const current = await db.get<Row>(collection, id);
        if (current) validateAdminPatch(current, patch as Partial<Row>);
      }
      return db.update<T>(collection, id, patch);
    },
    async compareAndUpdate<T extends Row>(collection: string, id: string, expected: Partial<T>, patch: Partial<T>, validUntil?: { field: string; after: string }) {
      if (collection === "admin_users") {
        const current = await db.get<Row>(collection, id);
        if (current) validateAdminPatch(current, patch as Partial<Row>);
      }
      return db.compareAndUpdate<T>(collection, id, expected, patch, validUntil);
    },
    async remove(collection: string, id: string) {
      if (collection === "admin_users") {
        const current = await db.get<Row>(collection, id);
        if (current && isSuperAdminIdentity(current.email)) throw new Error("The protected Super Admin cannot be deleted.");
      }
      return db.remove(collection, id);
    },
    async putMany<T extends Row>(collection: string, rows: T[]) {
      if (collection === "admin_users") throw new Error("Bulk admin replacement is prohibited.");
      return db.putMany<T>(collection, rows);
    },
  };
}

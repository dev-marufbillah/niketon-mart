import "server-only";

import type { Database, Query, Row } from "@/lib/db/types";
import { makeId } from "@/lib/db/types";
import { mongoCompareFilter } from "@/lib/db/mongo-cas";
import { assertMongoApplicationCompatibility } from "@/lib/db/mongo-compatibility";

/**
 * MongoDB driver (official `mongodb` package).
 *
 * Activated by setting `MONGODB_URI` (and optionally `MONGODB_DB`, default
 * `niketon_mart`). Documents keep our own string `id` next to Mongo's `_id`, so
 * rows stay portable between drivers and no `ObjectId` ever reaches the client.
 */

const CONNECT_TIMEOUT_MS = 2500;

type MongoModule = typeof import("mongodb");
type MongoClient = import("mongodb").MongoClient;
type MongoDb = import("mongodb").Db;

let clientPromise: Promise<{ client: MongoClient; db: MongoDb; mongo: MongoModule } | null> | null = null;

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;

  const mongo = await import("mongodb");
  let client: MongoClient | undefined;
  try {
    // Parsing can fail before connect() and its error may contain a URI. Keep
    // constructor, connection and ping inside the same sanitized failure path.
    client = new mongo.MongoClient(uri, {
      serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
      connectTimeoutMS: CONNECT_TIMEOUT_MS,
    });
    await client.connect();
    await client.db(process.env.MONGODB_DB ?? "niketon_mart").command({ ping: 1 });
    const db = client.db(process.env.MONGODB_DB ?? "niketon_mart");
    return { client, db, mongo };
  } catch {
    // Never fall back to a separate, ephemeral store when a configured MongoDB
    // is unavailable. Do not log the driver error: it can contain credentials.
    await client?.close().catch(() => undefined);
    throw new Error("MongoDB is configured but unavailable; store data is not writable until the connection is restored.");
  }
}

/** Single connection per process (Next.js dev reloads re-use the cached promise). */
export async function getMongo() {
  if (!clientPromise) {
    clientPromise = connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

function strip<T extends Row>(doc: Record<string, unknown> | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  void _id;
  return rest as T;
}

const matches = (where: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(where).map(([key, value]) => [key, Array.isArray(value) ? { $in: value } : value]),
  );

export async function createMongoDatabase(): Promise<Database | null> {
  const connection = await getMongo();
  if (!connection) return null;
  const { db, client } = connection;
  // In particular, refuse the linked main's Better Auth/Mongoose database before
  // touching indexes. This is a conservative tripwire, not a migration or proof
  // that any other existing data is compatible with this reconstructed source.
  await assertMongoApplicationCompatibility(db);
  const collection = (name: string) => db.collection(name);
  // Whitespace or malformed legacy account emails are not equivalent to their
  // normalized lookup under a Mongo collation. Reject them before indexing;
  // an operator must back up and reconcile them, never auto-merge identities.
  const candidates = collection("customers").find({ $or: [
    { passwordHash: { $exists: true } }, { googleSubjectHash: { $exists: true } },
  ] }, { projection: { email: 1, passwordHash: 1, googleSubjectHash: 1 } });
  for await (const row of candidates) {
    if (!row.passwordHash && !row.googleSubjectHash) continue;
    if ((row.passwordHash && typeof row.passwordHash !== "string") ||
        (row.googleSubjectHash && typeof row.googleSubjectHash !== "string") ||
        typeof row.email !== "string" || row.email !== row.email.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) {
      throw new Error("Registered customer identity data needs backup and review before enabling the store; no accounts were merged.");
    }
  }
  // Index creation is a database mutation. Backup/review legacy data before
  // first production use. $or in a partial index requires MongoDB 6.0+.
  try {
    await collection("admin_users").createIndex({ email: 1 }, {
      unique: true, collation: { locale: "en", strength: 2 }, name: "admin_email_unique",
    });
    await collection("customers").createIndex({ googleSubjectHash: 1 }, {
      unique: true, partialFilterExpression: { googleSubjectHash: { $type: "string" } },
      name: "customer_google_subject_unique",
    });
    // Password and Google customers share one email namespace; credential-free
    // guest/staff shopper rows remain separate and are not ownership proof.
    await collection("customers").createIndex({ email: 1 }, {
      unique: true, partialFilterExpression: { $or: [
        { passwordHash: { $type: "string", $gt: "" } },
        { googleSubjectHash: { $type: "string", $gt: "" } },
      ] }, collation: { locale: "en", strength: 2 }, name: "customer_registered_email_unique",
    });
  } catch {
    // Mongo index errors may contain emails or connection details: never log them.
    throw new Error("Account identity indexes could not be created. Back up and review duplicates, invalid identities, and MongoDB permissions/version before enabling the store.");
  }
  try {
    // A partial unique index enforces a single featured category even when two
    // admin instances act concurrently. Multiple legacy flags require review.
    await collection("categories").createIndex({ showInPrimaryNavigation: 1 }, {
      unique: true, partialFilterExpression: { showInPrimaryNavigation: true }, name: "category_primary_navigation_unique",
    });
  } catch {
    throw new Error("The primary-navigation category index could not be created. Back up and review multiple featured flags and MongoDB permissions before enabling the store.");
  }
  // Order-index creation can fail on legacy duplicates and is itself a database
  // mutation. Never do it merely by deploying the held checkout code. This
  // opt-in is for disposable staging AFTER a backup and explicit data review;
  // it does not enable production checkout.
  let orderIndexesReady = false;
  if (process.env.NIKETON_PREPARE_TRANSACTION_INDEXES === "1") {
    try {
      await collection("orders").createIndex({ number: 1 }, {
        unique: true, partialFilterExpression: { number: { $type: "string" } }, name: "order_number_unique",
      });
      await collection("orders").createIndex({ customerId: 1, idempotencyKey: 1 }, {
        unique: true, partialFilterExpression: {
          customerId: { $type: "string" }, idempotencyKey: { $type: "string" },
        }, name: "order_customer_idempotency_unique",
      });
      orderIndexesReady = true;
    } catch {
      throw new Error("Order indexes could not be created. Back up and review duplicate order numbers or customer retry keys before enabling the store.");
    }
  }

  return makeMongoDatabase(db, client, orderIndexesReady);
}

/** Bind every operation in a unit of work to the same session. No code using
 * this adapter may run parallel operations or external side effects inside a
 * transaction; the Mongo driver can retry the callback after a write conflict. */
function makeMongoDatabase(db: MongoDb, client: MongoClient, orderIndexesReady: boolean, session?: import("mongodb").ClientSession): Database {
  const collection = (name: string) => db.collection(name);
  const options = session ? { session } : {};
  const adapter: Database = {
    driver: "mongo",
    orderTransactionIndexesReady: orderIndexesReady,

    async list<T extends Row>(name: string, query?: Query<T>) {
      let cursor = collection(name).find(query?.where ? matches(query.where) : {}, options);
      if (query?.sort) cursor = cursor.sort(query.sort.field, query.sort.direction === "desc" ? -1 : 1);
      if (query?.limit) cursor = cursor.limit(query.limit);
      const docs = await cursor.toArray();
      return docs.map((doc) => strip<T>(doc)).filter((doc): doc is T => Boolean(doc));
    },
    async get<T extends Row>(name: string, id: string) {
      const doc = await collection(name).findOne({ id }, options);
      return strip<T>(doc as Record<string, unknown> | null);
    },
    async insert<T extends Row>(name: string, row: Omit<T, "id"> & { id?: string }) {
      const created = { ...(row as object), id: row.id ?? makeId(name) } as T;
      await collection(name).insertOne({ ...created, _id: created.id as unknown as import("mongodb").ObjectId }, options);
      return created;
    },
    async update<T extends Row>(name: string, id: string, patch: Partial<T>) {
      const result = await collection(name).findOneAndUpdate(
        { id }, { $set: { ...(patch as object), id } }, { ...options, returnDocument: "after", upsert: false },
      );
      return strip<T>(result as Record<string, unknown> | null);
    },
    async compareAndUpdate<T extends Row>(name: string, id: string, expected: Partial<T>, patch: Partial<T>, validUntil?: { field: string; after: string }) {
      const result = await collection(name).findOneAndUpdate(
        mongoCompareFilter(id, expected, validUntil), { $set: { ...patch, id } }, { ...options, returnDocument: "after", upsert: false },
      );
      return strip<T>(result as Record<string, unknown> | null);
    },
    async remove(name: string, id: string) {
      return (await collection(name).deleteOne({ id }, options)).deletedCount > 0;
    },
    async count(name: string) {
      return collection(name).countDocuments({}, options);
    },
    async putMany<T extends Row>(name: string, rows: T[]) {
      for (const row of rows) {
        const _id = row.id as unknown as import("mongodb").ObjectId;
        await collection(name).updateOne({ _id }, { $setOnInsert: { ...row, _id } }, { ...options, upsert: true });
      }
    },
  };
  if (!session) {
    adapter.withTransaction = async <T>(work: (transaction: Database) => Promise<T>): Promise<T> => {
      const transaction = client.startSession();
      try {
        // The callback can be retried by the driver. It may only use the
        // supplied transaction-bound adapter and must perform no side effects.
        return await transaction.withTransaction(
          async () => work(makeMongoDatabase(db, client, orderIndexesReady, transaction)),
          { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" },
        ) as T;
      } finally {
        await transaction.endSession();
      }
    };
  }
  return adapter;
}


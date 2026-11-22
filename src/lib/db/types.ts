/**
 * Database contract
 * -----------------
 * Every collection in Niketon Mart is addressed through this tiny interface, so
 * the app never depends on a specific database driver. Two drivers ship:
 *
 *  - `mongo.ts`  → MongoDB (set `MONGODB_URI`) — the production target.
 *  - `file.ts`   → a JSON document store (`.data/db.json`) used for local dev and
 *                  for hosts without a database, with the same semantics.
 *
 * Rows are plain objects with a string `id`. Mongo stores the same `id` field
 * (plus its own `_id`) so a document is portable between drivers.
 */

export type Row = { id: string } & Record<string, unknown>;

export type Query<T> = {
  where?: Partial<Record<keyof T | string, unknown>>;
  sort?: { field: string; direction?: "asc" | "desc" };
  limit?: number;
};

export interface Database {
  readonly driver: "mongo" | "file";
  /** True only when this adapter actually prepared the experimental order indexes. */
  readonly orderTransactionIndexesReady?: boolean;
  list<T extends Row>(collection: string, query?: Query<T>): Promise<T[]>;
  get<T extends Row>(collection: string, id: string): Promise<T | null>;
  insert<T extends Row>(collection: string, row: Omit<T, "id"> & { id?: string }): Promise<T>;
  update<T extends Row>(collection: string, id: string, patch: Partial<T>): Promise<T | null>;
  /** Atomically update a row only when all expected fields still match. */
  compareAndUpdate<T extends Row>(collection: string, id: string, expected: Partial<T>, patch: Partial<T>, validUntil?: { field: string; after: string }): Promise<T | null>;
  remove(collection: string, id: string): Promise<boolean>;
  count(collection: string): Promise<number>;
  /** Bulk write used by seeding only. */
  putMany<T extends Row>(collection: string, rows: T[]): Promise<void>;
  /** MongoDB replica-set transaction; unavailable on the local file driver. */
  withTransaction?<T>(work: (transaction: Database) => Promise<T>): Promise<T>;
}

export function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

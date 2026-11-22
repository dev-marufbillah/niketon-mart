import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { Database, Query, Row } from "@/lib/db/types";
import { makeId } from "@/lib/db/types";

/**
 * JSON driver — development / no-database fallback.
 *
 * All collections live in `.data/db.json`. Writes are serialised through a
 * promise queue and committed with tmp+rename so concurrent server actions can
 * never interleave a partial document.
 */

type Document = { version: number; collections: Record<string, Row[]> };

const DIR = process.env.CONTENT_STORE_DIR ?? path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "db.json");

let cache: { mtimeMs: number; document: Document } | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

class CustomerIdentityDataError extends Error {
  constructor() { super("Local customer identities are duplicate or invalid. Back up and review the data before starting; nothing was merged."); }
}
function isRegistered(row: Row): boolean { return Boolean(row.passwordHash || row.googleSubjectHash); }
function validateRegisteredIdentity(row: Row): void {
  if (!isRegistered(row)) return;
  if ((row.passwordHash && typeof row.passwordHash !== "string") ||
      (row.googleSubjectHash && typeof row.googleSubjectHash !== "string") ||
      typeof row.email !== "string" || row.email !== row.email.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) throw new CustomerIdentityDataError();
}
function validateExistingCustomerIdentities(rows: Row[]): void {
  const emails = new Set<string>(), subjects = new Set<string>();
  for (const row of rows) {
    validateRegisteredIdentity(row);
    if (typeof row.googleSubjectHash === "string") {
      if (subjects.has(row.googleSubjectHash)) throw new CustomerIdentityDataError();
      subjects.add(row.googleSubjectHash);
    }
    if (isRegistered(row)) {
      const email = (row.email as string).toLowerCase();
      if (emails.has(email)) throw new CustomerIdentityDataError();
      emails.add(email);
    }
  }
}

async function readDocument(): Promise<Document> {
  try {
    const stat = await fs.stat(FILE);
    if (cache && cache.mtimeMs === stat.mtimeMs) return cache.document;
    const parsed = JSON.parse(await fs.readFile(FILE, "utf8")) as Document;
    if (!parsed || typeof parsed.collections !== "object" || Array.isArray(parsed.collections) ||
        Object.values(parsed.collections).some((rows) => !Array.isArray(rows))) {
      throw new Error("Invalid database structure");
    }
    const document: Document = { version: 1, collections: parsed.collections };
    validateExistingCustomerIdentities(document.collections.customers ?? []);
    cache = { mtimeMs: stat.mtimeMs, document };
    return document;
  } catch (error) {
    if (error instanceof CustomerIdentityDataError) throw error;
    // A missing file is a new local store. Corrupt JSON, bad permissions and
    // other I/O errors must NOT be mistaken for an empty DB and overwritten.
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const document: Document = { version: 1, collections: {} };
      cache = { mtimeMs: 0, document };
      return document;
    }
    throw new Error("Local database could not be read. Restore a backup before retrying.");
  }
}

async function writeDocument(document: Document): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(document), "utf8");
  await fs.rename(tmp, FILE);
  const stat = await fs.stat(FILE);
  cache = { mtimeMs: stat.mtimeMs, document };
}

function serialise<T>(run: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(run, run);
  writeQueue = next.catch(() => undefined);
  return next;
}

const matches = (row: Row, where: Record<string, unknown>) =>
  Object.entries(where).every(([key, value]) => {
    if (Array.isArray(value)) return (value as unknown[]).includes(row[key]);
    return row[key] === value;
  });

/** Same-process local equivalents of Mongo's partial account identity indexes.
 * The file driver is deliberately not safe across separate server processes. */
function assertUniqueCustomerIdentity(collection: string, rows: Row[], candidate: Row): void {
  if (collection !== "customers") return;
  if (typeof candidate.googleSubjectHash === "string" && rows.some((row) => row.id !== candidate.id && row.googleSubjectHash === candidate.googleSubjectHash)) {
    throw new Error("This Google identity is already linked to another customer.");
  }
  validateRegisteredIdentity(candidate);
  if (isRegistered(candidate)) {
    const email = (candidate.email as string).toLowerCase();
    if (rows.some((row) => row.id !== candidate.id && isRegistered(row) &&
      (typeof row.email === "string" ? row.email.toLowerCase() : "") === email)) {
      throw new Error("A registered customer account already uses this email.");
    }
  }
}

/** Match Mongo's one-featured-category constraint within this file process. */
function assertUniqueConstraints(collection: string, rows: Row[], candidate: Row): void {
  assertUniqueCustomerIdentity(collection, rows, candidate);
  if (collection === "categories" && candidate.showInPrimaryNavigation === true &&
      rows.some((row) => row.id !== candidate.id && row.showInPrimaryNavigation === true)) {
    throw new Error("Only one category can be featured in primary navigation.");
  }
}

export function createFileDatabase(): Database {
  return {
    driver: "file",

    async list<T extends Row>(collection: string, query?: Query<T>) {
      const document = await readDocument();
      let rows = [...(document.collections[collection] ?? [])] as T[];
      if (query?.where) rows = rows.filter((row) => matches(row, query.where!));
      if (query?.sort) {
        const { field, direction = "asc" } = query.sort;
        rows.sort((a, b) => {
          const left = a[field] as unknown;
          const right = b[field] as unknown;
          if (left === right) return 0;
          if (left === undefined || left === null) return 1;
          if (right === undefined || right === null) return -1;
          const result = left < right ? -1 : 1;
          return direction === "asc" ? result : -result;
        });
      }
      if (query?.limit) rows = rows.slice(0, query.limit);
      return rows;
    },

    async get<T extends Row>(collection: string, id: string) {
      const document = await readDocument();
      return ((document.collections[collection] ?? []).find((row) => row.id === id) ?? null) as T | null;
    },

    async insert<T extends Row>(collection: string, row: Omit<T, "id"> & { id?: string }) {
      return serialise(async () => {
        const document = await readDocument();
        const created = { ...(row as object), id: row.id ?? makeId(collection) } as T;
        const rows = document.collections[collection] ?? [];
        // Match Mongo's unique _id behavior. The queue makes this check atomic
        // within this one file-driver process (not across processes).
        if (rows.some((existing) => existing.id === created.id)) throw new Error("A record with this id already exists.");
        assertUniqueConstraints(collection, rows, created);
        await writeDocument({
          ...document,
          collections: { ...document.collections, [collection]: [...rows, created] },
        });
        return created;
      });
    },

    async update<T extends Row>(collection: string, id: string, patch: Partial<T>) {
      return serialise(async () => {
        const document = await readDocument();
        const rows = document.collections[collection] ?? [];
        const index = rows.findIndex((row) => row.id === id);
        if (index === -1) return null;
        const updated = { ...rows[index], ...(patch as object), id } as T;
        assertUniqueConstraints(collection, rows, updated);
        const next = rows.slice();
        next[index] = updated;
        await writeDocument({ ...document, collections: { ...document.collections, [collection]: next } });
        return updated;
      });
    },

    async compareAndUpdate<T extends Row>(collection: string, id: string, expected: Partial<T>, patch: Partial<T>, validUntil?: { field: string; after: string }) {
      return serialise(async () => {
        const document = await readDocument();
        const rows = document.collections[collection] ?? [];
        const index = rows.findIndex((row) => row.id === id && Object.entries(expected).every(([key, value]) => isDeepStrictEqual(row[key], value)) &&
          (!validUntil || (typeof row[validUntil.field] === "string" && (row[validUntil.field] as string) > validUntil.after)));
        if (index === -1) return null;
        const updated = { ...rows[index], ...patch, id } as T;
        assertUniqueConstraints(collection, rows, updated);
        const next = rows.slice();
        next[index] = updated;
        await writeDocument({ ...document, collections: { ...document.collections, [collection]: next } });
        return updated;
      });
    },

    async remove(collection: string, id: string) {
      return serialise(async () => {
        const document = await readDocument();
        const rows = document.collections[collection] ?? [];
        const next = rows.filter((row) => row.id !== id);
        if (next.length === rows.length) return false;
        await writeDocument({ ...document, collections: { ...document.collections, [collection]: next } });
        return true;
      });
    },

    async count(collection: string) {
      const document = await readDocument();
      return (document.collections[collection] ?? []).length;
    },

    async putMany<T extends Row>(collection: string, rows: T[]) {
      await serialise(async () => {
        const document = await readDocument();
        for (const row of rows) assertUniqueConstraints(collection, rows, row);
        await writeDocument({ ...document, collections: { ...document.collections, [collection]: rows } });
      });
    },
  };
}

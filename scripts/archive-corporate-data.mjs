#!/usr/bin/env node
/**
 * Archive the Workplace Pantry / corporate-food data before it is retired.
 *
 * The platform no longer sells office food, corporate catering or recurring
 * corporate meals. Nothing is deleted automatically: this script copies every
 * corporate collection into a single dated JSON file so the records can be kept
 * for accounting, audited, or re-imported if the decision is ever reversed.
 *
 * Usage
 *   node scripts/archive-corporate-data.mjs                 # file driver (.data/db.json)
 *   MONGODB_URI="mongodb+srv://…" node scripts/archive-corporate-data.mjs
 *
 * Output
 *   archive/corporate-data-<ISO timestamp>.json
 *
 * The collections themselves are left untouched in the database. Removing them
 * is a separate, explicit step — see docs/LIMITATIONS.md → "Corporate data".
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const COLLECTIONS = [
  "corporate_companies",
  "corporate_employees",
  "corporate_departments",
  "corporate_locations",
  "corporate_quotations",
  "corporate_contracts",
  "corporate_invoices",
  "corporate_payments",
  "corporate_recurring_orders",
  "corporate_menu_items",
  "corporate_users",
  "corporate_inquiries",
  "pantry_packages",
];

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDirectory = process.env.ARCHIVE_OUTPUT_DIR || "archive";
const outFile = path.join(outputDirectory, `corporate-data-${stamp}.json`);

async function fromMongo(uri) {
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "niketon_mart");
  const data = {};
  for (const name of COLLECTIONS) {
    data[name] = await db.collection(name).find({}).toArray();
  }
  await client.close();
  return data;
}

async function fromFile() {
  const raw = await readFile(path.join(process.env.CONTENT_STORE_DIR || ".data", "db.json"), "utf8");
  const parsed = JSON.parse(raw);
  const collections = parsed.collections ?? {};
  const data = {};
  for (const name of COLLECTIONS) data[name] = collections[name] ?? [];
  return data;
}

const data = process.env.MONGODB_URI ? await fromMongo(process.env.MONGODB_URI) : await fromFile();

const summary = Object.fromEntries(Object.entries(data).map(([name, rows]) => [name, rows.length]));
const total = Object.values(summary).reduce((sum, count) => sum + count, 0);

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
await writeFile(
  outFile,
  JSON.stringify(
    {
      archivedAt: new Date().toISOString(),
      reason: "Workplace Pantry / corporate food business retired; grocery & fresh market is the sole business model.",
      source: process.env.MONGODB_URI ? "mongodb" : "file",
      collections: data,
      summary,
    },
    null,
    2,
  ),
  { encoding: "utf8", flag: "wx", mode: 0o600 },
);

console.log(`Archived ${total} rows to ${outFile}`);
console.table(summary);

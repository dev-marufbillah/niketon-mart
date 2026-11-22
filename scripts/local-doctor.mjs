#!/usr/bin/env node
/** Read-only development configuration check. No network, no writes, no secret values. */
import nextEnv from "@next/env";
import { promises as fs } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
nextEnv.loadEnvConfig(cwd, true); // same .env precedence as `next dev`, including shell environment
const hasLocal = await fs.stat(path.join(cwd, ".env.local")).then(() => true, () => false);
const hasMongo = Boolean(process.env.MONGODB_URI?.trim());
const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
console.log("Niketon local configuration check (read-only; no credentials displayed)");
console.log(`.env.local: ${hasLocal ? "present" : "not found"}`);
if (!hasLocal) console.log("Copy .env.example to .env.local; set a unique, private owner password before first start.");
if (process.env.VERCEL) console.log("WARNING: VERCEL is set. This is not a local file-store configuration.");
if (hasMongo) {
  console.log("Database: MongoDB is configured. Connection was NOT tested; an unavailable server stops the app safely.");
  console.log("For local-only testing, back up .env.local, unset MONGODB_URI in your local environment, restart the terminal/server, and keep your existing database unchanged.");
  console.log("A local file store is separate data; it does not copy data from MongoDB. Never use it as a production replacement.");
} else {
  console.log("Database: local JSON file store (only when VERCEL is unset). No MongoDB connection will be attempted.");
  const directory = process.env.CONTENT_STORE_DIR || path.join(cwd, ".data");
  const filename = path.join(directory, "db.json");
  try {
    const stats = await fs.stat(filename);
    if (stats.size > 100 * 1024 * 1024) {
      console.log("Existing local database: too large for this quick read-only check; review it manually.");
    } else {
      const store = JSON.parse(await fs.readFile(filename, "utf8"));
      const admins = store?.collections?.admin_users;
      if (!Array.isArray(admins)) console.log("Existing local database found; owner status could not be determined.");
      else {
        const owners = admins.filter((row) => typeof row?.email === "string" && row.email.trim().toLowerCase() === "marufsalauddin76@gmail.com");
        if (owners.length === 1 && owners[0].role === "owner" && owners[0].active === true && owners[0].passwordHash) {
          console.log("Local protected owner: already exists. The bootstrap password does not reset this account.");
        } else if (owners.length === 0) console.log("Local protected owner: not yet created; a valid bootstrap password is required.");
        else console.log("Local protected owner: identity needs backup and review; do not delete or overwrite the existing data.");
      }
    }
  } catch (error) {
    if (error?.code === "ENOENT") console.log("Local database: not created yet. A valid bootstrap password is required for first start.");
    else console.log("Local database: could not be inspected; back up and review the file and permissions before continuing.");
  }
}
if (password.length < 12 || password.length > 256) {
  console.log("Bootstrap password: missing or outside the required 12–256 character length (only required when creating the owner).");
} else {
  console.log("Bootstrap password: length is in range; avoid reused or published demo passwords. This check does not verify existing login credentials.");
}
console.log("No database connection, file modification, password reset, or deployment was performed.");

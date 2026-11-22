import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("local legacy duplicate/invalid registered identities fail closed without changing the data", async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "niketon-legacy-identities-"));
  process.env.CONTENT_STORE_DIR = dir;
  const filename = path.join(dir, "db.json");
  const { createFileDatabase } = await import("../../src/lib/db/file");
  const db = createFileDatabase();
  try {
    for (const customers of [
      [{ id: "a", email: "Same@example.test", passwordHash: "hash-a" }, { id: "b", email: "same@example.test", googleSubjectHash: "subject-b" }],
      [{ id: "a", email: " old@example.test ", passwordHash: "hash-a" }],
      [{ id: "a", email: "one@example.test", googleSubjectHash: "same-subject" }, { id: "b", email: "two@example.test", googleSubjectHash: "same-subject" }],
    ]) {
      const original = JSON.stringify({ version: 1, collections: { customers } });
      await fs.writeFile(filename, original);
      await assert.rejects(db.list("customers"), /identities are duplicate or invalid/i);
      assert.equal(await fs.readFile(filename, "utf8"), original, "No repair, deletion or account merge is allowed");
    }
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

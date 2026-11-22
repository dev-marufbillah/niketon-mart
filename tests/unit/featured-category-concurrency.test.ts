import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("one featured category is enforced for concurrent writes within the local file process", async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "niketon-featured-category-"));
  process.env.CONTENT_STORE_DIR = dir;
  try {
    const { createFileDatabase } = await import("../../src/lib/db/file");
    const db = createFileDatabase();
    await db.insert("categories", { id: "one", showInPrimaryNavigation: false });
    await db.insert("categories", { id: "two", showInPrimaryNavigation: false });
    const results = await Promise.allSettled([
      db.update("categories", "one", { showInPrimaryNavigation: true }),
      db.update("categories", "two", { showInPrimaryNavigation: true }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const featured = (await db.list("categories")).filter((row) => row.showInPrimaryNavigation === true);
    assert.equal(featured.length, 1);
    await db.update("categories", featured[0].id, { showInPrimaryNavigation: false });
    const other = featured[0].id === "one" ? "two" : "one";
    assert.equal((await db.update("categories", other, { showInPrimaryNavigation: true }))?.showInPrimaryNavigation, true);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

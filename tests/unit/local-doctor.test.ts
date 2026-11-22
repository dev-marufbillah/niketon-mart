import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const script = path.join(process.cwd(), "scripts", "local-doctor.mjs");

test("local configuration doctor is read-only and never prints credential values", async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), "niketon-local-doctor-"));
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? dir, NODE_ENV: "development" };
  try {
    const first = spawnSync(process.execPath, [script], { cwd: dir, env, encoding: "utf8" });
    assert.equal(first.status, 0);
    assert.match(first.stdout, /\.env\.local: not found/);
    assert.match(first.stdout, /local JSON file store/);
    assert.equal((await fs.readdir(dir)).length, 0, "diagnostic must not create files");
    const secret = "THIS-FAKE-PASSWORD-MUST-NOT-BE-PRINTED-123";
    const localEnv = `MONGODB_URI=mongodb://FAKEUSER:FAKE-MONGO-SECRET@127.0.0.1:1/test\nSUPER_ADMIN_PASSWORD=${secret}\n`;
    await fs.writeFile(path.join(dir, ".env.local"), localEnv);
    const second = spawnSync(process.execPath, [script], { cwd: dir, env, encoding: "utf8" });
    assert.equal(second.status, 0);
    assert.match(second.stdout, /MongoDB is configured/);
    assert.match(second.stdout, /Connection was NOT tested/);
    for (const value of [secret, "FAKE-MONGO-SECRET", "FAKEUSER", "mongodb://"]) assert(!second.stdout.includes(value));
    assert.equal(await fs.readFile(path.join(dir, ".env.local"), "utf8"), localEnv);
    assert.deepEqual(await fs.readdir(dir), [".env.local"]);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

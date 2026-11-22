import test from "node:test";
import assert from "node:assert/strict";
import { protectDatabase } from "../../src/lib/db/protected-database";
import type { Database, Row } from "../../src/lib/db/types";

test("database write layer refuses owner deletion, identity edits, demotion, disabling and escalation", async () => {
  const records: Row[] = [
    { id: "owner", email: "marufsalauddin76@gmail.com", role: "owner", active: true, passwordHash: "old" },
    { id: "staff", email: "staff@example.invalid", role: "admin", active: true },
  ];
  const raw = {
    driver: "file",
    list: async () => records,
    get: async (_name: string, id: string) => records.find((r) => r.id === id) ?? null,
    insert: async (_name: string, row: Row) => { records.push(row); return row; },
    update: async (_name: string, id: string, patch: Partial<Row>) => { const row = records.find((r) => r.id === id); if (!row) return null; Object.assign(row, patch); return row; },
    compareAndUpdate: async (_name: string, id: string, _expected: Partial<Row>, patch: Partial<Row>) => { const row = records.find((r) => r.id === id); if (!row) return null; Object.assign(row, patch); return row; },
    remove: async (_name: string, id: string) => { const index = records.findIndex((r) => r.id === id); if (index < 0) return false; records.splice(index, 1); return true; },
    count: async () => records.length,
    putMany: async () => undefined,
  } as unknown as Database;
  const db = protectDatabase(raw);
  await assert.rejects(() => db.update("admin_users", "owner", { email: "changed@example.invalid" }));
  await assert.rejects(() => db.update("admin_users", "owner", { role: "admin" }));
  await assert.rejects(() => db.update("admin_users", "owner", { active: false }));
  await assert.rejects(() => db.remove("admin_users", "owner"));
  await assert.rejects(() => db.update("admin_users", "staff", { role: "owner" }));
  await assert.rejects(() => db.update("admin_users", "staff", { email: "marufsalauddin76@gmail.com" }));
  await assert.rejects(() => db.update("admin_users", "staff", { role: "custom", permissions: ["users.manage"] }));
  await assert.rejects(() => db.insert("admin_users", { id:"other", email:"other@example.invalid", role:"owner", active:true }));
  await assert.rejects(() => db.putMany("admin_users", []));
  assert.equal((await db.update("admin_users", "owner", { passwordHash: "new-hash" }))?.passwordHash, "new-hash");
  assert.equal(records.find((r) => r.id === "owner")?.role, "owner");
});

import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mongoCompareFilter } from "../../src/lib/db/mongo-cas";
import { sameSessionVersion } from "../../src/lib/auth/session-version";
import { hashPasswordSync, verifyPassword } from "../../src/lib/auth/password";

test("Mongo CAS filter retains exact array/object equality and distinguishes null from missing", () => {
  const items = [{ id:"item", weight:{status:"proposed", actual:12} }];
  assert.deepEqual(mongoCompareFilter("order", { items, taxRate:10, oldValue:undefined, nullable:null }, {field:"expiry",after:"now"}), {
    $and:[{id:"order"}, {items:{$eq:items}}, {taxRate:{$eq:10}}, {oldValue:{$exists:false}},
      {nullable:{$eq:null,$exists:true}}, {expiry:{$gt:"now"}}],
  });
});

test("same-process file CAS permits only one winner and compares nested financial data", async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(),"niketon-cas-"));
  process.env.CONTENT_STORE_DIR = dir;
  try {
    const { createFileDatabase } = await import("../../src/lib/db/file");
    const db = createFileDatabase();
    await db.insert("orders", {id:"order", items:[{id:"x",amount:10}], total:10, tax:1});
    const before = {items:[{id:"x",amount:10}], total:10, tax:1};
    const result = await Promise.all([
      db.compareAndUpdate("orders","order",before,{total:11,items:[{id:"x",amount:11}]}),
      db.compareAndUpdate("orders","order",before,{total:12,items:[{id:"x",amount:12}]}),
    ]);
    assert.equal(result.filter(Boolean).length,1);
    const current = await db.get("orders","order");
    assert([11,12].includes(current!.total as number));
    assert.equal(await db.compareAndUpdate("orders","order",{tax:2},{total:100}),null);
    const inserts = await Promise.allSettled([
      db.insert("wishlists", {id:"same-account", ownerCustomerId:"one"}),
      db.insert("wishlists", {id:"same-account", ownerCustomerId:"two"}),
    ]);
    assert.equal(inserts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await db.list("wishlists")).length, 1);
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});

test("password/session rotations invalidate old and in-flight admin sessions", () => {
  assert(sameSessionVersion(undefined,undefined));
  assert(sameSessionVersion("v1","v1"));
  assert(!sameSessionVersion("v2","v1"));
  assert(!sameSessionVersion("v2",undefined));
  assert(!sameSessionVersion(0,0));
  const password = "A-very-long-test-password";
  const hash = hashPasswordSync(password);
  assert(verifyPassword(password,hash));
  assert(!verifyPassword("wrong",hash));
  assert(!verifyPassword(password,"scrypt$00$00"));
  assert(!verifyPassword(password,"scrypt$junk$junk"));
});

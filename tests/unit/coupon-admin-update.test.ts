import test from "node:test";
import assert from "node:assert/strict";
import { getResource } from "../../src/lib/admin/resources";
import { normalizeForSave, parseResourceForm, resourceUpdatePatch, validateResource } from "../../src/lib/admin/parse";

test("coupon admin edits do not write back the stale redemption counter", () => {
  const config = getResource("coupons");
  assert(config);
  const data = new FormData();
  data.set("code", "SAVE10"); data.set("type", "fixed"); data.set("value", "10");
  data.set("description", "Updated rules"); data.set("active", "on"); data.set("appliesTo", "all");
  const { values, errors } = parseResourceForm(config, data);
  errors.push(...validateResource(config, values, [], "coupon-id"));
  assert.deepEqual(errors, []);
  const stale = { id: "coupon-id", usedCount: 3, internalAudit: "preserve", createdAt: "before" };
  const normalized = normalizeForSave(config, values, stale);
  const patch = resourceUpdatePatch(config, values, normalized);
  assert(!Object.hasOwn(patch, "usedCount"));
  assert(!Object.hasOwn(patch, "internalAudit"));
  assert(!Object.hasOwn(patch, "createdAt"));
  assert.equal(patch.description, "Updated rules");
  assert.equal(patch.code, "SAVE10");
  assert.equal(typeof patch.updatedAt, "string");
});

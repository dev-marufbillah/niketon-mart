import test from "node:test";
import assert from "node:assert/strict";
import { hashOrderAccessKey, verifyOrderAccessKey } from "../../src/lib/auth/order-access-key";

test("new guest access keys are hashed and legacy random keys remain verifiable", () => {
  const key = "ab".repeat(32);
  assert(verifyOrderAccessKey({ accessTokenHash: hashOrderAccessKey(key) }, key));
  assert(!verifyOrderAccessKey({ accessTokenHash: hashOrderAccessKey(key) }, "ab".repeat(31) + "ac"));
  assert(!verifyOrderAccessKey({ accessTokenHash: hashOrderAccessKey(key) }, "bad"));
  assert(verifyOrderAccessKey({ accessToken: "cd".repeat(16) }, "cd".repeat(16)));
  assert(!verifyOrderAccessKey({ accessToken: "cd".repeat(16) }, "ef".repeat(16)));
});

import test from "node:test";
import assert from "node:assert/strict";

test("malformed configured MongoDB fails closed without exposing URI and allows a later retry", async () => {
  process.env.MONGODB_URI = "mongodb://FAKE-USERNAME:FAKE-SECRET@::::/bad";
  const { getMongo } = await import("../../src/lib/db/mongo");
  try {
    await assert.rejects(getMongo(), (error: unknown) => {
      const message = String(error);
      assert.match(message, /configured but unavailable/i);
      for (const secret of ["FAKE-USERNAME", "FAKE-SECRET", "mongodb://"]) assert(!message.includes(secret));
      return true;
    });
    delete process.env.MONGODB_URI;
    assert.equal(await getMongo(), null);
  } finally { delete process.env.MONGODB_URI; }
});

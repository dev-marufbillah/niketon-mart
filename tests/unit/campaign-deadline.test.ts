import test from "node:test";
import assert from "node:assert/strict";
import { campaignDeadline } from "../../src/lib/content/campaign-deadline";

test("campaign deadline is explicit and uses Bangladesh time consistently", () => {
  assert.equal(campaignDeadline("2027-02-28"), Date.parse("2027-02-28T17:59:59.000Z"));
  assert.equal(campaignDeadline("2028-02-29"), Date.parse("2028-02-29T17:59:59.000Z"));
  for (const value of [undefined, null, "", "2027-02-29", "2026-02-30", "2026-13-01", "2026-11-10T12:00:00Z", "0000-01-01", "not-a-date"]) {
    assert.equal(campaignDeadline(value), null);
  }
});

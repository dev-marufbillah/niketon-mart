import test from "node:test";
import assert from "node:assert/strict";
import { adminNav } from "../../src/lib/admin/navigation";

test("CMS admin section provides the existing homepage and content management screens", () => {
  const cms = adminNav.find((group) => group.label === "CMS");
  assert.ok(cms);

  const destinations = cms.items.map((item) => item.href);
  for (const href of [
    "/admin/homepage",
    "/admin/r/hero_slides",
    "/admin/r/promo_banners",
    "/admin/pages/about",
    "/admin/settings",
    "/admin/media",
  ]) {
    assert(destinations.includes(href), `CMS navigation should include ${href}`);
  }
});

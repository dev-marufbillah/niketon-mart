import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedImageReference } from "../../src/lib/catalogue/image-reference";

test("persistent product/category images reject temporary, embedded, unsafe or unsupported references", () => {
  for (const safe of ["/images/products/apple.jpg", "/images/category-placeholder.svg", "https://images.unsplash.com/photo-test?auto=format", "https://images.pexels.com/photos/1/test.jpg", "https://store-123.public.blob.vercel-storage.com/products/test.png"]) {
    assert(isAllowedImageReference(safe, false), safe);
  }
  assert(isAllowedImageReference("/uploads/products/test.png", true));
  assert(!isAllowedImageReference("/uploads/products/test.png", false), "Vercel upload paths are ephemeral");
  for (const unsafe of ["", null, 7, "blob:https://example.com/temp", "data:image/png;base64,ZmFrZQ==", "//evil.test/a.jpg", "http://images.unsplash.com/a.jpg", "https://evil.test/a.jpg", "https://images.unsplash.com@evil.test/a.jpg", "/images/../private", "/images/%2e%2e/private", "/images/\\evil", "/images/%00bad", "/uploads/../images/a.png"]) {
    assert(!isAllowedImageReference(unsafe, true), String(unsafe));
  }
});

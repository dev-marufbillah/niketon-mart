import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ACCOUNT_DESTINATION, isAdminDestination, registrationHref, safeAccountNext } from "../../src/lib/auth/return-to";

test("shared sign-in returns only to an allowed same-site page", () => {
  for (const path of ["/product/fresh-rui-fish", "/cart", "/wishlist?list=1234", "/checkout", "/admin/orders", "/my-account/orders", "/product/fresh-rui-fish#reviews"]) {
    assert.equal(safeAccountNext(path), path);
  }
  for (const malicious of ["https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/product/../other", "/product/%2f%2fevil", "/my-account/login", "/admin/login", "/my-accounting", "/order/private#token=secret", "/cart\r\nLocation: evil", "/" + "x".repeat(3000)]) {
    assert.equal(safeAccountNext(malicious), DEFAULT_ACCOUNT_DESTINATION, malicious);
  }
  assert.equal(isAdminDestination("/admin/orders"), true);
  assert.equal(isAdminDestination("/admin?denied=x"), true);
  assert.equal(isAdminDestination("/my-account"), false);
  assert.equal(registrationHref("/product/fresh-rui-fish"), "/my-account/register?next=%2Fproduct%2Ffresh-rui-fish");
});

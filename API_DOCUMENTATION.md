# API and server-action reference

The Next.js application primarily uses server actions rather than a public REST catalogue API. Server actions are internal application contracts, not stable public endpoints; server session, permission, validation and ownership checks remain authoritative. All amounts are numeric BDT, with display formatting performed separately.

## HTTP routes

| Route | Access | Current behavior |
| --- | --- | --- |
| `GET /api/admin/home/top-picks` | Admin `content.view`/`content.manage`, or configured `ADMIN_API_TOKEN` bearer | Returns section record, resolved public product fields and missing IDs. |
| `PUT /api/admin/home/top-picks` | Admin `content.manage`, or configured bearer | Validates section copy/product IDs, saves to the central homepage record and records a best-effort activity entry. Missing/invalid auth gets 403; invalid JSON 400; invalid data 422. |
| `POST /api/admin/media/upload` | Admin with media, product or content management permission | Multipart `file` plus optional `folder`; bounded body, 5 MiB maximum file, actual JPG/PNG/WebP decode/re-encode and durable Blob on Vercel. Returns `{url,id,folder,alt}` or a meaningful 4xx/5xx. Host limits may be lower. |
| `GET/POST /api/payments/[provider]/callback` | Public but disabled | Returns 503 without processing or marking a payment. No provider session/callback is implemented. |
| `GET /api/e2e/safety` | Isolated dev only | 404 on production/Vercel, Mongo, Blob or without explicit local marker/test settings; otherwise returns a non-secret hash of the disposable store path. |
| `/robots.txt`, `/sitemap.xml` | Public | Use the configured origin; sitemap includes visible public products, not private account/order/admin paths. |

The optional bearer token is powerful and not an individual admin identity; leave it unset unless required, rotate it, and never expose it in the browser.

## Catalogue pages and administration

`/home-grocery` is the complete live shop. `/fresh-market` and `/grocery` partition the existing public catalogue using each top-level category's admin-managed navigation group; a subcategory follows its current parent. `/categories` and the shared desktop/mobile menus respect category and parent navigation visibility. Category links carry an immutable category ID in `?category=`; filters, sorting and pagination stay on the current listing route. These are HTML pages, not new public REST APIs. The existing `products.manage`-protected taxonomy action persists `showInPrimaryNavigation`; the first visible, navigation-enabled featured category is projected into a single optional primary-menu slot. Normal saves reject a second featured category; rendering is capped to one even if legacy/concurrent data contain multiple flags. Category images use the existing permission-checked upload and taxonomy action; page title/description settings use the existing `settings.manage` action with server validation. The parent/child explorer is a presentation of the same public catalogue and active query, not a new API or hardcoded category mapping. It excludes navigation-hidden children, while product visibility follows the separate category `visible` flag. Links retain the other filters and use the actual category ID. Product image sources now reject `data:`, `blob:`, `file:` and unconfigured remote hosts before persistence; this does not replace a broader media-security audit.

## Important server actions

- `src/lib/actions/cart.ts` and `checkout.ts`: accept product identifiers, quantities and selections; recompute price, preparation, tax, delivery and discount server-side. Production order creation is paused pending safe transactions/idempotency. Never accept a browser total as authority.
- `src/lib/actions/orders.ts`, `weight-confirmation.ts`, `account-orders.ts`: require an authenticated order owner or a high-entropy private order key. New fragment keys exchange for order-scoped HttpOnly cookies. Customer cancellation is paused in production. Weight approval binds to an exact proposal and total.
- `src/lib/actions/account.ts`: shared customer/staff credential verification; only the active staff credential creates an admin session. Public registration creates a customer, never an admin. `wishlist.ts` derives the owner from the server session and rejects a stale-tab owner mismatch; share links are read-only. `reviews.ts` requires a shopper session. `contact.ts` and `newsletter.ts` persist genuine messages/subscriptions; no customer notification email/SMS is implied.
- `src/lib/admin/*-actions.ts`: enforce permissions for catalogue, orders, payment decisions, settings, staff and content. Only the protected owner has `users.manage`. Payment/refund entries record already verified events and do not move money.

## Privacy and compatibility

Do not return raw product, customer, session, token, admin or order documents to an untrusted client. Public catalogue and review projections strip sensitive fields. New order access keys and admin invitation/reset tokens are stored as SHA-256 hashes; legacy order keys can still be plaintext pending migration. Errors should not reveal whether a private order or admin account exists. See `SECURITY_AUDIT.md` for untested integrations and residual risk.

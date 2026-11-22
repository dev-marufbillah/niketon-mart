# Niketon Mart — grocery & fresh market

Next.js / React / TypeScript storefront and one centralized admin. Categories, products, stock, preparation choices, content and store settings are managed from the same admin and persisted through the database layer. Prices display in BDT with Bangladeshi grouping.

> **Not ready for live ordering:** production checkout is paused and online cancellation is held in every environment pending the owner's manual-review requirements and a completed staff workflow. Online gateways are not implemented. The Vercel-linked `main` is a different codebase; do not overwrite it or connect this source to its live DB. No deployment was made. Review `docs/GITHUB_MAIN_COMPARISON.md`, `REMAINING_TASKS.md` and `DEPLOYMENT_GUIDE.md` before launch.

## Run locally

Prerequisites: Node.js 20.9+ and npm. The ZIP deliberately contains no database, credentials, dependencies or build output.

```bash
npm ci
cp .env.example .env.local
# Edit .env.local: set a unique SUPER_ADMIN_PASSWORD (12–256 characters).
npm run dev
```

Open `http://localhost:3000`; customers and staff use `/my-account/login` (the old `/admin/login` redirects there). The protected owner email defaults to `marufsalauddin76@gmail.com`. The password is created from your server environment only when the owner is first provisioned, not from this repository. After verifying access, remove the bootstrap password from the runtime environment and store your credentials safely. Never put a secret in a `NEXT_PUBLIC_` variable or commit `.env.local`.

Google customer sign-in requires a Google OAuth web client, the exact callback URI and server-only environment values. It never grants staff access; existing password customers must explicitly connect Google after password verification. Actual Google integration is not yet tested. See `docs/GOOGLE_LOGIN_BANGLA.md` before setup.

Without `MONGODB_URI`, local development uses `.data/db.json` and seeds **demo** catalogue/content. These examples are not real business records; verify or replace them before use. The local store is not suitable for multiple production instances. A fresh production store does not seed demo products, reviews, heroes or active payment methods. Production on Vercel requires MongoDB; uploads additionally require Vercel Blob. See `.env.example` and `DEPLOYMENT_GUIDE.md`.

## Admin and shopping flows

- Catalogue and search are public. Product details, cart, wishlist, checkout and review submission require a customer or verified staff session; guests are sent to customer signup and can choose sign-in instead. The intended internal page is restored after successful authentication. Product detail pages are excluded from the public sitemap because they require sign-in.
- The shared sign-in verifies staff credentials on the server against the existing admin records; only active, verified staff get the dashboard shortcut and their existing RBAC permissions. Public signup creates customers only, including when an email matches a staff email. Staff shop with a separate profile bound to their admin ID; email alone never merges profiles or old orders.
- Wishlists are persisted to the signed-in account with a separate read-only share link; carts stay in browser storage scoped to each account and device. Earlier unscoped browser carts and token-only guest wishlists are retained but are not automatically assigned to a new account. Existing read-only wishlist share links still work after sign-in. Plan an explicit verified recovery process for old unshared guest lists before relying on a migration.
- `/fresh-market` and `/grocery` are separate live product listings; `/categories` is the category index and `/home-grocery` remains the full shop. In `/admin/catalogue/taxonomy`, assign a top-level category's navigation group: Fresh Market appears in the former; Grocery & Essentials, Household and Bakery appear in the latter. Children follow their parent. Visibility, home/navigation display, order, image and safe deletion remain in this existing admin. Products are managed in `/admin/catalogue/products`.
- Upload a category image and save it in taxonomy; it is used across desktop/mobile category navigation and homepage. Without an uploaded category image, a visible product image or neutral placeholder is used. Desktop Featured Categories use larger centered wrapping rows; mobile keeps its existing horizontal rail. Edit catalogue-page headings and descriptions in `/admin/settings` → Catalogue pages. Standard English navigation is Home, Shop, Categories, Fresh Market, Grocery, the optional admin-featured category and About Us; Blog remains in the footer.
- Fresh Market, Grocery and featured-category pages scope both products and facets to their respective admin-managed group/family; Shop retains the complete public catalogue. Featured categories such as Dates show subcategories in filters rather than illustrated Explore tiles. **Show subcategories as filters only** in the existing taxonomy admin preserves that behaviour even if the category leaves the primary navigation slot; ordinary categories retain their existing illustrated subcategory browser. Counts represent public products, not stock. See `docs/STOREFRONT_CATEGORIES_BANGLA.md`.
- A brand-new local demo database starts with editable **Dates** and five starter subcategory names: Ajwa, Medjool, Mabroom, Safawi and Sukkari. These are taxonomy examples only: no date products, prices, stock or product photos are created. Existing and production databases are not modified automatically. After approved backup/review, create or edit `Dates` in Admin → Categories & brands, enable the two navigation checkboxes, then add each real subcategory with Dates as its parent. Unfeature the previous selection first. In Products → New product choose `Dates › [subcategory]` and enter genuine product data and a deliberate image.
- Homepage merchandising and the Top Picks editor use the existing admin, not a separate data system. Desktop category/product cards and the product gallery are compact; the mobile hero places its image first. A card links to its product while cart and wishlist remain separate controls.
- Preparation groups, selling units and prices are configured per product. Cart/checkout pricing comes from the server; order lines snapshot the selected preparation and its charge.
- A heavier variable-weight item requires an exact customer approval. A lighter item may reduce a reconcilable unpaid total. Paid or insufficiently snapshotted historical orders are held for manual review; a waiver does not charge more.
- The owner manages role-limited staff through invitations. A real Resend configuration is required for invitation/reset delivery. Admins do not select each other's passwords.
- Guest order access uses a private key, not just email or phone; new links use a fragment and order-scoped cookie. Signed-in customers see only orders confirmed as belonging to their session. No customer order email/SMS is configured.
- COD and explicitly configured manual transfers are non-gateway methods, but **production checkout remains paused**. Staff can record only independently verified payments/refunds; the app does not move money.

## Verification

```bash
npm run typecheck
npm run test:unit
npm run lint
npm audit
npm run build
```

Use only an isolated store for build/browser tests because initialization can write data. `npm run test:e2e` creates orders, users and uploads and refuses to run without a disposable local-store handshake; follow the exact instructions in `REMAINING_TASKS.md`. Actual results and limitations are in `IMPLEMENTATION_REPORT.md`, `PROJECT_AUDIT.md` and `SECURITY_AUDIT.md`.

To put this ZIP in a new private GitHub repository or safely compare it with an existing remote, see `GITHUB_UPLOAD_BANGLA.md`. Other guides: `ADMIN_GUIDE.md`, `API_DOCUMENTATION.md`, `LOCAL_SETUP_BANGLA.md`, `docs/LIMITATIONS.md` and the permanent development rules in `AGENTS.md`.

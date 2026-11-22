# Project audit — Niketon Mart

## Scope and status

The workspace now contains a grocery/fresh-market storefront and one centralized admin. The approved design is retained. Production checkout and online cancellation are intentionally held; no deployment or live data mutation has been performed. A Vercel project was observed read-only, but its deployed revision and database have not been reconciled with this workspace.

## Implemented and reviewed

- **Homepage presentation and scrolling:** the category section had fixed-width desktop flex cards extending beyond the content container. A contained responsive desktop layout and small-screen rail remove document-wide horizontal overflow without a global overflow-hiding workaround. Desktop merchandising cards, banners and the product gallery are now more compact; small-screen hero order is image then text. Card surfaces are links with independent cart/wishlist controls. Browser coverage exercises natural vertical scroll, sticky header, card interactions, category navigation and desktop/tablet/mobile widths.
- **Responsive navigation/data reads:** catalogue, homepage and settings reads are deduplicated per server render, while mutations and later requests remain fresh. Local before/after timings were mixed; see `IMPLEMENTATION_REPORT.md` rather than assuming a live-site speedup. The Top Picks dedicated editor/API now persists its validated fields instead of the generic empty-schema path silently dropping them.
- **Catalogue and navigation:** separate Fresh Market and Grocery listings derive their products and filters from the admin-managed root category group; children follow their current parent. Categories has a real visibility-filtered index. Desktop/mobile menus and homepage category thumbnails use the admin image first, then a visible product image or neutral placeholder, never a category emoji. Existing taxonomy manages groups, pictures, order and visibility; Settings manages page headings and descriptions/SEO. The requested English navigation labels and URLs are fixed. Products, stock, variations, preparation, units and media use the existing admin and database.
- **Drawers and scroll:** cart/wishlist destination links close their persistent drawer; overlapping mobile-menu, drawer and filter scroll locks are coordinated. New paths start at the top, while hash anchors, browser history and filter/pagination interactions are not forcibly reset. Global automatic smooth scrolling is disabled; pagination explicitly requests smooth scrolling.
- **Money and order snapshots:** centralized BDT/৳ formatting with lakh grouping and server-side pricing; preparation and weight details are snapshotted. A variable-weight increase needs exact customer approval; a reduction, discount cap and waiver preserve the correct unpaid amount. Legacy/paid/inconsistent orders fail closed rather than being re-priced.
- **Identity and privacy:** protected configured owner, role-based staff invitations and resets, suspension/session revocation, scoped customer sessions, hashed new guest keys and private order access, genuine-review/public-product projections.
- **Payments and uploads:** COD/manual configuration only; gateway integration unavailable. Real staff-verified payment/refund records do not move money. Authorized image uploads validate actual bytes, bound request bodies and require durable Blob on Vercel.
- **Content and operations:** centralized homepage/Top Picks, delivery settings, contact/subscription storage, SEO origin, robots and sitemap. The permanent same-task centralized-admin rule is documented in `AGENTS.md`.

## Data safety

An earlier local-only archive preserved 31 corporate rows in a private workspace archive; it is intentionally excluded from the ZIP. The archive script only copies records. Historical corporate records must not be deleted without authorization. A local demo database had sample numeric prices labeled BDT without converting the numbers; it is excluded from the ZIP and requires business review. No claim is made about live data or historical foreign currency. A new production database does not seed fake catalogue/hero/active payments.

## Gaps and verification

See `REMAINING_TASKS.md` for transaction/idempotency/cancellation blockers, live backup and migration approval, real Mongo/Blob/mail/gateway tests, legacy keys/identity and customer concurrency. `IMPLEMENTATION_REPORT.md` records actual command results and their scope. Lint and dependency warnings, best-effort logs and observed dev stream errors remain. This is not a launch-ready certification.

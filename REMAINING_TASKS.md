# Remaining tasks and safe test instructions

**Status: do not use this release for live ordering yet.** Production checkout and online cancellation (all environments) are intentionally held. The Vercel-linked `dev-marufbillah/niketon-mart` `main` at `892500c4d5a335dd34ecbc9ee5680f26f40dd944` was read-only compared and is a substantially different Better Auth/Mongoose source and database shape; see `docs/GITHUB_MAIN_COMPARISON.md`. It was not merged or changed. The connected live database and Vercel project were not changed. Git push must happen before any Vercel deployment or Vercel settings change.

## Launch blockers

1. **Transactional checkout.** An experimental Mongo core and opt-in unique constraints have passed synthetic local replica-set checkout, rollback, idempotency and concurrency probes. They are not production certification. Test actual admin actions and variant editing against checkout, additional retry/failure paths, multiple application instances, legacy BSON and Atlas; independently review the entire flow. Keep the public production checkout hold until all gates pass.
2. **Transactional cancellation/refunds.** The owner selected manual review for coupon orders and uncertain customer aggregates. A pre-write hold now rejects ALL online cancellation in all environments because this version cannot establish/reconcile every customer contribution; the general local status path cannot bypass it and a caller-supplied staff ID is refused. There is no completed in-app authorized staff review or refund workflow. Design and implement per-order permission-checked review, accounting/coupon decisions, transactionally consistent stock/ledger and real refund reconciliation, with historical-order handling and real admin/dispatch races; then independently review. Do not substitute an assumed release or aggregate policy for the owner's choice.
3. **Live-data approval.** Identify the exact repository, deployment and database; make and restore-test a private backup before running this code or migrations. Review `_meta` seed version, admin identities, products, financial records and currencies. Resolve duplicate/invalid admin emails and conflicts with the protected owner; never blindly relabel USD/unknown historical amounts as BDT. Any conversion needs explicit owner approval and reconciliation. Preserve the corporate archive; never publish or delete it without approval.
4. **Real-service staging.** Test MongoDB replica-set transactions and exact nested-value CAS against the actual deployment; exercise multiple instances and legacy BSON, indexes and failure recovery. Test Vercel Blob upload/retrieval/deletion and access; send and receive real invitation/reset messages via a verified Resend sender. Local file storage and mock email are not evidence that these services work.
5. **Store setup.** Configure the real HTTPS `NEXT_PUBLIC_SITE_URL`, MongoDB, Blob, protected owner, sender/domain and reviewed store settings. Populate genuine categories, products, images, prices, delivery areas and payment methods; review any demo numeric amounts instead of treating them as real BDT prices. Verify shipping, tax and legal content with the business. New production stores intentionally start without demo catalogue/content or enabled payment methods.

## Additional security and operations

- Google customer OAuth is implemented but Google Cloud credentials, approved consent screen, exact HTTPS callback and an actual Google login have not been supplied/tested. Follow `docs/GOOGLE_LOGIN_BANGLA.md`; first review the partial unique Google-subject Mongo index and backup/legacy duplicates on isolated staging, then verify real login, explicit password-account linking, sign-out, blocking, session revocation and concurrent link/unlink across instances. Google does not grant staff access. OAuth credentials are environment-only and must never enter Git, logs or ZIPs.
- Implement an audited real payment integration only if needed, including provider-hosted session, authentic callback verification, amount/currency validation, replay protection, settlement and refund reconciliation; currently all gateway callbacks are rejected. Do not store card numbers, CVV, PIN or OTP.
- Replace per-instance throttling with a shared limiter/WAF, verify trusted proxy headers, and review CSRF/security headers and production observability. Activity logging is best-effort, not an immutable guaranteed audit trail.
- The reconstructed source now creates a case-insensitive partial unique index for registered-customer email, a partial unique Google-subject index, and a partial unique index for the single featured category. Legacy invalid/untrimmed registered identities, duplicate identities or multiple featured flags can block initialization: back up, inspect and resolve them deliberately rather than automatically merging or modifying records. Local replica-set concurrency/preflight tests passed; Atlas, legacy production BSON and full multi-instance application workflows still need staging review. Customer session revocation still needs a concurrent password-change/login race review. The file-driver uniqueness and CAS protections apply within one process only.
- Old token-only guest wishlists and unscoped browser carts are retained but are not automatically assigned to the next account on a shared device. Existing wishlist share links can be opened after sign-in; devise an explicit ownership-verified recovery path for unshared legacy lists before migrating them. Account wishlist writes are last-write-wins between devices, not a transactional merge.
- Old guest orders may have plaintext access keys and legacy `?t=` links, which can leak on the initial GET. New keys are hashed and fragment-based. Plan a controlled rotation/migration. Old signed-in orders without reliable `customerWasAuthenticated` provenance require their private key and are omitted from account history until ownership is verified.
- Historic orders without the original frozen `checkoutDiscount` or trustworthy tax/financial snapshots are blocked from reweighing; do not guess or rewrite them. Paid/awaiting-verification orders require manual reconciliation.
- Product pages and server quotes hold products with multiple nonempty variation groups for review. Cards, search, recently viewed and wishlists now use explicit base/from/review pricing, with unit tests; stale carts and full cross-surface browser/admin-action races still need testing before any live orders.
- Manual payment decisions submit a fingerprint of the displayed BDT financial snapshot and use conditional updates. The reconstructed source passed focused local browser checks for forged/stale/anonymous submissions, concurrent decisions, weight/currency holds and separate refund evidence. This does not prove payment or provide a transaction: real provider reconciliation, broader multi-instance staging and financial review remain necessary.
- The admin design refresh passed 11 focused browser groups and five inventory groups against separate disposable file stores, including 7 representative screens at four viewport widths. This is not a full admin action, screen-reader, MongoDB or production audit; see `ADMIN_DESIGN_UPDATE_BANGLA.md`.
- Audit remaining permission, accessibility, performance, content/SEO and image-host policies on staging. A later isolated browser probe found no horizontal overflow at 320, 360, 375, 390, 767, 768, 1024 or 1366px after a narrow-header adjustment; wishlist remains available in the mobile menu. Product details now require sign-in and are excluded from the public sitemap: review the SEO trade-off before launch. Review the current lint warnings and moderate dependency advisories. Dev logs have shown `The destination stream errored while writing data` during rapid navigation; determine whether this is a harmless aborted stream or an application defect and monitor production.
- Customer self-service password-reset/verified-email change is implemented, but the full browser flow and actual email provider, Atlas and multi-instance setup are unverified. Customer order emails/SMS, live delivery tracking and real payment processing are not implemented. Verify business claims and contact details before publication.
- The underscore-containing admin return-path allowlist was corrected and has unit coverage; review redirect behaviour again during real-service staging.

## Private Atlas test and Git sequence (not yet performed)

- The previously shared Mongo credential was exposed in chat: rotate it before production. If an Atlas test is authorized, use a **test-only** user, private secret handling and a new random empty database; do not paste credentials into chat or Git, and do not use existing live data. Other environment keys from the user's template are not automatically implemented.
- A prospective target `niketon_test_706bf8eaa9f6c61a3ff12326` was generated but has **not** been checked or written on Atlas. Before using it, confirm the destination is empty and scope a temporary account to that database only if Atlas permits; if not empty or insufficiently isolated, stop and provision a fresh target. An Atlas-specific empty-target probe must first be implemented and reviewed to reject unsafe names/nonempty stores, write synthetic data only, and never seed or drop a database automatically.
- `npm run test:mongo:local` passed 32 synthetic groups against its own temporary localhost replica set, including experimental application checkout, financial validation and manual cancellation holds; it accepts no Atlas URI and does not prove Atlas or multi-instance browser/server-action behavior. Earlier stock-restoration cancellation probes applied to the prior now-held primitive and do not prove the current manual review workflow exists. Never use live credentials in browser E2E tests.
- The Vercel-linked `dev-marufbillah/niketon-mart` `main` was inspected read-only, but an earlier note used a different owner name; confirm the intended repository. The comparison revealed incompatible identity/order/media schemas and remote-only features. Re-fetch latest, preserve remote history and feature-by-feature changes, prepare a reviewed migration and obtain approval before any non-force push. Only after push and a readiness/backup/staging review may Vercel settings or deployment be considered. Neither has happened yet.
- `NIKETON_PREPARE_TRANSACTION_INDEXES=1` prepares experimental order indexes only after explicit review on a disposable staging database; it does not enable the held production checkout. Existing identity/featured-category indexes can be created even without this flag, and startup may perform other writes. Consult `docs/TRANSACTION_STAGING_BANGLA.md` before connecting any MongoDB database.

## Re-run checks safely

Run from the extracted project directory. Build/initialization can write to a data store, so never point these commands at a live database.

```bash
npm ci
npm run typecheck
npm run test:unit
npm run lint
npm audit
# An isolated build: explicitly override any values in .env.local as empty.
BUILD_DIR=$(mktemp -d "${TMPDIR:-/tmp}/niketon-build-XXXXXX")
MONGODB_URI='' BLOB_READ_WRITE_TOKEN='' VERCEL='' CONTENT_STORE_DIR="$BUILD_DIR" \
  SUPER_ADMIN_PASSWORD="$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')" \
  NEXT_PUBLIC_SITE_URL='https://example.invalid' npm run build
```

### Browser suite (destructive, disposable local data only; Bash/macOS/Linux/WSL)

Install Chromium and any system dependencies with `npx playwright install chromium` (Linux may also need `npx playwright install-deps chromium`). Start **Terminal 1** in the project directory:

```bash
umask 077
TESTDIR=$(mktemp -d "${TMPDIR:-/tmp}/niketon-e2e-XXXXXX")
printf 'niketon-mart-e2e-disposable\n' > "$TESTDIR/.niketon-e2e-disposable"
PASSWORD=$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')
printf 'export E2E_DATA_DIR=%q\nexport E2E_OWNER_PASSWORD=%q\n' "$TESTDIR" "$PASSWORD" > "$TESTDIR/test.env"
. "$TESTDIR/test.env"
# Empty overrides also prevent Next.js loading live values from .env.local.
export MONGODB_URI='' BLOB_READ_WRITE_TOKEN='' VERCEL=''
export CONTENT_STORE_DIR="$E2E_DATA_DIR" SUPER_ADMIN_PASSWORD="$E2E_OWNER_PASSWORD" SUPER_ADMIN_EMAIL=marufsalauddin76@gmail.com
export E2E_TEST_MODE=1 NEXT_PUBLIC_SITE_URL=http://localhost:3000 ADMIN_API_TOKEN=''
export ADMIN_MAIL_TEST_URL=http://127.0.0.1:3666/emails RESEND_API_KEY=isolated-test ADMIN_EMAIL_FROM=tests@example.invalid
printf 'Disposable test settings: %s/test.env\n' "$TESTDIR"
npm run dev -- --hostname localhost
```

Open `http://localhost:3000/` once to initialize the disposable store. In **Terminal 2**, source the printed `test.env` path, then run `npm run test:e2e` for the full suite or the separate `test:e2e:auth`, `test:e2e:navigation`, `test:e2e:dates`, `test:e2e:storefront-scope`, `test:e2e:storefront-scroll`, `test:e2e:google`, `test:e2e:payment`, `test:e2e:inventory`, or `test:e2e:admin-ui` scripts. Each suite mutates its store; use a fresh marked local demo store for each. The suites verify a local-only safety endpoint, the disposable marker and matching store path; the broader suite starts a loopback email mock on port 3666 and requires all three mock-mail variables above. It creates test users, orders and temporary uploads. `E2E_ONLY` selects a subset but is not a substitute for the full suite; some steps depend on earlier steps. The latest full run was stopped after timeouts/failures, a misconfigured mock-mail setup and memory exhaustion. Afterward, focused fresh-store admin security passed 6/6 selected checks and category/media passed 5/5 selected checks including the previously failing category-image assertion. A prior run finished 16/30, with later focused passes; none is a clean full pass. The new inventory suite passed 5/5 groups on a file store, not Mongo concurrency. Re-run the full suite with correct mock settings and adequate memory and investigate remaining failures. Stop the server and inspect the marker/directory before cleaning disposable data; never clean a real store or unrecognized upload. Never use production credentials or a live database for this suite.

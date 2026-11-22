# Deployment guide — staging first, no live deployment performed

## 1. Stop and review

Git push must precede any Vercel deployment **or settings change**. This workspace was reconstructed from an older ZIP; read-only comparison with the Vercel-linked `dev-marufbillah/niketon-mart` `main` shows incompatible architecture, identity/data and remote-only features. Confirm the intended repository, re-fetch latest and review `docs/GITHUB_MAIN_COMPARISON.md`; do not overwrite it. The previously chat-exposed Mongo credential must be rotated before production.

Production checkout is deliberately paused. A staff-reviewed cancellation workflow now exists for eligible new, unpaid offline orders and orders with an independently completed and recorded refund, but the latest version has not yet passed its disposable Mongo replica-set suite or real staging tests. Customer self-service cancellation and online payment remain unavailable. This repository is a workspace snapshot, not proof of what is currently deployed to Vercel. Do not deploy or connect it to an unknown live database until the owner approves the release plan and `REMAINING_TASKS.md` launch blockers are resolved. Mongo initialization can create identity/featured indexes and perform other writes without the experimental order-index flag; see `docs/TRANSACTION_STAGING_BANGLA.md`.

1. Identify the exact Vercel project, Git revision, database and media store. Back up all data securely and verify restoration separately; the private historical corporate archive must never enter a public repository or ZIP.
2. Inventory existing owner/admin identities and case-variant email duplicates. Existing `SUPER_ADMIN_EMAIL` with a wrong role, inactive status or missing hash fails closed. The new Mongo admin email unique index can fail on legacy duplicates. Plan recovery offline with a backup and authorization, not by silently elevating an account.
3. Inspect store currency, historical orders and seed `_meta` version. Startup rejects existing non-BDT/unknown financial data and older production seed migrations. Do not relabel or convert values without owner approval and accounting review.
4. Clone an isolated staging database and Blob store; scrub personal data as appropriate. Test the release, restore plan and all real integrations there. Do not enable checkout until cross-instance transactions, idempotency, inventory and failure tests pass.

## 2. Server environment

Set secrets in the platform's server environment, never in Git or `NEXT_PUBLIC_` variables:

| Name | Purpose |
| --- | --- |
| `SUPER_ADMIN_EMAIL` | Protected owner identity; use `marufsalauddin76@gmail.com`. Only an intentional authorized server configuration change can alter it. |
| `SUPER_ADMIN_PASSWORD` | Unique 12–256-character bootstrap password, only required when no protected owner exists. Verify login then remove it from the environment. |
| `MONGODB_URI`, `MONGODB_DB` | Durable database (Vercel requires the URI; database name defaults to `niketon_mart`). Use least-privilege credentials and backups. |
| `NEXT_PUBLIC_SITE_URL` | Actual HTTPS origin, with no path/query/fragment. Used for canonical/robots/sitemap and admin email links. |
| `BLOB_READ_WRITE_TOKEN` | Required for durable Vercel image uploads. The image is public; do not upload private documents. |
| `RESEND_API_KEY`, `ADMIN_EMAIL_FROM` | Real invitation/reset emails via a verified sender; provider acceptance is not inbox delivery. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_OAUTH_COOKIE_SECRET` | Customer-only Google sign-in; actual provider testing and correct HTTPS callback are still required. See `docs/GOOGLE_LOGIN_BANGLA.md`. |
| `ADMIN_API_TOKEN` | Optional powerful maintenance bearer for Top Picks; leave unset unless needed and rotate securely. |

Do not configure `ADMIN_MAIL_TEST_URL` or `E2E_TEST_MODE` in production. Gateway keys do not enable payments; provider integrations are not implemented. `.env.example` is a template with no secrets.

## 3. Staging verification

- Run `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run lint`, `npm audit` and `npm run build` on isolated configuration. Run the guarded browser suite only on a disposable local file store, then perform separate real-service and concurrency tests against staging.
- Confirm protected-owner login and invitation/reset delivery, replay/expiry, roles, suspension and revocation; never share passwords. Check Mongo index creation, duplicate handling and app restart.
- Upload, retrieve and delete a real test image from a separate Blob store. Validate provider/platform upload limits; the app's 5 MiB file limit can be lower at the hosting layer.
- Verify currency/price snapshots, visibility and taxonomy, responsive scrolling, product images, SEO origin and private-order access. Verify checkout and cancellation are still paused until approved, and fake callbacks cannot mark a payment paid.
- Configure only genuine store information, products, prices, taxes, delivery areas and manually verified payment instructions. Fresh production initialization intentionally leaves catalogue/hero and payment methods empty/inactive.

## 4. Release and recovery

Obtain explicit owner approval after the blockers, staging and backups are complete. Deploy the reviewed revision, monitor errors and verify against a small approved checklist. Roll back code/configuration if necessary without deleting or rewriting production data; restore data only under a separately approved, tested recovery procedure. Never point destructive E2E tests at production. Review distributed rate limiting, activity-log guarantees, PII retention, legacy order links and dependency advisories before launch.

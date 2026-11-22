# Current limitations

- Production checkout and online cancellation are paused pending transactional order/stock/ledger work; local checkout is for isolated development only.
- Online gateway sessions, callback verification and actual payment/refund processing are not implemented. Manual records require independent verification. Manual decisions bind the displayed financial snapshot and passed focused local stale/concurrency tests, but still require independent payment verification and staging reconciliation.
- Admin invitations and resets use real Resend only when configured; no customer order email or SMS, no customer self-service reset email and no live courier tracking are implemented.
- MongoDB, Blob, real email and distributed concurrency require staging tests; the JSON file store and mock email are not proof of production safety.
- Historical currency/owner/data migrations require backup and explicit approval. Legacy guest keys and order ownership need reviewed reconciliation. Historic orders without complete financial snapshots cannot be safely reweighed.
- Local demo content and price examples are not verified business records. Fresh production starts without demo catalogue/hero or enabled payment methods.
- Rate limiting and file locking are per-process; activity logging is best-effort. Additional security, observability, accessibility, performance and dependency work is listed in `REMAINING_TASKS.md`.
- Corporate data: preserve any existing private historical archive and database backup; the archive script copies records but does not delete them. Never publish or remove it without authorization.

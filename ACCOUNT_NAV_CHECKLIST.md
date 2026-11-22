# Account, navigation and access checklist

Current request; all checks use disposable local data. No live deployment or live-data change is authorized.

- [x] Stop account navigation from showing the old footer/scroll position; retain anchor and history behavior.
- [x] Make the existing admin-managed category menu more spacious with restrained hover/focus zoom.
- [x] Simplify search and verify live-catalogue brand results and Enter submission. Further keyboard/mobile and empty/error-state coverage remains.
- [x] Provide one customer/staff sign-in entry. Only a verified, active staff credential grants the existing server-side admin role; public signup is customer-only. Keep staff invitations and password resets secure and separately verified.
- [x] Expose a dashboard shortcut only to an authenticated staff identity, never an ordinary customer.
- [x] Require sign-in/sign-up for product details, cart, wishlist and checkout; preserve browsing, legacy private order links and safe return destinations. Enforce relevant server actions, not just client appearance.
- [x] Keep shopper data separated between accounts and preserve old data without silently attaching someone else's records.
- [x] Run isolated guest, customer, owner, invited/suspended staff, core account switching, admin permissions, logout, navigation and saved-state checks; update the test harness and docs. See the remaining coverage below.
- [x] Run typecheck, unit tests, lint, isolated build and focused browser checks. Package without private data, credentials, runtime uploads or build artifacts.
- [ ] Complete an uninterrupted full regression and test forged quote/checkout/review actions, concurrent wishlist writes, additional mixed-cookie/account switching and keyboard/mobile/anchor cases.
- [ ] Verify real MongoDB, Blob, Resend and other live integrations on approved staging after backup/review; production checkout and cancellation remain held.

Historical account-pass results (see IMPLEMENTATION_REPORT.md for the current reconstructed-source recheck): typecheck and build passed; 20 unit tests passed; lint reported 0 errors and 18 warnings. The shared-login/navigation suite passed eight groups including anonymous and cross-account wishlist write replays. Separate focused tests passed 8/8 owner/staff/SEO checks with mock email, and checkout plus guest/authenticated order privacy cases passed in a different run. The complete regression was not rerun as one clean suite. See IMPLEMENTATION_REPORT.md.

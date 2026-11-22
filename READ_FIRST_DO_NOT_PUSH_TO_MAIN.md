# Read first — reference source, not a deployment package

This is reconstructed work, not a checkout of the Vercel-linked GitHub project. **Do not copy it over `dev-marufbillah/niketon-mart` main, force-push it, connect it to the live database, or deploy it as-is.** The linked main uses substantially different Better Auth, Mongoose, order and media structures and has remote-only features. Production checkout in this reconstructed source is held; cancellation review/refunds and real-provider staging are incomplete.

This version includes the redesigned existing admin panel. See `ADMIN_DESIGN_UPDATE_BANGLA.md` for the changes and focused local test results, `GIT_PUSH_DEPLOY_NOW_BANGLA.md` for the owner's steps, `MASTER_COMPLETION_TRACKER.md` for the latest checks, and `docs/GITHUB_MAIN_COMPARISON.md` for specific differences. A reviewed feature-by-feature integration onto the real main and a backup/restore-tested database plan are required before a non-force Git push. Deploy only after the push and readiness review. No live writes or deployment were made in producing this archive.

The archive excludes real environment files, local databases, runtime uploads, dependency/build directories and private archives. It contains `.env.example` only as a template. No provider credentials should be sent in chat.

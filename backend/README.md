# Live class progress

The static cases are hosted on GitHub Pages. A Cloudflare Worker and D1 database provide shared progress counts. The production endpoint is configured in `../shared/live-config.js`.

## Instructor workflow

Open the landing page, enter the private instructor key, and choose **Show live progress**. Start a session for the relevant case **before** students open its usual URL or QR code. The dashboard refreshes every 10 seconds. End the session afterwards; starting another session gives fresh counts. Sessions expire after 12 hours.

**Preview case** links do not count the instructor. Students need no account. Counts represent browser profiles or groups sharing one device, not verified individuals. Reloading the same browser retains its random session token. Separate browsers, private browsing, or cleared browser storage can count again. Only successfully checked core gates count; optional extensions and written explanations are not automatically assessed. A gate remains recorded as passed if answers are later edited.

## Data and access

The Worker stores a session label, timestamps, a hash of each random participant token, and four completion bits. Answers and free text stay in the browser. Aggregated counts and session management require the `ADMIN_TOKEN` Cloudflare secret. Never put that secret in this repository, a URL, or the frontend configuration. GitHub and Cloudflare also process technical access data to operate the services.

Daily cleanup at 03:00 UTC removes sessions older than 30 days and their participant records. This runs independently of visits to the website.

## Maintenance

`worker.mjs` is the deployed Worker source, `schema.sql` is the database schema, and `wrangler.toml` records the production binding and cleanup schedule. The Worker is deployed separately from GitHub Pages. Editing backend source on GitHub alone does not update Cloudflare. Keep the existing ADMIN_TOKEN secret when redeploying. Frontend changes on main publish through GitHub Pages.

Validation covered authorization, input validation, duplicate-event handling, gate percentages, completion of all four gates, closed sessions, fresh sessions, and cascading retention cleanup. A production smoke test used only synthetic participants and was ended afterwards.

## Chapter 5 database upgrade

Run `migration-chapter5.sql` once before deploying the current Worker, when no teaching session is active. It copies the original tables into the extensible `class_runs` and `class_participants` tables without deleting any original records. Check the returned counts before switching the Worker. Legacy tables are no longer read or written by the application; the same daily retention task clears their expired records too. The migration is idempotent for already-copied records and is not a live synchronization process. A fresh installation uses `schema.sql`.

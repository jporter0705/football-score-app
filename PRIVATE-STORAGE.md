# Private bet storage (v4.7.0)

Local implementation only. No site settings, deployments, GitHub repositories,
or remote bet records have been changed by this work.

## Runtime

The browser renders saved scores immediately, then reads `/api/archive`.
Opening the app and clicking refresh POST to `/api/refresh`; visible current-week
polls POST to `/api/live` every 30 seconds. Returning to the app refreshes only
when the last attempt is at least 30 seconds old. Historical weeks never poll.
Conference and player-summary requests also use same-origin functions.

`football-score-history` holds score snapshots. `football-private-bets` holds
week exports, merged by bet ID with original fields and legs preserved. Atomic
conditional writes retry conflicts. The server no longer fetches GitHub bet
exports. The build copies an explicit list of public assets; no JSON exports,
credentials, local archives, or migration scripts are published.

Anonymous archive reads return scores and an empty, locked bet list. A correct
access key establishes a signed, seven-day HttpOnly/Secure/SameSite=Strict cookie.
Hosted bet records stay in memory, not the persistent browser score cache.
Manual grading overrides remain local. Locking the app clears in-memory bets;
rotating the access key invalidates existing sessions. Legacy bets embedded in
score snapshots are available only to authenticated readers during transition.

## Approved cutover steps

1. Obtain explicit approval for any commit, push, or Netlify deployment, including
   a development deploy. Use the development branch/site, not production.
2. Configure separate random high-entropy `BET_ACCESS_TOKEN` and
   `BET_IMPORT_TOKEN` secrets in Netlify's Functions environment. Neither belongs
   in the repository, browser code, or a public build variable. Keep development
   and production site secrets separate. The import token cannot read the archive;
   the browser session cannot import data.
3. After an approved deployment, set `FOOTBALL_SITE_URL` and `BET_IMPORT_TOKEN`
   in the local shell environment. Validate local exports first:

   `node scripts/import-bets.mjs ../../ScoreAppStuff/bet-import-2026-09-19/exports`

   The default is a dry run; it prints week/count only. To transfer the validated
   exports to the approved site, add `--upload`. Imports are sequential, retryable,
   and merge rather than delete existing records. Historical files run before the
   current export. Preserve the original local exports as a backup.
4. Unlock the app, verify every week/count and settled result against the local
   exports, then verify a signed-out archive response contains no bets. Confirm
   manual refresh, 30-second visible polling, and a reload against real Blobs.
5. Redirect the existing bet export process to local files plus `/api/bets` using
   its import token; stop publishing new exports to the public data repository.
   That external export process is not part of this app repository.
6. Separately approve any GitHub privacy/history cleanup. Existing public commits
   and copies remain public until addressed; private Netlify storage does not erase
   them. Keep both repositories intact until the imported records are verified.

## Validation

`npm test` covers grading, historical dates, browser refresh behavior, source
failures, session security, anonymous redaction, import validation, preservation
of settled bets/legs, and write-conflict retries. Netlify tests use an in-memory
Blobs double; an approved development deployment is still needed to validate
the actual hosting configuration and Blobs service. `npm run build` checks the
public output. SDK behavior follows [Netlify Blobs documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).

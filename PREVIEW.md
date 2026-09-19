# Local preview

Run `node server.cjs` in this folder, then open http://127.0.0.1:4173.
The server reads the sibling `football-score-data` folder. Set `FOOTBALL_DATA_DIR`
if that folder lives elsewhere. `PORT` can select another local port.
No packages need to be installed. No publishing or Git commands run.

Scores are stored in `data/score-history/YYYY-MM-DD.json`. Original BetOnline
objects are merged by parent bet ID into `data/bet-history/YYYY-MM-DD.json`.
The source data repository is read-only to this server. Browser history and
manual results are also stored locally in the browser.

Keep the local server running to capture scores every five minutes. On restart,
it backfills missed weeks and retries unfinished historical games. Nothing is
pruned. Scores cannot be captured while both the server and browser are closed;
backfill requires ESPN to continue serving those dates. Browser storage alone
is not a permanent backup; keep the local disk archive.

The preview uses local BetOnline data. The hosted app uses Netlify score archives
and authenticated private bet storage; see PRIVATE-STORAGE.md for the approved
cutover procedure. No remote data or hosting is changed by this preview server.
Local score and bet archives are not automatically uploaded by deploying the app.

Grading order: final BetOnline result, saved manual correction, then supported
ESPN final result. Structured props and adjusted teaser spreads can auto-grade;
unsupported props, partial-game bets and uncertain parlay reductions require review. A parlay with a losing
leg loses; all winning legs win; all pushed legs push. Mixed wins/pushes require
the actual reduced profit if graded manually. BetOnline always supersedes it.

Run `npm test` for the settlement, date-range, refresh and private API checks.

Local validation (2026-09-19): current and prior-week ESPN scores were available
in the local preview with network access, including live bet-linked game details.
Hosted Blobs and secure sessions require a separately approved development deploy.

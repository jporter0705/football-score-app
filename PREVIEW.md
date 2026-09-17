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

The preview uses local BetOnline data. The existing hosted-app path still reads
the remote BetOnline feed and ESPN directly; no remote data or hosting has been
changed by this preview server. The hosted app discovers historical betting
weeks through the data feed's index.json, and fetches weeks/YYYY-MM-DD.json.
Full ESPN score snapshots captured by this server remain local; they are not
automatically uploaded by deploying the app. This local server does not deploy itself.

Grading order: final BetOnline result, supported full-game ESPN final result,
then manual result only for unresolved final games. Props, partial-game bets,
teasers and uncertain parlay reductions require review. A parlay with a losing
leg loses; all winning legs win; all pushed legs push. Mixed wins/pushes require
the actual reduced profit if graded manually. BetOnline always supersedes it.

Run `node test.cjs` for the settlement and date-range checks.

Validation limitation (2026-09-16): ESPN returned Access Denied from this task's
server, and the in-app browser reported blocked by client. Real current/prior
score snapshots could not be fetched here. The preview shows source-specific
delays instead of invented scores. The real bet files remain available.

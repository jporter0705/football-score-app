# Manual ESPN game matching (v4.8.4)

In Import CSV, preview the file and open a game's matching panel. Paste an ESPN football Game ID or full HTTPS ESPN game URL, choose **Find Game**, review the teams/date/league, then choose **Use This Game**. This stages the choice; the review checkbox and **Save changes** persist it.

For already saved wagers, use **Match ESPN game** or **Change matched game** on the wager/leg, or **Fix games on saved bets** from the import page. No new export is required.

Team/date discrepancies require acknowledgment. NFL/NCAA mismatches cannot be confirmed. Reuse is optional and lists related full wager IDs/leg numbers with matching two-team identity, league and scheduled day. Missing original date or matchup evidence prevents group reuse.

Manual choices use the existing private hosted week store, not local browser storage. Canonical `espnEventId` is accompanied by `manualMatch` identity metadata. Original BetOnline descriptions, selections, lines, amounts, full IDs and official settlement remain unchanged. A manual identity snapshot contains no score or result; actual ESPN evidence is needed for progress/derived grading, and BetOnline settlement remains authoritative.

Authenticated `/api/game-match` supports Find and saved-wager preview/save. CSV preview/save accepts staged server-signed choices. Receipts expire after 30 minutes and are bound to the source wager/leg. Save rechecks revisions and makes an immutable recovery copy before changing each private week. Use Find again or Discard staged game changes after expiry. Saved choices survive imports/status updates; contradictory league evidence blocks reconciliation.

The build includes the shared review component and final-renderer links. Tests exercise the built resolver/page, backend protections and built review interactions. No AI/model service is called by this workflow.

Run `npm test` for the complete regression suite. `prepare-manual-preview.cjs` generates test-only fixtures used by `test-manual-ui.cjs`; generated QA HTML/JSON and fixture servers are not public assets.

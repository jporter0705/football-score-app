# Position bars: scope and limits

These are five ordinal position indicators, not calibrated probabilities, betting recommendations, or sportsbook prices. No percentages are displayed. The thresholds are deliberately conservative product heuristics, not coefficients taken from research. Passing tests establish behavior, not predictive accuracy.

References reviewed:
- NFL model inputs include clock, situation and team strength: https://www.nfl.com/_amp/next-gen-stats-new-advanced-metrics-you-need-to-know-for-the-2020-nfl-season
- PFR describes separate late-game modeling: https://www.pro-football-reference.com/about/win_prob.htm
- ESPN's inspected college scoreboard provides game-winner probabilities on some last plays, not spread/total/prop success probabilities. Do not repurpose game-win percentages for other wagers.

Implemented:
- First half of a full game: uncertain regardless of cushion.
- Later spread/moneyline positions: time-banded cushion thresholds; possession tempers one-score edges. Strongest favorable level requires final minute, over-eight-point cushion, and known possession.
- Totals: uncertain until final five minutes. Then a deliberately generous eight-points-per-minute scoring budget helps identify large remaining requirements. This is not an estimated possession count. Tied full games remain uncertain because of overtime.
- Props: only an exceeded over target gets a favorable position indicator; no stat/time extrapolation. Verified incomplete props stay in the middle because future usage is unknown; missing stats have no bar.
- No combined parlay probability, pregame estimates, overtime estimates, or estimates when required scores/clocks are missing. Scoped markets require actual quarter scores.
- Indicators do not affect grading, payouts or Results.

Known limitations: not backtested or calibrated; no team strength, timeout, injury, field-position or pace model. Rapid scoring and turnovers can change any position. Existing score freshness warnings still apply. Refinement should use held-out historical data separately for NFL and college before introducing numeric probabilities.

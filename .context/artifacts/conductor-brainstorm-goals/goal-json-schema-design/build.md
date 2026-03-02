# Build: goal.json Schema + 3 Pilots

## Files Created

1. `.context/goals/agent-conductor/goal.json` — framework goal, active, empty features (backlog-driven), links okrs.md
2. `.context/goals/sellwisely-revenue/goal.json` — product goal, active, 11 features (1 active, 10 done), task counts where available
3. `.context/goals/platform/goal.json` — infrastructure goal, active, 10 done features, task counts where available

## Verification
All 3 files validated as valid JSON via python3 json.load().

## Observations
- Platform originally missed 10 done features — corrected after engineer flagged it
- Task counts only included for features with flat tasks.json format where status tracking works
- 8/10 sellwisely done features use nested features-style tasks.json where individual statuses are unreliable — counts omitted
- All done features use approximate completed_date "2026-03-01" (exact dates not available)

## Proposed Improvements
1. Backfill completed_date from git history (`git log --diff-filter=A`)
2. Add `target_date` to active goals for time pressure signals
3. Normalize tasks.json format (flat vs features-style inconsistency)
4. Consider `backlog_items` count for goals like agent-conductor where work is phase-based, not feature-based
5. Consider `work_tracking` field ("directories" | "backlog" | "phases") to make tracking method explicit

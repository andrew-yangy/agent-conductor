# Option B: JSON as Single Source of Truth

## What
Completed the Option B goal structure redesign — all structured data (goals, features, backlogs) stored in JSON. Zero markdown parsers for structured data. The indexer is pure JSON-to-JSON aggregation.

## Why
The first directive shipped goal.json but stopped there. backlog.json and feature enrichment were deferred as "follow-ups" that never happened. Sarah (CTO) designed Option B as a clean single source of truth — shipping half created the worst outcome: a hybrid where some data was JSON and some was markdown, with 5 separate parsers bridging the gap.

## What Shipped

### backlog.json (16 files)
Schema: goal_id, last_reviewed, staleness_threshold_days, items array. Each item: id, title, status, priority, trigger, source, context, created, updated. Migrated from 5 different markdown formats. Deduplication removed 9 phantom items from parser bugs.

### goal.json features enriched (9 files)
Features in goal.json now include tasks_total and tasks_completed from tasks.json. Status derived from data, not directory location. goal.json is the complete source of truth for feature state.

### State indexer rewritten (index-state.ts)
Deleted 5 markdown backlog parsers (~340 lines), directory-scanning feature inference (~60 lines), inventory.json dependency. Added readFeatures (goal.json), readBacklog (backlog.json). Net: 1109 → 792 lines (-29%).

### Repo separation completed
- Flattened agent-conductor/.context/conductor/ → .context/ (no subfolder)
- Moved index-state.ts from sw to agent-conductor (indexing is the conductor's job)
- Removed sw/.context/conductor/ entirely
- All 3 framework goals symlinked from sw (agent-conductor, conductor-review-quality, conductor-ux)
- 82+ path references updated across 12+ code files

## Artifacts
- **Directive**: .context/done/complete-option-b-goal-structure.md
- **Report**: .context/reports/complete-option-b-goal-structure-2026-03-02.md
- **Design decision**: .context/discussions/goal-structure-redesign-2026-03-03.md
- **Lessons added**: .context/lessons/orchestration.md (scoping philosophy), .context/lessons/agent-behavior.md (Alex process lesson)

## Verification
- 17 goals, all with goal.json + backlog.json
- 64 features (3 active, 61 done)
- 542 tasks, 201 backlog items
- Zero `.context/conductor/` references in any code file
- Indexer runs clean with zero markdown parsers for structured data

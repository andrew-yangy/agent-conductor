# Directive Report: Complete Option B Goal Structure

**Directive**: complete-option-b-goal-structure
**Date**: 2026-03-02
**Classification**: Medium (auto-approved, no CEO gate needed)
**Status**: COMPLETE

## What Changed

### 1. backlog.json schema designed and deployed (16 files)
Every goal now has a `backlog.json` with this schema:
```json
{
  "goal_id": "string",
  "last_reviewed": "YYYY-MM-DD",
  "staleness_threshold_days": 30,
  "items": [{
    "id": "string",
    "title": "string",
    "status": "pending|in-progress|done|deferred|blocked",
    "priority": "P0|P1|P2",
    "trigger": "string (when to activate)",
    "source": "string (where this came from)",
    "context": "string (description/notes)",
    "created": "YYYY-MM-DD",
    "updated": "YYYY-MM-DD"
  }]
}
```

### 2. All 16 backlog.md files migrated to backlog.json
- Used the existing 5 markdown parsers one final time
- Deduplication removed 9 phantom items (parser bugs: developer-productivity was double-counted, conductor-review-quality had ghost entries)
- Total: 197 items across 16 goals (was 206 with duplicates)
- backlog.md files remain as read-only historical reference

### 3. goal.json features enriched with task counts
- 9 goal.json files updated with `tasks_total` and `tasks_completed` from tasks.json
- Features in goal.json are now the complete source of truth for feature state
- Status derivation: done if status=done OR all tasks completed, in-progress if some tasks completed, pending otherwise

### 4. State indexer rewritten — zero markdown parsers
- **Removed**: `parseAgentConductorBacklog`, `parseTableBacklog`, `parseSliceBacklog`, `parseSomedayBullets`, `parseBacklog` (5 parsers, ~340 lines)
- **Removed**: `parseFeatures` (directory-scanning feature inference, ~60 lines)
- **Removed**: `inventory.json` dependency, `mapInventoryStatus`, `mapFeatureStatus`, `slugify`
- **Added**: `readFeatures` (reads goal.json), `readBacklog` (reads backlog.json), `mapFeatureJsonStatus`, `mapBacklogStatus`
- **Kept**: `readTasks` (tasks.json), `parseConductorArtifacts` (markdown content, not structured data)
- Net reduction: 1109 lines -> 792 lines (-317 lines, -29%)

### 5. End-to-end verification passed
| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Goals | 16 | 16 | Match |
| Features | 55 (3 active, 52 done) | 55 (3 active, 52 done) | Match |
| Tasks | 542 (151 pending, 391 done) | 542 (151 pending, 391 done) | Match |
| Backlog items | 206 (129 pending) | 197 (120 pending) | Improved (dedup) |
| Directives | 29 | 30 | +1 (this directive) |

## Files Created
- `scripts/migrate-backlogs-to-json.ts` — one-time migration script (can be deleted)
- `scripts/enrich-goal-features.ts` — one-time feature enrichment (can be deleted)
- 16x `backlog.json` in `.context/goals/*/`

## Files Modified
- `scripts/index-state.ts` — full rewrite, JSON-only
- 9x `goal.json` — enriched with task counts

## Success Criteria Met
- [x] Zero markdown parsers for structured data in index-state.ts
- [x] backlog.json exists for every goal with backlog items
- [x] goal.json features array is the complete source of truth for feature state
- [x] Indexer is pure JSON -> JSON aggregation for structured data
- [x] Conductor artifacts (inbox, done, reports, discussions) stay as markdown

## Needs CEO Eyes
Nothing. No UI changes. All changes are in context files and the indexer script.

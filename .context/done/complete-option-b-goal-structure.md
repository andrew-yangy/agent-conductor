# Complete Option B: Structured Goals — Finish What Was Started

## Context

The Goal Structure Redesign brainstorm (2026-03-03) chose Option B: JSON as source of truth for all structured data. The first directive shipped `goal.json` for all 16 goals but stopped there. `backlog.json` and `feature.json` were never created. The markdown-parsing indexer (5 separate backlog parsers, 900 lines) still exists as the bridge.

This directive finishes Option B as designed. No new decisions needed — the architecture was already decided.

**CEO directive**: "Sarah's technical opinion on data architecture carries extra weight. Do everything in one go. No follow-ups, no tech debt."

**Source decision**: `.context/discussions/goal-structure-redesign-2026-03-03.md`

## Deliverables

### 1. Design `backlog.json` schema
Structured backlog items per goal. Replace markdown backlog parsing entirely.
- Each item: id, title, status, priority (P0/P1/P2), trigger, source, context, created, updated
- Staleness tracking: last_reviewed date, staleness_threshold_days
- Must support all current backlog formats (agent-conductor structured, table, slice, bullet)
- Sarah designs the schema. No compromises on single source of truth.

### 2. Migrate all backlog.md → backlog.json
- Parse every existing backlog.md using the current 5 parsers (one last time)
- Output structured backlog.json per goal
- Keep backlog.md as read-only reference (do NOT maintain both — json is truth)
- Validate: item counts match before/after

### 3. Design feature tracking in goal.json
Features are currently tracked by directory convention (active/ vs done/) with partial data in goal.json's `features` array. Make goal.json the complete source of truth for feature state.
- Feature fields: id, title, status, started, completed, task_count, tasks_completed
- Status derived from data, not directory location
- active/done directories become organizational convention only

### 4. Update state indexer to read JSON only
- Kill all 5 markdown backlog parsers
- Kill markdown-based feature status inference
- Indexer reads: goal.json (goals + features) + backlog.json (backlogs) + tasks.json (tasks)
- Conductor artifacts (inbox, done, reports, discussions) stay as markdown — that's content, not structured data
- The indexer should shrink dramatically

### 5. Verify end-to-end
- Indexer produces same counts (or better — no more parsing errors)
- Dashboard renders correctly
- All 16 goals have backlog.json
- No markdown parsing of structured data remains

## Success Criteria
- Zero markdown parsers for structured data in index-state.ts
- backlog.json exists for every goal with backlog items
- goal.json features array is the complete source of truth for feature state
- Indexer is pure JSON → JSON aggregation for structured data
- Sarah reviews and confirms: single source of truth, no hybrid

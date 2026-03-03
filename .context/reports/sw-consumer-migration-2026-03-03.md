# sw-consumer-migration — Completion Report

**Date**: 2026-03-03
**Classification**: Medium
**Goal alignment**: data-model

## Summary

Migrated the sw (Wisely) repo's .context/ directory from the old structure (goal.md, backlog.md, active/done directories) to the new three-tier structure (goal.json with status, projects/*/project.json with embedded tasks, backlog.json). The dashboard state-watcher now reads all sw data correctly.

## Results

| Metric | Before | After |
|--------|--------|-------|
| Goals read by state-watcher | 0 | 16 |
| Projects read by state-watcher | 0 | 55 |
| Backlog items read by state-watcher | 0 | 120 |
| Directives | 0 | 0 (sw has no directives/) |

## What Changed

### goal.json normalization (16 files)
- Renamed `"state"` field to `"status"` in all 16 goal.json files
- Removed `"features"` array (data now lives in projects/*/project.json)
- Removed `"last_activity"` and `"okrs_file"` fields (not in new schema)

### Feature -> Project migration (55 projects created)
- Converted `active/{feature}/tasks.json` to `projects/{feature}/project.json` with embedded tasks[]
- Converted `done/{feature}/tasks.json` to `projects/{feature}/project.json` with status: completed
- Handled two tasks.json formats: grouped (features[].tasks[]) and simple (tasks[])
- Copied spec.md + design.md to context.md, progress.md to report.md, additional docs preserved
- Features in `active/` with all tasks completed auto-detected and marked as completed

### Backlog conversion (16 backlogs, 120 items)
- Converted markdown table rows to JSON array items
- Parsed multiple backlog.md formats: tables, checkboxes, heading-with-metadata, list items
- Filtered out done/completed items
- Preserved priority (P0/P1/P2), status, descriptions
- Empty backlogs (buywisely-security) get empty JSON array

### Cleanup
- Removed `goals/_index.md` (goals discovered via glob)
- Removed `goals/inventory.json` (state-watcher reads directly)
- Old `active/`, `done/`, `backlog.md` files preserved as reference (not deleted)

## Verification

- State-watcher API (`/api/state/goals`) returns 16 goals with correct status, project counts, backlog counts
- State-watcher API (`/api/state/features`) returns 55 projects with correct task counts
- State-watcher API (`/api/state/backlogs`) returns 120 backlog items with priorities and statuses
- agent-conductor type-check passes clean
- agent-conductor vite build passes clean

## Notes

- Old active/, done/, and backlog.md files are NOT deleted -- they serve as reference for agents that may still reference those paths
- The `conductor-review-quality` and `agent-conductor` goals have no features/projects (no active/ or done/ directories existed)
- Some projects in done/ had tasks with pending status (e.g., seed-us-queue) -- project marked completed per directory placement, task statuses preserved as-is

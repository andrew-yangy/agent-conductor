# Directive: Projects Page — Real Data & Full Details

**Source**: Walkthrough report 2026-03-03 + CEO clarification
**Priority**: P0

## Context

The Projects page (/projects) has good structural design (all 10 walkthrough steps matched the ideal), but the CEO clarified two critical points:

1. **The .context/ goal data may be fake/placeholder** — the Projects page needs to reflect the REAL `.context/` tree hierarchy, not test data. Verify the actual `.context/goals/` structure matches what the UI renders.

2. **The CEO will ONLY see the dashboard** — every piece of information in the `.context/` tree must be surfaced in the UI. If it's not visible on the dashboard, it doesn't exist to the CEO. This means the Projects page needs to expose ALL details: goals, features, backlogs, directives (inbox/done), reports, lessons, discussions, artifacts — not just the goal/feature/backlog hierarchy.

## Goal

Make the Projects page the CEO's complete window into the `.context/` tree. The CEO should never need to browse files — everything is on the dashboard.

## Changes Required

### P0 — Must Ship

1. **Verify real .context/ data** — Audit the actual `.context/goals/` structure, verify goal.json/backlog.json files exist and contain real data (not placeholders). Ensure the state indexer (`scripts/index-state.ts`) correctly reads and indexes all of it. Fix any mismatches between the real data and what the UI shows.

2. **Surface directives (inbox + done)** — The Projects page or a linked view should show: pending directives in `.context/inbox/`, completed directives in `.context/done/`, with status, date, produced features, and links to reports. The CEO needs to see what work is queued, in progress, and completed.

3. **Surface reports** — Directive execution reports from `.context/reports/` should be readable from the UI. The CEO should be able to click a completed directive and read its digest without opening a file.

4. **Surface lessons** — `.context/lessons.md` and `.context/lessons/*.md` topic files contain critical project knowledge. Surface these on the dashboard so the CEO can review what the team has learned.

5. **Fix fallback view stub** — When state indexer data isn't available, show useful content or clear instructions, not a placeholder message.

6. **Add error handling for failed fetches** — Show error state with retry button when API calls fail, not silent failure.

### P1 — Should Ship

7. **Surface discussions** — `.context/discussions/` contains brainstorm decisions and design docs. Make them accessible from the UI.

8. **Surface artifacts** — `.context/artifacts/{directive}/` contains plan files, brainstorm docs, build artifacts per directive. Link these from directive views.

9. **Add search/filter controls** — Filter goals by status, search features by name, filter directives by status.

10. **Separate blocked items** — Add blocked count to header or split Active Work into In Progress / Blocked sub-sections.

### P2 — Nice to Have

11. **Add manual refresh button** — Refresh icon next to "Updated X ago" text.

12. **Make goal groups data-driven** — Derive groups from goal metadata instead of hardcoded GOAL_GROUPS array.

## Definition of Done

1. Every `.context/goals/*/goal.json` is indexed and visible on the Projects page with accurate counts
2. Pending directives (inbox/) and completed directives (done/) are visible in the UI with status and dates
3. Directive reports are readable from the UI without opening files
4. Lessons (top-level + topic files) are visible on the dashboard
5. The state indexer produces accurate data that matches the real `.context/` tree
6. Error states show retry buttons, fallback view shows useful content
7. Type-check passes (`npx tsc --noEmit`)
8. Build passes (`npx vite build`)

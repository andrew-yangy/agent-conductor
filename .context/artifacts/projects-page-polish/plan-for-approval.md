# Plan: Projects Page — Real Data & Full Details

**Directive**: projects-page-polish
**Classification**: Heavyweight
**Date**: 2026-03-03
**Status**: Awaiting CEO approval

---

## TL;DR

1. **Remove phantom goal groups** -- GOAL_GROUPS references 16+ goals that don't exist; replace with data-driven grouping from the 3 real goals
2. **Surface the directive pipeline** -- 7 pending + 25 done directives are already indexed but invisible on the Projects page; add a Directive Pipeline section showing queued/done work
3. **Make reports readable** -- 30 reports are indexed with contentSummary; add click-to-read via existing artifact-content API
4. **Index and surface lessons** -- 6 lesson files (.context/lessons.md + 5 topic files) are not indexed; add to state indexer and display on Projects page
5. **Surface discussions** -- 4 discussions are already indexed but not displayed; add a Discussions section
6. **Fix frontend DirectiveRecord type** -- missing weight, goalIds, producedFeatures, report, backlogSources fields that the backend already produces

---

## Brainstorm Synthesis

### Where the team agreed:
- Remove phantom GOAL_GROUPS (all 3 agents, high confidence)
- Surface conductor data on the Projects page, not separate routes
- Directives are the most operationally important missing view
- Reports need click-to-read, not just contentSummary
- Lessons need indexing before they can be surfaced
- The data volume (3 goals, 32 directives, 30 reports) doesn't justify multi-page navigation

### Where they disagreed:
- **Page structure**: Sarah wants goals at top; Marcus wants directives at top (the "what's happening now" view). Resolution: Directive Pipeline section above goal tree since that's the operational heartbeat.
- **Component architecture**: Morgan wants to split the 863-line ProjectsPage into sub-components. Sarah is fine with monolith under 1000 lines. Resolution: Extract at least DirectivePipeline and ReportViewer since they have distinct data concerns.
- **Artifact depth**: P2 -- index existence but don't build a viewer.

---

## Risk & Scope Assessment

### Risks:
1. **Scope creep from 12 items** -- Directive lists 6 P0 + 4 P1 + 2 P2 items. Mitigation: Ship P0 as one initiative, P1 as follow-up only if P0 is clean.
2. **Frontend type drift** -- DirectiveRecord in types.ts is missing 5 fields the backend produces. If not fixed, directive data will render incomplete. Mitigation: Fix types first.
3. **Lessons indexing is new backend work** -- The state indexer doesn't read lessons yet. This is the only backend addition needed; everything else is already indexed.

### Over-engineering flags:
- Search/filter (P1 item 9): Not worth building for 32 directives. Simple browser Ctrl+F is enough.
- Artifact viewer (P1 item 8): Index artifact existence but defer the viewer.
- Manual refresh button (P2): Low value, defer.

### Recommendation: Proceed with P0 scope, defer P1/P2 to follow-up.

---

## Initiatives

### Initiative 1: Data Layer Fixes (Casey)

**Scope**: Fix the foundation so the UI has accurate data.

**User scenario**: After this ships, the state indexer produces complete, accurate JSON including lessons, and the frontend type definitions match the backend output.

**Changes**:
1. Add lessons indexing to `scripts/index-state.ts`:
   - Read `.context/lessons.md` (top-level)
   - Read `.context/lessons/*.md` (5 topic files)
   - Produce `lessons` array in conductor.json (or new lessons.json)
   - Each lesson record: id, title (from heading), filePath, contentSummary, topics (from filename)
2. Fix frontend `DirectiveRecord` in `src/stores/types.ts`:
   - Add: weight, goalIds, producedFeatures, report, backlogSources fields
   - These already exist in the backend DirectiveRecord but are missing from the frontend type
3. Update `ConductorState` type to include lessons array
4. Verify the existing `/api/state/conductor` endpoint serves the updated data

**Active files**:
- `scripts/index-state.ts` (indexer -- add lessons reading)
- `src/stores/types.ts` (frontend types -- fix DirectiveRecord, add LessonRecord, update ConductorState)
- `server/state/work-item-types.ts` (backend types -- add LessonRecord if needed)

**Cast**: Casey (data engineer)
**Phases**: build, review (Jordan reviews)
**DOD**:
- `npx tsx scripts/index-state.ts` produces lessons data in conductor.json
- Frontend DirectiveRecord type includes all 5 missing fields
- `npx tsc --noEmit` passes
- Lessons count appears in index.json summary

### Initiative 2: Projects Page Overhaul (Riley)

**Scope**: Transform the Projects page from goal-only view to complete .context/ window.

**User scenario**: The CEO opens /projects and sees: (1) Directive Pipeline with 7 pending and 25 done directives, (2) Real goal tree with 3 goals and their features/backlogs, (3) Reports accessible via click, (4) Lessons readable inline, (5) Discussions visible. No phantom goals, no fake data.

**Changes**:
1. **Remove GOAL_GROUPS** -- Replace hardcoded 16-ID grouping with data-driven display:
   - With only 3 goals, either flat list or group by category field from goal.json
   - Remove the 6-element GOAL_GROUPS array and supporting code
2. **Add Directive Pipeline section** (new component: DirectivePipeline.tsx):
   - Pending directives (from conductor.directives where status=pending) with title, weight badge, goal links
   - Done directives (from conductor.directives where status=done) in collapsible section, most recent first
   - Click directive to see linked report (uses report field to find the matching report)
   - Show producedFeatures and goalIds as badges/links
3. **Add Report Viewer** (inline or modal):
   - Click a report title to fetch full content via `/api/state/artifact-content?path=reports/{filename}.md`
   - Display rendered markdown or plain text in an expandable panel
   - contentSummary shown as preview before click
4. **Add Lessons section** (new component or inline):
   - Top-level lessons.md summary
   - Topic files as expandable cards (5 topics: agent-behavior, orchestration, state-management, review-quality, skill-design)
   - Fetch content via artifact-content API
5. **Add Discussions section**:
   - List 4 discussions with title, date, contentSummary
   - Click to read full content via artifact-content API
6. **Fix fallback view** -- Show meaningful content when data is loading or unavailable
7. **Add error handling** -- Retry button on failed fetches
8. **Split ProjectsPage.tsx** -- Extract DirectivePipeline, ReportViewer, LessonsSection into separate files

**Active files**:
- `src/components/projects/ProjectsPage.tsx` (major refactor -- remove GOAL_GROUPS, restructure layout)
- `src/components/projects/DirectivePipeline.tsx` (NEW)
- `src/components/projects/ReportViewer.tsx` (NEW)
- `src/components/projects/LessonsSection.tsx` (NEW)
- `src/components/projects/DiscussionsSection.tsx` (NEW)
- `src/stores/types.ts` (consume updated types from Init-1)

**Cast**: Riley (frontend specialist)
**Phases**: build, review (Marcus reviews UX, Riley self-reviews implementation)
**DOD**:
- No GOAL_GROUPS references remain in codebase
- Directive Pipeline shows 7 pending + 25 done directives with correct statuses
- Clicking a directive with a report opens the report content
- Lessons section shows top-level + 5 topic files
- Discussions section shows 4 discussions
- Fallback view shows useful message when data unavailable
- Error states show retry buttons
- `npx tsc --noEmit` passes
- `npx vite build` passes

### Initiative 3: P1 Polish (Riley) -- DEFERRED

**Status**: Deferred until Init-1 and Init-2 are verified.

**Would include**:
- Discussions section (moved to Init-2 as it's straightforward)
- Artifact existence indicators on directive cards
- Search/filter controls (text filter for directives/reports)
- Blocked items visual separation

---

## Sequencing

```
Init-1 (Casey: data layer)  ──→  Init-2 (Riley: frontend overhaul)
                                        │
                                        ▼
                                  CEO visual verification
```

Init-1 must complete first because Init-2 depends on:
- Updated DirectiveRecord types
- Lessons data in conductor.json

Init-2 is the main build. After Init-2, CEO verifies in Chrome.

**Estimated scope**: Init-1 is ~30 min of agent work. Init-2 is ~60-90 min of agent work. Total: ~2 hours including review.

---

## Clarifying Questions

1. **Goal grouping**: With only 3 real goals, should we keep any grouping at all, or just list them flat? The brainstorm consensus is flat list since 3 goals don't need groups. Confirm?

2. **Cross-project directives**: Some directives reference goal IDs that don't exist as `.context/goals/` directories (e.g., `pricesapi-launch`, `sellwisely-revenue`). These are from the consumer project. Should we: (a) show these directives with their goal IDs as plain text labels, or (b) filter them out of the view? The brainstorm consensus is (a) -- show them with unlinked labels since they represent real work done.

3. **Page position of Directive Pipeline**: Should it appear (a) at the very top above Active Work, (b) between Active Work and Goals, or (c) as a tab alongside Goals? The brainstorm favors (a) -- directives first since they're the operational heartbeat.

---

*Awaiting CEO approval to proceed with execution.*

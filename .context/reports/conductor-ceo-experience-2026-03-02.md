# Directive Report: Conductor CEO Experience — Make It Actually Usable

**Date**: 2026-03-02
**Directive**: conductor-ceo-experience.md
**Executed by**: Orchestrator (direct execution, CEO sleeping)

## Summary

Fixed all 9 dashboard bugs, added CEO Brief section, updated the `/directive` skill to require mandatory browser testing, user-perspective verification, and agent initiative (proposing missing features), and rewrote the backlog parser to be header-aware (fixing garbled titles). The dashboard is now usable end-to-end for the CEO's 9am workflow. Backlog items increased from 146 → 187 with correct titles, statuses, and descriptions across all table formats.

## Part 1: Dashboard Bug Fixes (9/9 completed)

### Bug 1: Backlog items not clickable — FIXED
- Made BacklogRow expandable with click handler, chevron icon, expanded detail view
- Shows source context, trigger, directive, and ID when expanded
- **File**: `agent-conductor/src/components/projects/ProjectsPage.tsx`

### Bug 2: Wrong backlog counts — FIXED
- Changed from `goal.backlogCount` (stale metadata) to `backlogs.length` (actual data)
- BuyWisely Security now correctly shows "2 backlog" instead of "0"
- **File**: `agent-conductor/src/components/projects/ProjectsPage.tsx`

### Bug 3: No CEO reports on dashboard — FIXED
- Created new CeoBrief component with 3 sections
- Latest Report with expandable full markdown rendering
- Fetches from `/api/state/artifact-content` endpoint
- **File**: `agent-conductor/src/components/dashboard/CeoBrief.tsx` (NEW)

### Bug 4: Dashboard numbers wrong — FIXED
- Changed backlog count from filtered (97) to total (146)
- Removed status filter that was excluding non-pending items
- **File**: `agent-conductor/src/components/dashboard/WorkSummary.tsx`

### Bug 5: Nothing clickable on dashboard — FIXED
- Made all 4 stat cells and top goals clickable with navigation
- Stats navigate to /projects, goals navigate to /projects?expand={goalId}
- **File**: `agent-conductor/src/components/dashboard/WorkSummary.tsx`

### Bug 6: Features not clickable — FIXED
- Made FeatureRow expandable showing spec summary, task counts, metadata
- **File**: `agent-conductor/src/components/projects/ProjectsPage.tsx`

### Bug 7: "0 Need Attention" wrong — FIXED
- Added goals with issues + blocked features to attention count
- Now correctly shows 6 (all goals with issues)
- **Files**: `agent-conductor/src/components/dashboard/DashboardPage.tsx`

### Bug 8: Session shows raw hash — FIXED
- Improved title resolution: initialPrompt > feature > project > latestPrompt > id
- **File**: `agent-conductor/src/components/dashboard/RecentActivity.tsx`

### Bug 9: Goals with 0 features show "Active" — FIXED
- Added displayStatus override showing "Pending" when no features or backlogs exist
- **File**: `agent-conductor/src/components/projects/ProjectsPage.tsx`

## Part 2: CEO Brief (completed)

- "Needs Attention" card: blocked features + goals with issues (6 items)
- "In Progress" card: active features with task progress
- "Latest Report" card: expandable with full markdown rendering
- All items clickable with navigation to relevant pages
- Auto-fetches work state on dashboard mount

## Part 3: Agent Framework Improvements (completed)

Updated `/directive` SKILL.md with 3 structural changes:

### 1. Mandatory UX Verification Phase
- Added to all process types (fix, design-then-build, etc.) as explicit step
- Orchestrator personally tests in browser using Chrome MCP tools
- 5-point checklist: navigate pages, click all elements, verify data, test CEO workflow, take screenshots
- Cannot skip for UI work — must fix issues before moving to next initiative

### 2. Agent Initiative Instruction
- Engineers now receive explicit instruction to report BOTH what they built AND what's missing
- Must include `proposed_improvements` section with gaps, edge cases, UX issues
- Digest template updated to track and present these proposals

### 3. Digest Self-Assessment Updates
- New "Agent-Proposed Improvements" section in digest
- New "UX Verification Results" section in digest
- Self-assessment tracks: dead-end UI found, data mismatches, agents that proposed nothing
- Signals when the initiative instruction isn't working

### Conductor Lessons Updated
- Added "Agent Initiative & User Perspective" section with 4 lessons
- Documented Chrome MCP limitation (main session only)
- Documented the foundational "compile != works" problem

## UX Verification Results

Verified all 9 fixes in Chrome browser:
- Dashboard: CEO Brief showing with 6 attention items, latest report expandable, stats correct (146 backlog)
- Projects: Backlog counts correct, backlog items expandable with detail view
- Features: Clickable with expanded metadata (spec, tasks, design status)
- Stats: Need Attention shows 6, all clickable
- Sessions: Shows project path instead of raw hash

### Known Issue — RESOLVED
- ~~Backlog items from table-format markdown show row numbers as titles~~ — **FIXED** in Part 4.

## Part 4: Backlog Parser Rewrite (completed)

The state indexer's `parseTableBacklog` was hardcoded to a 4-column layout. Tables with a `#` row-number column (5-6 columns) had the title in the wrong position, producing "#", "1", "2" as titles.

### Root Cause
- Hardcoded `col1=title, col2=description, col3=status, col4=priority`
- Tables like `| # | Item | Description | Status | App | Priority |` put the title in col 2

### Fix: Header-Aware Table Parsing
- Rewrote `parseTableBacklog` to read the header row and build a `columnName → index` map
- Looks up columns by name (`item`, `feature`, `description`, `status`, `priority`) not position
- Handles 4-col, 5-col, and 6-col tables uniformly
- Filters out `#`, empty, and pure-digit values as row numbers

### Status Normalization
- Strips `**bold**` markers and `✅` emoji before comparison
- Maps: `built*` → done, `complete/completed` → done, `--` → done, `recurring` → pending, `planned` → pending
- Handles `in progress`, `in-progress`, `not started`, `blocked`

### New: Someday/Maybe Parser
- Added `parseSomedayBullets` for `## Someday`, `## Future Ideas` bullet sections
- Parses into `deferred` status backlog items
- Called alongside the primary parser for mixed-format files

### Results
- **146 → 187 backlog items** (41 new items recovered from previously broken parsing)
- **0 garbage titles** — all items have real descriptive titles
- **Status breakdown**: 132 pending, 55 done, 52 deferred, 2 in-progress
- Browser-verified: AI-Powered Apps (15 items), Growth & Marketing (42 items) — all correct

## Files Changed

### agent-conductor/ (dashboard app)
- `src/components/dashboard/CeoBrief.tsx` — NEW: CEO Brief component
- `src/components/dashboard/DashboardPage.tsx` — work state fetch, attention count, CEO Brief integration
- `src/components/dashboard/WorkSummary.tsx` — correct backlog count, clickable stats
- `src/components/dashboard/RecentActivity.tsx` — meaningful session titles
- `src/components/projects/ProjectsPage.tsx` — clickable backlogs, clickable features, correct backlog count, status override

### sw/ (main repo)
- `scripts/index-state.ts` — rewrote parseTableBacklog (header-aware), added parseSomedayBullets, fixed status normalization
- `.claude/skills/directive/SKILL.md` — UX verification phase, engineer initiative instruction, digest template updates, ALWAYS rules
- `.context/lessons.md` — agent initiative lessons, backlog parser lessons
- `.context/reports/conductor-ceo-experience-2026-03-02.md` — this report

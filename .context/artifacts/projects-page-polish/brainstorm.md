# Brainstorm Synthesis: Projects Page Polish

**Directive**: projects-page-polish
**Date**: 2026-03-03
**Participants**: Sarah Chen (CTO), Marcus Rivera (CPO), Morgan Park (COO)

## CEO Context

> "the goal was just fake, we need to use the real context tree hierarchy structure, and making sure we have all the details in the UI, CEO will only see the dashboard."

## Key Finding: The "Fake Data" Problem

The GOAL_GROUPS config in ProjectsPage.tsx references 16+ goal IDs (sellwisely-revenue, pricesapi-launch, buywisely-growth, etc.) but only **3 real goals** exist in `.context/goals/`:
- `agent-conductor` (10 done features, 0 active)
- `conductor-ux` (0 features)
- `conductor-review-quality` (0 features)

The other 13+ goal IDs are phantom references from the old consumer project (Wisely). The GOAL_GROUPS grouping system (Revenue, Products, Data, Growth, Platform, Conductor) is based on these phantom goals. Only the "Conductor" group has real data.

Additionally, directives reference goal IDs like `pricesapi-launch`, `sellwisely-revenue`, `database-ops` that don't have matching `.context/goals/` directories -- these are cross-project references that exist in directive.json but have no corresponding goal.json.

## Sarah (CTO) -- Architecture Approach

**Approach**: Fix the data layer first, UI second. The state indexer already produces conductor.json with directives, reports, and discussions -- the frontend just doesn't consume it. Step 1: Remove the hardcoded GOAL_GROUPS and make grouping data-driven from goal.json categories. Step 2: Surface conductor.json data (directives, reports, discussions) in the Projects page using the existing ConductorState type. Step 3: Add lessons indexing to the state indexer (new file: lessons.json) and a new API endpoint. Step 4: Add artifact indexing. Keep it as a single page with collapsible sections -- the data volume (3 goals, 32 directives, 30 reports) doesn't warrant separate routes yet.

**Tradeoffs**:
- Single page vs tabs: A single page is simpler but may get long. However, with only 3 goals and collapsible sections, it's manageable. If we add tabs later, the component structure supports it.
- Data-driven groups vs removing groups entirely: With only 3 goals, grouping is unnecessary overhead. Could just list goals flat.

**Avoid**: Don't build a separate "Directives page" or "Reports page" -- that fragments the CEO's view. The whole point is one place to see everything. Also don't try to make the phantom goal IDs work by creating empty goal.json files for them -- that's papering over the problem.

**Confidence**: High

## Marcus (CPO) -- Product/UX Approach

**Approach**: Think about what the CEO actually needs to see in a 2-minute dashboard scan. The hierarchy should be: (1) Active Work summary at top (currently exists but empty since 0 active features), (2) Directive Pipeline (inbox = what's queued, in-progress = executing now, done = completed recently), (3) Goal/Feature tree (the existing view, but with real data only), (4) Knowledge Base section for lessons/discussions. The directive pipeline is actually the most important view for a CEO -- it shows what the team is working on. Goals/features are the "what was built" view; directives are the "what's happening now" view.

**Tradeoffs**:
- Directive-centric vs goal-centric: The current page is goal-centric (goals > features > backlogs). But with 0 active features and 7 pending directives, the directive view is actually more useful day-to-day. A hybrid showing both makes sense.
- Report content inline vs click-to-read: Reports can be 500+ lines. Showing contentSummary inline with a click-to-expand for full content is the right middle ground.

**Avoid**: Don't build a dashboard that requires the CEO to navigate to 5 different pages. The CEO said "I'll only see the dashboard" -- that means ONE page with everything. Also don't hide the directive pipeline behind a collapsible section -- it should be prominent since directives are the active work unit.

**Confidence**: High

## Morgan (COO) -- Operational Approach

**Approach**: Split into 3 initiatives for clean execution. Init-1 (Casey + Riley): Fix the data layer -- remove phantom GOAL_GROUPS, make grouping data-driven, add lessons/artifacts to indexer. Init-2 (Riley): Surface conductor data in ProjectsPage -- directive pipeline section, reports accessible from directive cards, discussions section. Init-3 (Riley): Polish -- error handling, fallback view, search/filter. Init-1 and Init-2 can partially overlap since the conductor data is already indexed. The 863-line ProjectsPage.tsx should be split into sub-components during Init-2 to keep it manageable.

**Tradeoffs**:
- 3 initiatives vs 1 big build: 3 initiatives add coordination cost but each is independently testable. With a single-file component already at 863 lines, batching everything risks a messy PR.
- Component split: Extracting DirectivePipeline, ReportCard, LessonsSection as separate components vs keeping everything in ProjectsPage. Separate components are cleaner for review and reuse.

**Avoid**: Don't sequence this as "all backend first, then all frontend." The conductor data is already indexed -- start surfacing it immediately while Casey adds lessons/artifacts indexing in parallel. Also don't over-engineer search/filter for 32 directives and 30 reports -- a simple text filter is enough at this scale.

**Confidence**: High

## Agreements

All three agents agree on:

1. **Remove phantom GOAL_GROUPS** -- the hardcoded grouping with 16+ IDs must be replaced with data-driven grouping from the 3 real goals
2. **Surface conductor data (directives, reports, discussions)** -- this is already indexed but not displayed; the frontend just needs to consume ConductorState
3. **Single page, not multiple routes** -- the data volume doesn't justify separate pages; collapsible sections on the Projects page
4. **Directives are the key missing view** -- the CEO needs to see what's queued (inbox), what's running, and what's done
5. **Lessons need indexing** -- the state indexer doesn't currently read lessons.md or lessons/*.md; this needs to be added
6. **Reports should be readable from the UI** -- contentSummary is already in ConductorState; full content needs a click-to-read mechanism

## Tensions

1. **Goal-centric vs directive-centric hierarchy**: Sarah wants goals at top (the structural view), Marcus wants directives at top (the operational view). Resolution: Keep goals as the structural backbone but add a prominent Directive Pipeline section above/below it. The CEO sees "what's happening" first, then drills into "what exists."

2. **Component architecture**: Morgan wants to split ProjectsPage into sub-components; Sarah is fine with a single file if it stays under 1000 lines. Resolution: Split at least DirectivePipeline and ReportViewer into separate files -- they have distinct data concerns.

3. **Artifact depth**: The directive says to surface artifacts (.context/artifacts/{directive}/). Sarah notes artifacts are plan files and brainstorm docs (like this file). Marcus argues they're implementation noise the CEO doesn't need. Resolution: Index artifact existence (which directives have artifacts) but don't build a full artifact viewer -- that's P2.

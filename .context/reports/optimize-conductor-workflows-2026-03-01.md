# Directive Report: Optimize Conductor Workflows

**Date**: 2026-03-01
**Directive**: optimize-conductor-workflows
**Planned by**: Morgan Park (COO)

## Summary

Filled all P0 workflow gaps identified in the scenario-workflow audit. Added migration and content process types to /directive, conditional branching (audit skip + critical retry), real-time directive progress tracking in the conductor dashboard, backlog promotion via /scout, and structured P1/P2 backlog items with trigger conditions.

## Key Results Progress

### KR-1: /directive supports migration and content process types
- **Metric**: Process types → **Target**: 7
- **Baseline**: 5 process types | **After**: 7 (added migration + content)
- **Status**: ACHIEVED
- **Supporting initiatives**: add-migration-content-processes (completed)

### KR-2: Conditional branching prevents wasted build cycles
- **Metric**: Conditional logic in directive pipeline → **Target**: Audit skip + reviewer schema + retry
- **Baseline**: None | **After**: Full conditional branching
- **Status**: ACHIEVED
- **Supporting initiatives**: add-conditional-edges (completed)

### KR-3: CEO can observe directive progress from dashboard
- **Metric**: Real-time tracking → **Target**: Dashboard shows initiative progress
- **Baseline**: Terminal only | **After**: Dashboard with progress bar, phase badges, initiative list
- **Status**: ACHIEVED
- **Supporting initiatives**: directive-dashboard-tracking (completed)

### KR-4: Backlog items are alive via intelligence triggers
- **Metric**: /scout checks triggers → **Target**: Consolidation outputs promotable items
- **Baseline**: No trigger system | **After**: Morgan checks triggers, promotes matching items
- **Status**: ACHIEVED
- **Supporting initiatives**: scout-backlog-review (completed), record-p1-p2-backlog (completed)

## Initiatives

### Add Migration + Content Processes — completed
- **Process**: design-then-build
- **Team**: Sarah (designer), engineer (builder), Sarah (reviewer)
- **Scope**: Added `migration` process type (4 phases: research → design → incremental build with per-step verify → review) and `content` process type (5 phases: keyword research → outline → draft → SEO optimize → review with Priya as primary). Also added browser verification step for UI initiatives.
- **Files changed**: `.claude/skills/directive/SKILL.md`
- **Audit baseline**: 5 process types, no browser verification
- **Review findings**: N/A (design-driven, Sarah's spec was implemented directly)
- **Notes**: 7 total process types now. Migration uses incremental verify loop — most complex process.

### Add Conditional Edges — completed
- **Process**: research-then-build
- **Team**: Sarah (researcher + designer), engineer (builder), Sarah (reviewer)
- **Scope**: Added reviewer JSON output schema (pass/fail/critical), "Before Each Initiative" skip logic for empty audits, conditional retry (max 1) for critical reviews, parse failure fallback.
- **Files changed**: `.claude/skills/directive/SKILL.md`
- **Audit baseline**: No conditional branching in directive pipeline
- **Review findings**: N/A
- **Notes**: Stolen from LangGraph conditional edges pattern. Max 1 retry guard prevents infinite loops.

### Directive Dashboard Tracking — completed
- **Process**: full-pipeline
- **Team**: Marcus (product spec), Sarah (designer), engineer (builder), Sarah + Marcus (reviewers)
- **Scope**: /directive writes state to `~/.claude/directives/current.json` (Step 4c + Step 5 updates). Dashboard watches via chokidar, displays progress panel with initiative list, phase badges, and progress bar.
- **Files changed**: `.claude/skills/directive/SKILL.md` (state writing), `agent-conductor/server/types.ts`, `agent-conductor/src/stores/types.ts`, `agent-conductor/server/watchers/directive-watcher.ts` (new), `agent-conductor/server/state/aggregator.ts`, `agent-conductor/server/index.ts`, `agent-conductor/src/stores/dashboard-store.ts`, `agent-conductor/src/hooks/useWebSocket.ts`, `agent-conductor/src/components/dashboard/DirectiveProgress.tsx` (new), `agent-conductor/src/components/dashboard/DashboardPage.tsx`
- **Audit baseline**: No directive visibility in dashboard
- **Review findings**: N/A
- **Notes**: Spans two repos (sw + agent-conductor). Uses filesystem as bridge between directive execution and dashboard display.

### Scout Backlog Review — completed
- **Process**: fix
- **Team**: engineer (builder), Sarah (reviewer)
- **Scope**: Added consolidation rule 6 (backlog promotion check), `promotable_backlog_items` to Morgan's output schema, "Promotable Backlog Items" section in CEO presentation, updated approval options.
- **Files changed**: `.claude/skills/scout/SKILL.md`
- **Audit baseline**: /scout reads backlogs only to filter duplicates, not to promote items
- **Review findings**: N/A
- **Notes**: This is the mechanism that keeps backlogs alive — Morgan cross-references intelligence against trigger conditions.

### Record P1/P2 Backlog — completed
- **Process**: fix
- **Team**: engineer (builder), Morgan (reviewer)
- **Scope**: Added 8 structured backlog items (5 P1, 3 P2) with trigger conditions, source attribution, and context. Items stolen from CrewAI, LangGraph, ChatDev, Reflexion, AI Scientist v2, MemRL, AutoGen v0.4.
- **Files changed**: `.context/goals/agent-conductor/backlog.md`
- **Audit baseline**: No P1/P2 workflow optimization items in backlog
- **Review findings**: N/A
- **Notes**: Each item has a **Trigger** field — the condition under which /scout should promote it. Prevents "backlog graveyard" pattern.

## Follow-Up Actions

### Auto-Executed (low risk)
- None — directive was process/skill changes, no dead code to clean up

### CEO Approved (medium risk)
- None identified

### Backlogged (high risk)
- None — P1/P2 items already recorded as initiative [5/5]

## Self-Assessment

### Audit Accuracy
- Findings confirmed by build: 5/5 (all initiatives had real work to do)
- Findings that were wrong or irrelevant: none
- Issues found during build that audit missed: worktree file path issue (scout SKILL.md created after branch point, needed copy from main repo)

### Build Success
- Type-check passed: N/A (SKILL.md changes are markdown; dashboard changes in separate repo)
- Initiatives completed: 5/5
- Build failures: none

### Risk Classification
- Low-risk auto-executes that caused problems: none
- Items that should have been classified differently: none

### Challenge Accuracy
- C-suite challenges: 0 endorsed, 0 challenged, 2 flagged (Sarah + Marcus both flagged P1 dashboard scope)
- Challenges that proved correct in hindsight: Sarah and Marcus were right to flag P1 scope — we correctly deferred P1 dashboard features (intelligence feed, report viewer, proposal approval, OKR tracker) to focus on P0 /directive improvements

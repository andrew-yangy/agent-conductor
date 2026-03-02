# Work State Management — The Foundational Fix

## Objective

The conductor system cannot be autonomous if the CEO is the only persistent memory. Work items get buried, discussions die with sessions, partial completions go untracked, and md files are a write-once graveyard. Fix the state management layer so the system can actually track, persist, and surface everything.

Without this, there is no AI autonomous conductor.

## The Problem (CEO's words, raised 4 times)

"Project A sliced into tasks → do some → discover new scope → becomes Project B → start Project C → old slices forgotten. The CEO asks 'where are we?' and gets no clear answer."

Root causes identified in post-mortem:
1. Context window is the single point of failure — strategic thinking dies with sessions
2. Md files are write-once graveyards — not queryable, not lifecycle-aware
3. Only outputs are persisted, not discussions/reasoning
4. No checkpoint/resume for interrupted directives
5. Partial completions marked "done" (P0 ships, P1/P2 silently abandoned)
6. No project hierarchy — 15+ flat projects is unnavigable

## Key Results (CEO approved)

### KR-1: Every work item is a structured, queryable record with lifecycle state
- **Metric:** % of work items tracked as structured data vs free-form md
- **Target:** 100% — md becomes rendering artifact, not source of truth
- **Verification:** Query "show me all blocked items across goals" from dashboard, get answer in seconds

### KR-2: Zero orphaned work — incomplete items auto-queued and visible
- **Metric:** Count of scoped-but-unfinished items with no tracked status
- **Target:** 0 — every item is pending, in-progress, deferred (with reason), done, or abandoned
- **Verification:** Open any completed directive in dashboard, see exactly which sub-items shipped

### KR-3: Research, reasoning, and discussions persist as durable artifacts
- **Metric:** % of strategic sessions producing a retrievable artifact in dashboard
- **Target:** 100% — zero knowledge loss on session death
- **Verification:** Find any past research/discussion from dashboard without prompting Claude

### KR-4: Dashboard is the single operating surface
- **Metric:** Time to orient at start of new session with no prior context
- **Target:** < 2 minutes
- **Verification:** Close session mid-work, open fresh next day, pick up without reading md files

### KR-5: Directives can be interrupted and resumed with zero information loss
- **Metric:** % of directive steps with checkpoint before proceeding
- **Target:** 100% checkpoint coverage
- **Verification:** Kill directive mid-execution, new session recovers from last checkpoint

### KR-6: CEO cognitive load for system management near zero
- **Metric:** Weekly time on housekeeping (re-raising, auditing, reconstructing)
- **Target:** < 5 min/week
- **Verification:** CEO hasn't re-raised a buried topic in 30 days

### KR-7: Projects organized in navigable hierarchy
- **Metric:** Top-level items in dashboard default view
- **Target:** ≤ 7 groupings, projects nest under them, drillable
- **Verification:** Navigate to any project within 2 clicks

### KR-8: Mid-task backlog capture preserves context
- **Metric:** % of mid-task backlog additions with source context attached
- **Target:** 100%
- **Verification:** Open a backlog item created mid-task a week later, see full context

### KR-9: Existing goals, archives, and old docs migrated to new structure
- **Metric:** % of existing context tree content (15 goals, done/ folders, docs/archive/, directive reports) migrated into the new structured state
- **Target:** 100% — all existing work items, completed features, and archived docs are queryable in the new system, not stranded in orphaned md files
- **Verification:** CEO searches for any past project or decision from the dashboard and finds it — nothing is lost in the migration

## Research (completed, persisted)

Framework comparison of 10 agent orchestration systems (NOT IDE tools):
- See `.context/discussions/research-framework-comparison-2026-03-02.md`
- Key patterns to steal: LangGraph checkpointing, Devin session sleep/resume + work log, Taskmaster tasks.json
- Nobody solves what we're building — we're unique in combining multi-project, CEO dashboard, bottom-up proposals, and research persistence

## Execution Authority

CEO has authorized fully autonomous execution. Do not pause for approval — use team judgment on plan, initiative priorities, and follow-ups. The CEO will review results in `/report`, not during execution.

## Process Notes

- **C-suite KR brainstorm was valuable** — Morgan, Sarah, Marcus each proposed KRs from their domain. Add this as a formal step for OKR-level directives.
- **Scenario list update** — use day-to-day scenarios as verification during execution, not planning. One initiative should be: update scenario list and validate KRs against it.
- **This is the foundational problem.** Prioritize over feature work. The conductor can't be autonomous without persistent state.

## Context

- Conductor dashboard: `/Users/yangyang/Repos/agent-conductor/` — React 19 + Vite + Zustand + WebSocket + shadcn/ui + chokidar
- Discussion file: `.context/discussions/work-state-management-2026-03-02.md`
- Agent conductor backlog: `.context/goals/agent-conductor/backlog.md`
- Current inventory: `.context/goals/inventory.json` (manually maintained — step in right direction)

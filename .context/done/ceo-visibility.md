# CEO Visibility — Complete Picture of Everything

## Objective
The CEO has no single place to see "where are we on EVERYTHING." Projects get started, partially completed, then new projects push them aside. The pattern: Project A sliced into tasks → do some → discover new scope → becomes Project B → start Project C → old slices forgotten. The CEO asks "where are we?" and gets no clear answer.

Fix this. Give the CEO a complete, always-current picture of all work — what's done, what's in progress, what's partially abandoned, what's next.

## The Real Problem
1. **No single source of truth**: Work state is scattered across `.context/goals/*/`, backlogs, OKRs, active folders, done folders — no unified view
2. **Partial completion invisible**: Projects get 2/5 slices done, then attention shifts. Those remaining 3 slices disappear from view
3. **CEO reports lack completeness**: `/report` shows recent activity but not the full picture of all in-flight work
4. **No project lifecycle tracking**: A project can be "active" forever with no one noticing it stalled
5. **Scope expansion not tracked**: When Project A expands to Project B, the original slices aren't explicitly carried forward or explicitly dropped

## What Needs to Happen

### P0 — Context Tree Structure (the data layer)
The `.context/goals/` structure needs to support clear project state tracking:
- Every active feature/project must have a clear status: not_started, in_progress, blocked, partially_done, done, abandoned
- Every task within a project must have explicit status
- When scope expands (A → B), the relationship must be explicit
- Stale detection: if a project hasn't been touched in X days, flag it

Audit all current `.context/goals/*/` folders and normalize them to a consistent structure. Surface what's partially done and forgotten.

### P0 — Conductor Dashboard: Project Tracker
Add to the existing conductor dashboard (`/Users/yangyang/Repos/agent-conductor/`):
- **All Projects view**: Every goal area, every active project, every backlog item — in one filterable list
- **Status columns**: Kanban or table view — not_started | in_progress | blocked | partially_done | done
- **Staleness indicators**: Projects with no activity in 7+ days get flagged
- **Drill-down**: Click a project to see its tasks, completion %, last activity, and what's blocking it
- Data source: read from `.context/goals/*/` directory structure (backlogs, active features, OKRs, tasks.json files)

### P0 — Structured CEO Reports
Upgrade `/report` skill to always include:
- **Complete project inventory**: ALL projects across ALL goal areas with current status
- **Partially done alert**: Projects that are >0% but <100% done, sorted by staleness
- **What shifted**: Projects that were active last week but not touched this week
- **Decision queue**: Things waiting for CEO input (blocked items, proposals, approvals)

### P1 — Backlog Health
- Every backlog item gets a structured format: priority, status, trigger condition, staleness date
- `/healthcheck` Morgan step checks for stale backlogs and partially-done projects
- Dashboard backlog view with filtering by goal area, priority, staleness

## Success Criteria
- CEO can open ONE view (dashboard or report) and see the status of everything
- Partially-done projects are impossible to forget — they show up as "stale" after 7 days
- When a new project starts, old in-progress projects don't disappear from view
- `/report weekly` includes a complete project inventory, not just recent activity

## Context
- Conductor dashboard: `/Users/yangyang/Repos/agent-conductor/` — React 19 + Vite + Zustand + WebSocket + shadcn/ui + chokidar
- Context tree: `.context/goals/*/` with backlogs, active features, OKRs
- Current skills: `/directive`, `/scout`, `/healthcheck`, `/report`
- The dashboard already has: session tracking, team tracking, task tracking, directive progress panel

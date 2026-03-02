# Discussion: Work State Management — OKR Shaping

Date: 2026-03-02
Status: In progress — OKR alignment phase

## Problem Statement

Work state gets buried. The CEO has raised this FOUR times across sessions. Each time, the discussion about fixing it also got buried. Root causes identified in post-mortem:
1. Context window is the single point of failure — strategic thinking dies with sessions
2. Md files are write-once graveyards — not queryable, not lifecycle-aware
3. Directive pipeline hijacks conversations — no "strategic discussion" mode
4. Continuation summaries are lossy — detail is lost on session death
5. I never checkpoint in-progress thinking
6. Partial solutions get marked "done" (P0 ships, P1/P2 silently abandoned)
7. Each ask gets treated as a new problem instead of the same recurring one

## CEO Requirements (verbatim from conversation)

- "I don't think we can manage those within md files"
- "without this there is no AI autonomous conductor at all"
- "I won't be monitoring the progress in the session anymore, and in most time I would just use one session for all the works"
- "we need to store the research results, like the scenario mapping things, with the research, so as CEO I can take a look at the conductor UI"
- Projects need hierarchy (teams/roadmaps/initiatives) — like a Jira board — otherwise too many flat projects
- Day-to-day scenario to support: "add something to backlog while doing something else, do it later, with context"

## CEO Corrections (must not be lost again)

- **Do NOT compare against IDE AI tools** (Cursor, Copilot, etc.) for scenario mapping. Compare against **autonomous agent orchestration frameworks** doing similar things to us (CrewAI, AutoGen, LangGraph, MetaGPT, etc.)
- The original scenario mapping wrongly benchmarked against IDEs. CEO corrected this but the correction was not stored.
- **Add "C-suite KR brainstorm" as a formal step** in the directive pipeline — the group thinking produced good results.

## C-Suite KR Proposals (from brainstorm session)

### Convergence across Morgan, Sarah, Marcus:
1. Structured state, not md files — every work item is a queryable record with lifecycle
2. Nothing silently dropped — zero orphaned slices, P1/P2s, or deferred items
3. Research/reasoning persisted — not just action items
4. Dashboard as operating surface — single source of truth, auto-updating
5. CEO stops being the memory — cognitive load < 5 min/week on system housekeeping

### Additional KR from CEO:
6. Project hierarchy/grouping — projects organized into teams/roadmaps/initiatives so they don't become an unnavigable flat list

## Framework Research (completed)
See `research-framework-comparison-2026-03-02.md` for full comparison of 10 frameworks.

Key insight: **Nobody solves what we're building.** Closest comparables:
- Devin (for UX/dashboard quality + session sleep/resume)
- LangGraph (for checkpoint-after-every-step architecture)
- Taskmaster AI (for structured task state in JSON)
- Temporal (for durable execution of long-running workflows)

Our unique requirements no framework addresses:
1. Multiple parallel goals/projects (not single-task)
2. CEO-level oversight (not developer debugging)
3. Bottom-up proposals from agents
4. Research/reasoning persistence
5. Project hierarchy (teams/roadmaps) not flat task lists

## Finalized KRs (CEO approved 2026-03-02)

### KR-1: Every work item is a structured, queryable record with lifecycle state
- **Metric:** % of work items tracked as structured data vs free-form md
- **Target:** 100% — md becomes rendering artifact, not source of truth
- **Verification:** Query "show me all blocked items across goals" from dashboard, get answer in seconds

### KR-2: Zero orphaned work — incomplete items auto-queued and visible
- **Metric:** Count of scoped-but-unfinished items with no tracked status
- **Target:** 0 — every item is pending, in-progress, deferred (with reason), done, or abandoned
- **Verification:** Open any completed directive in dashboard, see exactly which sub-items shipped and which didn't

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
- **Metric:** % of existing context tree content migrated into new structured state
- **Target:** 100% — all 15 goals, done/ folders, docs/archive/, directive reports queryable
- **Verification:** Search for any past project or decision from dashboard and find it

### Architecture: KR-1 is foundation (fix write path first). KR-6 is capstone (if CEO is still the memory, we failed). KR-9 ensures we don't leave history behind.

## Pending Work (this discussion)
- [x] Research agent orchestration frameworks (NOT IDEs) — done, persisted
- [x] C-suite KR brainstorm — done (Morgan, Sarah, Marcus)
- [x] Finalize KR set with CEO — approved
- [ ] Create directive file in inbox/
- [ ] Execute directive (separate session)

## Key Scenarios to Support
1. "CEO is mid-task on Project A. An idea surfaces for Project B. CEO says 'add this to backlog.' The system captures it WITH the context of why it came up, what was being discussed, and links it to the right project. CEO continues with Project A. The backlog item doesn't get lost."
2. "CEO opens dashboard in a new session. Sees all pending work across all goals. Knows exactly what to continue without reading any files or asking Claude."
3. "A directive completes P0 but not P1/P2. The CEO can see exactly which items shipped and which are still pending, from the dashboard."
4. "CEO had a strategic discussion last week. The reasoning, research, and scenarios are findable in the dashboard without having to remember which session it was in."

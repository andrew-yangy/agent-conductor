# Context Tree Redesign -- DEFINITIVE SPECIFICATION

**Directive:** context-tree-redesign
**Date:** 2026-03-03
**Status:** APPROVED -- Ready for execution planning
**Authority:** All decisions made by CEO across 4 brainstorm rounds

---

## 1. Design Decisions (Settled)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Three-tier hierarchy: Goal > Project > Task | Unanimous across 4 rounds. No 4th tier. |
| 2 | "Goal" naming (not "Area") | CEO decision: ambiguity serves solo founders |
| 3 | Embedded + enriched OKRs | OKRs stay in goal.json with `period`, `expires`, `cycle` fields. Multiple OKRs per goal (array). |
| 4 | Optional `kpis[]` on goals | Ongoing health metrics separate from time-bound OKRs |
| 5 | Projects nested under goals on filesystem | `goals/{id}/projects/{pid}/` |
| 6 | Tasks embedded in project.json | No separate task files. Ever. |
| 7 | `sequence` + `depends_on_project` on projects | Roadmap ordering within a goal |
| 8 | Optional `phase` label on tasks | Dashboard grouping only, not structural |
| 9 | No milestones | Split large projects instead |
| 10 | Directives flat, linked via triage | Full traceability: directive > project > tasks |
| 11 | Kill _state/ and indexer | Dashboard reads source files directly via glob + chokidar |
| 12 | Context co-located with parent entity | .md files live in the entity's directory |
| 13 | Intel: keep all | `intel/latest/` + `intel/archive/{date}/` |
| 14 | Backlog: per-goal level | `goals/{id}/backlog.json` + optional project-level |
| 15 | Reports: co-located for directives, top-level for CEO | `reports/` for daily/weekly, project dir for directive reports |
| 16 | No backwards compatibility | Clean break, migrate everything |

---

## 2. Entity Schemas

### 2.1 Goal

**File:** `.context/goals/{goal-id}/goal.json`

```json
{
  "id": "string (kebab-case, matches directory name)",
  "title": "string",
  "status": "in_progress | paused | completed | archived",
  "category": "product | framework | infrastructure | growth",
  "description": "string (one paragraph)",
  "created": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)",
  "updated": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)",
  "kpis": [
    {
      "id": "string (e.g. kpi-1)",
      "metric": "string (what is measured)",
      "target": "string or number",
      "current": "string or number",
      "unit": "string (e.g. users, dollars, percent)"
    }
  ],
  "okrs": [
    {
      "objective": "string",
      "period": "string (e.g. Q1-2026, H1-2026, 2026)",
      "expires": "ISO date (when this OKR cycle ends)",
      "cycle": "quarterly | biannual | annual | evergreen",
      "key_results": [
        {
          "id": "string (e.g. kr-1)",
          "description": "string (measurable outcome)",
          "target": "string or number",
          "current": "string or number",
          "status": "not_started | in_progress | completed | missed"
        }
      ]
    }
  ]
}
```

**Required fields:** id, title, status, category, description, created, updated
**Optional fields:** kpis, okrs

**What goals do NOT store:**
- No project IDs array. Projects discovered via filesystem: `goals/{id}/projects/*/project.json`
- No features array. Features are now projects.

### 2.2 Project

**File:** `.context/goals/{goal-id}/projects/{project-id}/project.json`

```json
{
  "id": "string (kebab-case, matches directory name)",
  "title": "string",
  "goal_id": "string (FK to Goal.id, must match filesystem path)",
  "status": "proposed | planning | in_progress | blocked | completed | abandoned",
  "priority": "p0 | p1 | p2 | p3",
  "sequence": "integer (optional, roadmap ordering within the goal)",
  "depends_on_project": "string | null (optional, format: goal-id/project-id for cross-goal, or project-id for same-goal)",
  "description": "string (what this project delivers)",
  "scope": {
    "in": ["string"],
    "out": ["string"]
  },
  "dod": [
    {
      "criterion": "string (verifiable statement)",
      "met": false,
      "verified_by": ["string"] | null
    }
  ],
  "verify": {
    "checklist": ["string (project-specific verification steps — NOT type-check, that's always implied)"],
    "reviewers": [
      {
        "agent": "string (sarah | marcus | priya | morgan)",
        "domain": "string (what they verify: architecture, ux, seo, process)"
      }
    ],
    "browser_test": "boolean (true if project touches UI)"
  },
  "source_directive": "string | null (FK to Directive.id)",
  "tags": ["string (for cross-goal relevance, secondary categorization)"],
  "tasks": [
    "// See Task schema below"
  ],
  "created": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)",
  "updated": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)",
  "completed": "ISO date | null"
}
```

**Required fields:** id, title, goal_id, status, priority, description, dod, verify, tasks (can be `[]`), created, updated
**Optional fields:** sequence, depends_on_project, scope, source_directive, tags, completed

**Reviewer Assignment Rules (by domain and complexity):**

| Goal Category | Reviewers | Rationale |
|---------------|-----------|-----------|
| `framework` | [Sarah] | Architecture, schema integrity, system design |
| `infrastructure` | [Sarah] | Server, deployment, security |
| `product` | [Marcus] | User-facing features, UX flows, product decisions |
| `growth` | [Priya] | SEO, marketing, content, positioning |
| Cross-cutting (P0) | [domain lead, + Sarah or Marcus] | Complex work needs multi-perspective review |

**verify.checklist semantics:**
- NOT "type-check passes" — that's always run, listing it is noise
- NOT "it works" — too vague
- YES: project-specific acceptance tests the reviewer walks through
- Examples: "Dashboard loads with real goal data from .context/", "All API endpoints return new entity shapes", "Foreman can discover and launch directives from directives/ directory"

**DoD + verify are required for all non-completed projects.** Completed projects may omit them. Each DoD criterion must be verifiable — can be objectively marked `met: true` or `met: false`.

### 2.3 Task (embedded in project.json tasks[])

```json
{
  "id": "string (unique within project, e.g. t1, fix-auth)",
  "title": "string",
  "status": "pending | in_progress | completed | blocked | skipped",
  "phase": "string | null (optional label: research, design, build, test, etc.)",
  "agent": ["string"] | [] (array of agent names, e.g. ["jordan"], ["sarah", "marcus"]),
  "depends_on": ["string (task IDs within same project)"],
  "blocked_reason": "string | null (set when status = blocked)",
  "cross_project_dep": "string | null (format: goal-id/project-id:task-id)",
  "acceptance_criteria": ["string (testable criterion for this task)"] | null,
  "verified_by": ["string (agent names who verified this task)"] | null,
  "review_outcome": "pass | fail | critical | null",
  "output": "string | null (summary of what was done, set on completion)",
  "created": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)",
  "completed": "ISO 8601 timestamp | null"
}
```

**Required fields:** id, title, status, created
**Optional fields:** phase, agent, depends_on, blocked_reason, cross_project_dep, acceptance_criteria, verified_by, review_outcome, output, completed

**Task verification fields:**
- `acceptance_criteria`: Testable criteria specific to this task (mini-DOD). Set during planning or build phase. Complements the project-level DOD which covers the aggregate delivery.
- `verified_by`: Agent(s) who reviewed/tested this task's output. Set when the task is verified — may differ from `agent` (who built it).
- `review_outcome`: Result of verification. `pass` = criteria met, `fail` = issues found but non-blocking, `critical` = must fix before project ships.

**Constraints:**
- Tasks are atomic, single-agent work items
- No separate .md files for tasks
- Cross-project dependencies are explicit but strongly discouraged
- When a task is completed, `agent`, `verified_by`, and `review_outcome` MUST be populated. Use `["self"]` for `agent` when work was done directly in the CEO session without the directive pipeline.
- Tasks without verification are technically valid but indicate a gap in the review process.

### 2.4 Directive

**Files:** `.context/directives/{id}.json` + `.context/directives/{id}.md` (optional CEO brief)

```json
{
  "id": "string (kebab-case)",
  "title": "string",
  "status": "pending | triaged | in_progress | completed | rejected",
  "source": "ceo | scout | healthcheck | walkthrough",
  "weight": "quick-fix | tactical | strategic",
  "created": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)",
  "updated": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)",
  "completed": "ISO date | null",
  "triage": {
    "action": "create_project | add_tasks | update_existing | create_goal | reject",
    "goal_id": "string",
    "project_id": "string",
    "task_ids": ["string"],
    "secondary_goal_ids": ["string"],
    "rationale": "string",
    "requires_ceo_approval": false
  },
  "plan": {
    "challenges": [
      { "agent": "string", "assessment": "string", "recommendation": "proceed | simplify | reject" }
    ],
    "initiatives": [
      {
        "id": "string",
        "title": "string",
        "phases": ["build", "review"],
        "cast": { "engineer": "string", "reviewer": "string" },
        "dod": [{ "criterion": "string", "met": false, "verified_by": [] }],
        "user_scenario": "string"
      }
    ]
  },
  "phases": {
    "audit": { "findings": [], "agent": "string", "timestamp": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)" },
    "build": { "summary": "string", "files_changed": [], "agent": "string", "timestamp": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)" },
    "review": { "outcome": "pass | fail | critical", "findings": [], "agent": "string", "timestamp": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)" }
  },
  "cast": {},
  "dod": [{ "criterion": "string", "met": false, "verified_by": [] }],
  "report_summary": "string | null",
  "telemetry": {
    "started": "ISO datetime",
    "completed": "ISO datetime",
    "wall_time_minutes": 0,
    "phase_times": {}
  }
}
```

### 2.5 Backlog Item

**File:** `.context/goals/{goal-id}/backlog.json` (array of items)

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "priority": "p0 | p1 | p2 | p3",
  "status": "proposed | approved | promoted | rejected",
  "source": "scout | ceo | healthcheck | agent",
  "source_detail": "string (e.g. scout agent name, directive ID)",
  "trigger": "string | null (condition that makes this actionable)",
  "promoted_to": "string | null (directive ID if promoted)",
  "created": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)",
  "updated": "ISO 8601 timestamp (e.g. 2026-03-03T10:30:00Z)"
}
```

**Location:** Per-goal: `goals/{goal-id}/backlog.json`. Each goal has its own backlog file. This keeps backlogs co-located with their domain. The CEO reviews across goals via `/report` which reads all backlog files.

---

## 3. Directory Structure

```
.context/
|-- vision.md                                    # System vision (required)
|-- preferences.md                               # CEO preferences (consumer repos only)
|
|-- goals/                                       # Dynamic goals
|   |-- {goal-id}/
|   |   |-- goal.json                            # REQUIRED
|   |   |-- context.md                           # OPTIONAL -- domain knowledge, narrative
|   |   |-- backlog.json                         # OPTIONAL -- per-goal backlog items
|   |   +-- projects/
|   |       |-- {project-id}/
|   |       |   |-- project.json                 # REQUIRED -- entity + embedded tasks
|   |       |   |-- context.md                   # OPTIONAL -- spec, design notes
|   |       |   |-- report.md                    # OPTIONAL -- completion report
|   |       |   |-- brainstorm.md                # OPTIONAL -- brainstorm output
|   |       |   |-- brainstorm-round-N.md        # OPTIONAL -- multi-round brainstorms
|   |       |   +-- *.md                         # OPTIONAL -- any named context file
|   |       +-- ...
|   +-- ...
|
|-- directives/                                  # FLAT -- status in JSON, not directory
|   |-- {id}.json                                # Directive entity
|   |-- {id}.md                                  # CEO brief (optional)
|   +-- ...
|
|-- intel/                                       # Scout outputs
|   |-- latest/                                  # Overwritten each /scout run
|   |   |-- sarah.json
|   |   |-- marcus.json
|   |   |-- morgan.json
|   |   +-- priya.json
|   +-- archive/                                 # Previous runs
|       +-- {YYYY-MM-DD}/
|           |-- sarah.json
|           +-- ...
|
|-- reports/                                     # CEO dashboard reports
|   |-- daily-{YYYY-MM-DD}.md
|   |-- weekly-{YYYY-MM-DD}.md
|   +-- ...
|
|-- lessons/                                     # Flat, topic-based knowledge
|   |-- orchestration.md
|   |-- agent-behavior.md
|   +-- ...
|
+-- (NO state/, NO inbox/, NO done/, NO artifacts/, NO checkpoints/, NO discussions/)
```

### File Existence Rules

| Level | Required Files | Optional Files |
|-------|---------------|----------------|
| Goal directory | `goal.json` | `context.md`, `backlog.json` |
| Project directory | `project.json` | `context.md`, `report.md`, `brainstorm*.md`, `design.md`, any `*.md` |
| Directive | `{id}.json` | `{id}.md` |
| Intel | `latest/{agent}.json` | `archive/{date}/{agent}.json` |
| Reports | `{type}-{date}.md` | -- |
| Lessons | `{topic}.md` | -- |

### Key Conventions
- Directory names = entity IDs. `goals/buywisely/` means `goal.id = "buywisely"`.
- project.json is THE source of truth for a project including all its tasks.
- context.md is freeform markdown. No schema.
- Brainstorm/design/review outputs live as named .md files in the project directory.
- Reports co-located with projects for directive-specific reports. CEO dashboard reports in top-level `reports/`.

---

## 4. Directive Triage Flow

```
1. CEO writes directive
   -> Creates directives/{id}.md (freeform brief)
   -> Creates directives/{id}.json with status: "pending"

2. Triage agent reads:
   -> The directive .md
   -> All goals/*/goal.json
   -> All goals/*/projects/*/project.json

3. Decision tree:
   +-- Match existing project?
   |   YES -> action: "add_tasks" or "update_existing"
   |
   |   NO -> Match existing goal?
   |       YES -> action: "create_project"
   |
   |       NO -> Need new goal?
   |           YES -> action: "create_goal", requires_ceo_approval: true
   |           NO  -> action: "reject"

4. After triage:
   -> directive.json status -> "triaged", triage field populated
   -> Entities created on filesystem if applicable

5. Execution:
   -> Morgan plans -> engineers build -> reviewers verify
   -> Task statuses updated in project.json
   -> Phase outputs in directive.json
   -> Artifacts as .md in project directory

6. Completion:
   -> directive status -> "completed"
   -> Tasks marked completed
   -> Project status updated
   -> report.md in project directory
   -> Lessons extracted
```

### Cross-Goal Directives
- `triage.goal_id` = primary goal (project lives here)
- `triage.secondary_goal_ids[]` = other relevant goals
- Project `tags[]` includes `"cross-goal:{other-goal}"`
- ONE project created, under primary goal

### Default Bias: Map to Existing
1. First: map to existing project
2. Second: map to existing goal (create project)
3. Last resort: propose new goal (requires CEO approval)

---

## 5. Dashboard Read Patterns

### No Indexer -- Direct File Reading

The dashboard reads source files on startup and watches for changes. No intermediate computed layer.

### Glob Patterns

```javascript
// All goals
glob('.context/goals/*/goal.json')

// All projects (nested)
glob('.context/goals/*/projects/*/project.json')

// All directives
glob('.context/directives/*.json')

// All intel
glob('.context/intel/latest/*.json')

// All reports
glob('.context/reports/*.md')

// All lessons
glob('.context/lessons/*.md')

// All backlogs (per-goal)
glob('.context/goals/*/backlog.json')
```

### File Watching (chokidar)

```javascript
chokidar.watch([
  '.context/goals/*/goal.json',
  '.context/goals/*/projects/*/project.json',
  '.context/goals/*/backlog.json',
  '.context/directives/*.json',
  '.context/intel/latest/*.json',
  '.context/reports/*.md',
], { persistent: true })
```

### Performance

- ~70-80 files total across all entity types
- <100ms to read all on modern SSD
- Changes reflected immediately (no indexer lag)

---

## 6. Migration Plan

### Overview

Two repos to migrate:
- **agent-conductor** (framework): 3 goals -> 1 consolidated goal
- **sw** (consumer): 14 goals -> ~5 consolidated goals

Migration runs on a git branch. Validate before merging.

### 6.1 Agent-Conductor Migration

**Current structure:**
```
.context/
  goals/
    agent-conductor/     -> goal.json + features
    conductor-ux/        -> goal.json + features
    conductor-review-quality/ -> goal.json + features
  inbox/                 -> 8 pending directives
  done/                  -> 28 completed directives
  artifacts/             -> 9 artifact directories
  intelligence/latest/   -> 4 agent files
  state/                 -> 6 computed files (backlogs.json, conductor.json, features.json, goals.json, index.json, references.json)
  reports/               -> 35 report files
  lessons/               -> topic-based .md files
  checkpoints/           -> directive checkpoints
  discussions/           -> strategic discussions
  lessons.md             -> top-level lessons
  intelligence.log       -> empty
  proposals.log          -> empty
  scenarios.md           -> outdated
```

**Goal consolidation:**
| Old Goal | New Location |
|----------|-------------|
| `agent-conductor/` | `conductor/` (rename, keep as primary goal) |
| `conductor-ux/` | `conductor/projects/dashboard-ux/` (demote to project) |
| `conductor-review-quality/` | `conductor/projects/review-quality/` (demote to project) |

**Directive migration:**
- `inbox/*.json` + `inbox/*.md` -> `directives/*.json` + `directives/*.md` (keep status: "pending")
- `done/*.json` + `done/*.md` -> `directives/*.json` + `directives/*.md` (set status: "completed")

**Artifact migration:**
- Each `artifacts/{directive-id}/` -> find matching project, move .md files there
- If no matching project, create one under the appropriate goal

**Other migrations:**
- `intelligence/latest/` -> `intel/latest/`
- `state/` -> DELETE (replaced by direct reads)
- `checkpoints/` -> absorbed into directive.json (or deleted if stale)
- `discussions/` -> absorbed into lessons/ or project context.md
- `lessons.md` (top-level) -> merge content into `lessons/` topic files
- `intelligence.log`, `proposals.log` -> DELETE (empty)
- `scenarios.md` -> DELETE (outdated)
- `reports/` -> stays (CEO dashboard reports). Directive-specific reports move to project dirs.

### 6.2 SW (Consumer) Migration

**Goal consolidation (14 -> ~5):**
| New Goal | Old Goals Consolidated | Category |
|----------|----------------------|----------|
| `buywisely` | buywisely-growth, buywisely-modernize, buywisely-security | product |
| `sellwisely` | sellwisely-revenue | product |
| `infrastructure` | platform, database-ops, developer-productivity, scraper-product-discovery | infrastructure |
| `growth` | growth-marketing, competitor-intelligence, global-expansion | growth |
| `new-products` | ai-powered-apps, data-enrichment, pricesapi-launch | product |

Note: The SW repo also has symlinked conductor goals (agent-conductor, conductor-ux, conductor-review-quality). These get removed from SW -- they live in the agent-conductor repo only.

**Feature -> Project migration:**
Each feature in old goal.json `features[]` becomes a project directory.

Status mapping:
- `done` -> `completed`
- `active` -> `active`
- `planned` -> `proposed`
- other -> `proposed`

**Task migration:**
- Active features with `tasks.json` -> embed tasks in project.json
- Completed features without tasks.json -> set `tasks: []`

**Other SW-specific:**
- `_state/` -> DELETE
- `_index.md` -> DELETE
- `inventory.json` -> DELETE or absorb
- Old goal directories -> DELETE after migration
- `workflow.md`, `roles.md` -> evaluate; keep if still relevant
- `systems/` -> remains (separate from context tree)
- `marketing/` -> remains (separate from context tree)

### 6.3 Migration Script Requirements

The migration script must:
1. Be idempotent (safe to run multiple times)
2. Print a validation report: entity counts, orphan checks, broken references
3. Map ALL old features to new projects (no data loss)
4. Preserve all directive data (both pending and completed)
5. Move artifacts to co-located project directories
6. Create backlog.json per goal from old backlog data
7. Handle the sw-only files (preferences.md, systems/, marketing/)
8. NOT delete old structure (that is Phase 10 -- separate step after validation)

### 6.4 Post-Migration Updates

After migration data is validated:
1. Update dashboard server to use glob-based direct file reading
2. Remove indexer code from dashboard
3. Update all SKILL.md files to read/write new paths
4. Update CLAUDE.md in both repos
5. Update agent prompts that reference old paths
6. Delete old directory structure

---

## 7. Edge Cases

### Cross-Goal Directive
- Primary goal gets the project; secondary goals listed in `triage.secondary_goal_ids`
- Project tagged with `"cross-goal:{goal-id}"`
- Dashboard shows under both goals

### Abandoned Project
- `status: "abandoned"`, remaining tasks `status: "skipped"`
- Stays on filesystem for historical record
- Dashboard filters out by default

### Quick-Fix Directive
- Even tiny fixes get a project (one-task project is cheap)
- Triage can create project + task in single operation
- Full pipeline not required for quick-fix weight

### Cross-Project Task Dependency
- `cross_project_dep: "goal-id/project-id:task-id"`
- Strongly discouraged. Prefer project-level sequencing.

### Scout Intelligence -> Project
- Scout writes to `intel/latest/`
- CEO promotes to directive via `/report`
- Or scout adds to goal's `backlog.json`

---

## 8. Relationship Summary

### Forward (parent -> child)
```
Goal -> Projects (discovered via filesystem glob)
Project -> Tasks (embedded in tasks[])
```

### Backward (child -> parent)
```
Project.goal_id -> Goal.id
Project.source_directive -> Directive.id
```

### Cross References
```
Directive.triage.goal_id -> Goal.id
Directive.triage.project_id -> Project.id
Directive.triage.secondary_goal_ids[] -> Goal.id[]
Backlog[].promoted_to -> Directive.id
Task.cross_project_dep -> "goal-id/project-id:task-id"
```

### Traceability Chain

**Forward:** CEO writes directive.md -> directive.json (triage links goal + project) -> project.json (tasks) -> task.output -> report.md

**Reverse:** project.source_directive -> directive.json -> directive.md (original intent) -> triage.rationale

---

## 9. What Gets Preserved vs Dropped

### Preserved
- All goal data (consolidated into fewer goals)
- All feature data (as projects)
- All active task data (embedded in project.json)
- All directive data (flattened into directives/)
- All artifacts (co-located with projects)
- All lessons (kept in lessons/)
- All intelligence (renamed to intel/)
- Vision and preferences
- CEO dashboard reports

### Dropped
- `state/` / `_state/` computed files (replaced by direct reads)
- `tasks_total` / `tasks_completed` counts (stale metadata)
- `backlog.md` files (replaced by per-goal backlog.json)
- `okrs.md` files (absorbed into goal.json okrs field)
- `goal.md` narrative files (replaced by context.md)
- Empty log files (intelligence.log, proposals.log)
- `scenarios.md` (outdated)
- `discussions/` (absorbed into lessons or project context)
- `checkpoints/` (absorbed into directive.json)
- `_index.md`, `inventory.json` (indexer artifacts)
- Old indexer script / code

---

*This is the single authoritative specification. Morgan plans from this. Sarah audits against this. No further design decisions needed.*

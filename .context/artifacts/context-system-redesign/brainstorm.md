# Context System Redesign — Brainstorm Synthesis

**Directive:** context-system-redesign
**Date:** 2026-03-02
**Participants:** Sarah Chen (CTO), Marcus Rivera (CPO)
**Facilitator:** Alex Rivera (Chief of Staff)

---

## Sarah Chen (CTO) — Architecture-First Approach

### Core Thesis
The problem is a missing data model, not a missing feature. Today's schemas evolved organically — each file type was designed in isolation without a cross-reference contract. The fix is to define a **universal reference format** and add reference fields to existing schemas, not to create a new centralized database. Keep the current file-per-entity pattern (it works well with git and agents) but make every entity aware of its neighbors.

### Proposed Schema Changes

**goal.json — no changes needed.** Goals are containers. They don't need to reference directives or reports directly — those references live on the features inside them.

**Feature object (inside goal.json features array) — add 4 fields:**
```json
{
  "id": "rich-trend-charts",
  "title": "Rich Competitive Trend Charts",
  "status": "done",
  "started": "2026-03-01",
  "completed": "2026-03-02",
  "tasks_total": 6,
  "tasks_completed": 6,
  "source": "directive:rich-trend-charts",
  "dod": [
    "Portfolio stacked area chart replaces old line chart",
    "TrendKpiStrip shows Revenue at Risk, Products Losing, % Cheapest",
    "Date range toggle works across all charts",
    "Designer + Store Owner review passes"
  ],
  "refs": ["report:rich-trend-charts-2026-03-02", "backlog:sellwisely-revenue/trend-visualization"]
}
```

- `source`: single reference to what created this feature (a directive, backlog item, or "ceo-request:{description}")
- `dod`: array of strings — the Definition of Done criteria, copied from Morgan's plan at feature creation time
- `refs`: array of related entity references (reports, discussions, backlog items) — append-only, not a primary relationship

**backlog.json items — replace free-text `source` with structured ref:**
```json
{
  "id": "trend-visualization",
  "title": "Trend visualization improvements",
  "status": "done",
  "source": "directive:optimize-conductor-workflows",
  "promoted_to": "feature:sellwisely-revenue/rich-trend-charts",
  "context": "..."
}
```

- `source`: structured reference (same format as feature.source)
- `promoted_to`: when a backlog item becomes a feature, record the link

**tasks.json — simplify, add DOD verification field:**
```json
{
  "feature_id": "rich-trend-charts",
  "goal_id": "sellwisely-revenue",
  "verify": "cd apps/sellwisely && npm run type-check",
  "tasks": [
    {
      "id": "expand-timeline-types",
      "title": "Expand timeline types...",
      "status": "completed",
      "role": "backend",
      "deps": [],
      "files": ["apps/sellwisely/src/lib/types.ts"],
      "description": "..."
    }
  ]
}
```

Remove the nested `features` wrapper — tasks.json lives inside a feature directory, so the feature context is implicit from the path. Add `feature_id` and `goal_id` at the top level for self-describing files.

**New file: directive.json (in inbox/ and done/ alongside the .md file):**
```json
{
  "id": "context-system-redesign",
  "title": "Context System Redesign — From File Store to Ticketing System",
  "status": "pending",
  "created": "2026-03-02",
  "weight": "strategic",
  "produced_features": [],
  "report": null,
  "goal_ids": ["agent-conductor"]
}
```

When a directive completes, `produced_features` gets populated with `["agent-conductor/context-system-redesign"]` and `report` gets set to `"report:context-system-redesign-2026-03-02"`. This is the structured metadata for directives — the .md file remains the content.

### Cross-Reference Format
**URI-style references:** `{type}:{id}` where type is one of: `directive`, `feature`, `backlog`, `report`, `discussion`, `goal`. The id uses the same hierarchical format already in use (`goal-id/feature-id`). Examples:
- `directive:rich-trend-charts`
- `feature:sellwisely-revenue/rich-trend-charts`
- `backlog:agent-conductor/manager-re-planning`
- `report:rich-trend-charts-2026-03-02`

**Bidirectionality is achieved through the indexer, not dual writes.** Each entity stores its outgoing references. The indexer builds a reverse-reference map at index time. This avoids the dual-write consistency problem.

### DOD Design
DOD lives on the feature object in goal.json as a `dod: string[]` array. It's populated when Morgan creates the plan (Step 4 of the directive pipeline). The reviewer (Sarah) verifies against it. After completion, the DOD stays on the feature permanently — queryable, not buried.

### Task System
Tasks remain feature-level. Goal-level tasks are a different abstraction — they're really just backlog items that are "in-progress." Rather than creating a parallel task system, mark backlog items with `status: "in-progress"` and optionally add a `tasks` array to backlog items that need decomposition. This avoids a proliferation of task locations.

### Migration Plan
1. Add `directive.json` to all existing inbox/ and done/ directives (script reads .md, extracts title/id, writes .json)
2. Add `source`, `dod`, `refs` to all feature objects in goal.json files (default: `source: null`, `dod: []`, `refs: []`)
3. Replace free-text `source` in backlog.json items with structured references (parse existing strings, map to directive IDs)
4. Simplify tasks.json schema (remove nested features wrapper, add feature_id/goal_id)
5. Update indexer to read directive.json and build reverse-reference maps
6. Update SKILL.md to write references at each transition point

### Tradeoffs
- **Bidirectional via indexer vs dual-write**: Cheaper to implement, but references are only queryable after re-indexing. Acceptable because the dashboard is the query layer.
- **DOD as string[] vs structured criteria**: String array is simpler but can't track pass/fail per criterion. Start with strings, add structured verification later if needed.
- **No lifecycle history**: We track current state, not transition history. Adding a `history: [{from, to, date, trigger}]` array is possible but adds complexity for minimal current value.

### What to Avoid
Do NOT create a centralized entities.json or graph database. The file-per-entity pattern works well with git (diffs are meaningful, conflicts are rare, agents can read one file at a time). A centralized store would create merge conflicts, blow up diffs, and make the system harder for agents to consume. The distributed files + indexer pattern is the right architecture.

### Confidence: High

---

## Marcus Rivera (CPO) — User-Experience Approach

### Core Thesis
The CEO's core workflow is **tracing**: start at any entity, navigate to related entities. Today that requires knowing file paths and conventions. The fix should optimize for the CEO's most common questions: "What did this directive produce?", "Where's the DOD for this feature?", "What's the source of this backlog item?" Every schema change should be evaluated against these navigation queries.

### Proposed Schema Changes

**Feature object — add source lineage and DOD:**
```json
{
  "id": "rich-trend-charts",
  "title": "Rich Competitive Trend Charts",
  "status": "done",
  "source_directive": "rich-trend-charts",
  "source_backlog": "sellwisely-revenue/trend-visualization",
  "dod": {
    "criteria": [
      {"text": "Portfolio stacked area chart replaces old line chart", "met": true},
      {"text": "KPI strip shows 3 prominent metrics", "met": true}
    ],
    "verified_by": "sarah",
    "verified_at": "2026-03-02"
  },
  "report": "rich-trend-charts-2026-03-02"
}
```

Key difference from Sarah: **DOD should be structured with per-criterion pass/fail**, not just strings. The CEO wants to ask "is this feature done?" and get a definitive answer. The reviewer agent needs to mark each criterion. A string array makes DOD a write-once artifact; a structured array makes it a living verification record.

**Separate source fields instead of generic URI:** Instead of `source: "directive:rich-trend-charts"`, use `source_directive` and `source_backlog` as separate nullable fields. This is more explicit and makes filtering trivial (find all features from a specific directive = filter on `source_directive`). Generic URI references require parsing.

**backlog.json — add promotion tracking:**
```json
{
  "id": "trend-visualization",
  "source_directive": "optimize-conductor-workflows",
  "promoted_to_feature": "sellwisely-revenue/rich-trend-charts",
  "promoted_at": "2026-03-01"
}
```

**New file: directive.json** — agrees with Sarah. Structured metadata alongside the .md content file. Must include `produced_features` array populated at directive completion.

**tasks.json — flatten and add goal-level support:**
For features, keep tasks.json in feature directories but simplify (remove nested features wrapper).
For goal-level tasks, allow a `tasks.json` at the goal root (not inside a feature directory). The indexer would read both locations.

```json
{
  "scope": "goal",
  "goal_id": "agent-conductor",
  "tasks": [
    {
      "id": "audit-cross-refs",
      "title": "Audit all cross-references for consistency",
      "status": "pending",
      "assignee": "sarah"
    }
  ]
}
```

### Cross-Reference Design
**Explicit typed fields over generic refs arrays.** Instead of a generic `refs: ["report:xyz", "discussion:abc"]` array, use specific fields: `source_directive`, `source_backlog`, `report`, `discussion`. This is more verbose but:
1. The CEO doesn't have to parse URIs to understand relationships
2. Schema validation can enforce field types
3. Dashboard can render links without a URI parser
4. Agents can read exactly the field they need

For the cases where an entity has many related items of the same type (e.g., a directive that produced 5 features), use arrays: `produced_features: ["goal/feat1", "goal/feat2"]`.

### DOD Design
DOD lives on the feature in goal.json as a structured object with criteria, verification status, and verification metadata. This serves both users:
- **CEO**: "Is this done?" = check if all criteria have `met: true`
- **Reviewer agent**: Iterate criteria, verify each, set `met` flag
- **Dashboard**: Show a checklist with green/red indicators

The DOD is created by Morgan at plan time (Step 4), populated with criteria text. The reviewer fills in `met` status. The CEO sees the final state.

### Task System
Agrees that goal-level tasks are needed. Proposes `tasks.json` at both goal level and feature level, with a `scope` field to distinguish. Goal-level tasks handle cross-cutting work (audits, reviews, migrations) that doesn't belong to any single feature.

### Migration Plan
1. Add `source_directive`, `source_backlog`, `dod`, `report` fields to all features in goal.json (nullable defaults)
2. Create directive.json for all existing directives in inbox/ and done/
3. Backfill `source_directive` on backlog items (parse existing free-text `source` field)
4. Add `promoted_to_feature` on backlog items that became features
5. Flatten tasks.json schema (remove nested features wrapper)
6. Update indexer to expose relationships in state/*.json
7. Update SKILL.md to populate references at each pipeline transition

### Tradeoffs
- **Explicit fields vs generic refs**: More verbose schema but much better DX for CEO and agents. Worth the extra fields.
- **Structured DOD vs string array**: More complex schema but enables verification tracking. The CEO specifically asked for DOD as a system — strings make it a label, structured data makes it a system.
- **Goal-level tasks**: Adds a new location for tasks (goal root), which the indexer must handle. But without it, goal-level work has no task tracking.

### What to Avoid
Do NOT make cross-references optional or gradual. The whole point is that EVERY feature links to its source. If references are optional, agents won't write them (they skip optional fields), and in 2 months we're back to the same problem. Make `source_directive` OR `source_backlog` required on every feature. Enforce it in the indexer with warnings for missing references.

### Confidence: High

---

## Synthesis — Agreements & Disagreements

### Where They Agree
1. **directive.json is needed** — structured metadata alongside the markdown content file
2. **DOD belongs on the feature object** in goal.json, not in reports
3. **tasks.json should be simplified** — remove the nested `features` wrapper
4. **backlog items need structured source references** — replace free-text `source`
5. **Bidirectional references via the indexer** — don't dual-write, compute reverse refs at index time
6. **Migration should be scripted** — one pass to update all existing files
7. **File-per-entity pattern is correct** — no centralized database
8. **Feature needs a `source` field** linking to the directive or backlog item that created it

### Where They Disagree

**1. DOD format: string[] vs structured criteria with pass/fail**
- Sarah: `dod: ["criterion 1", "criterion 2"]` — simple, sufficient for v1
- Marcus: `dod: { criteria: [{ text, met, verified_by }] }` — enables verification tracking
- **Implication**: Marcus's version is more complex but directly addresses the CEO's request for a DOD "system." Sarah's is simpler and can be upgraded later.

**2. Reference format: URI-style vs explicit typed fields**
- Sarah: `source: "directive:rich-trend-charts"` + generic `refs: [...]` array
- Marcus: `source_directive: "rich-trend-charts"`, `source_backlog: "goal/item-id"` — separate fields per type
- **Implication**: Sarah's is more extensible (new entity types don't need schema changes). Marcus's is more explicit (no parsing needed, better for agents and dashboard).

**3. Task system scope: keep feature-only vs add goal-level**
- Sarah: Tasks stay feature-level. Goal-level work = backlog items with `status: "in-progress"`
- Marcus: Add goal-level tasks.json at goal root, with `scope: "goal"` field
- **Implication**: Sarah's avoids a new task location but conflates backlog items with tasks. Marcus's is cleaner conceptually but adds indexer complexity.

---

## Clarifying Questions for the CEO

**1. DOD granularity: Do you want a checklist you can mark off, or a list of criteria you can eyeball?**
Sarah proposes `dod: string[]` (a readable list). Marcus proposes `dod: { criteria: [{ text, met }] }` (a checkable list with per-criterion verification status). The structured version enables the dashboard to show green/red checkmarks and lets reviewer agents mark individual criteria. The string version is simpler and still answers "what was the DOD?" Do you want DOD to be a **label** (what we agreed to do) or a **verification system** (what we verified was done)?

**2. Reference format: Do you prefer parsing-free explicit fields or a universal URI scheme?**
Option A (Sarah): `source: "directive:rich-trend-charts"` — one field, URI-style, extensible
Option B (Marcus): `source_directive: "rich-trend-charts"`, `source_backlog: null` — multiple fields, no parsing
Option A is more flexible for future entity types. Option B is more immediately readable and agent-friendly. Which matters more to you?

**3. Goal-level tasks: Should backlog items double as goal-level tasks, or should there be a separate task system at the goal root?**
Sarah argues that "in-progress" backlog items serve this purpose and a second task system at the goal level adds confusion. Marcus argues that tasks (discrete, assignable units of work) are conceptually different from backlog items (prioritized ideas with triggers). When you think "I need someone to audit all cross-references for this goal," do you want to add that as a backlog item or as a task?

---

## Brainstorm Artifact Path
`/Users/yangyang/Repos/agent-conductor/.context/artifacts/context-system-redesign/brainstorm.md`

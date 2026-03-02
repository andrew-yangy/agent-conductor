# Context System Redesign — Execution Plan

**Directive:** context-system-redesign
**Date:** 2026-03-02
**Prepared by:** Alex Rivera (Chief of Staff), with Morgan Park (COO) and Sarah Chen (CTO) input

---

## TL;DR

1. **Add cross-references to all entities** — features get `source_directive`, `source_backlog`, `dod`, `report` fields; backlog items get structured `source_directive` + `promoted_to_feature`; directives get companion `directive.json` with `produced_features` and `goal_ids`.
2. **DOD becomes a verification system** — `{ criteria: [{ text, met, verified_by }] }` on every feature, populated at plan time, verified at review time, queryable from goal.json.
3. **Goal-level tasks.json** — separate from backlog items, lives at goal root, handles cross-cutting work (audits, migrations, reviews).
4. **Indexer builds reverse-reference maps** — bidirectional navigation without dual-write. Every entity links to its neighbors.
5. **Migration script** — one-pass update of all 17 goal.json files, 14 backlog.json files, 31 directives, and 53 tasks.json files.

---

## Morgan's Challenges & Risks

### Risk 1: Scope creep into SKILL.md pipeline changes
The directive says "update SKILL.md to write references at each transition point." This is a second initiative hiding inside the first. Schema changes and pipeline behavior changes should be separate. **Recommendation:** Phase 1 = schema + migration + indexer. Phase 2 (separate directive) = SKILL.md pipeline updates.

### Risk 2: Dual-write during migration window
Between "migration runs" and "SKILL.md updated," new directives will still write old-format data. Mitigation: the indexer should handle both old and new formats during the transition. The migration script should be idempotent (safe to re-run).

### Risk 3: Breaking symlinked goals
Three goals (agent-conductor, conductor-review-quality, conductor-ux) are symlinked from sw/.context/goals/ to agent-conductor/.context/goals/. Changes to goal.json schema must work in both repos. The indexer runs from agent-conductor but reads sw/.context/goals/. Mitigation: test the indexer with both consumer and framework goals after every change.

### Risk 4: tasks.json format split (41 nested vs 12 flat)
41 existing tasks.json files use the nested `features[].tasks[]` format. 12 use the flat `tasks[]` format. The brainstorm proposes removing the nested wrapper, but this means rewriting 41 files. **Recommendation:** Support both formats in the indexer (already done). Standardize new files to flat format. Don't rewrite 41 old files — they're all in done/ directories and won't be edited again. Add `feature_id` and `goal_id` to new flat-format files only.

### Proceed recommendation: Proceed, scoped to 2 phases

---

## Technical Audit Findings (Sarah)

### Current State Inventory

| Entity | Count | Format | Issues |
|--------|-------|--------|--------|
| Goals (goal.json) | 17 (14 native + 3 symlinked) | JSON | No cross-references to directives or reports |
| Features (in goal.json) | 64 total (3 active, 61 done) | JSON objects inside goal.json | No `source`, no `dod`, no `refs`. 25 done features missing `completed_date`. 9 agent-conductor features have no feature directories (JSON-only) |
| Backlog items (backlog.json) | 201 items across 14 files | JSON | Only 15 items have a `source` field, and it's free-text. No `promoted_to_feature`. No structured directive reference |
| Tasks (tasks.json) | 542 total (151 pending, 391 done) across 53 files | JSON | 41 use nested format, 12 flat. No `feature_id` or `goal_id` at top level |
| Directives | 31 total (8 inbox, 23 done) | Markdown only | **Zero directive.json files exist.** No structured metadata. No goal linkage. No produced_features tracking |
| Reports | 28 | Markdown | Some have directive name in filename (parseable) but no structured link |
| Discussions | 3 | Markdown | Orphaned — no entity references them |

### Key Findings

1. **directive.json is the biggest gap.** Zero exist. Every directive's metadata (goal linkage, produced features, status) must be parsed from markdown filenames and content. This is the highest-value addition.

2. **Feature-to-directive linkage is completely absent.** Of 64 features, zero have a `source_directive` or any link to what created them. The CEO literally cannot answer "what directive produced this feature?" without reading report files.

3. **Backlog source field is unreliable.** Only 15/201 items have `source`, and it's free-text like "Directive checkpoint-resume, 2026-03-02". Not parseable without heuristics.

4. **The nested tasks.json wrapper is unnecessary but harmless in done/ files.** 41 files use `features[].tasks[]` but all are in done/ directories. Don't rewrite them — the indexer already handles both formats.

5. **agent-conductor goal is JSON-only for 8 of 9 features.** These features have no directories, no spec.md, no tasks.json. They were registered directly in goal.json during the brainstorm-goals directive. This is valid for the conductor pattern (features without physical directories) but means DOD and tasks can't be attached via filesystem — they must live in goal.json itself.

6. **25 done features are missing completed_date.** These need backfilling during migration — use `last_activity` from goal.json or filesystem mtime as fallback.

---

## Execution Plan

### Initiative 1: Schema Evolution + Migration Script

**Priority:** P0 (everything else depends on this)
**Cast:** Sarah (auditor + reviewer) + 1 engineer
**Phases:** build, review
**Scope:** Both repos (sw + agent-conductor)

**What changes:**

#### 1a. Feature objects in goal.json — add 4 fields

```json
{
  "id": "rich-trend-charts",
  "title": "Rich Competitive Trend Charts",
  "status": "done",
  "started": "2026-03-01",
  "completed": "2026-03-02",
  "tasks_total": 6,
  "tasks_completed": 6,
  "source_directive": "rich-trend-charts",
  "source_backlog": null,
  "dod": {
    "criteria": [
      { "text": "Portfolio stacked area chart replaces old line chart", "met": true, "verified_by": "sarah" },
      { "text": "TrendKpiStrip shows 3 prominent metrics", "met": true, "verified_by": "sarah" }
    ]
  },
  "report": "rich-trend-charts-2026-03-02",
  "refs": []
}
```

New fields (all nullable, backward-compatible):
- `source_directive: string | null` — directive ID that created this feature
- `source_backlog: string | null` — backlog item ID (format: "goal-id/item-id") if promoted from backlog
- `dod: { criteria: [{ text: string, met: boolean, verified_by: string | null }] } | null` — structured DOD
- `report: string | null` — report ID (format: "directive-name-YYYY-MM-DD")
- `refs: string[]` — generic reference array for secondary links (URI format: `type:id`)

The CEO decided: **explicit typed fields for primary links** (`source_directive`, `source_backlog`, `report`) + **generic `refs[]` for secondary/miscellaneous links**.

The CEO decided: **structured DOD** with per-criterion verification (`{ criteria: [{ text, met, verified_by }] }`).

#### 1b. Backlog items in backlog.json — add structured references

```json
{
  "id": "trend-visualization",
  "title": "Trend visualization improvements",
  "status": "done",
  "created": "2026-03-02",
  "updated": "2026-03-02",
  "source_directive": "optimize-conductor-workflows",
  "promoted_to_feature": "sellwisely-revenue/rich-trend-charts",
  "promoted_at": "2026-03-01",
  "context": "..."
}
```

Changes to existing fields:
- `source` (free-text) renamed to `source_directive` (directive ID string) — parsed from existing free-text where possible

New fields:
- `promoted_to_feature: string | null` — feature ID when backlog item became a feature
- `promoted_at: string | null` — date of promotion

#### 1c. New file: directive.json (alongside each .md in inbox/ and done/)

```json
{
  "id": "rich-trend-charts",
  "title": "Rich Competitive Trend Charts",
  "status": "done",
  "created": "2026-03-01",
  "completed": "2026-03-02",
  "weight": "standard",
  "goal_ids": ["sellwisely-revenue"],
  "produced_features": ["sellwisely-revenue/rich-trend-charts"],
  "report": "rich-trend-charts-2026-03-02",
  "backlog_sources": ["sellwisely-revenue/trend-visualization"]
}
```

Created for all 31 existing directives (8 inbox, 23 done). Fields:
- `id` — matches the .md filename
- `title` — extracted from .md first heading
- `status` — "pending" for inbox/, "done" for done/
- `created` — file mtime
- `completed` — file mtime for done/ items, null for inbox/
- `weight` — "lightweight" | "standard" | "strategic" (default "standard" for existing)
- `goal_ids` — array of goal IDs this directive serves (parsed from .md content where possible, otherwise empty — backfill manually)
- `produced_features` — array of feature IDs created by this directive (backfilled from report files where possible)
- `report` — report ID if one exists
- `backlog_sources` — backlog items that triggered this directive

#### 1d. Goal-level tasks.json

```json
{
  "scope": "goal",
  "goal_id": "agent-conductor",
  "verify": "npx tsx /Users/yangyang/Repos/agent-conductor/scripts/index-state.ts",
  "tasks": [
    {
      "id": "audit-cross-refs",
      "title": "Audit all cross-references for consistency",
      "status": "pending",
      "role": "sarah"
    }
  ]
}
```

New `tasks.json` at goal root (not inside a feature directory). Distinguished by `"scope": "goal"`. The indexer reads both locations.

#### 1e. tasks.json flat format standardization (new files only)

```json
{
  "feature_id": "rich-trend-charts",
  "goal_id": "sellwisely-revenue",
  "verify": "cd apps/sellwisely && npm run type-check",
  "tasks": [...]
}
```

New tasks.json files use flat format with `feature_id` and `goal_id` at top level. Existing nested-format files in done/ are NOT rewritten (the indexer handles both).

**Migration script scope:**
1. Create `directive.json` for all 31 existing directives (parse .md for title, extract goal_ids where possible)
2. Add `source_directive`, `source_backlog`, `dod`, `report`, `refs` to all 64 features across 17 goal.json files (defaults: null/empty)
3. Parse existing backlog `source` field into `source_directive` for 15 items that have it
4. Backfill `completed_date` on 25 done features missing it (use goal.json `last_activity` or mtime)
5. Add `promoted_to_feature` to backlog items where a matching feature exists
6. Script must be idempotent — safe to run multiple times

**DOD:**
```json
{
  "criteria": [
    { "text": "All 17 goal.json files have features with source_directive, source_backlog, dod, report, refs fields", "met": false, "verified_by": null },
    { "text": "All 31 directives have companion directive.json", "met": false, "verified_by": null },
    { "text": "15 backlog items with source field are migrated to source_directive", "met": false, "verified_by": null },
    { "text": "25 features with missing completed_date are backfilled", "met": false, "verified_by": null },
    { "text": "Migration script is idempotent (running twice produces same result)", "met": false, "verified_by": null },
    { "text": "Indexer still runs successfully: npx tsx scripts/index-state.ts", "met": false, "verified_by": null }
  ]
}
```

**Verify:** `npx tsx /Users/yangyang/Repos/agent-conductor/scripts/index-state.ts`

---

### Initiative 2: Indexer Update — Cross-References + Reverse Map

**Priority:** P0 (must ship with Initiative 1)
**Cast:** Sarah (auditor + reviewer) + 1 engineer
**Phases:** build, review
**Scope:** agent-conductor repo only (scripts/index-state.ts)

**What changes:**

1. **Read directive.json** files from inbox/ and done/ alongside the .md files. Populate `DirectiveRecord` with structured data (goal_ids, produced_features, report, weight, etc.) instead of only parsing .md headings.

2. **Read new feature fields** (source_directive, source_backlog, dod, report, refs) and expose them in `FeatureRecord` in features.json.

3. **Read new backlog fields** (source_directive, promoted_to_feature) and expose in `BacklogRecord`.

4. **Build reverse-reference map** at index time:
   - For each directive with `produced_features`, add `directive_id` to each feature's record
   - For each feature with `source_backlog`, add `promoted_to_feature` to the backlog item
   - Compute `directive → features`, `goal → directives`, `backlog_item → feature` reverse maps
   - Expose as a new `references.json` state file or embedded in existing files

5. **Support goal-level tasks.json** — read tasks.json at goal root (where `scope === "goal"`) and include in task counts.

6. **Add validation warnings** for:
   - Features with no `source_directive` and no `source_backlog` (orphan features)
   - Directives with empty `goal_ids` (orphan directives)
   - Active features missing DOD

**DOD:**
```json
{
  "criteria": [
    { "text": "Indexer reads directive.json and populates DirectiveRecord with structured fields", "met": false, "verified_by": null },
    { "text": "features.json includes source_directive, source_backlog, dod, report, refs on every feature", "met": false, "verified_by": null },
    { "text": "backlogs.json includes source_directive, promoted_to_feature on items", "met": false, "verified_by": null },
    { "text": "Goal-level tasks.json (scope=goal) are read and counted", "met": false, "verified_by": null },
    { "text": "Reverse references are computed (directive->features, feature->directive, backlog->feature)", "met": false, "verified_by": null },
    { "text": "Validation warnings printed for orphan features and directives", "met": false, "verified_by": null },
    { "text": "Indexer runs clean on both sw/ and agent-conductor/ context paths", "met": false, "verified_by": null }
  ]
}
```

**Verify:** `npx tsx /Users/yangyang/Repos/agent-conductor/scripts/index-state.ts && npx tsx /Users/yangyang/Repos/agent-conductor/scripts/index-state.ts --context-path /Users/yangyang/Repos/sw/.context`

---

### Initiative 3: Backfill Cross-References on Known Entities

**Priority:** P1 (valuable but not blocking)
**Cast:** 1 engineer (with Sarah review)
**Phases:** build, review
**Scope:** Both repos

After the schema and indexer are updated (Initiatives 1+2), populate the actual reference data for known relationships:

1. **directive.json goal_ids backfill** — for the 23 done directives, read the .md content and report files to extract which goals they served. Many directive names match feature names (e.g., "rich-trend-charts" directive → sellwisely-revenue goal). Script can auto-match ~70%, remainder needs manual review.

2. **directive.json produced_features backfill** — for done directives, cross-reference report filenames with features in goal.json. When a feature ID matches a directive ID, that's a produced_feature.

3. **Feature source_directive backfill** — for done features where the feature ID matches a directive name, set source_directive automatically.

4. **Backlog promoted_to_feature backfill** — for done backlog items, check if a matching feature exists (by title similarity or ID match).

5. **DOD backfill for recent features** — for features completed in the last 30 days, extract DOD criteria from the report .md files where available.

**DOD:**
```json
{
  "criteria": [
    { "text": ">80% of done directives have populated goal_ids", "met": false, "verified_by": null },
    { "text": ">60% of done directives have populated produced_features", "met": false, "verified_by": null },
    { "text": ">50% of done features have source_directive set", "met": false, "verified_by": null },
    { "text": "Backfill script is idempotent", "met": false, "verified_by": null },
    { "text": "Indexer runs clean after backfill", "met": false, "verified_by": null }
  ]
}
```

**Verify:** `npx tsx /Users/yangyang/Repos/agent-conductor/scripts/index-state.ts`

---

## Sequencing

```
Phase 1 (this directive):
  Init 1 (Schema + Migration) ──┐
                                 ├── sequential, same engineer
  Init 2 (Indexer Update) ───────┘
  Init 3 (Backfill) ── after Init 1+2 pass review

Phase 2 (separate directive — NOT in scope):
  - Update SKILL.md pipeline to write references at each transition
  - Update /directive skill to create directive.json on triage
  - Update /directive skill to populate source_directive on features at completion
  - Update /directive skill to populate DOD from Morgan's plan
  - Update /report skill to link reports to directives
```

**Rationale for phasing:** Phase 1 is schema + data. Phase 2 is behavior change in the pipeline. Combining them in one directive risks scope creep and makes review harder. Phase 1 is valuable standalone — the CEO gets queryable cross-references immediately.

---

## Cast Summary

| Role | Agent | Scope |
|------|-------|-------|
| Auditor | Sarah | Pre-build: validate schema design against current data. Post-build: review all changes |
| Planner | Morgan | This plan (already done) |
| Engineer | 1 unnamed | All 3 initiatives (sequential) |
| Reviewer | Sarah | Code review + DOD verification |

Solo engineer is sufficient. The work is schema updates (JSON edits), a migration script (TypeScript), and indexer modifications (TypeScript). No product review needed (no UI), no multi-agent coordination needed.

---

## Files Modified

### agent-conductor repo
- `scripts/index-state.ts` — indexer updates (Init 2)
- `.context/inbox/*.json` — new directive.json files (Init 1)
- `.context/done/*.json` — new directive.json files (Init 1)
- `.context/goals/agent-conductor/goal.json` — feature schema additions (Init 1)
- `.context/goals/conductor-review-quality/goal.json` — feature schema additions (Init 1)
- `.context/goals/conductor-ux/goal.json` — feature schema additions (Init 1, if exists)

### sw repo
- `.context/goals/*/goal.json` — all 14 native goal.json files updated (Init 1)
- `.context/goals/*/backlog.json` — all 14 backlog.json files updated (Init 1)
- `.context/state/*.json` — regenerated by indexer (Init 2)

### New files
- `scripts/migrate-cross-references.ts` — one-time migration script (Init 1)
- `scripts/backfill-references.ts` — reference backfill script (Init 3)
- `.context/inbox/*.json` — 8 new directive.json files
- `.context/done/*.json` — 23 new directive.json files

---

## What This Does NOT Cover (deferred to Phase 2 directive)

1. SKILL.md pipeline changes to auto-populate references
2. Dashboard UI for cross-reference navigation
3. feature.json as separate files (not needed — features live in goal.json)
4. Lifecycle history tracking (transition logs)
5. Reverse-reference navigation in the conductor dashboard

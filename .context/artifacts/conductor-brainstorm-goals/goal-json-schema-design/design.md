# Design: goal.json Schema + 3 Pilots

## Schema

```typescript
interface GoalJson {
  id: string;           // kebab-case, matches folder name
  title: string;        // human-readable
  state: 'exploring' | 'active' | 'paused' | 'done';
  category?: string;    // optional grouping (e.g., "product", "infrastructure", "framework")
  created: string;      // ISO date
  target_date?: string; // ISO date, optional
  description: string;  // 1-2 sentence summary
  okrs_file?: string;   // relative path to okrs.md if exists
  features: FeatureEntry[];
  last_activity: string; // ISO date of most recent change
}

interface FeatureEntry {
  id: string;           // kebab-case, matches folder name
  title: string;        // human-readable
  status: 'active' | 'done';
  tasks_total?: number;
  tasks_completed?: number;
  completed_date?: string; // ISO date, only for done features
}
```

## Design Decisions

1. **Features array replaces directory convention**: Instead of relying on `active/` and `done/` directories, features are listed with a `status` field. Directories still exist for spec/tasks files, but the source of truth for status is goal.json.

2. **Lightweight fields**: Only fields that the indexer and dashboard need. No deep nesting, no embedded specs. Tasks stay in `tasks.json` per feature; goal.json just summarizes counts.

3. **State lifecycle**: `exploring → active → paused → done`. Most goals start as `active`. Use `exploring` for early-stage goals with no active features yet. `paused` for goals temporarily deprioritized.

4. **Backlog frontmatter**: Replace HTML comment `<!-- last-reviewed: date -->` with machine-readable YAML frontmatter. Not part of goal.json — backlog.md keeps its own metadata.

5. **okrs_file reference**: Points to the existing okrs.md file. Goal-level OKRs stay — only directive-level KRs are killed.

## 3 Pilot Goals

### agent-conductor
- Complex goal with OKRs, large backlog, no active/ or done/ directories
- Tests: OKR reference, empty features array, category field

### sellwisely-revenue
- Has both active (1) and done (10) features with tasks.json data
- Tests: mixed feature statuses, task counts from real tasks.json files

### platform
- Has no active features, no done directory, backlog with done items
- Tests: goal with no features array (or empty), backlog-only structure

## Migration Notes (for initiative 4)

1. Read goal.md to extract title, description
2. Scan active/ and done/ directories for features
3. Read tasks.json per feature to get task counts
4. Check for okrs.md
5. Determine state from _index.md status column
6. Write goal.json
7. Validate with type-check after indexer update

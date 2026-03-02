# Context System Redesign — From File Store to Ticketing System

## Problem

The .context/ system is a collection of loosely-connected files. Nothing links to anything else. When a directive ships, the feature entry in goal.json has no link to the directive, no link to the report, no link to the discussion that spawned it. The report references files by path but nothing is queryable. Backlogs have "source" fields but they're free-text strings, not real references.

The CEO keeps finding gaps: "where is the feature for this?", "where is the spec?", "what directive created this?" — and the answer is always "it's somewhere in the markdown files." This is the write-once graveyard problem all over again, just with JSON instead of markdown.

## CEO Direction

"Treat it as a ticketing system, not just context md stores. All context needs to be linked — discussions, goals, tasks, backlogs. Design the DOD system. Where are tasks.json? Something wrong with the design or we just haven't migrated?"

## What's Wrong (diagnosis needed)

1. **No cross-references**: goal.json features don't link to directives. Directives don't link to reports. Backlogs don't link to the goals they belong to (well, goal_id exists but nothing links back). Discussions are orphaned markdown files.

2. **Inconsistent structure**: Some goals have active/done/feature directories with spec.md + tasks.json. Others (like agent-conductor) have 9 features in goal.json with zero directories, zero specs, zero tasks. The system supports both patterns but doesn't enforce either.

3. **No DOD system**: Definition of Done exists in Morgan's plan JSON and in the directive report, but it's not persisted anywhere queryable. After the directive finishes, the DOD is buried in a report file.

4. **tasks.json is feature-level only**: Tasks exist inside `goals/{goal}/active/{feature}/tasks.json`. But what about goal-level tasks? Backlog items that become tasks? There's no task system outside of feature directories.

5. **No lifecycle tracking**: When does a backlog item become a feature? When does a feature become active? When is it done? The transitions aren't recorded — you just find the item in its current state with no history.

## Deliverables

This is a STRATEGIC directive. The team should brainstorm approaches before Morgan plans.

### Required outcomes:
1. **Cross-reference schema**: Every entity (goal, feature, backlog item, directive, report, discussion) can reference any other entity by ID. References are bidirectional and queryable.
2. **Consistent feature lifecycle**: Clear path from backlog item → directive → feature → tasks → done, with links at every transition.
3. **DOD persistence**: Definition of Done is a first-class field on features, not buried in reports.
4. **Task system design**: Where do tasks live? Only in features? Goal-level? How do they relate to backlogs?
5. **Migration plan**: Move existing data to the new structure without losing anything.
6. **Indexer update**: index-state.ts reads and exposes all cross-references.

### Constraints:
- JSON for structured data, markdown for content (this principle is settled)
- Must work with the current conductor dashboard
- The indexer must remain a standalone script (no runtime dependencies)
- Don't break symlinks between sw and agent-conductor
- Sarah's architectural opinion carries extra weight on schema design

## Success Criteria
- Every feature in goal.json links to its source (directive, backlog item, or CEO request)
- Every directive in done/ links to the features it produced
- Every report links to its directive and the features/tasks it covers
- The CEO can start from any entity and navigate to all related entities
- tasks.json exists for every active feature (not optional)
- DOD is queryable from goal.json features, not buried in reports
- The indexer exposes cross-references in state/*.json

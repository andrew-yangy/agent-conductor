# Build: Update State Indexer for goal.json

## Changes to scripts/index-state.ts

1. **GoalRecord interface**: Added `category?: string`, `goalState?` (exploring/active/paused/done), `hasGoalJson: boolean`
2. **GoalJsonFile interface**: New interface matching goal.json schema
3. **mapGoalJsonState()**: Maps goal.json states to LifecycleState (active→in-progress, exploring→pending, paused→deferred, done→done)
4. **Goal loop**: Reads goal.json first, uses as preferred source for title, description, status, dates, category. Falls back to inventory.json/goal.md when absent.
5. **index.json counts**: Added `goalsWithJson` count

## Verification
- Indexer runs successfully: 16 goals, 55 features, 542 tasks, 206 backlog items
- All 16 goals show hasGoalJson=true, category populated, goalState populated
- goalsWithJson: 16/16 in index.json

## Proposed Improvements
1. Add targetDate to GoalRecord from goal.json target_date
2. Cross-validate goal.json features vs directory scanner findings
3. Add console summary line for goalsWithJson count

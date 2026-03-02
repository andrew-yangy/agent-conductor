# Clean Up Projects Page

## Problem

The projects page in the conductor dashboard has grouping issues:
1. **"Other" project is a mess** — contains 2 conductor-related projects (conductor-review-quality, conductor-ux) that should be grouped under the "Conductor" project group
2. **Open and Done counts show 0** for both conductor projects — the counts are wrong, these goals have features and backlog items

## CEO Direction

Fix the project grouping logic so conductor goals are grouped under "Conductor" (not "Other"). Fix the open/done feature counts so they reflect actual data from goal.json.

## Deliverables

1. Conductor goals (agent-conductor, conductor-review-quality, conductor-ux) grouped together on the projects page
2. Open/done counts reflect actual feature counts from goal.json
3. No "Other" catch-all group containing conductor projects

## Constraints

- This is a dashboard fix (agent-conductor repo, likely server/ or UI code)
- Don't change the goal.json schema — fix the display/grouping logic

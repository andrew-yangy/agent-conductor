# Build: Migrate All Goals to goal.json

## Files Created (13 new + 3 existing pilots = 16 total)

All 16 goal folders now have goal.json files.

| Goal | State | Active | Done | OKRs |
|------|-------|--------|------|------|
| agent-conductor | active | 0 | 0 | yes |
| ai-powered-apps | active | 4 | 1 | no |
| buywisely-growth | active | 0 | 2 | no |
| buywisely-modernize | active | 0 | 3 | no |
| buywisely-security | active | 0 | 0 | yes |
| competitor-intelligence | active | 0 | 1 | no |
| conductor-review-quality | active | 0 | 0 | yes |
| data-enrichment | exploring | 0 | 0 | no |
| database-ops | active | 0 | 1 | no |
| developer-productivity | active | 0 | 4 | no |
| global-expansion | active | 2 | 4 | no |
| growth-marketing | active | 3 | 8 | no |
| platform | active | 0 | 10 | no |
| pricesapi-launch | exploring | 0 | 0 | no |
| scraper-product-discovery | active | 0 | 1 | no |
| sellwisely-revenue | active | 1 | 10 | no |

## Ambiguities
- buywisely-growth, buywisely-modernize: "In progress" in _index.md but 0 active features (all done)
- database-ops: _index.md lists cold-storage-scaling as active but no folder exists
- buywisely-security: "In progress" but has zero features (only okrs.md and goal.md)
- Task counts only reliable for 1 feature across all 13 goals (buywisely-migration: 6/6)

## Proposed Improvements
1. Stale state detection script (active goals with 0 active features)
2. Task count standardization (flat tasks[] vs features[] inconsistency)
3. Cross-check _index.md claims against actual directories
4. Derive created/last_activity dates from git history

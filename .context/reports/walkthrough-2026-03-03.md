# Walkthrough Report — 2026-03-03

## Scenario: Projects Portfolio Overview

**Actor**: CEO | **Goal**: Get a complete picture of all goals, features, backlogs, status, and details from one page

### Ideal vs Actual

| Step | Ideal | Actual | Status |
|------|-------|--------|--------|
| 1. Navigate to /projects | Sidebar link, page loads | Route exists, lazy-loaded, sidebar highlights | match |
| 2. Summary header | Counts + freshness | All 4 metrics + "Updated X ago" | match |
| 3. Active Work section | Flat in-progress + blocked | Yellow card with icons, goals, bars | match |
| 4. Goal groups | Named groups with progress | 6 groups + auto "Other", auto-expand | match |
| 5. Expand group | Status, OKR, warnings, counts | GoalCard with all indicators | match |
| 6. Expand goal | Features by status | Three sections with spec/design indicators | match |
| 7. Expand feature | Spec summary, tasks, ID | Inline expansion with deep-link support | match |
| 8. Backlog section | Priority-sorted items | Three-tier with expandable rows | match |
| 9. Issue warnings | Yellow triangle on goals | Visible at collapsed and expanded level | match |
| 10. Full scan | Complete mental model <60s | Consistent hierarchy and color coding | match |

### Gaps Found: 6

1. **[major] Fallback view is a stub** — FallbackProjectsPage shows placeholder text instead of rendering goalInventory data when state indexer JSON isn't available.
2. **[minor] Hardcoded goal groups** — GOAL_GROUPS in ProjectsPage.tsx requires manual edits for new goals.
3. **[minor] No blocked items summary** — Blocked features mixed into Active Work with no separate count.
4. **[minor] No search/filter** — Can't filter goals by status or search features on the page.
5. **[minor] Silent fetch failure** — API errors swallowed with empty .catch(). No error state shown.
6. **[cosmetic] No manual refresh button** — Data only refreshes via WebSocket or page navigation.

### Working Well

- Full hierarchy (Group -> Goal -> Feature/Backlog) with collapsible components
- Active Work card surfaces in-flight work with zero clicks
- Consistent color coding (yellow=active, green=done, red=blocked)
- Deep-linking via ?expand= and ?highlight= query params
- Real-time WebSocket updates
- Backlog priority sorting and three-tier grouping
- Issue warnings visible at both collapsed and expanded level
- Feature rows pack good information density

## Participants

- Marcus Rivera (CPO) — ideal experience design
- Sarah Chen (CTO) — actual system trace

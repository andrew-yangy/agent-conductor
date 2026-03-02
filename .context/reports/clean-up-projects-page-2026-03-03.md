# Directive Report: Clean Up Projects Page

**Date**: 2026-03-03
**Directive**: clean-up-projects-page
**Classification**: Lightweight
**Executed by**: Alex → Engineer agent

## Summary

Fixed conductor goals being misplaced in "Other" group on the Projects page. All 3 conductor goals now correctly appear under the "Conductor" group.

## Change

**File**: `src/components/projects/ProjectsPage.tsx` (line 65)

The Conductor project group's `goalIds` array only included `agent-conductor`, causing `conductor-review-quality` and `conductor-ux` to fall into the "Other" catch-all group.

**Fix**: `goalIds: ['agent-conductor']` → `goalIds: ['agent-conductor', 'conductor-review-quality', 'conductor-ux']`

## Verification

Browser-verified at `http://localhost:4444/projects`:
- Conductor group shows 3 goals with correct counts (0 open, 10 done, 38 backlog)
- No "Other" group exists
- All 17 goals properly categorized across 6 groups

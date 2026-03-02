# Report: Fix Subagent Status Propagation
**Date**: 2026-03-03
**Directive**: fix-subagent-status-propagation
**Status**: Completed

## Summary

Added bidirectional status propagation between parent and subagent sessions in the aggregator, and updated frontend components to use propagated status for accurate org page, dashboard, and recent activity display.

## Changes

### Backend (server/state/aggregator.ts)
- Added `propagateSubagentStatuses()` function that runs after normal status derivation
- **Parent -> Subagent**: When parent is "working", stale subagents (idle/paused) get upgraded to "working"
- **Subagent -> Parent**: When any subagent has error/waiting status, parent gets `subagentAttention: true`
- **Reverse propagation**: When parent is "idle" but subagents have recent activity (<5 min), parent upgrades to "working"
- Propagation called in 3 places: `buildSessionsFromFileStates()`, `rederiveSessionStatuses()`, `updateSessionFromFileState()`
- Only upgrades statuses, never downgrades -- preserves existing status logic

### Type Changes (server/types.ts + src/stores/types.ts)
- Added `subagentAttention?: boolean` to Session -- surfaces subagent error/waiting states on parent
- Added `activeSubagentNames?: string[]` to Session -- names of working subagents for display

### Frontend (OrgPage.tsx)
- Updated `deriveAgentStatus()` to check `activeSubagentNames` on working parent sessions
- Agent shows "working" if any parent session lists it in `activeSubagentNames`, even if the agent's own session JSONL is stale

### Frontend (DashboardPage.tsx)
- Attention count now includes parent sessions with `subagentAttention: true`
- Active count already reflects propagated status (subagent sessions promoted to "working" server-side)

### Frontend (RecentActivity.tsx)
- Working parent sessions show active subagent names (e.g., "Sarah, Morgan working")
- Displayed as green text next to the session title

## Verification
- `npx tsc --noEmit` -- passes clean
- `npx vite build` -- passes clean

## Files Modified
1. `server/state/aggregator.ts` -- propagateSubagentStatuses() function + 3 call sites
2. `server/types.ts` -- Session type: subagentAttention, activeSubagentNames
3. `src/stores/types.ts` -- Session type: subagentAttention, activeSubagentNames
4. `src/components/org/OrgPage.tsx` -- deriveAgentStatus() uses parent propagation
5. `src/components/dashboard/DashboardPage.tsx` -- attention count includes subagent attention
6. `src/components/dashboard/RecentActivity.tsx` -- shows active subagent names

# Directive: Fix Subagent Status Propagation

**Source**: CEO observation — org page only shows Alex as working when other agents are active inside his session
**Priority**: P0

## Problem

When Alex spawns named subagents (Sarah, Marcus, Morgan, Riley, etc.), each gets a JSONL file under `{parentSession}/subagents/agent-{name}.jsonl`. Status is derived from file modification time. But subagent files are written once at spawn and rarely updated — so after 5 minutes they show "paused", after 1 hour "idle", even though the agent is actively working inside the parent session.

This affects every surface that shows session/agent status:

| Surface | Impact |
|---------|--------|
| **Org page** | Named agents show "idle"/"offline" when they're actively working |
| **Dashboard stats** | Active session count wrong (parent "idle" while subagents work) |
| **Dashboard attention** | Missing errors if subagent has error but parent is stale |
| **Kanban board** | Subagent cards in wrong columns (idle instead of working) |
| **Session tree** | Wrong sort order, stale status indicators |
| **Recent activity** | Parent shows idle while subagents are busy |

## Root Cause

`deriveSessionStatus()` in `server/state/aggregator.ts` treats parent and subagent sessions independently. No logic aggregates subagent status into the parent, or propagates parent activity to child agents.

## Fix

Propagate status bidirectionally in the aggregator:

1. **Parent → Subagent**: If a parent session is "working" and has active subagentIds, mark those subagent sessions as "working" too (they're active inside the parent's context)
2. **Subagent → Parent**: If any subagent has status "error" or "waiting-input", surface that on the parent session (or at minimum, in the parent's metadata so the dashboard can show attention needed)
3. **Org page derivation**: When deriving agent status in `buildAgentSummary()`, also check if the agent has active subagent sessions inside a working parent — if the parent is working and lists this agent as a subagent, the agent is working

## Files to Change

- `server/state/aggregator.ts` — `buildSessionsFromFileStates()` (add status propagation after building parent-child map), `deriveSessionStatus()` or a new `propagateSubagentStatuses()` function
- `server/state/aggregator.ts` — `rederiveSessionStatuses()` (add propagation pass after individual re-derivation)
- `src/components/org/OrgPage.tsx` — `deriveAgentStatus()` (consider parent session activity when determining agent status)
- `src/components/dashboard/DashboardPage.tsx` — active/attention counts should reflect propagated status
- `src/components/dashboard/RecentActivity.tsx` — parent activity should reflect subagent work

## Definition of Done

1. When Alex is "working" and has spawned Sarah as a subagent, Sarah shows "working" on the org page
2. When a subagent has "error" status, the parent session surfaces that in dashboard attention
3. Dashboard active session count reflects real activity (not stale file times)
4. Kanban board shows subagent cards in correct status columns
5. Session tree sorts correctly based on propagated status
6. Type-check passes (`npx tsc --noEmit`)
7. Build passes (`npx vite build`)

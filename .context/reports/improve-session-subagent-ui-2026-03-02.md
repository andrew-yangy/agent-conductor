# Directive Report: improve-session-subagent-ui

**Date**: 2026-03-02
**Classification**: Medium (frontend-only, single system)
**Status**: Completed

## Summary

Improved the session page UI to display sub-agent information with proper cards, named agent detection, and visual hierarchy. The existing flat subagent list has been upgraded to structured mini-cards with named agent identity badges and tree-view connecting lines.

## Key Changes

### 1. Named Agent Detection (Server-Side)

Added server-side parsing to detect named agents (Sarah, Morgan, Marcus, Priya, Alex) from the initial prompt of subagent JSONL files. Detection patterns:
- "You are {FirstName} {LastName}, {Role}" (primary pattern)
- Personality file headers ("# {Name} --- {Role}")
- Known agent first name matching

New fields added to `Session` type: `agentName`, `agentRole`

### 2. Enhanced Subagent Cards (KanbanCard)

- Named agents display with a `User` icon, bold name, and color-coded role badge
- Unnamed/engineer agents show with a `Bot` icon and their initial prompt
- Proper mini-card borders with status/model/time on a separate row
- Vertical connecting line in the subagent list for visual hierarchy
- Subagents sorted: named first, then by status (working first)
- Trigger line shows named agent names ("Alex, Morgan + 2 more") instead of just count

### 3. Improved Tree View (SessionTree)

- Named subagents render as bordered cards with agent identity prominently displayed
- Horizontal connector lines between parent-child relationships
- Thicker left border line (2px) for clearer hierarchy
- Named vs unnamed subagents visually distinguished

### 4. Updated SessionCard Compact Mode

- Compact mode shows named agent badge with role for subagents
- Expanded details panel includes Agent row with name + role badge
- Parent session ID shown in expanded details

## Files Modified

**Server (data model + parsing)**:
- `server/types.ts` -- Added `agentName`, `agentRole` to Session interface
- `server/parsers/session-scanner.ts` -- Added `extractAgentIdentity()`, `extractAgentIdentityFromFile()`, known agent registry
- `server/parsers/session-state.ts` -- Import new functions, extract identity during bootstrap, added `agentName`/`agentRole` to SessionFileState
- `server/state/aggregator.ts` -- Pass `agentName`/`agentRole` when building sessions and updating from file state

**Frontend (UI components)**:
- `src/stores/types.ts` -- Added `agentName`, `agentRole` to Session interface
- `src/components/sessions/KanbanCard.tsx` -- Complete rewrite of subagent section with SubagentCard component, named agent badges, connecting lines
- `src/components/sessions/SessionCard.tsx` -- Updated compact mode for named agents, added Agent row in expanded details, color-coded role badges
- `src/components/sessions/SessionTree.tsx` -- Enhanced subagent hierarchy with connector lines, named agent card treatment

## Agent Badge Colors

Each known named agent has a distinct color:
- Alex (Chief of Staff): Blue
- Sarah (CTO): Emerald
- Morgan (COO): Purple
- Marcus (CPO): Amber
- Priya (CMO): Pink
- Unknown agents: Default secondary

## Verification

- `npx tsc --noEmit`: Pass
- `npx vite build`: Pass (1.89s)

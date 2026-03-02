# Team Org Dashboard -- Execution Plan

## Classification: Medium
- Frontend-only changes, no backend needed
- Existing session data already has agentName/agentRole fields
- Dashboard changes only -- no production risk

## Auto-approved (medium complexity)

## Initiatives Executed

### 1. Org Page (`/org`)
- CEO node at top with session count
- C-suite grid with status indicators (working/waiting/idle/offline)
- Each card shows: name, title, role, status dot, session count, current work preview, domains
- Cards link to agent detail pages
- Engineer pool section showing spawned subagents
- Sorted by status priority (working first)

### 2. Agent Detail Page (`/org/:agentId`)
- Back navigation to /org
- Agent header with avatar, name, role, status badges
- Description card with domain tags
- Tabbed interface:
  - Sessions: parent sessions with status, prompts, git branch, quick actions, focus buttons
  - Engineers: subagent sessions spawned by this agent
  - Activity: recent hook events for this agent's sessions

### 3. Routing & Navigation
- Sidebar: "Team" entry with Users icon, positioned right after Dashboard
- Routes: `/org` and `/org/:agentId` with lazy loading
- All components code-split

## Files Created
- `src/components/org/agent-config.ts` -- static agent hierarchy config
- `src/components/org/OrgPage.tsx` -- org hierarchy page
- `src/components/org/AgentDetailPage.tsx` -- individual agent detail

## Files Modified
- `src/router.tsx` -- added OrgPage and AgentDetailPage routes
- `src/components/layout/Sidebar.tsx` -- added Team nav item

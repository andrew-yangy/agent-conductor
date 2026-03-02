# Improve Session Page: Sub-Agent Cards & Hierarchy

We now have a structure of spawning/chaining agents, and some of them are named ones. We need to improve the UI for the session page so that we can easily see all the sub-agent info.

## Requirements

- Each sub-agent should have its own card with all its info, including:
  - Agent name (if it's a named agent like Sarah, Morgan, etc.)
  - Agent role/type
  - Status (running, completed, etc.)
  - Parent agent relationship (which agent spawned it)
- The hierarchy of agent spawning should be visually clear
- Users should be able to see the chain of agents at a glance

## Success Criteria

- Sub-agents are displayed as individual cards on the session page
- Named agents show their names prominently
- Parent-child relationships between agents are clearly visible
- The UI handles multiple levels of nesting gracefully

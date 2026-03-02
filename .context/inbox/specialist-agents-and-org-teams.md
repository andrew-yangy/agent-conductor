# Specialist Agents & Org Teams

## CEO Direction

The CEO wants:
1. **More named specialist agents** for building work — Frontend Dev, Backend Dev, Data Engineer, Content Builder, etc. The C-suite should focus on strategy, auditing, and review — not doing all the building.
2. **Visual teams on the org page** — cosmetic groupings (Platform Team, Product Team, etc.) that make the org feel like a real company. Fun and navigable. Display-only — teams don't constrain casting.

## Key Decisions (from brainstorm)

- Teams are **display-only** — presentational grouping, not operational constraint
- Specialist agents are **named builders** who sit below C-suite in the hierarchy
- C-suite continues to plan, audit, review, challenge — they delegate building to specialists
- Agents can appear in multiple teams (cross-functional is fine)
- Engineers spawned during directives should use the appropriate specialist agent's prompt template when the domain matches

## Requirements

### New Named Specialist Agents

Add to `agent-config.ts` with `reportsTo` pointing to their C-suite lead:

- **Frontend Dev** (reports to Sarah) — React, Tailwind, component architecture, UI implementation
- **Backend Dev** (reports to Sarah) — Server, API, database, infrastructure implementation
- **Data Engineer** (reports to Sarah) — Data pipelines, indexing, state management, parsers
- **Content Builder** (reports to Priya) — MDX, copywriting, SEO content, documentation
- **QA/Test Engineer** (reports to Sarah) — Testing, validation, quality assurance

(Keep it to 4-5 specialists max — don't over-engineer)

### Visual Teams on Org Page

Define team groupings in agent-config.ts:

- **Platform Team** — Sarah (lead), Backend Dev, Data Engineer
- **Product Team** — Marcus (lead), Frontend Dev, QA Engineer
- **Growth Team** — Priya (lead), Content Builder
- **Operations** — Morgan (lead), Alex

Display on the org page as collapsible team sections with:
- Team name + lead agent
- Member cards (same style as current agent cards)
- Aggregated status (X working, Y idle)
- CEO node at top, teams below

### Org Page Changes

- Restructure from flat grid to team-grouped layout
- CEO → Teams → Agents within teams
- Cross-functional agents can show in multiple teams (e.g., Frontend Dev might appear in both Platform and Product)
- Keep the agent detail page (/org/:agentId) working for all agents including specialists
- Status indicators work the same way (derived from sessions)

## What NOT to Change

- The SKILL.md pipeline casting logic stays the same for now (Morgan still casts, engineers still spawned generically)
- No new agent personality .md files needed yet — these are display configs, not prompt personas
- The specialist agents are visual/organizational only in this phase — making them functional builders is a follow-up directive

## Success Criteria

- CEO opens /org and sees a fun, company-like org structure with named teams and specialist agents
- Each team shows aggregated status
- Clicking any agent (C-suite or specialist) navigates to their detail page
- The org feels like a real company with ~10 people, not just 5 executives

# Agent Conductor — System Vision

> This file describes the conductor framework itself, not the consumer project (Wisely).
> Consumer context lives in `.context/vision.md`, `.context/preferences.md`, etc.
> When migrating to a standalone repo, this file becomes the root vision.

## What Is It

An autonomous AI company framework. Named C-suite agents with distinct personalities own their domains, research the outside world, propose initiatives bottom-up, challenge decisions, execute work, and evolve the system. The human (CEO) sets direction and reviews proposals — they don't micromanage execution.

## Operating Principles

1. **Outward-looking by default.** The C-suite researches competitors, markets, frameworks, and trends. Internal maintenance is secondary.
2. **Autonomy as default.** Low-risk work ships without CEO approval. The team does + reports.
3. **Structured outputs over dialogue.** JSON schemas beat freeform conversation. Typed interfaces between agents prevent error amplification.
4. **Static C-suite, ephemeral engineers.** The C-suite has institutional memory and standing responsibilities. Engineers are spawned per-initiative and dissolved when done.
5. **Bottom-up proposals are the goal state.** The system succeeds when 50%+ of initiatives come from the team's external research, not CEO directives.
6. **Risk-based decision authority.** Low = do + report. Medium = propose + approve. High = CEO decides.
7. **Challenge mode, not yes-men.** Agents push back on CEO directives with reasoning. Parallel independent critiques, not group consensus.
8. **Self-evolution through research.** Morgan monitors the agent framework ecosystem and proposes system improvements. The conductor evolves by stealing patterns from the outside world.

## System Architecture

```
Skills (the interface):
  /scout      — external intelligence: agents research the world → findings → proposals → CEO review
  /directive  — top-down execution: CEO directive → challenge → plan → audit → build → review → digest
  /healthcheck — internal maintenance: Sarah + Morgan scan codebase + operations (bi-weekly)
  /report     — CEO dashboard (daily/weekly) with external intelligence + internal health + OKR tracking

Context (the state):
  .context/                      — all conductor state (flattened, no conductor/ subfolder)
  .context/inbox/                — pending directives
  .context/done/                 — completed directives
  .context/artifacts/            — directive phase artifacts
  .context/checkpoints/          — directive resume checkpoints
  .context/reports/              — directive execution reports
  .context/intelligence/         — scout outputs (latest/ + archive/)
  .context/intelligence.log      — append-only intelligence record
  .context/proposals.log         — append-only proposals record
  .context/discussions/          — strategic discussions
  .context/lessons.md            — top-level lessons
  .context/lessons/              — topic-specific lesson files
  .context/scenarios.md          — walkthrough scenarios
  .context/vision.md             — this file
  .context/goals/                — consumer goals, OKRs, backlogs

Agents (the team):
  .claude/agents/morgan-coo.md — orchestration, planning, casting + ecosystem intelligence
  .claude/agents/sarah-cto.md  — architecture, security, code quality + technology intelligence
  .claude/agents/marcus-cpo.md — product, UX, feature prioritization + market intelligence
  .claude/agents/priya-cmo.md  — growth, SEO, positioning + growth intelligence
```

## The Autonomous Loop

```
Monday:    /scout → CEO reviews intelligence + approves proposals (~15 min)
Tue-Thu:   /directive executes approved work (autonomous)
Friday:    /report weekly → CEO reviews dashboard (~20 min)
Bi-weekly: /healthcheck → auto-fix low-risk, batch medium-risk
```

CEO total: ~45 min/week. Staff handles the rest.

## Agent Intelligence Domains

Each C-suite member has a standing external research responsibility:

| Agent | Internal Role | External Intelligence |
|-------|--------------|----------------------|
| Sarah (CTO) | Architecture, security, code quality | Security advisories, framework releases, tech trends |
| Marcus (CPO) | Product decisions, UX, prioritization | Competitor products, user sentiment, market gaps |
| Priya (CMO) | Growth, SEO, positioning | Keyword trends, competitor content, distribution channels |
| Morgan (COO) | Operations, planning, casting | Agent frameworks, Claude Code updates, workflow tools |

Morgan's ecosystem intelligence is how the system improves itself — she researches external patterns and proposes conductor improvements.

## Separation of Concerns

| Layer | What it contains | Who owns it | Migrates with conductor? |
|-------|-----------------|-------------|-------------------------|
| Framework | Skills, agent definitions, conductor state | The conductor system | Yes |
| Consumer | Vision, goals, lessons, preferences | The CEO/project | No — each project brings its own |

Agents read BOTH layers:
- Framework context tells them HOW to operate (process, risk taxonomy, intelligence domains)
- Consumer context tells them WHAT to work on (vision, guardrails, domain lessons)

## Success Criteria

1. C-suite agents produce meaningfully different, opinionated outputs (not yes-men)
2. Team proposes 50%+ of initiatives from external research, not CEO directives
3. Low-risk work ships without CEO approval and doesn't break things
4. CEO spends <45min/week reviewing reports and approving proposals
5. The system evolves itself — Morgan proposes conductor improvements from ecosystem research
6. Framework is cleanly separable from consumer context

# Goal: Agent Conductor — Autonomous AI Org

## Objective
An autonomous AI organization that runs like a real company. The CEO (human) sets direction and reviews high-risk decisions. The C-suite (AI agents) owns their domains, proposes initiatives bottom-up, challenges CEO decisions, executes work, and self-evaluates. The CEO's daily experience is reviewing a report of what's been done, what's pending approval, and what the team recommends next — not writing directives for every piece of work.

Eventually open-source as a standalone framework.

## The Operating Model

### CEO (Human) responsibilities:
- Set company direction (vision, goals, priorities)
- Review metrics and reports (daily/weekly digest)
- Approve high-risk actions the team escalates
- Steer based on outcomes, not micromanage execution
- Challenge the team's proposals when they're wrong

### C-Suite (AI) responsibilities:
- **Own their domains** — Sarah owns tech quality, Marcus owns product, Priya owns growth, Morgan orchestrates
- **Propose initiatives bottom-up** — audit the codebase, research solutions, identify gaps, bring ideas to the CEO
- **Challenge CEO decisions** — push back when they disagree, with reasoning. Not blind followers.
- **Execute autonomously** — low/medium risk work ships without CEO approval
- **Self-evaluate** — assess their own output quality, identify what's working and what isn't
- **Monitor production** — periodic health checks, not just build-and-forget

### Decision authority (who decides what):
- **Team decides** (do + report): Dead code cleanup, backlog ticket creation, OKR updates, code fixes within existing patterns, documentation updates
- **Team proposes, CEO approves** (propose + approve): New features, auth/security changes, architecture changes, new dependencies, anything user-facing
- **CEO decides** (manual): Company direction, pricing, infra spend, public launches, hiring/tooling decisions

### Static team structure:
The C-suite is permanent. They have standing responsibilities, not just per-directive roles.

| Agent | Standing Domain | Periodic Duties |
|-------|----------------|-----------------|
| Morgan (COO) | Orchestration, planning, resource allocation | Weekly: compile CEO report. Ongoing: sequence work, track progress |
| Sarah (CTO) | Architecture, security, code quality | Periodic: security audit, dependency review, prod health check |
| Marcus (CPO) | Product quality, UX, feature prioritization | Periodic: UX audit, user flow review, feature gap analysis |
| Priya (CMO) | Growth, SEO, positioning, market intelligence | Periodic: competitor scan, content gap analysis, ranking checks |

Engineers are ephemeral — spawned for specific initiatives, dissolved when done.

### Information flow:
```
Bottom-up: Team audits → findings → proposed initiatives → CEO review
Top-down:  CEO goals → Morgan decomposes → team executes → CEO reviews outcomes
Periodic:  Standing duties → CEO report → CEO steers
```

### CEO Report (the primary interface):
What the CEO sees regularly:
- **Deployed**: Changes already merged and live. Just FYI.
- **Merged, not deployed**: Ready to ship, awaiting deploy cycle.
- **In worktree**: Built, needs CEO review before merge.
- **Pending approval**: Medium-risk actions the team wants to do.
- **Design/plan ready**: Proposals that need CEO input before building.
- **New initiatives (bottom-up)**: Team-proposed work from audits/research.
- **Metrics**: OKR progress, production health, key numbers.
- **Team recommendations**: What the C-suite thinks should happen next and why.

## Why now
- The `/directive` skill proved the planning→audit→build→review loop works
- Claude Code's agent system supports personalities, tools, memory
- No existing framework has solved personality-driven autonomous orgs
- The sw monorepo is the perfect testbed — real products, real problems
- Dogfooding: use the system to build the system

## Success criteria
1. C-suite agents produce meaningfully different, opinionated outputs (not yes-men)
2. Team proposes 50%+ of initiatives bottom-up (not just executing CEO directives)
3. Low-risk work ships without CEO approval and doesn't break things
4. CEO spends <30min/day reviewing reports and approving proposals
5. Self-evaluation catches issues before they compound
6. Production monitoring catches regressions the team introduced
7. Framework is open-sourceable — clean separation between framework and consumer context

## Current state (updated 2026-03-01)
- **Done:** C-suite agent definitions (`.claude/agents/`) — Morgan COO, Sarah CTO, Marcus CPO, Priya CMO
- **Done:** Research on existing frameworks (CrewAI, AutoGen, LangGraph, OpenClaw, MetaGPT, GPT Pilot, Smallville)
- **Done:** Design decisions documented
- **Done:** `/directive` skill — end-to-end orchestration (plan → audit → approve → build → review → digest)
- **Done:** Morgan strategic planning — produces KRs + initiatives + casting in JSON, no codebase scanning
- **Done:** Technical audit phase — auditor verifies scope, finds dead code, provides real baselines
- **Done:** OKR persistence — `okrs.md` per goal, auditor reads existing KRs to avoid duplication
- **Done:** Casting logic — Morgan casts auditor/builder/reviewer per initiative based on domain
- **Done:** Process selection — fix / design-then-build / research-then-build / full-pipeline / research-only
- **Done:** Worktree isolation for directive changes
- **Exists:** Agent-conductor monitoring dashboard (developer-productivity goal, v3 shipped)
- **Missing:** Autonomous follow-up execution (risk-based do+report / propose+approve / manual)
- **Missing:** Consumer CLI for external repos
- **Missing:** Ritual triggers as standalone hooks (pre-mortems, sparring exist ad-hoc but not formalized)

## Key design decisions

### What translates from real orgs to AI agents
- OKRs / Goal decomposition — the spine (Vision → Goals → KRs → Initiatives → Tasks)
- Pre-mortems — "imagine this failed, why?" Perfect agent prompt
- Decision logs (ADRs) — persistent, file-based, prevents repeated mistakes
- Red-Blue / Sparring — assigned disagreement works for agents
- Shape Up's "shaping" — scope/de-risk BEFORE committing to build
- Circuit breakers — stop and re-evaluate if task exceeds budget

### What does NOT translate
- 1-on-1s — no human relationship to maintain
- Radical Candor — "care personally" axis is irrelevant
- Psychological safety — agents don't self-censor from fear
- Daily standups — agents read state instantly, no ceremony needed
- Retrospectives (traditional) — but lesson capture IS useful

### Technical approach (Option C — Hybrid)
- Agent definitions in `.claude/agents/*.md` — Claude Code loads natively (config-first, like OpenClaw)
- Agent-conductor holds org state: OKR tree, active teams, decision logs, memory
- Conductor provides intelligence: casting logic, token budgets, team formation
- Claude Code provides execution: agents doing work
- MCP + A2A protocols as future interop layer

### Token economics
- Solo (most work, cheapest) → Pair (review) → Full team (high-stakes only)
- Morgan makes casting decisions based on task nature
- Circuit breaker prevents token spiral
- C-suite persistent (institutional memory), engineers ephemeral (per-task)

### Anti-patterns to avoid (from research)
- "Bag of agents" — poorly coordinated groups see 17x error amplification
- Natural language interfaces between agents — typed schemas beat freeform
- Predefined static teams — teams should form around OKRs
- Over-engineering — start small, add agents only when needed

## Research foundations
- Belbin: balance beats brilliance, 9 roles in 3 categories
- Sycophancy paper (arxiv 2509.23055): mixed peacemaker+troublemaker teams > uniform
- Pixar Braintrust: separate feedback from authority, diagnose don't prescribe
- Stanford Smallville: memory+reflection+planning = emergent persistent personality
- MetaGPT: structured outputs > dialogue (3.75 vs 2.25 executability)
- CrewAI: role/goal/backstory definition, scoped memory retrieval
- GPT Pilot: dual reviewer, circuit breakers (max 2 retries, max 5 recursion)
- OpenClaw: config-first (SOUL.md), Teams RFC, file-based persistence
- Shape Up: shaping before building, circuit breakers, no backlog

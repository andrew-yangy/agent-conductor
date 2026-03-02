# Team Layer & Specialist Agents Brainstorm

Date: 2026-03-02
Decision: Cosmetic teams + named specialist agents
Participants: Sarah (CTO), Marcus (CPO), Morgan (COO)

## Context

CEO asked whether to add a "team layer" (data team, security team, platform team, UI team) to the org page between CEO and individual agents.

## Options Considered

### Option A: Domain Filter Pills (UI-only)
Horizontal filter pills on the Org page. Quick, no data model changes. All three agents preferred this.

### Option B: Domain-Tagged Work Views
Formalize domains as tags on goals/initiatives. Deeper visibility but more effort.

### Option C: Standing Teams (Display-Only)
Visual team groupings on org page. Cosmetic only. All three agents flagged as weakest option.

## Research Findings

- **Every major multi-agent framework** (CrewAI, AutoGen, MetaGPT, ChatDev) uses dynamic task-scoped grouping, not standing teams
- **GitHub's docs** say skip teams for small orgs (< 10 people)
- **Linear** added sub-teams for 100+ person orgs, not 5-person ones
- **Startup advice** universally says flat structure at 5 people

## Second Question: Specialized Agents

CEO pivoted: "how about more skilled agents? isn't it good to spawn related skills agents rather than COO, CTO, CPO doing all the dirty work?"

### Research on Specialist vs Generalist Agents

- Paper testing 162 personas: personas in system prompts do NOT reliably improve LLM output (effect size 0.004)
- Microsoft guidance: "Don't assume role separation requires multiple agents"
- What improves quality: task-specific instructions + relevant context, NOT persona richness
- Current C-suite agents ARE specialized through context injection (personality files + domain lessons)

### Where Specialization Helps

The engineer build phase — currently generic for all domains. Domain-specific prompt templates (frontend, backend, content) would improve build quality ~10-15%.

## Decision

CEO chose a hybrid approach:
1. **Cosmetic teams on the org page** — "I'm ok with fake just UI teams" — make it feel like a real company
2. **Named specialist agents** — Frontend Dev, Backend Dev, Data Engineer, Content Builder — visual/organizational in this phase
3. **C-suite stays strategic** — plan, audit, review, challenge. Specialists handle building.

## Non-Negotiables (from brainstorm)

- Teams are display-only, don't constrain casting
- Agents can appear in multiple teams
- No new Team types in the data model
- Org page stays scannable
- Cross-functional overlap must work

## Next Steps

- Directive `specialist-agents-and-org-teams` created to implement the visual changes
- Follow-up directive needed to make specialists functional (prompt templates for engineer builds)

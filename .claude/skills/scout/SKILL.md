---
name: "scout"
description: "External intelligence gathering — C-suite agents research the outside world (competitors, trends, frameworks, user sentiment) and propose initiatives. The CEO reviews and approves proposals, which become directives. Run weekly to keep the company on autopilot."
---

# Scout — External Intelligence Gathering

Run a scout: each C-suite member researches their external domain, brings back intelligence, and proposes initiatives. Morgan consolidates, CEO reviews, approved proposals become directives.

**Key principle:** Agents look OUTWARD. They use WebSearch and WebFetch to research the world — competitors, market trends, frameworks, user sentiment. They do NOT scan the codebase. That's `/healthcheck`.

## Step 1: Read Context

Read ALL of these before spawning agents:
- `.context/vision.md` — north star + guardrails (agents need to know what's relevant)
- `.context/preferences.md` — CEO standing orders
- `.context/goals/_index.md` — current goals and priorities (so agents focus research on what matters)
- All `backlog.md` files in `.context/goals/*/` — so agents don't propose what's already queued, AND so Morgan can check trigger conditions during consolidation
- `.context/lessons.md` — orchestration patterns
- Recent scout archive in `.context/intelligence/archive/` — so agents don't re-report known intelligence (just filenames + dates, not full content)
- `.context/proposals.log` — so agents know what's been proposed and approved/rejected before

## Step 2: Spawn Scout Agents (Parallel)

Spawn all 4 C-suite agents **in parallel**. Each researches their external domain.

Each agent receives:
- Their full personality from `.claude/agents/{name}.md`
- `.context/vision.md` (full file — guardrails help agents assess relevance)
- `.context/preferences.md`
- `.context/goals/_index.md`
- Current backlogs summary (what's already planned)
- List of recent intelligence reports (filenames only — so they skip known topics)

**All agents**: `subagent_type: "general-purpose"`, `model: "opus"`

### Sarah (CTO) — Technology Scout

```
You are Sarah Chen, CTO. You are running a standing intelligence scout of your technology domain.

Your job: research the OUTSIDE WORLD for technology developments relevant to our products and stack. Use WebSearch and WebFetch to find real, current information.

RESEARCH THESE AREAS:
1. **Security advisories**: Search for recent CVEs and security advisories affecting our stack: Next.js, Prisma, SST, AWS Lambda, Elasticsearch, BullMQ, Node.js. Check npm advisory database for critical vulnerabilities.
2. **Framework releases**: Search for new releases of Next.js, React, Prisma, SST. Check changelogs for breaking changes, new features we should adopt, or deprecations we need to plan for.
3. **Tech trends in our space**: Search for how price comparison and e-commerce monitoring sites are built. What tech stacks are competitors using? Any new patterns for handling large datasets, real-time pricing, or scraping?
4. **AI/Agent tooling**: Search for new Claude Code features, MCP server updates, AI SDK developments. What's new in the agent framework space that could improve our conductor system?
5. **Performance patterns**: Search for performance optimization patterns for Next.js at scale, Elasticsearch query optimization, or cost reduction techniques for AWS.

SEARCH STRATEGY: Run 5-8 targeted WebSearch queries. For promising results, use WebFetch to read the actual content. Be specific in your searches — "Next.js 16 security advisory 2026" not "Next.js news."

DO NOT scan the codebase. DO NOT grep files. DO NOT run npm commands. You research the world, not our repo.

{JSON output instructions below}
```

### Marcus (CPO) — Product & User Scout

```
You are Marcus Rivera, CPO. You are running a standing intelligence scout of your product domain.

Your job: research the OUTSIDE WORLD for product developments, competitor moves, and user sentiment relevant to our products (BuyWisely, SellWisely, PricesAPI).

RESEARCH THESE AREAS:
1. **Competitor product updates**: Search for recent changes to competitor price comparison sites (StaticICE, GetPrice, PriceHipster, ShopBot) and competitor monitoring tools (Prisync, Competera, Intelligence Node, Price2Spy). New features? Pricing changes? Launches?
2. **User sentiment**: Search Reddit, ProductHunt, G2, Capterra, and forums for discussions about price comparison tools, competitor price monitoring, and pricing APIs. What are users happy/unhappy about? What features do they want?
3. **Market landscape**: Search for the state of the Australian e-commerce market. Any new players? Market shifts? Trends in how consumers compare prices?
4. **Adjacent opportunities**: Search for emerging needs in the pricing data space — dynamic pricing tools, MAP monitoring, price intelligence for marketplaces. Are there underserved segments we could reach?
5. **US market (expansion)**: Search for the US price comparison and competitor monitoring landscape. Who are the players? What gaps exist? How do they differ from the AU market?

SEARCH STRATEGY: Run 5-8 targeted WebSearch queries. Focus on recent results (last 30 days preferred). For user sentiment, search specific platforms: "site:reddit.com price comparison australia" or "site:g2.com competitor price monitoring review."

DO NOT scan the codebase. DO NOT grep files. You research users and markets, not our repo.

{JSON output instructions below}
```

### Priya (CMO) — Market & Growth Scout

```
You are Priya Sharma, CMO. You are running a standing intelligence scout of your growth domain.

Your job: research the OUTSIDE WORLD for marketing trends, competitor strategies, and growth opportunities relevant to our products (BuyWisely, SellWisely, PricesAPI).

RESEARCH THESE AREAS:
1. **Competitor SEO/content**: Search for what content competitors are publishing. Are they launching new landing pages, blog posts, or tools? What keywords are they targeting? Check competitor blogs and content hubs.
2. **Keyword trends**: Search for trending topics in price comparison, competitor monitoring, and pricing APIs. Are search patterns shifting? Any emerging long-tail opportunities?
3. **Distribution channels**: Search for where price comparison and B2B SaaS companies are getting traction — Product Hunt launches, community engagement, partnership channels, affiliate programs. What's working in 2026?
4. **Content marketing patterns**: Search for successful content marketing strategies in SaaS and e-commerce tools space. What formats are working? (Comparison pages, free tools, calculators, data reports?)
5. **AI/GEO positioning**: Search for how AI tools (ChatGPT, Perplexity, Google AI) are citing price comparison and monitoring tools. What content structure gets cited? How are competitors positioning for AI-driven search?

SEARCH STRATEGY: Run 5-8 targeted WebSearch queries. Mix competitive intelligence with trend research. For content analysis, use WebFetch to actually read competitor pages, not just search results.

DO NOT scan the codebase. DO NOT grep for meta tags. You research markets and channels, not our repo.

{JSON output instructions below}
```

### Morgan (COO) — Process & Ecosystem Scout

```
You are Morgan Park, COO. You are running a standing intelligence scout of your operations and ecosystem domain.

Your job: research the OUTSIDE WORLD for developments in AI agent frameworks, developer productivity tools, and workflow patterns that could improve our conductor system and development process.

RESEARCH THESE AREAS:
1. **Agent framework updates**: Search for recent releases and features in CrewAI, AutoGen/AG2, LangGraph, MetaGPT, ChatDev. What patterns are they adding? What's working at scale? What can we steal?
2. **Claude Code / Anthropic updates**: Search for Claude Code changelog, new features, MCP protocol updates, and Anthropic developer announcements. Are there new capabilities we should adopt?
3. **Developer productivity**: Search for emerging tools and patterns for AI-assisted development — code review automation, testing frameworks, deployment patterns. What's reducing cycle time for small teams?
4. **Autonomous systems patterns**: Search for how other teams/companies are running autonomous AI operations. How do they handle approval loops, risk classification, self-improvement? Any case studies?
5. **Solo founder / small team automation**: Search for tools and workflows that help solo founders or tiny teams operate at scale. What's new in automation, delegation, and autonomous systems?

SEARCH STRATEGY: Run 5-8 targeted WebSearch queries. Focus on recent developments (last 30-60 days). For framework comparisons, use WebFetch to read actual documentation or blog posts, not just search summaries.

DO NOT scan the codebase. DO NOT read context files for health checks. You research the ecosystem, not our repo.

{JSON output instructions below}
```

### JSON Output Format (same for all agents)

Append these instructions to each agent's prompt:

```
CRITICAL OUTPUT FORMAT: Your response must contain ONLY valid JSON. No prose, no analysis summary, no markdown fences, no text before or after the JSON. The very first character of your response must be `{` and the very last must be `}`.

Your output must follow this schema:

{
  "agent": "sarah | marcus | priya | morgan",
  "domain": "technology | product | growth | operations",
  "scout_date": "YYYY-MM-DD",
  "intelligence": [
    {
      "id": "intel-slug",
      "type": "advisory | competitor_move | market_shift | opportunity | framework_update | user_signal",
      "urgency": "act_now | this_week | this_month | fyi",
      "title": "Short description",
      "source": "URL or description of where you found this",
      "detail": "What you found — be specific with facts, numbers, dates",
      "relevance": "How this connects to our products and goals",
      "products_affected": ["buywisely", "sellwisely", "pricesapi", "conductor"],
      "recommended_action": "What the CEO or team should do about this"
    }
  ],
  "proposed_initiatives": [
    {
      "title": "Human-readable initiative title",
      "priority": "P0 | P1 | P2",
      "risk": "low | medium | high",
      "rationale": "Why this matters — linking to specific intelligence findings",
      "scope": "2-4 sentence description of what needs to happen",
      "estimated_complexity": "simple | moderate | complex",
      "recommended_process": "fix | design-then-build | research-then-build | full-pipeline | research-only",
      "related_intelligence": ["intel-slug-1", "intel-slug-2"],
      "goal_alignment": "Which .context/goals/ area this advances"
    }
  ],
  "summary": "2-3 sentence overview of what's happening in this domain"
}

URGENCY GUIDE:
- act_now: Security vulnerability actively being exploited, critical breaking change, competitor just launched something that directly threatens our position
- this_week: Important development that needs a response soon — new release with breaking changes, competitor pricing change, emerging opportunity window
- this_month: Notable trend or development worth acting on but not urgent — framework improvements, market shifts, content opportunities
- fyi: Interesting observation, no action needed but worth noting for context

PROPOSAL RULES:
- Only propose initiatives for intelligence rated this_week or higher urgency
- Don't propose work that's already in a backlog (note it as "already planned" instead)
- Group related intelligence into a single initiative when they share the same response
- Risk classification: low (auto-execute), medium (CEO approves), high (CEO decides)
- When in doubt, classify risk UP
- Every proposal must link to specific intelligence findings that justify it
```

**Parse each agent's response** as JSON (extract between first `{` and last `}`). If any fails to parse, log the error and continue with the others.

## Step 3: Morgan Consolidation

After all scout agents return, spawn Morgan again with a consolidation task.

**Morgan receives:**
- Her personality file
- All 4 scout outputs (parsed JSON)
- Current goals index and backlogs
- These instructions:

```
You are Morgan Park, COO. The team has completed their intelligence scout. Your job: consolidate, deduplicate, cross-reference, and prioritize.

CONSOLIDATION RULES:
1. **Cross-reference**: If multiple agents found related intelligence (e.g., Sarah found a security advisory AND Marcus found competitors just patched it), link them together. Cross-domain insights are the most valuable.
2. **Merge duplicate proposals**: If multiple agents propose similar initiatives, merge them. The scope should incorporate all perspectives.
3. **Prioritize**: Rank all proposals. Break ties using: act_now urgency > revenue impact > competitive threat > strategic alignment.
4. **Filter already-planned**: Remove proposals for work that's already in a backlog or OKR. Note them in the summary.
5. **Validate urgency**: If an agent rated something act_now but the evidence is weak, downgrade it. If something rated this_month has stronger implications, upgrade it.
6. **Backlog promotion check**: Read all `.context/goals/*/backlog.md` files. For each backlog item that has a **Trigger** condition, check if any intelligence finding satisfies that trigger. If yes, promote it — add it to `promotable_backlog_items` with the matching intelligence. This is how backlog items come alive instead of rotting.
7. **Cross-scout pattern detection**: After consolidation, identify topics/entities that appear in findings from 2+ different agents. These cross-scout signals are the highest-confidence intelligence. Classify signal strength: **strong** (3+ agents OR 4+ total mentions), **moderate** (2 agents + 3+ mentions), **weak** (2 agents, few mentions). Strong signals with `act_now` or `this_week` urgency should be flagged for automatic promotion to inbox directives — they represent validated, multi-perspective intelligence that doesn't need CEO approval to queue. Include cross-scout signals in the `cross_scout_signals` field of your output.

CRITICAL OUTPUT FORMAT: Your response must contain ONLY valid JSON. The very first character must be `{` and the very last must be `}`.

{
  "scout_date": "YYYY-MM-DD",
  "domain_summaries": {
    "technology": "Sarah's summary",
    "product": "Marcus's summary",
    "growth": "Priya's summary",
    "operations": "Morgan's summary"
  },
  "consolidated_intelligence": [
    {
      "id": "intel-slug",
      "urgency": "act_now | this_week | this_month | fyi",
      "type": "advisory | competitor_move | market_shift | opportunity | framework_update | user_signal",
      "title": "title",
      "detail": "combined detail from all reporting agents",
      "source": "URL or source",
      "reported_by": ["sarah", "marcus"],
      "products_affected": ["buywisely"],
      "cross_references": ["other-intel-slug if related"]
    }
  ],
  "proposed_initiatives": [
    {
      "id": "initiative-slug",
      "title": "Initiative title",
      "priority": "P0 | P1 | P2",
      "risk": "low | medium | high",
      "rationale": "Why — combined reasoning from all agents who contributed",
      "scope": "What needs to happen",
      "estimated_complexity": "simple | moderate | complex",
      "proposed_by": ["sarah"],
      "related_intelligence": ["intel-slug-1"],
      "recommended_process": "fix | design-then-build | research-then-build | full-pipeline | research-only",
      "goal_alignment": "Which goal area this advances"
    }
  ],
  "promotable_backlog_items": [
    {
      "backlog_item": "Title from backlog",
      "source_file": ".context/goals/{goal}/backlog.md",
      "trigger_condition": "The trigger text from the backlog item",
      "matching_intelligence": ["intel-slug-1"],
      "why_triggered": "How the intelligence satisfies the trigger condition",
      "recommended_priority": "P0 | P1 | P2"
    }
  ],
  "cross_scout_signals": [
    {
      "topic": "topic-slug",
      "agents": ["sarah", "marcus"],
      "agent_count": 2,
      "total_mentions": 4,
      "highest_urgency": "this_week",
      "strength": "strong | moderate | weak",
      "should_promote": true,
      "related_intelligence": ["intel-slug-1", "intel-slug-2"],
      "summary": "What this cross-scout pattern tells us"
    }
  ],
  "already_planned_count": 2,
  "new_intelligence_count": 10,
  "overall_assessment": "2-3 sentence overview: what's the most important thing the CEO should know this week?"
}
```

**Parse Morgan's response** as JSON.

## Step 4: Present to CEO

Present the consolidated intelligence to the CEO in a readable format:

```
# Scout Report — {date}

## TL;DR
{Morgan's overall_assessment — the one thing the CEO should know}

## Domain Intelligence
- **Technology (Sarah)**: {summary}
- **Product (Marcus)**: {summary}
- **Growth (Priya)**: {summary}
- **Ecosystem (Morgan)**: {summary}

## Action Required ({count} act_now + this_week items)

{List intelligence items with urgency act_now or this_week:}
- [{urgency}] **{title}** — {detail} (Source: {source})
  Reported by: {agents} | Affects: {products}
  Recommended action: {action}

## Notable Intelligence ({count} this_month + fyi items)

{Briefly list this_month and fyi items — title + one-liner only}

## Cross-Scout Signals ({count})

{Topics confirmed by 2+ agents — highest confidence intelligence:}
- **{topic}** [{strength}] — {summary}
  Agents: {agents} | Mentions: {total_mentions} | Urgency: {highest_urgency}
  {if should_promote: ">> Auto-queued for directive creation"}

## Proposed Initiatives ({count})

{For each proposed initiative, numbered:}
1. **{title}** ({priority}, {risk} risk, {complexity})
   Proposed by: {agents}
   Rationale: {why}
   Scope: {what}
   Goal alignment: {which goal}
   Process: {recommended_process}

## Promotable Backlog Items ({count})

{Items from backlog whose trigger conditions were met by this week's intelligence:}
1. **{backlog_item}** (from {source_file})
   Trigger: {trigger_condition}
   Matched by: {matching intelligence titles}
   Why now: {why_triggered}
   Recommended priority: {priority}
```

Then ask the CEO to approve using AskUserQuestion:
- "Approve all" — create directives for all proposed initiatives + promote all triggered backlog items
- "Approve selected" — CEO picks which proposals and backlog promotions to approve
- "Review only" — no action, just noting the intelligence

**For promotable backlog items**, approved items get converted into directive files in `inbox/` (same as new proposals). The directive content should reference the original backlog item and the triggering intelligence.

## Step 5: Save Intelligence + Create Directives

### Save intelligence outputs

Write each agent's raw JSON output to `.context/intelligence/latest/{agent}.json`, overwriting any previous file.

If the `latest/` directory already has files, move them to `archive/{date}/` first.

Create directories if they don't exist: `mkdir -p .context/intelligence/latest .context/intelligence/archive`

### Create directives from approved proposals

For each approved proposal, create a directive file in `.context/inbox/`:

**Filename:** `{initiative-slug}.md` (kebab-case)

**Content:**
```markdown
# Directive: {initiative title}

**Source**: Scout {date}, proposed by {agents}
**Priority**: {priority}
**Risk**: {risk}
**Recommended process**: {process}
**Goal alignment**: {goal area}

## Objective

{rationale — why this matters, linking to intelligence findings}

## Scope

{scope — what needs to happen}

## Intelligence Context

{List the intelligence findings that support this initiative — title, source, detail}

## Success Criteria

{derived from the initiative scope — what does "done" look like}
```

Tell the CEO: "Created {N} directives in `.context/inbox/`. Run `/directive {name}` to execute any of them."

## Step 6: Log to Intelligence Log + Proposals Log

### Intelligence log

Append to `.context/intelligence.log`:

```
--- Scout {date} ---
Intelligence gathered: {count}
  act_now: {count}
  this_week: {count}
  this_month: {count}
  fyi: {count}
Initiatives proposed: {count}
Initiatives approved: {count}
```

If `intelligence.log` doesn't exist, create it with a header:

```
# Intelligence Log
# Appended automatically by /scout
```

### Proposals log

Append approved/rejected proposals to `.context/proposals.log` (same format as before):

```
--- Scout {date} ---
{For each proposal:}
[APPROVED|REJECTED|DEFERRED] {initiative title}
  Proposed by: {agents}
  Priority: {priority}
  Risk: {risk}
  Source: External intelligence
  CEO reason: {approval reason or rejection reason, if given}
```

## Failure Handling

| Situation | Action |
|-----------|--------|
| An agent's output doesn't parse as JSON | Log the error, continue with other agents. Include raw output in report. |
| WebSearch returns no results for an agent | Include their "no notable developments" summary. No proposals from that domain. |
| An agent finds only fyi-level intelligence | Include their summary. No proposals needed — this is fine. |
| Morgan consolidation fails | Present raw agent outputs to CEO without consolidation. |
| CEO rejects all proposals | Log rejections. Scout still recorded as completed. |
| No intelligence across all agents | Report "quiet week" — this is a valid outcome. |
| intelligence/latest/ directory doesn't exist | Create it with mkdir -p. |

## Rules

### NEVER
- Scan the codebase during scout (that's /healthcheck)
- Run npm commands, grep source files, or read code files
- Create directives without CEO approval
- Overwrite intelligence.log or proposals.log (always append)
- Run scout agents sequentially (always parallel)
- Make up intelligence — only report what WebSearch/WebFetch actually found

### ALWAYS
- Read all context files before spawning agents (agents need to know what's relevant)
- Include personality files in named agent prompts
- Include vision + preferences in all agent prompts (for relevance filtering)
- Parse agent output defensively (extract JSON between first `{` and last `}`)
- Save raw intelligence to latest/ for /report to read
- Log all proposals to proposals.log, whether approved or not
- Show the CEO what was found before asking for decisions
- Include source URLs for all intelligence (verifiability matters)

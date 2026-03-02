---
name: "directive"
description: "Execute a CEO directive — evaluate, plan, cast agents, build, and report. Takes a directive name matching a file in .context/inbox/. Dynamic orchestration: Morgan evaluates complexity, designs the process, and casts the right agents per initiative."
---

# Execute Directive

Execute the CEO directive: $ARGUMENTS

## Step 0a: Delegate to Alex (CEO Session Only)

**This step runs in the CEO's main session.** The CEO should never run the directive pipeline directly — it fills the context window with implementation noise. Instead, delegate to Alex (Chief of Staff).

**If YOU are Alex** (your prompt says "You are Alex"), skip Step 0a entirely and go to Step 0b (Triage).

### Spawn Alex

Spawn Alex as a **background** agent with the directive name and the full SKILL.md pipeline:

```
Agent tool call:
  subagent_type: "alex"
  description: "Alex: directive {name}"
  model: "opus"
  run_in_background: true
  prompt: |
    Execute the directive: {directive_name}

    Follow the directive SKILL.md pipeline below. Start at Step 0b (Triage).

    CRITICAL: You are a background agent. You CANNOT use AskUserQuestion or Chrome MCP tools.
    - For CEO approval gates: write the plan to an artifact file and STOP (return summary to CEO)
    - For UX verification: include instructions in "Needs CEO Eyes"
    - For medium-risk follow-ups within directive scope: auto-approve, include in summary

    WORKING DIRECTORY: {cwd}

    DIRECTIVE PIPELINE:
    {the full SKILL.md from Step 0b onward}
```

**Tell the CEO:** "Alex is on it. You'll be notified when he needs you or when it's done."

The CEO's session is now **free** — give other commands, browse, run other skills.

### When Alex Returns

Alex returns with one of:

1. **Plan needs approval (heavyweight directives only):**
   - Read the plan file Alex wrote
   - Present concise summary to CEO (initiatives, challenges, DOD)
   - Ask CEO: Approve / Modify / Reject
   - Spawn Alex again with approval to continue execution

2. **Done (lightweight/medium directives — no approval needed):**
   - Show Alex's CEO summary (Done / Changes / Needs CEO Eyes / Next)
   - If "Needs CEO Eyes" has items, CEO handles them
   - Done.

### Skip Delegation When:
- **The CEO explicitly says "run inline"** — honor the request, go to Step 0b directly
- **YOU are Alex** — go to Step 0b directly

---

## Step 0b: Triage (Complexity Assessment)

**Alex does this first.** Read the directive, then classify its weight. This determines how much process overhead is needed. Not everything needs the full 7-step pipeline.

Read the directive file: `.context/inbox/$ARGUMENTS.md`
Read `.context/vision.md` guardrails and `.context/preferences.md`.

### Classification Rules

**Lightweight** — Alex handles directly, no Morgan, no C-suite challenges, no CEO approval:
- Single clear task (fix a bug, delete dead code, update a config)
- All changes are in well-understood files
- No user-facing impact
- No guardrail risk (check vision.md)
- Scope fits in one engineer agent's work

**Medium** — Alex asks Morgan to plan, but no C-suite challenges, no CEO approval:
- 2-3 related tasks that need coordination
- Touches multiple files but within one system
- Low-to-medium risk (no revenue/auth/schema impact)
- Morgan plans the initiatives, Alex executes, CEO gets the summary

**Heavyweight** — Full pipeline with challenges, audit, and CEO approval gate:
- Crosses system boundaries (frontend + backend + infra)
- Touches revenue, auth, user data, or database schema
- Architectural decisions needed
- Violates or tests a guardrail in vision.md
- CEO has explicitly flagged this area as sensitive
- 4+ initiatives or multi-day scope

**Security classification examples** (to resolve ambiguity):
- Hardening existing code (fixing injection, removing hardcoded creds, adding input validation to existing routes) = **Medium**
- Changing auth flows, adding new auth mechanisms, modifying access controls, changing session handling = **Heavyweight**

**Strategic** — Full pipeline with brainstorm phase before Morgan plans:
- Multiple valid approaches and the directive doesn't prescribe one
- Architectural or process-level change — affects HOW the system works, not just WHAT it does
- Crosses 2+ domain boundaries where C-suite members would have conflicting opinions
- Lasting consequences expensive to reverse — new schemas, API contracts, conventions
- The directive asks a question or states a problem without specifying the solution
- NOT strategic just because it's big — a directive with a clear prescribed approach is heavyweight, not strategic

### Triage Output

State the classification clearly before proceeding:

```
Directive: {name}
Classification: {lightweight | medium | heavyweight | strategic}
Reasoning: {1-2 sentences why}
Process: {what steps will be used}
```

### Lightweight Process

1. Read context files (lessons.md, preferences.md — skip the full Step 2 context load)
2. Scan the codebase yourself (or spawn one auditor agent if needed)
3. Spawn engineer agent(s) to do the work
4. Verify (type-check)
5. Generate a short digest to `.context/reports/`
6. Return CEO summary (Done / Changes / Needs CEO Eyes / Next)

No Morgan. No C-suite challenges. No CEO approval. No worktree (unless the CEO has uncommitted changes). No OKR updates. Just get it done.

### Medium Process

1. Read full context (Step 2)
2. Spawn Morgan to plan initiatives (Step 3) — Morgan's inline challenge is always included, but skip separate C-suite challengers (Step 2b)
3. Spawn auditor for technical baseline (Step 3b)
4. **No CEO approval gate** — Alex approves the plan based on directive scope and guardrails
5. Create branch (Step 4b) — worktree only if working directory is dirty
6. Execute initiatives (Step 5)
7. Update OKRs, generate digest, update lessons (Step 6)
8. Return CEO summary

Morgan plans, but Alex doesn't pause for CEO sign-off. The CEO reviews the digest after the fact. If something in the plan looks risky (touches a guardrail), **upgrade to heavyweight**.

### Strategic Process

Same as heavyweight but with a brainstorm phase before Morgan plans. The team figures out the approach, CEO just answers 2-3 clarifying questions.

1. Read full context (Step 2)
2. **Brainstorm phase** — spawn 2-3 relevant C-suite agents in parallel (Sarah for architecture, Marcus for product, Priya for growth — pick based on directive domain). Each agent gets:
   - Their personality from `.claude/agents/{name}.md`
   - The directive text
   - `.context/vision.md` and `.context/preferences.md`
   - Instruction: "Propose an approach for this directive. Not endorse/challenge — actually propose HOW to solve this. Include: (1) your recommended approach in 3-5 sentences, (2) key trade-offs, (3) what you'd avoid and why. Output JSON: `{agent, approach, tradeoffs, avoid, confidence}`"
   - `model: "sonnet"` (cheap, fast — this is approach exploration, not code)
3. **Synthesize** — collect all proposals, write synthesis to `.context/artifacts/{directive_name}/brainstorm.md`
4. **CEO clarification** — write 2-3 clarifying questions based on where agents disagreed or where scope is ambiguous. STOP and return to CEO: "This directive is strategic. The team brainstormed N approaches. Here are questions before we proceed: [questions]"
5. **After CEO answers** — feed brainstorm synthesis + CEO answers into Morgan's prompt as additional context. Continue as heavyweight from Step 3 onward.

Agent brainstorm prompt template:
```
You are {Name}, {Title}. The CEO issued a strategic directive that needs approach exploration before execution planning.

DIRECTIVE:
{directive text}

CONTEXT:
- Vision: {vision.md relevant sections}
- Preferences: {preferences.md}

Your job: Propose a concrete approach for this directive. Not "endorse or challenge" — actually design HOW to solve this.

{
  "agent": "{name}",
  "approach": "Your recommended approach in 3-5 sentences — be specific about what to build/change and in what order",
  "tradeoffs": ["Key trade-off 1", "Key trade-off 2"],
  "avoid": "What approach you'd explicitly NOT take and why",
  "confidence": "high | medium | low — how certain are you this is the right approach?"
}

CRITICAL: First character `{`, last `}`. JSON only.
```

### Heavyweight Process

Full pipeline: Steps 0 → 1 → 2 → 2b → **Brainstorm** → 3 → 3b → 4 (with CEO approval) → 4b → 4c → 5 → 6 → 7.

**Brainstorm phase (mandatory for heavyweight):** Before Morgan plans, spawn 2-3 relevant C-suite agents in parallel to explore approaches — same brainstorm process as strategic (see above). The difference: for heavyweight, the brainstorm focuses on implementation approach (not whether to do it), and CEO clarification questions are included in the plan-for-approval artifact rather than as a separate STOP gate. This ensures the team thinks through the approach before Morgan plans, without adding a separate round-trip to the CEO.

For the CEO approval gate (Step 4): write the plan to `.context/artifacts/{directive_name}/plan-for-approval.md` and STOP. Return a summary asking the CEO to approve. Include brainstorm synthesis and any clarifying questions alongside Morgan's plan. The CEO spawns Alex again with the approval to continue.

---

## Step 0: Check for Checkpoint

Check if `.context/checkpoints/$ARGUMENTS.json` exists.

**If not found:** Proceed to Step 1 normally.

**If found:** Parse the checkpoint JSON and present a resume summary:

```
Found checkpoint for {directive_name}:
- Started: {started_at}, last updated: {updated_at}
- Progress: {completed}/{total} initiatives complete
- Current step: {current_step}
- Initiatives: {list each with status}

Resume from checkpoint or restart fresh?
```

Ask the CEO using AskUserQuestion: **Resume** or **Restart**.

**If Restart:** Delete the checkpoint file and its artifacts directory (`rm -rf .context/checkpoints/$ARGUMENTS.json .context/artifacts/$ARGUMENTS/`). Proceed to Step 1.

**If Resume:** Load checkpoint data and skip to the appropriate step:
- `current_step` is `step-3` → Load `planning.morgan_plan`, skip to Step 4 (CEO approval)
- `current_step` is `step-4` → Re-present plan for CEO approval (Step 4). Previous approval carries over — show it and ask CEO to confirm: "Plan was previously approved. Confirm to continue?"
- `current_step` is `step-4b` or `step-4c` → Load `planning.worktree_path`, re-initialize `~/.claude/directives/current.json` from checkpoint initiative states (Step 4c is idempotent), then skip to Step 5
- `current_step` is `step-5` → Load initiatives array. Skip initiatives with `status: "completed"` or `status: "skipped"`. Restart any `in_progress` initiative from its first phase (do not attempt partial phase resume). Continue with `pending` initiatives.
- `current_step` is `step-6` or later → Load wrapup state, skip completed wrapup sub-steps, continue from the first incomplete one

For resumed Step 5: when restarting an in-progress initiative, read its artifact files (if any) for context but re-execute all phases from scratch. Only truly completed initiatives are skipped.

## Step 1: Read the Directive

Read `.context/inbox/$ARGUMENTS.md`. If not found, list what's in `inbox/` and ask the user which directive to run.

**Naming convention:** Directive filenames must be kebab-case (e.g., `improve-security.md`). The name is used in git branch names (`directive/$ARGUMENTS`) and file paths.

### Create directive.json (if not already present)

After reading the directive .md, create `.context/inbox/$ARGUMENTS.json` alongside it if it doesn't already exist. This companion JSON provides structured metadata for the indexer and cross-reference system.

```json
{
  "id": "$ARGUMENTS",
  "title": "{extracted from first heading of the .md}",
  "status": "executing",
  "created": "{today's date YYYY-MM-DD}",
  "completed": null,
  "weight": "{classification from Step 0b: lightweight | standard | strategic}",
  "goal_ids": ["{goal IDs from directive content — parse 'Goal alignment:' or infer from directive name}"],
  "produced_features": [],
  "report": null,
  "backlog_sources": []
}
```

Extract `goal_ids` from the directive .md content:
- Look for `**Goal alignment**: {goal-id}` in the directive text
- If not found, infer from the directive name (e.g., `sellwisely-*` -> `sellwisely-revenue`, `conductor-*` -> `agent-conductor`)
- If uncertain, leave as empty array — it will be populated during Step 6

## Step 2: Read Context

Read ALL of these before spawning Morgan:
- `.context/vision.md` — north star + guardrails (agents must respect guardrails)
- `.context/preferences.md` — CEO standing orders (agents must follow these)
- `.context/goals/_index.md` — current goals and priorities
- `.context/lessons.md` — project gotchas and patterns
- `.context/lessons.md` — framework lessons index (read this first, then load topic files as needed per agent role)
- `.context/lessons/orchestration.md` — for Morgan and Alex
- `.context/lessons/agent-behavior.md` — for all agents
- All `.context/goals/*/backlog.md` files — so Morgan doesn't plan work that's already queued
- `.context/state/*.json` — structured state files (if they exist) for current work item counts and status
- The agent personality files Morgan may cast:
  - `.claude/agents/sarah-cto.md`
  - `.claude/agents/marcus-cpo.md`
  - `.claude/agents/priya-cmo.md`

Also note the path to `okrs.md` if it exists (`.context/goals/{goal_folder}/okrs.md`) — this goes to the auditor in Step 3b, not Morgan.

## Step 2b: C-Suite Challenge (Heavyweight Directives Only)

**Default behavior:** Challenge is INLINED into Morgan's planning prompt (see Step 3). Morgan identifies the top 3 risks and flags over-engineering concerns as part of her planning output.

**Separate challenger agents are only spawned when:**
- The CEO explicitly flags the directive as controversial
- The directive is heavyweight AND crosses multiple domains (e.g., touches revenue + auth + UI)

When separate challengers ARE needed, spawn 1-2 relevant C-suite members:
- Security / architecture / technical debt → **Sarah**
- User-facing features / product changes → **Marcus**
- Growth / SEO / marketing / positioning → **Priya**
- Operational / process / resource changes → spawn **two** of the above (most relevant pair)

**Challenger prompt** (customize per agent):

```
You are {Name}, {Title}. The CEO has issued a directive. Before we plan execution, your job is to independently evaluate this directive from your domain expertise.

DIRECTIVE:
{directive text}

CONTEXT:
- Vision + Guardrails: {vision.md content}
- CEO Preferences: {preferences.md content}
- Current Goals: {goals index summary}

Evaluate the directive and produce ONE of these responses:

1. ENDORSE — You agree this is the right thing to do. Briefly explain why from your domain perspective.
2. CHALLENGE — You see problems with this directive. Explain what concerns you and propose an alternative or modification.
3. FLAG — The directive is fine directionally, but there are risks or considerations the CEO should be aware of before committing.

Keep it SHORT — 3-5 sentences max. This is a gut check, not a detailed analysis.

CRITICAL OUTPUT FORMAT: Your response must contain ONLY valid JSON. The very first character must be `{` and the very last must be `}`.

{
  "agent": "{name}",
  "verdict": "endorse | challenge | flag",
  "reasoning": "Your 3-5 sentence evaluation from your domain perspective",
  "alternative": "If challenging: what would you do instead? If endorsing/flagging: null",
  "risk_flags": ["Short risk statements, if any. Empty array if none."]
}
```

**Spawn challengers in parallel.** Each is a lightweight agent call — use the agent's named `subagent_type` (e.g., `"sarah"`, `"marcus"`, `"priya"`), `model: "sonnet"` (fast, cheap — this is a gut check, not deep analysis).

**Parse responses** as JSON. If any fail to parse, log the error and continue.

**Store challenges** — they get presented alongside Morgan's plan in Step 4.

## Step 3: Spawn Morgan (Strategic Planning)

Spawn Morgan as an Agent (model: opus, subagent_type: "morgan").

**Morgan's prompt must include:**
- The CEO directive text (personality is auto-loaded via `subagent_type: "morgan"`)
- The goals index, lessons, and agent summaries from Step 2
- These explicit instructions:

```
You are Morgan Park, COO. The CEO has issued a directive. Your job:

1. Read and understand the directive
2. CHALLENGE FIRST: Before planning, identify the top 3 risks with this directive and flag any over-engineering concerns. Be skeptical — is there a simpler approach? Would a lightweight version ship 80% of the value at 20% of the complexity?
3. Define initiatives — the shippable work that achieves the directive's goal

CRITICAL — NO SPLITTING, NO FOLLOW-UPS, NO DEFERRING:
- Do NOT split the directive into "phase 1 now, phase 2 later"
- Do NOT recommend deferring parts of the directive to a follow-up
- Do NOT create backlog items for "future work" that should be done now
- The CEO gave you the FULL directive — plan ALL of it in this execution
- If the directive says to do X, Y, and Z, plan initiatives for X, Y, AND Z — not just X with Y and Z as "follow-ups"
- Every requirement in the directive MUST map to an initiative. Nothing gets left on the cutting room floor.
4. For each initiative, define concrete Definition of Done criteria
5. For each initiative, specify the exact phases needed (don't pick from a taxonomy — design the right sequence)
6. Cast agents for each initiative (including who audits the codebase)
7. Produce a structured JSON plan

You do NOT scan the codebase. You plan at the strategic level. The technical audit (Step 3b) will provide real file lists, baselines, and dead code flags. Your job is WHAT needs to happen and WHO does it, not WHERE in the code.

CRITICAL OUTPUT FORMAT: Your response must contain ONLY valid JSON. No prose, no analysis summary, no markdown fences, no text before or after the JSON. The very first character of your response must be `{` and the very last must be `}`. If you include ANY text outside the JSON object, the parser will fail and we waste a full planning cycle.

Your plan must follow this schema EXACTLY:

{
  "goal": "CEO's goal title",
  "goal_folder": "which .context/goals/ folder this belongs to (existing or new)",
  "challenges": {
    "risks": ["Top 3 risks with this directive — be specific, not generic"],
    "over_engineering_flags": ["Anything in the directive that's scoped too broadly or could be simpler"],
    "recommendation": "Proceed as-is | Simplify (explain how — but still deliver everything)"
  },
  "initiatives": [
    {
      "id": "slug-id",
      "title": "Human-readable title",
      "priority": "P0 | P1 | P2",
      "complexity": "simple | moderate | complex",
      "phases": ["build", "review"],
      "user_scenario": "One sentence: how the user will experience this change when it ships",
      "cast": {
        "auditor": "sarah | priya | riley | jordan | casey (who investigates the codebase — specialists can audit their own domain for simple work; C-suite for complex/cross-cutting)",
        "researcher": "priya | sarah (optional, only for phases including research)",
        "product_spec": "marcus (optional, only when phases include product-spec)",
        "designer": "sarah (optional, when phases include design)",
        "builder": "engineer | riley | jordan | casey | taylor | sam (engineer = generic, named = specialist with domain template)",
        "reviewers": ["sarah | marcus | morgan | priya | riley | jordan | casey | sam — one or more, matched to domain. Prefer specialists for routine code review; reserve C-suite for strategic/cross-cutting review"]
      },
      "scope": "High-level description of what needs to happen and why",
      "verify": "verification command — use `npm run type-check` (NOT lint, which OOMs on large projects)",
      "definition_of_done": ["Concrete, testable acceptance criterion 1", "Criterion 2", "..."]
    }
  ]
}

DEFINITION OF DONE RULES:
- Every initiative MUST have a definition_of_done array with 2-5 concrete, testable criteria
- Each criterion must be verifiable (not vague like "improve quality")
- DOD is what the CEO reviews to approve/reject the initiative's result
- Examples of good DOD: "All 16 goal folders have goal.json", "Indexer reads goal.json and populates category field", "Type-check passes"
- Examples of bad DOD: "Improve goal structure", "Make it work", "Better code quality"

PHASES — COMPOSABLE BUILDING BLOCKS:
Instead of picking from a fixed process type taxonomy, specify the exact phases each initiative needs as an ordered array. Available phases:

- "research" — investigation, analysis, competitive intel (researcher agent)
- "product-spec" — product requirements + acceptance criteria (Marcus)
- "design" — technical approach document (Sarah)
- "keyword-research" — SEO keyword analysis (Priya, for content work)
- "outline" — content structure and plan (Priya, for content work)
- "clarification" — pre-build Q&A between engineer and designer/auditor (auto-added for complex work)
- "build" — implementation (engineer agent)
- "draft" — content writing (engineer, for content work)
- "seo-review" — SEO quality review (Priya, for content work)
- "review" — code/quality review (reviewer agents from cast)
- "tech-review" — architecture review (Sarah, for complex work)
- "product-review" — product spec verification (Marcus, for complex work)

COMMON PHASE PATTERNS (guidance, not rigid rules):
- Simple fix: ["build", "review"]
- Feature with design: ["design", "clarification", "build", "review"]
- Research-driven feature: ["research", "design", "clarification", "build", "review"]
- Full complex feature: ["product-spec", "design", "clarification", "build", "tech-review", "product-review"]
- Research only: ["research"] (no build — produces a report)
- Migration: ["research", "design", "clarification", "build", "review"] (build is incremental)
- Content: ["keyword-research", "outline", "draft", "seo-review", "review"]

CLARIFICATION PHASE RULES:
- Auto-add "clarification" before "build" when the initiative has "design", "research", or "product-spec" phases
- Skip clarification for simple ["build", "review"] initiatives — scope is tight enough
- Skip for ["research"] only initiatives — no build phase to clarify

CASTING RULES:

DELEGATION PRINCIPLE: C-suite agents (Sarah, Marcus, Morgan, Priya) focus on STRATEGY — planning, auditing, challenging, and cross-cutting reviews. Specialists (Riley, Jordan, Casey, Taylor, Sam) handle EXECUTION — building AND routine domain-specific reviews. Do NOT have C-suite do work that a specialist can handle. Alex orchestrates but does NOT build, review, or audit — he delegates.

AUDITING:
- Security/architecture audits → Sarah
- User-facing/product audits → Marcus or Sarah
- Growth/marketing audits → Priya
- Routine codebase audits for simple initiatives → specialists can audit their own domain (Riley audits frontend, Jordan audits backend, Casey audits data pipelines)

REVIEWING:
- Simple frontend work → Riley reviews (not Sarah, unless security-sensitive)
- Simple backend work → Jordan reviews (not Sarah, unless architecture-sensitive)
- Simple data/pipeline work → Casey reviews
- QA/testing/validation → Sam reviews
- Cross-cutting or architecture-sensitive work → Sarah reviews
- User-facing product/UX decisions → Marcus reviews
- Process/pipeline/operational changes → Morgan reviews
- Growth/SEO/content quality → Priya reviews
- Complex or risky work → C-suite reviewer + specialist reviewer (dual review)

GENERAL:
- Simple work (1-2 phases) → specialist builder + specialist reviewer (same domain, different person if possible; same person OK if solo domain)
- Moderate work (3-4 phases) → specialist builder + C-suite reviewer (for strategic oversight)
- Complex work (5+ phases) → full team: C-suite designs/audits, specialist builds, C-suite + specialist review
- Every initiative MUST have an auditor — this is who scans the codebase in Step 3b
- Match reviewers to the domain being changed — don't default to Sarah for everything
- Never have the builder review their own build (conflict of interest)
- Never have an agent review changes to its own behavior/prompts (conflict of interest)

SPECIALIST BUILDER ASSIGNMENT (file-pattern matching):
When the audit reveals which files an initiative will touch, assign the matching specialist:
- Files in `src/components/`, `*.tsx`, `*.jsx`, or UI/styling work → `"builder": "riley"` (Frontend Developer)
- Files in `server/`, API routes, WebSocket, watchers, or backend logic → `"builder": "jordan"` (Backend Developer)
- Files in `scripts/`, `server/parsers/`, `server/state/`, data pipelines, or indexing → `"builder": "casey"` (Data Engineer)
- Files in `.context/`, `*.md`, `*.mdx`, documentation, or content creation → `"builder": "taylor"` (Content Builder)
- Testing, verification, type-checking, or QA-focused work → `"builder": "sam"` (QA Engineer)
- When scope crosses domains, use the DOMINANT domain's specialist
- When no clear domain match or scope is very broad, use `"builder": "engineer"` (generic, no template)
- Specialist assignment is optional — `"builder": "engineer"` always works as a fallback

REVIEWER-TYPE DEFINITIONS:
When casting reviewers, each type focuses on their domain:

C-Suite reviewers (strategic/cross-cutting — use for complex, risky, or multi-domain work):
- **Sarah (architecture/security)**: Code patterns, type safety, security vulnerabilities, performance, schema correctness, dependency risks. Use when work is security-sensitive, touches data models, or crosses system boundaries.
- **Marcus (product/UX)**: User workflow completeness, product spec alignment, dead-end UI, first-impression clarity, CEO-intent match. Use when work affects what the CEO sees or touches.
- **Morgan (operations/process)**: Conductor process compliance, operational correctness, sequencing logic, casting rule adherence, checkpoint integrity. Use when work changes how the pipeline operates.
- **Priya (growth/content)**: SEO preservation, content quality, keyword targeting, internal linking, growth metric impact. Use when work affects public content or growth metrics.

Specialist reviewers (domain-specific — use for routine, single-domain work):
- **Riley (frontend)**: Component patterns, Tailwind conventions, state management, UI consistency, responsive behavior, accessibility. Use for routine frontend builds.
- **Jordan (backend)**: API patterns, error handling, WebSocket correctness, watcher logic, server performance. Use for routine backend builds.
- **Casey (data)**: Parser correctness, indexer logic, state file integrity, data pipeline accuracy. Use for data/pipeline builds.
- **Sam (QA)**: Type safety, build validation, test coverage, verification completeness, regression risk. Use as a second reviewer on any build for quality assurance.

MULTI-REVIEWER CASTING GUIDANCE:
- Simple frontend work → Riley reviews (Sarah only if security-sensitive)
- Simple backend work → Jordan reviews (Sarah only if architecture-sensitive)
- Simple data work → Casey reviews
- UI-touching initiatives that affect CEO workflow → Riley builds + Marcus reviews
- Complex/risky work → specialist builds + C-suite reviews (dual layer)
- Process/conductor changes → Morgan reviews (she owns the pipeline)
- Content/SEO work → Priya reviews + Taylor builds
- Any initiative → optionally add Sam as second reviewer for QA coverage
- Default: single specialist reviewer is fine for simple, single-domain work. Escalate to C-suite reviewer when the work is risky, cross-cutting, or user-facing.

USER SCENARIO RULES:
- Every initiative must include a `user_scenario` — one sentence describing the user experience after this ships
- Good: "The CEO runs /directive and sees a telemetry summary with token costs and wall times at the end of the digest"
- Bad: "Improves the system" (too vague — what does the user actually experience?)
- Reviewers walk this scenario during review to verify the work delivers the promised experience

SCOPE FORMAT:
Write 2-4 sentences describing what needs to happen. Focus on the outcome and approach, not specific files or line numbers. Example: "All API endpoints that accept user input need input validation and parameterized queries. Currently using string interpolation for SQL. Switch to Prisma parameterized queries and add Zod validation schemas."

DEFINITION OF DONE RULES:
- Each initiative must include 3-5 specific, testable acceptance criteria in `definition_of_done`
- These are what the reviewer will verify — concrete conditions, not vague outcomes
- Good DOD: "Every /api/* route has a Zod schema and type-check passes"
- Bad DOD: "Security is improved" (too vague to verify)
- DOD should cover: functional correctness, scope completeness, and CEO-intent alignment
- If the directive has explicit success criteria, each criterion should map to at least one DOD item
```

**If this directive was classified as strategic**, also include in Morgan's prompt:
- The brainstorm synthesis from `.context/artifacts/{directive_name}/brainstorm.md`
- CEO's clarification answers
- Additional instruction to Morgan: "The team has brainstormed approach options for this directive. Use the brainstorm synthesis and CEO's answers to inform your plan — you don't need to re-derive the approach from scratch. Focus on execution planning, not strategy."

**Parse Morgan's response** as JSON. Extract the JSON object from her response (find the first `{` and last `}`). If it fails to parse, show the error and stop.

## Step 3b: Technical Audit

After parsing Morgan's plan, spawn the auditor(s) to investigate the codebase.

**Group initiatives by auditor** — if multiple initiatives have the same auditor, send them in a single audit agent to save tokens.

**Auditor spawn rules:**
- Use the auditor's named `subagent_type` (e.g., `"sarah"`, `"priya"`, `"riley"`, `"jordan"`, `"casey"`) — the personality file is auto-loaded
- Spawn as Agent (model: opus)

**Auditor's prompt must include:**
- Their personality file (for named agents)
- Morgan's initiatives (the ones assigned to this auditor)
- Existing OKRs from `.context/goals/{goal_folder}/okrs.md` (if it exists) — so they avoid re-auditing solved problems
- `.context/vision.md` guardrails section — for risk classification reference
- `.context/preferences.md` — CEO standing orders
- `.context/lessons.md` — project gotchas
- `.context/lessons/review-quality.md` — review lessons (for Sarah)
- `.context/lessons/agent-behavior.md` — agent behavior lessons
- These explicit instructions:

```
You are auditing the codebase to provide real technical context for Morgan's strategic plan.

For each initiative you've been assigned, your job is:
1. Scan the codebase for the scope described — use Glob, Grep, Read tools
2. Verify target files/endpoints are still active (grep for imports, fetch calls, route usage)
3. Flag dead code — files or endpoints that exist but aren't actively used anywhere
4. Measure real baselines (exact counts, specific file lists)
5. Recommend a technical approach based on what you find
6. Identify follow-up actions discovered during the audit, with risk classification

Be THOROUGH: grep broadly to find ALL instances of a problem, not just the obvious ones. Check existing patterns, env var names, and function signatures before recommending changes.

If an initiative's scope turns out to have nothing to fix (e.g., the problem described doesn't exist in the codebase, or it was already fixed), say so clearly in your findings.

**Checkpoint:** Write checkpoint with `current_step: "step-3"`, `planning.morgan_plan` set to the parsed JSON, and `initiatives` array initialized from the plan (all `status: "pending"`).

RISK CLASSIFICATION for follow-ups:
- "low": Safe to auto-execute without CEO approval. Examples: delete dead code, remove unused imports, create backlog tickets, update OKR status, fix typos in comments.
- "medium": Needs CEO approval before execution. Examples: fix auth gaps, add input validation, add middleware, refactor modules, change API behavior.
- "high": CEO must decide. Examples: schema changes, new API endpoints, infrastructure changes, auth flow changes, anything user-facing, anything that could affect revenue.

When in doubt, classify UP (low → medium, medium → high). Read `.context/vision.md` guardrails — anything that would violate a guardrail is automatically high risk.

CRITICAL OUTPUT FORMAT: Your response must contain ONLY valid JSON. No prose, no analysis summary, no markdown fences, no text before or after the JSON. The very first character of your response must be `{` and the very last must be `}`.

Your output must follow this schema:

{
  "initiatives": [
    {
      "id": "slug matching Morgan's initiative id",
      "baseline": "Real measured baseline (e.g., '4 endpoints use string interpolation for SQL')",
      "active_files": ["files that are in use and need work"],
      "dead_code": ["files that exist but aren't actively used — list them for auto-cleanup in follow_ups"],
      "findings": "What you found in the codebase — be specific",
      "recommended_approach": "How to implement this, referencing real patterns and files",
      "follow_ups": [
        {
          "action": "Short description of what to do",
          "risk": "low | medium | high",
          "rationale": "Why this risk level — what could go wrong?",
          "files": ["affected files, if known"]
        }
      ]
    }
  ]
}
```

**Parse the auditor's response** as JSON. If it fails to parse, show the error and stop.

**If an initiative has no active files and all dead code:** Flag it for removal in the CEO presentation.

## Step 4: Present Combined Plan to CEO

**If running as Alex (background agent):** Do NOT present to the CEO directly. Write the full plan to `.context/artifacts/$ARGUMENTS/plan-for-approval.md` using the format below, write checkpoint, and return your summary. The CEO session handles approval.

**If running inline (CEO session):** Present as described below.

### CEO Quick Summary (present FIRST — before any detail)

Always lead with a 3-5 bullet TL;DR that the CEO can read in 20 seconds:

```
## TL;DR

- **What**: {1-sentence goal}
- **Scope**: {N} initiatives, {complexity breakdown e.g. "2 simple, 1 moderate"}
- **Risk**: {Morgan's recommendation — proceed / scope down / defer}
- **Auto-ships**: {count} low-risk initiatives execute without approval
- **Needs your call**: {count} items need CEO decision {brief description}

Approve all / Approve with changes / Reject
```

The CEO should be able to approve from the TL;DR alone for medium-risk directives. The full detail below is for heavyweight review or "Approve with changes" scenarios.

### Challenges (from Morgan's inline analysis + Step 2b if separate challengers were spawned)

First, present Morgan's built-in challenge analysis:

```
## Risk & Scope Assessment (Morgan)

Risks: {Morgan's top 3 risks from challenges.risks}
Over-engineering flags: {challenges.over_engineering_flags}
Recommendation: {challenges.recommendation}
```

If separate C-suite challengers were spawned (heavyweight/controversial directives only), present their responses:

```
**{Agent Name}** — {ENDORSE | CHALLENGE | FLAG}
{reasoning}
{If challenge: "Alternative: {alternative}"}
{If risk flags: "Risks: {list}"}
```

If any challenge (Morgan's or separate) recommends scoping down, highlight it prominently. The CEO should consider the challenge before approving the plan.

### Plan (from Steps 3 + 3b)

Merge Morgan's strategic plan with the audit findings and present **grouped by priority**:

For each initiative, display:
- Title + priority + complexity
- Scope (from Morgan)
- User scenario (from Morgan — the one-sentence user experience)
- Audit findings: active files, dead code flagged, recommended approach
- Phases + agent cast
- Definition of Done items (from Morgan's plan — for CEO to review before approving)
- Verify command

Flag initiatives where the audit found nothing to fix or all dead code — recommend removal.

Example format:
```
## P0 — Must Ship

  1. {Initiative Title} (phases: {phases list}) — {cast summary}
     Scope: {Morgan's scope description}
     User scenario: {user_scenario}
     Audit: {baseline} | {N} active files | {M} dead code files flagged
     Approach: {auditor's recommended approach}
     DOD: {criterion 1} | {criterion 2} | {criterion 3}

  2. {Initiative Title} — RECOMMEND REMOVE
     Audit: No active issues found. {explanation}

## P1 — Should Ship
  ...

## P2 — Nice to Have
  ...
```

Ask the CEO to approve using AskUserQuestion:
- "Approve all" — execute everything as planned
- "Approve with changes" — CEO adjusts priorities or removes initiatives
- "Reject" — stop, explain what's wrong

**DOD review guidance:** Before approving, scan each initiative's DOD items. Flag any that are:
- Too vague to verify ("improve quality" vs "all routes have Zod schemas")
- Missing CEO-intent alignment (DOD doesn't reflect what you actually want)
- Incomplete (fewer than 3 items, or missing a testability dimension)

If DOD items are weak, use "Approve with changes" to request better criteria before execution starts.

If CEO wants changes, adjust the plan accordingly.

**Checkpoint:** Write checkpoint with `current_step: "step-4"`, `planning.ceo_approval` set to `{status: "approved", modifications: [...]}` (or rejected). This is CRITICAL — CEO decisions cannot be reconstructed after context loss.

## Step 4b: Branch / Worktree Isolation

After CEO approval, create a branch to isolate directive changes.

**Default: branch-only (no worktree).** Create a branch for the directive:

```bash
git checkout -b directive/$ARGUMENTS
```

**Use worktree ONLY when** `git status` shows uncommitted changes that should be preserved. In that case:

```bash
git worktree add ../sw-directive-$ARGUMENTS -b directive/$ARGUMENTS
```

If the worktree already exists, reuse it. All agent spawn prompts must include `"Working directory: {worktree_path}"` so agents operate in the isolated copy.

At the end (Step 7), tell the CEO the branch name so they can review with `git diff main..directive/$ARGUMENTS`.

**Skip isolation entirely if:** the user explicitly says "no branch", or all initiative phases are research-only (no code changes).

**Checkpoint:** Write checkpoint with `current_step: "step-4b"`, `planning.worktree_path` set to the worktree path (or null if branch-only or skipped).

## Step 4c: Initialize Directive State

Create the directive state file for dashboard tracking:

```bash
mkdir -p ~/.claude/directives
```

Write initial state to `~/.claude/directives/current.json`:

```json
{
  "directiveName": "$ARGUMENTS",
  "status": "executing",
  "totalInitiatives": N,
  "currentInitiative": 0,
  "currentPhase": "starting",
  "initiatives": [
    {"id": "slug", "title": "Human-readable", "status": "pending", "phase": null}
  ],
  "startedAt": "ISO timestamp",
  "lastUpdated": "ISO timestamp"
}
```

**Update this file before each initiative and phase change** throughout Step 5. The conductor dashboard watches this file via chokidar for real-time progress display.

At Step 7 (completion), update status to `"completed"` or `"failed"`.

**Also ensure directive.json exists** at this point. If Step 1 didn't create it (e.g., lightweight process that skipped Step 1), create `.context/inbox/$ARGUMENTS.json` now with the schema from Step 1. Update its `status` to `"executing"` and set `weight` from the triage classification.

**Checkpoint:** Write checkpoint with `current_step: "step-4c"`.

## Checkpoint Protocol

Checkpoints allow a directive to pause mid-execution and resume after context exhaustion. A single JSON file is overwritten atomically at each transition point.

**Checkpoint file:** `.context/checkpoints/{directive-name}.json`
**Artifact files:** `.context/artifacts/{directive-name}/{initiative-id}/{phase}.md`

**Schema:**

```json
{
  "version": 1,
  "directive_name": "string",
  "directive_path": ".context/inbox/{name}.md",
  "started_at": "ISO datetime",
  "updated_at": "ISO datetime",
  "current_step": "step-3 | step-4 | step-4b | step-4c | step-5 | step-6 | step-7",
  "planning": {
    "morgan_plan": {},
    "ceo_approval": { "status": "approved|rejected", "modifications": [] },
    "worktree_path": "string | null"
  },
  "initiatives": [
    {
      "id": "string",
      "status": "pending | in_progress | completed | partial | skipped | failed",
      "phases": ["design", "build", "review"],
      "phases_completed": ["design", "build"],
      "current_phase": "review | null",
      "artifact_paths": { "research": "path | null", "product-spec": "path | null", "design": "path | null", "clarification": "path | null", "build": "path | null", "review": "path | null", "tech-review": "path | null", "product-review": "path | null", "keyword-research": "path | null", "outline": "path | null", "draft": "path | null", "seo-review": "path | null" },
      "review_findings": []
    }
  ],
  "wrapup": {
    "okrs_persisted": false,
    "follow_ups_processed": false,
    "digest_path": null,
    "lessons_updated": false
  }
}
```

**Write mechanism:** Use the Write tool to overwrite the entire checkpoint file. Always update `updated_at` to the current ISO timestamp. Create parent directories with `mkdir -p` on first write.

**Artifact writes:** After each phase completes in Step 5, write the phase output (design doc, build report, review JSON) to `.context/artifacts/{directive-name}/{initiative-id}/{phase}.md`. These survive context exhaustion and allow resumed runs to provide context to downstream phases.

## Step 5: Execute Initiatives

Execute each approved initiative **in priority order** (P0 first, then P1, then P2).

**Progress tracking:** Before each initiative, show the CEO a status line:

```
[2/4] Initiative: Fix SQL Injection (P0, fix) — starting build phase...
```

After each initiative completes, show:

```
[2/4] Fix SQL Injection — completed (6/6 tasks)
```

For each initiative, execute its `phases` array in order. Each phase has specific agent assignments and artifact outputs.

### Phase Execution Reference

For each phase in the initiative's `phases` array, execute it according to these rules:

**Phase: `research`**
Spawn researcher agent (Priya or Sarah per cast) to investigate and produce findings. **Artifact:** `artifacts/{directive}/{initiative}/research.md`.

**Phase: `product-spec`**
Spawn Marcus to write product requirements + acceptance criteria. **Artifact:** `artifacts/{directive}/{initiative}/product-spec.md`.

**Phase: `design`**
Spawn designer agent (Sarah) to read the codebase and write a technical approach. Include any prior phase artifacts (research, product-spec) as context. **Artifact:** `artifacts/{directive}/{initiative}/design.md`.

**Phase: `keyword-research`**
Spawn Priya to research target keywords, search intent, competitor content gaps, and recommended topics. **Artifact:** `artifacts/{directive}/{initiative}/keyword-research.md`.

**Phase: `outline`**
Spawn Priya to create a content outline -- structure, headings, target keywords per section, internal linking strategy. Include keyword research artifact as context. **Artifact:** `artifacts/{directive}/{initiative}/outline.md`.

**Phase: `clarification`**
Pre-build Q&A stolen from ChatDev's dual-agent dehallucination pattern (40% error reduction). Spawn the engineer with all context (scope, design output, audit findings). Engineer outputs 3-5 specific clarifying questions about scope boundaries, edge cases, integration points, and ambiguous requirements. Spawn the designer/auditor from the previous phase to respond. **Artifact:** `artifacts/{directive}/{initiative}/clarification.md`.

**Phase: `build`**
Spawn engineer agent(s) with initiative scope + all prior phase artifacts + audit findings + verify command. For migration initiatives (phases include research + design + build), the build is INCREMENTAL: engineer executes one step at a time, running verify between each step. **Artifact:** `artifacts/{directive}/{initiative}/build.md`.

**Phase: `draft`**
Spawn engineer agent to write the actual content (MDX files, page components) following the outline artifact. **Artifact:** `artifacts/{directive}/{initiative}/draft.md`.

**Phase: `seo-review`**
Spawn Priya to review the draft for SEO quality -- meta tags, keyword density, structured data, internal links, readability. **Artifact:** `artifacts/{directive}/{initiative}/seo-review.md`.

**Phase: `review`**
For each reviewer in the initiative's `cast.reviewers` array, spawn the reviewer agent to review the changes. Collect all review JSONs. If ANY reviewer returns "critical", trigger the retry logic. **Artifact:** `artifacts/{directive}/{initiative}/review.md`.

**Phase: `tech-review`**
Spawn Sarah to review code quality + architecture. **Artifact:** `artifacts/{directive}/{initiative}/tech-review.md`.

**Phase: `product-review`**
Spawn Marcus to verify it meets the product spec. **Artifact:** `artifacts/{directive}/{initiative}/product-review.md`.

**After the last phase:** If any initiative phase produced UI changes, trigger UX verification (see "UX Verification Phase" below).

**For research-only initiatives** (phases = `["research"]`): After the research phase, write the report to `.context/reports/` as well.

### Agent Spawn Rules

**All named agents** (C-suite and specialists): Use the agent's named `subagent_type` — e.g., `subagent_type: "sarah"`, `subagent_type: "riley"`, `subagent_type: "jordan"`, etc. The personality file is auto-loaded by the agent system. Do NOT manually paste personality file contents into the prompt — just use the named type.

Available named `subagent_type` values:
- **C-suite**: `"sarah"`, `"marcus"`, `"priya"`, `"morgan"`, `"alex"`
- **Specialists**: `"riley"` (frontend), `"jordan"` (backend), `"casey"` (data), `"taylor"` (content), `"sam"` (QA)

Specialists receive engineer-style instructions (scope, DOD, audit findings, verify command) in their task prompt — the personality is already loaded via the type.

**Engineer agents** (generic, no specialist assigned — `"builder": "engineer"` in cast): Use `subagent_type: "general-purpose"`. No personality file. Spawn with:
- Initiative scope (from Morgan's plan)
- Initiative definition_of_done (from Morgan's plan) — the engineer must know acceptance criteria BEFORE building
- Audit findings (from Step 3b): active file list, recommended approach, baseline
- Design output (if available from earlier phases)
- Verify command
- Instruction: "Self-organize your work based on the audit findings and scope. Run the verify command when done."
- **Initiative instruction**: "After completing the build, report BOTH what you built AND what you think is still missing or broken. List specific follow-ups you'd propose — gaps in the UX, edge cases not covered, related features that should exist but don't. This is not optional — every build report must include a `proposed_improvements` section."
- **User-perspective instruction**: "Before reporting completion, mentally walk through the feature as if you are the CEO using it for the first time. Ask yourself: Can I click this? Where does it go? Does the number match reality? Is anything a dead end? Include a `user_walkthrough` section in your build report describing what the CEO would experience step-by-step."

**Engineer clarification prompt** (for complex processes only — prepend to the engineer's build prompt when a clarification phase precedes the build):

```
Before building, you reviewed the scope and design and asked clarifying questions. Here are the answers:

{clarification Q&A from the clarification phase artifact}

Use these clarifications to guide your implementation. If the answers revealed scope changes or additional requirements, incorporate them.
```

**All agents** get:
- `subagent_type`: the agent's named type (see above) — only use `"general-purpose"` for generic unnamed engineers
- `model: "opus"`
- `.context/preferences.md` — CEO standing orders
- `.context/vision.md` guardrails section — hard constraints
- `.context/lessons.md` — project gotchas and patterns
- Topic-specific conductor lessons (load only what's relevant to the agent's role):
  - **Engineers**: `.context/lessons/agent-behavior.md` + `.context/lessons/skill-design.md`
  - **Sarah (auditor/reviewer)**: `.context/lessons/agent-behavior.md` + `.context/lessons/review-quality.md`
  - **Marcus (product reviewer)**: `.context/lessons/review-quality.md`
  - **Morgan (process reviewer)**: `.context/lessons/orchestration.md` + `.context/lessons/review-quality.md`
  - **Priya (content/growth)**: `.context/lessons/agent-behavior.md`

### UX Verification Phase (mandatory for UI work)

**When:** After the build + review phases complete for any initiative where the audit's `active_files` list contains files matching UI patterns: `*.tsx`, `*.jsx`, `*.css`, `*.scss`, `*.html`, `tailwind.config.*`, `globals.css`, or files under `pages/`, `app/`, `components/`, `layouts/`, or `styles/` directories. This is NOT a subjective judgment call — if the file patterns match, UX verification is REQUIRED.

**How:** The orchestrator (you) must personally verify the changes work from the CEO's perspective using browser automation tools (mcp__claude-in-chrome__*). This is NOT delegated to a subagent — Chrome MCP tools only work in the main session.

**UX verification checklist:**
1. Navigate to every page/component that was modified
2. Click every clickable element — verify it does something useful (no dead-end UI)
3. Check that data displayed matches the backend (numbers, counts, lists)
4. Test the "9am CEO workflow": open dashboard → see what happened → click into detail → know what to do
5. Take screenshots as evidence

**If UX verification fails:** Fix the issues immediately (spawn another engineer if needed), then re-verify. Do NOT skip to the next initiative with broken UI.

**Skip UX verification if:** The initiative is backend-only, research-only, or doesn't touch any user-facing code.

**When running as Alex (Chief of Staff):** Chrome MCP tools are unavailable. Include specific UX verification instructions in the "Needs CEO Eyes" section of the summary — URLs to visit, elements to click, expected behavior, data to validate. The CEO (main session) handles browser checks.

### User-Perspective Review (mandatory for all initiatives)

Separate from code review. After the reviewer checks code quality, the reviewer ALSO evaluates the work from the end-user's perspective. This catches the gap where code compiles but the user experience is broken.

**Add to every reviewer prompt:**

```
SEPARATE FROM CODE REVIEW — also evaluate this work from the CEO/end-user perspective:
1. Walk through the initiative's `user_scenario`: "{user_scenario from Morgan's plan}". Does the build actually deliver this experience?
2. If this were shipped today, would the CEO's workflow actually improve?
3. What did the engineer build that technically works but misses the user's real need?
4. What's MISSING that the directive didn't ask for but the user clearly needs?
5. Are there dead-end UI elements (clickable-looking things that do nothing)?
6. Does the data flow make sense end-to-end (not just "does the component render")?

Include a `user_perspective` section in your review JSON:
{
  "user_perspective": {
    "workflow_improvement": "yes | partial | no — does this actually help the user?",
    "missing_features": ["things the user needs but weren't built"],
    "dead_ends": ["UI elements that look interactive but aren't"],
    "data_integrity": ["data that displays but doesn't match reality"]
  }
}
```

**DOD verification** (mandatory if initiative has definition_of_done):

```
DEFINITION OF DONE VERIFICATION — check EVERY criterion:
For each item in this initiative's definition_of_done array, verify whether it has been met.

Include a `dod_verification` section in your review JSON:
{
  "dod_verification": {
    "criteria": [
      {"criterion": "the DOD text", "met": true, "evidence": "what you observed that confirms/denies this"}
    ],
    "all_met": true
  }
}

If ANY criterion is not met, set review_outcome to "fail". If a criterion violation would breach a guardrail (SEO, security, data integrity), set review_outcome to "critical".
```

**CEO corrections check** (mandatory for all reviews):

```
CEO CORRECTIONS CHECK — MANDATORY:
Read .context/preferences.md (specifically the ## Standing Corrections section). For each standing correction:
1. Does this initiative's work touch anything related to this correction?
2. If yes, does the implementation respect the correction?
3. If it violates a correction, this is automatically review_outcome: "critical".

Include a `corrections_check` section in your review JSON:
{
  "corrections_check": {
    "corrections_reviewed": 4,
    "violations": []
  }
}
```

**Review completeness** (mandatory for all reviews):

```
REVIEW COMPLETENESS — use this structured output:
{
  "review_outcome": "pass | fail | critical",
  "code_quality": {"issues": [], "severity": "none | minor | major"},
  "user_perspective": { ... },
  "dod_verification": { ... },
  "corrections_check": { ... },
  "surfaces_checked": ["list every file, endpoint, UI surface, or data flow you actually inspected"],
  "what_is_missing": ["things the directive asked for that aren't present in the build"],
  "regression_risks": ["existing functionality that could break from these changes"]
}

A review_outcome of "pass" requires: ALL DOD criteria met, ZERO corrections violations, user_perspective.workflow_improvement is "yes" or "partial", and no major code quality issues.
```

**This is NOT optional.** Every review must include user-perspective evaluation. A review that only checks code quality but ignores user experience is incomplete.

Check the audit findings for this initiative. If `active_files` is empty and findings indicate nothing to fix, **skip the initiative** — set status to `skipped` and continue to the next. Log: `[N/M] {title} — skipped (audit found nothing to fix)`.

**Checkpoint:** Update this initiative's `status` to `"in_progress"` and `current_phase` to the first phase in its `phases` array.

### After Each Phase

- If an agent fails or reports a blocker: **skip remaining tasks in this initiative**, log the error, continue to next initiative
- If a reviewer finds issues: **log them as non-fatal findings** (don't block). Include in digest.

**Artifact:** Write the phase output to `.context/artifacts/{directive-name}/{initiative-id}/{phase}.md`.

**Checkpoint:** Update the initiative's `phases_completed`, `current_phase`, and `artifact_paths` in the checkpoint. Set `current_step: "step-5"`.

### Conditional Retry (review_outcome = critical)

If ANY reviewer returns `review_outcome: "critical"`, attempt ONE retry:
1. Re-spawn the engineer with the critical reviewer's issues as fix instructions
2. Re-run ONLY the reviewer(s) that returned "critical" — don't re-run reviewers that already passed
3. If still critical after retry, mark initiative as `partial` and continue

Maximum 1 retry per initiative. If all reviewers passed or got non-critical issues, no retry.

**What constitutes "critical":**
- Any DOD criterion not met that relates to a guardrail (SEO, security, data integrity)
- Any Standing Correction violation
- Security vulnerability introduced by the build
- Data loss or corruption risk
- Build that's fundamentally wrong approach (not just missing polish)

**What is NOT critical (just "fail"):**
- DOD criteria not met but no guardrail impact
- Missing edge case handling
- Code quality issues (naming, complexity, duplication)
- Incomplete coverage of scope (partial work)

### After Each Initiative

Log completion status: completed / partial / skipped / failed.

**Checkpoint:** Update the initiative's `status` to its final value (`completed`, `partial`, `skipped`, or `failed`). Set `current_phase: null`. If this is the last initiative, set `current_step: "step-6"`.

Collect `proposed_improvements` from the engineer's build report. These are ideas the builder had while working — features that should exist, edge cases not covered, UX gaps. Include them in the digest and present to the CEO in Step 7.

### Register Features in goal.json (after all initiatives complete)

When the directive produces new features (most directives do), register or update them in the appropriate `goal.json`:

1. **For each completed initiative that produced a shippable feature:**
   - Read `.context/goals/{goal_folder}/goal.json`
   - Add or update the feature entry with:
     - `source_directive`: the directive name (`$ARGUMENTS`)
     - `dod`: structured DOD from Morgan's plan — `{ "criteria": [{ "text": "...", "met": true/false, "verified_by": "reviewer-name" }] }`
     - `report`: the report filename (set in Step 6c, can be null here — updated later)
   - If the feature already exists (from a previous partial run), update rather than duplicate

2. **For each completed initiative, also update directive.json:**
   - Add the feature's full ID (`goal-id/feature-id`) to `produced_features` array

This ensures bidirectional links: feature -> directive (via `source_directive`) and directive -> feature (via `produced_features`).

## Step 6: Update Goal OKRs (if applicable)

If `.context/goals/{goal_folder}/okrs.md` exists, update the "Last updated" date and assess any existing KR statuses based on initiative outcomes. Do NOT create new KRs from directive work — goal-level OKRs are managed separately at the quarterly level.

If no okrs.md exists, skip this step.

## Step 6b: Process Follow-Up Actions

Collect all `follow_ups` from the audit findings (Step 3b) across all initiatives. Process them by risk level:

### Low Risk — Auto-Execute

Spawn an engineer agent to execute all low-risk follow-ups in a single batch. The agent receives:
- The list of low-risk follow-up actions with affected files
- `.context/preferences.md` and `.context/lessons.md`
- Verify command: `npm run type-check`
- Instruction: "Execute these cleanup actions. They've been classified as low-risk (safe to do without CEO approval). Run the verify command when done. Report what you changed."

**Low-risk examples:** Delete dead code files, remove unused imports, delete unused variables, create backlog tickets, update OKR status files, fix typos.

### Medium Risk — Batch for CEO Approval

Present all medium-risk follow-ups to the CEO in a single batch using AskUserQuestion:

```
The audit found {N} medium-risk follow-ups that need your approval:

1. {action} — {rationale}
   Files: {file list}

2. {action} — {rationale}
   Files: {file list}

Approve all / Skip all
```

If more than 3 items and the CEO wants selective approval, list each item individually with Y/N options.

For approved items, spawn an engineer agent to execute them.

**Medium-risk examples:** Fix auth gaps, add input validation, add middleware, refactor modules, change API behavior, update dependencies.

### High Risk — Write to Backlog

For each high-risk follow-up, write it to `.context/goals/{goal_folder}/backlog.json` as a new item with structured fields:

```json
{
  "id": "{kebab-case-action-slug}",
  "title": "{action title}",
  "status": "pending",
  "priority": "P1",
  "source_directive": "$ARGUMENTS",
  "context": "{what the audit found + risk rationale}",
  "created": "{today YYYY-MM-DD}",
  "updated": "{today YYYY-MM-DD}",
  "promoted_to_feature": null,
  "promoted_at": null
}
```

Set `source_directive` to the current directive name so the backlog item is traceable back to this directive. This enables the cross-reference system to answer "which directive created this backlog item?"

**High-risk examples:** Schema changes, new API endpoints, infrastructure changes, auth flow changes, anything user-facing, anything that could affect revenue or SEO.

### Skip follow-ups if:
- The directive is research-only (no code changes expected)
- No follow-ups were identified in the audit
- All initiatives were skipped or failed (follow-ups may be invalid)

## Step 6c: Generate Digest

**This step runs LAST** — after OKRs are updated and follow-ups are processed, so all data is available.

Write a digest to `.context/reports/$ARGUMENTS-{date}.md`.

**After writing the digest**, update directive.json with the report link:
- Read `.context/inbox/$ARGUMENTS.json` (or `.context/done/$ARGUMENTS.json` if already archived)
- Set `report` to the report filename without extension (e.g., `"improve-security-2026-03-01"`)
- Also update `produced_features` if any features were registered in the "After Each Initiative" step but the directive.json wasn't updated yet

Report file format:

```markdown
# Directive Report: {goal title}

**Date**: {today}
**Directive**: {directive filename}
**Planned by**: Morgan Park (COO)

## Summary

{1-2 sentence overview of what was accomplished}

## Definition of Done Assessment

### {Initiative Title}
- [x] {criterion 1} — MET
- [x] {criterion 2} — MET
- [ ] {criterion 3} — NOT MET ({reason})

(repeat for each initiative)

## Initiatives

### {Initiative Title} — {status: completed/partial/skipped/failed}
- **Phases**: {phases list}
- **Team**: {who was involved}
- **Scope**: {what was accomplished}
- **Files changed**: {list}
- **Audit baseline**: {what the audit found before work started}
- **Review findings**: {summary of reviewer feedback, if any}
- **Notes**: {any blockers, partial work, or follow-ups}

(repeat for each initiative)

## Follow-Up Actions

### Auto-Executed (low risk — done, just FYI)
- {action} — {result}

### CEO Approved (medium risk)
- {action} — {approved/rejected} — {result if executed}

### Backlogged (high risk — written to goal backlog)
- {action} — Added to {goal}/backlog.md

## Agent-Proposed Improvements

{Collect all `proposed_improvements` from engineer build reports. These are gaps, missing features, and edge cases identified by agents during the build — not assigned work, but initiative from the builders.}

- {improvement description} — proposed by {agent/initiative}
- {improvement description} — proposed by {agent/initiative}

{If no improvements were proposed, note: "No improvements proposed — agents completed assigned work only." This is a signal that the initiative instruction isn't working.}

## Corrections Caught

{Aggregate corrections_check data from all initiative reviews. For each violation found and fixed during the build cycle:}

| Correction | Initiative | Reviewer | Resolution |
|------------|-----------|----------|------------|
| {Standing Correction #N: description} | {initiative title} | {who caught it} | {Fixed in retry / Noted for follow-up} |

- **Corrections reviewed**: {total across all initiatives} (out of {N} standing corrections × {M} initiatives)
- **Violations found**: {count}
- **Violations fixed**: {count fixed during retry vs noted}

{If no violations: "All standing corrections verified across all initiatives. No violations found — the guardrails held."}

## UX Verification Results

{Results from browser testing after UI initiatives:}
- {page/flow tested}: {pass/fail} — {what was found}
- Screenshots: {list of screenshots taken}

{If no UI work: "No UI initiatives — UX verification skipped."}

## Self-Assessment

### Audit Accuracy
- Findings confirmed by build: {count}/{total}
- Findings that were wrong or irrelevant: {list}
- Issues found during build that audit missed: {list}

### Build Success
- Type-check passed: {yes/no}
- Initiatives completed: {count}/{total}
- Build failures: {list if any}

### UX Verification
- UI initiatives verified in browser: {count}/{total UI initiatives}
- Dead-end UI found: {count} (elements that look clickable but do nothing)
- Data mismatches found: {count} (numbers/counts that don't match backend)
- Issues fixed during verification: {list or "none"}

### Agent Initiative
- Improvements proposed by agents: {count}
- Improvements worth pursuing: {list or "none yet — need more data"}
- Agents that proposed nothing: {list — these agents need better prompting}

### Risk Classification
- Low-risk auto-executes that caused problems: {list or "none"}
- Items that should have been classified differently: {list or "none"}

### Challenge Accuracy
- C-suite challenges: {count endorsed, count challenged, count flagged}
- Challenges that proved correct in hindsight: {list or "N/A — first run"}
```

## Step 6d: Update Lessons

If the directive produced new learnings, append them to the appropriate topic file:
- Agent behavior lessons → `.context/lessons/agent-behavior.md`
- Orchestration/planning lessons → `.context/lessons/orchestration.md`
- State/checkpoint/dashboard lessons → `.context/lessons/state-management.md`
- Review/quality lessons → `.context/lessons/review-quality.md`
- Pipeline/skill/repo lessons → `.context/lessons/skill-design.md`
- Project/codebase lessons → `.context/lessons.md`

**Only add if:** something unexpected happened, a pattern emerged that prevents future mistakes, or a workaround was needed. Skip if the directive completed cleanly with no surprises.

**Format:** For failure-mode lessons, include what was tried and why it failed — not just the fix. Example: `**Morgan produces prose before JSON despite "output ONLY JSON" instructions.** Fix: stronger preamble ("first character must be {") AND parse defensively.` For stable patterns/facts, a single sentence is fine.

Read existing topic files first to avoid duplicates.

**Consolidation trigger:** After every 10th directive (count reports in `.context/reports/`), re-read all reports and consolidate recurring patterns into the topic files. Remove one-off entries that haven't recurred. This keeps lessons actionable, not bloated.

**Personality evolution trigger:** On the same 10th-directive cycle, also update the `## Learned Patterns` section in each agent's personality file (`.claude/agents/*.md`). For each agent, extract lessons from `conductor/lessons.md` that are relevant to their role:
- **Morgan** — operational patterns (sequencing, scoping, casting, compression)
- **Sarah** — technical patterns (audit accuracy, review findings, schema issues, build failures)
- **Marcus** — product patterns (UX verification, user perspective, feature management)
- **Priya** — growth patterns (content strategy, SEO, browser testing)

Replace the contents between `## Learned Patterns` and the next `##` heading. Keep each pattern as a single bullet with bold lead + explanation. Max 8 patterns per agent — keep only the most impactful.

## Step 6e: Re-index State

After all code changes, re-run the state indexer so the dashboard reflects the latest work:

```bash
npx tsx scripts/index-state.ts
```

This reads the entire `.context/` tree and produces structured JSON files in `.context/state/`:
- `goals.json` — goal hierarchy with active/done feature counts
- `features.json` — all features with task progress
- `backlogs.json` — all backlog items with structured fields
- `conductor.json` — directives, reports, discussions
- `index.json` — summary statistics

The dashboard's chokidar watcher picks up changes automatically. If the state indexer fails, log the error but don't block the directive.

**Copy state files** if working in a worktree: the dashboard watches `.context/state/` in the **main repo**, not the worktree. Copy with:
```bash
cp .context/state/*.json /path/to/main/repo/.context/state/
```

**Checkpoint:** Update `wrapup.digest_path` to the report path. Set `current_step: "step-7"`.

**Cleanup:** Delete the checkpoint file (`rm .context/checkpoints/{directive-name}.json`). The directive is complete — the digest and artifacts serve as the permanent record.

## Step 6f: Archive Directive

Move the directive file AND its companion JSON from inbox/ to done/:

```bash
mkdir -p .context/done
mv .context/inbox/$ARGUMENTS.md .context/done/$ARGUMENTS.md
mv .context/inbox/$ARGUMENTS.json .context/done/$ARGUMENTS.json
```

If the files don't exist in inbox/ (e.g., already moved or created directly in done/), skip silently.

**Update directive.json on archive:**
- Read `.context/done/$ARGUMENTS.json`
- Set `status` to `"done"`
- Set `completed` to today's date (`YYYY-MM-DD`)
- Ensure `produced_features` is populated with all feature IDs created by this directive
- Ensure `report` is set to the digest filename
- Write the updated JSON back

## Step 7: Report to CEO

Show the CEO:
1. The digest summary (not the full file — just the key points)
2. Run `git diff --stat main..directive/$ARGUMENTS` to show ONLY this directive's changes — not pre-existing uncommitted work
3. Any review findings that need attention
4. Recommended next steps
5. The branch name: "Review with `git log directive/$ARGUMENTS` and merge when ready"

## Failure Handling

| Situation | Action |
|-----------|--------|
| Challenger's output doesn't parse as JSON | Log the error, continue. Challenge is advisory, not blocking. |
| All challengers endorse | Note in Step 4, proceed normally. |
| A challenger challenges the directive | Highlight prominently in Step 4. CEO decides whether to proceed. |
| Morgan's plan doesn't parse as JSON | Stop, show the raw output, ask CEO to intervene |
| Worktree creation fails | Warn CEO, work in the main repo instead. All changes are uncommitted, CEO can review with `git diff`. |
| Audit finds nothing for ALL initiatives | Skip to Step 6c, generate digest noting "no issues found", recommend CEO review the directive scope. |
| CEO rejects the plan | Stop. CEO can re-run with adjusted directive or manually edit the plan |
| Agent fails mid-initiative | Skip remaining tasks in that initiative, continue to next. Log in digest. |
| Reviewer finds issues | Non-fatal. Include in digest. CEO decides whether to address. |
| Initiative is blocked | Skip, note in digest, continue to next initiative |
| All initiatives fail | Generate digest showing failures, recommend CEO review |
| Audit finds nothing to fix | Remove initiative from plan, note in digest |
| Context exhaustion mid-directive | Checkpoint file preserves state. Re-run `/directive {name}` to resume. |
| Brainstorm agents disagree on approach | Present all approaches with trade-offs in clarifying questions. Let CEO pick direction. Don't synthesize conflicting approaches into a compromise. |

## Rules

### NEVER
- Run the pipeline in the CEO's session — always delegate to Alex (Step 0a) unless CEO says "run inline"
- Skip triage (Step 0b) — Alex must classify before choosing the process weight
- Run heavyweight process for lightweight work (wastes tokens and CEO attention)
- Run lightweight process for heavyweight work (skips critical safety gates)
- Execute heavyweight directives without CEO approval of the combined plan (Morgan + audit)
- Skip the planning phase (Morgan evaluation)
- Skip the technical audit (Step 3b) — always verify scope before CEO approval
- Skip the challenge step (Step 2b) — Morgan's inline challenge is always required; separate challengers only for heavyweight/controversial
- Have Morgan scan the codebase (she plans strategy, not code)
- Run initiatives in parallel (sequential by priority)
- Treat reviewer findings as blockers (they're advisory)
- Accept a review that only covers code quality without user-perspective evaluation
- Spawn agents without their personality files (for named agents)
- Commit, push, checkout, or reset git state (CEO manages git). Note: `git checkout -b` (Step 4b), `git worktree add` (Step 4b), and `git diff --stat` (Step 7) are allowed — they're read-only or isolated operations.
- Add clarification phase to simple initiatives with just ["build", "review"] phases — tight scope makes it unnecessary token overhead
- Have the same agent review changes to its own behavior, prompts, or personality (conflict of interest)
- Run strategic process for directives with a clear prescribed approach (that's heavyweight, not strategic)

### ALWAYS
- Delegate to Alex via Step 0a when the CEO invokes /directive (keeps CEO session clean)
- Triage the directive (Step 0b) before choosing which process to run
- Upgrade to heavyweight if ANY guardrail in vision.md could be affected
- Include Morgan's inline challenge analysis in every plan — separate challengers for heavyweight/controversial only
- Read preferences.md + vision.md guardrails before spawning any agent
- Run technical audit before CEO approval to verify scope
- Read lessons.md AND relevant conductor/lessons/ topic files before spawning any agent
- Include personality text in named agent prompts
- Include preferences.md + guardrails in all agent prompts
- Include audit findings in engineer prompts (active files, recommended approach)
- Include verify command in engineer prompts
- Include "propose what's missing" instruction in engineer prompts
- Run UX verification in browser after any initiative that touches UI code
- Include user-perspective evaluation in every reviewer prompt (not just code quality)
- Require `user_walkthrough` in engineer build reports and `user_perspective` in reviewer output
- Process follow-ups by risk level after initiatives complete (Step 6b)
- Include self-assessment metrics in the digest (Step 6c)
- Include agent-proposed improvements in the digest (Step 6c)
- Include UX verification results in the digest (Step 6c)
- Update lessons if the directive produced new learnings (Step 6d)
- Log initiative status after each completes
- Generate a digest even if everything fails
- Re-index state after code changes (Step 6e) so dashboard is current
- Show the CEO what happened at the end
- Write checkpoint after every phase transition (Step 3, 4, 4b, 4c, 5 phases, 6)
- Write artifact files after every phase output in Step 5
- Delete checkpoint file after digest is written (Step 6 cleanup)
- Move directive from inbox/ to done/ after digest is written (Step 6f)
- Include clarification phase before build when initiative has design/research/product-spec phases (Morgan's phase list should already include it)
- Include initiative's definition_of_done in every reviewer prompt
- Include Standing Corrections check in every reviewer prompt
- Match reviewers to the domain being changed (process→Morgan, product→Marcus, architecture→Sarah)
- Never assign an agent to review changes to its own behavior or prompts
- Use file-pattern matching (*.tsx, *.jsx, *.css, etc.) to detect UI-touching initiatives — don't rely on subjective judgment
- Cast multiple reviewers when initiative crosses domains (UI + backend, process + product)
- Classify as strategic when the directive states a problem without prescribing an approach AND the work has lasting architectural/process consequences

# Brainstorm: Improve Agent Productivity

Date: 2026-03-03
Directive: improve-agent-productivity
Participants: Sarah (CTO), Morgan (COO) — brainstorm via web research

---

## Sarah's Proposal (CTO — Architecture)

### Recommended Approach

Adopt a **hybrid orchestration model** that replaces SKILL.md-driven LLM orchestration with a thin deterministic TypeScript layer powered by the Claude Agent SDK, while keeping the personality-driven C-suite agents that make this system unique.

The key insight from the research: the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) provides the exact primitives we need — `query()` with streaming, `allowedTools` for scoped tool access, subagent definitions via `agents` config, session persistence/resume, hooks for lifecycle events, and MCP server integration. We would write a TypeScript orchestrator script that reads directive files, determines weight, spawns the right agents with the right prompts and tool scopes — all deterministically, with LLM flexibility only where it adds value (planning, building, reviewing).

Specific architecture:
1. **Orchestrator script** (`scripts/orchestrate.ts`) — deterministic TypeScript that reads `.context/directives/`, classifies weight, and runs the pipeline steps as code (not prompts)
2. **Agent definitions** — keep `.claude/agents/*.md` but also register them programmatically as SDK `AgentDefinition` objects with proper `tools`, `model`, and `prompt` fields
3. **Parallel execution** — use `Promise.all()` for independent agents (brainstorm agents, parallel initiatives) instead of sequential LLM spawning
4. **Context injection** — each agent gets only the files it needs (via `prompt` field), not the entire SKILL.md. Research shows this reduces overhead from 50K to ~5K tokens per spawn
5. **Session persistence** — use SDK's `resume: sessionId` to continue agents across context exhaustion instead of our custom checkpoint JSON

### Key Trade-offs

- **Agent SDK dependency**: Ties the framework to Anthropic's SDK. If they break the API, we break. Mitigated by the SDK being actively maintained and open-source.
- **Loss of conversational flexibility**: Deterministic orchestration can't adapt mid-pipeline the way an LLM orchestrator can. Mitigated by keeping LLM agents for the creative phases (brainstorm, planning, building) and only making the pipeline flow deterministic.
- **Migration complexity**: SKILL.md is 80KB+ of carefully tuned prompts. Moving to SDK-based orchestration requires decomposing it into individual agent prompts and a separate orchestration script. This is a multi-week effort.
- **Claude Code Agent Teams vs Agent SDK**: Agent Teams (experimental, Feb 2026) provide inter-agent communication and shared task lists, which could replace our orchestration entirely. But they're experimental with known limitations (no session resumption, no nested teams). The Agent SDK is more mature and controllable.

### What to Avoid

Do NOT adopt a full agent framework (CrewAI, LangGraph, AutoGen). These add enormous dependency weight for patterns we can implement in 200 lines of TypeScript with the Agent SDK. Our system's value is the personality-driven C-suite and context tree — not the orchestration plumbing. Keep the plumbing thin.

Do NOT try to make Agent Teams the primary orchestration mechanism yet. They're experimental, use 3-4x tokens, and have no session resumption. Monitor them for when they stabilize, but don't build on them now.

### Confidence: High

The Agent SDK is purpose-built for exactly our use case. The research confirms hybrid (deterministic orchestration + LLM agents) is the industry consensus for production systems.

---

## Morgan's Proposal (COO — Operations)

### Recommended Approach

Focus on the **operational bottlenecks first** before reaching for new frameworks. The directive identifies 5 pain points — 3 of them (Alex doing too much, sequential spawning, failed spawns) are process problems that can be fixed with better SKILL.md design and agent configuration, no SDK needed. The other 2 (heavy prompts, missing context) benefit from the SDK but are lower priority.

Phased approach:
1. **Phase 1: Fix Alex's scope (week 1)** — Alex currently reads the full SKILL.md (80KB+), decides weight, plans if lightweight, audits if medium, and sometimes even codes (CEO flagged this twice). Split Alex's responsibilities: Alex does ONLY orchestration dispatch. Create a new `dispatcher` script or agent that handles weight classification deterministically (regex on directive keywords, file-count heuristics). Alex becomes a thin coordinator, not a Swiss Army knife.
2. **Phase 2: Enable parallel spawning (week 1-2)** — The current pipeline spawns agents sequentially because SKILL.md says "spawn, wait, collect, spawn next." For brainstorm and independent initiatives, we can spawn in parallel TODAY by updating SKILL.md instructions to use `run_in_background: true` for independent work. No SDK needed. For the SDK path: `Promise.all()` on multiple `query()` calls.
3. **Phase 3: Reduce spawn overhead (week 2-3)** — Custom subagent definitions (`.claude/agents/`) already support `tools` restrictions and `model` selection. Create purpose-specific subagents (`auditor`, `builder`, `reviewer`) with minimal system prompts instead of loading the full SKILL.md. Research shows this cuts tokens from 50K to 5K per spawn. Use `model: "haiku"` for low-stakes work (exploration, linting checks).
4. **Phase 4: SDK migration (week 3-4)** — Only after Phases 1-3 prove the operational improvements, migrate the orchestration loop to the Agent SDK. The SDK provides the deterministic shell; our custom agents provide the intelligence. This is the expensive phase — do it last, with proof the simpler fixes weren't enough.

### Key Trade-offs

- **Incremental vs Big Bang**: My phased approach means slower initial improvement but lower risk. Sarah's "build an SDK orchestrator" approach is faster to full value but has a higher failure mode (migration breaks the pipeline for days).
- **SKILL.md evolution vs replacement**: I want to evolve SKILL.md incrementally (smaller prompts, better instructions). Sarah wants to replace it with code. The truth is probably both — evolve SKILL.md now, replace with SDK later.
- **Custom subagent definitions are already available**: `.claude/agents/` is an existing feature we're underusing. We have 10 agent definitions but most orchestration still goes through `general-purpose` subagents with giant inline prompts. Using named agents with scoped tools is free improvement.

### What to Avoid

Do NOT start with the Agent SDK migration. It's the highest-risk, highest-effort change. Fix the process problems first — they're free or near-free improvements that prove out the patterns the SDK would formalize.

Do NOT over-invest in Agent Teams. They use 3-4x tokens and are experimental. Our C-suite model (static personalities, ephemeral engineers) is a better fit for subagents than teams — the C-suite doesn't need to "debate each other in real-time" since we have structured challenge phases.

Do NOT try to make this a single directive. This should become an ongoing goal with 4-5 projects executed over weeks. Each phase produces measurable improvement.

### Confidence: Medium-High

The operational fixes (Phases 1-3) are high-confidence. The SDK migration (Phase 4) is medium-confidence — depends on whether the simpler fixes are sufficient.

---

## Research Summary: External Landscape

### Claude Agent SDK (Production-Ready)
- Available in Python (`claude-agent-sdk`) and TypeScript (`@anthropic-ai/claude-agent-sdk`)
- Provides: query(), built-in tools, subagent definitions, session persistence/resume, hooks, MCP integration
- Subagents run in isolated context windows with scoped tools — exactly what we need
- Subagents cannot spawn sub-subagents (flat hierarchy only)
- Supports `model` per agent (haiku for cheap work, opus for complex)

### Claude Code Agent Teams (Experimental, Feb 2026)
- Teammates communicate directly, share task lists, self-coordinate
- 3-4x token cost vs single session
- Known limitations: no session resumption, no nested teams, shutdown can be slow
- Best for: tasks requiring real-time inter-agent debate/coordination
- Our assessment: interesting but too experimental and expensive for orchestration

### Claude Code Custom Subagents (Stable)
- `.claude/agents/` definitions with YAML frontmatter
- Support: custom tools, model selection, permission modes, hooks, persistent memory, worktree isolation
- Built-in: Explore (haiku, read-only), Plan (read-only), general-purpose (all tools)
- We already have 10 agents defined but underuse them — most work goes through general-purpose

### Industry Consensus (CrewAI, LangGraph, AutoGen, Swarm)
- Convergence toward graph-based or deterministic orchestration with LLM agents at nodes
- OpenAI Swarm: lightweight handoffs between specialized agents (now superseded by OpenAI Agents SDK)
- CrewAI: role-based teams, hierarchical process with manager agents
- LangGraph: graph-based state machines, strongest production guarantees
- All frameworks moving toward: deterministic flow + LLM flexibility at decision points
- Key insight: "Deterministic orchestration of non-deterministic agents" is the winning pattern

### Token Optimization Research
- Every subagent bootstrap costs 5,000-15,000 tokens (context loading)
- Tool descriptions alone can consume 2,000-8,000 tokens
- Scoped tool access (3-4 tools vs 20+) dramatically reduces overhead
- Model selection (haiku for exploration, sonnet for building) reduces cost 73% in one case study
- Minimal, focused system prompts (5K vs 50K) are the single biggest optimization

---

## Synthesis: Where Sarah and Morgan Agree

1. **The Agent SDK is the right long-term architecture** — both agree it's the right target, they disagree on timing
2. **Custom subagent definitions are underused** — we have the infrastructure, we're not leveraging it
3. **Parallel spawning is achievable now** — both propose `run_in_background` / `Promise.all()`
4. **Agent Teams are premature** — too experimental, too expensive, wrong model for our C-suite pattern
5. **External frameworks (CrewAI, LangGraph) are unnecessary** — we'd be adding complexity for patterns we can implement in <500 lines
6. **Token optimization via scoped tools/prompts is critical** — the single biggest quick win

## Where They Disagree

1. **Timing of SDK migration**: Sarah says build the SDK orchestrator now (it IS the fix). Morgan says fix process first, SDK later (prove you need it).
2. **SKILL.md evolution vs replacement**: Morgan wants incremental improvement. Sarah wants a clean break.
3. **Scope of initial work**: Sarah scopes a 4-week project. Morgan scopes 4 phases over 4 weeks but front-loads the cheap wins.

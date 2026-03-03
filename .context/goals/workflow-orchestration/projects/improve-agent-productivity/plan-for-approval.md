# Plan for Approval: Improve Agent Productivity

Date: 2026-03-03
Directive: improve-agent-productivity
Classification: Strategic
Goal alignment: workflow-orchestration

---

## Brainstorm Synthesis

The C-suite brainstormed two approaches. Sarah (CTO) advocates building a deterministic TypeScript orchestrator using the Claude Agent SDK immediately — it solves all 5 pain points at once. Morgan (COO) advocates fixing operational bottlenecks first (Alex's scope, parallel spawning, prompt bloat) with existing tools, then migrating to the SDK once the process improvements are proven.

Both agree on: Agent SDK is the right target, custom subagents are underused, Agent Teams are premature, external frameworks are unnecessary, and token optimization via scoped tools is the biggest quick win.

They disagree on: whether to start with the SDK (Sarah) or start with process fixes and defer the SDK (Morgan).

**Recommended synthesis**: Morgan's phased approach with Sarah's SDK as the Phase 4 target. Front-load cheap wins that prove patterns, then formalize them in the SDK. This aligns with the vision principle "self-evolution through research" — we steal the SDK pattern from Anthropic's own tooling, but we earn it incrementally.

---

## Proposed Goal Structure

**New ongoing goal**: `agent-productivity`
- Category: framework
- Description: Continuously improve agent orchestration — reduce spawn overhead, enable parallelism, improve error recovery, optimize token usage, and evolve toward deterministic orchestration patterns.

This is a SEPARATE goal from `workflow-orchestration` because it's about HOW agents work (infrastructure), not WHAT they do (pipeline steps). It will have ongoing projects as the team discovers new improvements.

---

## Initiatives (4 Projects)

### Project 1: Scope Reduction — Slim Alex Down (P0, Week 1)

**Problem**: Alex reads 80KB+ of SKILL.md, does weight classification, sometimes codes (flagged twice), and acts as a Swiss Army knife instead of a pure coordinator.

**Work**:
- Create focused subagent definitions for each pipeline role: `auditor` (read-only, haiku), `builder` (all tools, inherit model), `reviewer` (read-only, inherit model)
- Each gets a minimal system prompt (~2-5KB) instead of inheriting full SKILL.md
- Update SKILL.md to instruct Alex to use named subagents instead of `general-purpose` with inline prompts
- Add `model: "haiku"` for exploration/audit work, `model: "sonnet"` for building

**Casting**: 1 engineer (builds agent defs + SKILL.md updates) + Sarah (reviews architecture)

**Definition of Done**:
- 3+ new named subagent definitions in `.claude/agents/` (auditor, builder, reviewer)
- SKILL.md updated to reference named agents instead of general-purpose
- Token reduction measurable: before/after spawn token counts documented
- Alex's personality file unchanged (no scope creep into Alex's definition)

**Risk**: Low. Agent definitions are additive; SKILL.md changes are medium-risk but within our safe playground.

---

### Project 2: Parallel Execution — Unblock Concurrent Spawning (P0, Week 1-2)

**Problem**: Brainstorm agents, independent initiatives, and build+review cycles all run sequentially despite being independent.

**Work**:
- Update SKILL.md brainstorm phase to explicitly spawn 2-3 agents with `run_in_background: true` and collect results
- Update Step 5 (execution) to identify independent initiatives and spawn them in parallel
- Add a dependency-tracking pattern to SKILL.md: initiatives declare what files they modify, and initiatives with non-overlapping file sets run in parallel
- Document the pattern in `lessons/orchestration.md`

**Casting**: 1 engineer (SKILL.md updates + dependency logic) + Morgan (reviews orchestration pattern)

**Definition of Done**:
- Brainstorm phase spawns agents in parallel (not sequential)
- Independent initiatives execute concurrently (verified by running a test directive)
- Dependency conflicts detected and serialized (initiatives touching same files run sequentially)
- Pattern documented in lessons/orchestration.md

**Risk**: Medium-low. Parallel spawning is an existing Claude Code feature. The dependency-tracking is new logic but only in SKILL.md instructions.

---

### Project 3: Token Optimization — Minimize Spawn Overhead (P1, Week 2-3)

**Problem**: Every agent spawn loads 5K-15K tokens of context bootstrap plus 2K-8K tokens of tool descriptions. Most agents only need 3-4 tools but inherit 20+.

**Work**:
- Audit current spawn token costs (instrument a directive run, measure per-agent token usage)
- Restrict tool access per agent role: auditor gets `Read, Grep, Glob, Bash`; builder gets `Read, Write, Edit, Bash, Glob, Grep`; reviewer gets `Read, Grep, Glob`
- Add `model: "haiku"` to exploration and audit agents
- Create a minimal system prompt template (~2KB) for each agent role, injecting only the context files the agent needs
- Evaluate `skills` field in subagent frontmatter for injecting domain context without loading full SKILL.md

**Casting**: 1 engineer (audits + implements) + Sarah (reviews token optimization strategy)

**Definition of Done**:
- Before/after token cost comparison for a sample directive
- Tool scoping implemented for all named agents
- Model routing implemented (haiku for cheap work, sonnet/opus for expensive)
- At least 50% reduction in per-agent spawn overhead documented

**Risk**: Low. Tool restriction and model selection are existing subagent features.

---

### Project 4: Agent SDK Orchestrator — Deterministic Pipeline (P2, Week 3-4)

**Problem**: The entire pipeline is LLM-driven — SKILL.md tells the LLM what to do at each step, and the LLM decides. This is slow, token-expensive, and unreliable for deterministic decisions (weight classification, file reading, checkpoint management).

**Work**:
- Build `scripts/orchestrate.ts` — a TypeScript script that uses the Claude Agent SDK to:
  - Read directive files and classify weight deterministically (regex + heuristics, not LLM)
  - Spawn agents using SDK's `query()` with proper `AgentDefinition` objects
  - Run parallel agents using `Promise.all()` on multiple `query()` streams
  - Manage checkpoints using SDK's session persistence (`resume: sessionId`)
  - Apply hooks for pre/post tool validation
- Migrate one pipeline path (lightweight directives) as the first integration test
- Keep SKILL.md as the fallback for heavyweight/strategic directives until the SDK path is proven
- Evaluate whether Agent Teams make sense for brainstorm phases (parallel C-suite debate)

**Casting**: 1 senior engineer (builds orchestrator) + Sarah (reviews architecture) + Morgan (reviews operational impact)

**Definition of Done**:
- `scripts/orchestrate.ts` can execute a lightweight directive end-to-end using the Agent SDK
- Checkpoint/resume works via SDK sessions (not custom JSON)
- At least 2x speed improvement for lightweight directives vs current SKILL.md path
- Fallback to SKILL.md path documented and tested
- Agent Teams evaluated with a written recommendation (adopt/defer/reject)

**Risk**: Medium-high. This is the biggest change and creates a new orchestration path. Fallback to SKILL.md mitigates risk of regression.

**Trigger gate**: Only start after Projects 1-3 produce measurable improvements. If Projects 1-3 deliver >60% of the desired improvement, deprioritize Project 4 to P3.

---

## Clarifying Questions for CEO

1. **New goal vs subgoal**: Should `agent-productivity` be a new top-level goal (making 4 goals total), or a sub-area within `workflow-orchestration`? Sarah's view: separate goal because it's infrastructure, not pipeline logic. Morgan's view: keep it in workflow-orchestration to avoid goal sprawl. The directive itself suggests a new goal.

2. **SDK commitment level**: The Agent SDK is available now and well-documented. Should we commit to it as the target architecture (Project 4 is a "when", not an "if"), or should Project 4 remain conditional on Projects 1-3 results? Sarah says commit now. Morgan says keep the trigger gate.

3. **Alex's scope reduction — how far?**: Project 1 adds named subagents but keeps Alex as the coordinator. Should we also explore removing Alex as an LLM agent entirely and replacing with a deterministic dispatcher script? This would be a bigger change but eliminates the "Alex does too much" problem at the root. Morgan suggests this as a Phase 5 exploration after the SDK orchestrator proves itself.

---

## Execution Timeline

| Week | Project | Deliverable |
|------|---------|-------------|
| 1 | P1: Scope Reduction | Named subagent defs, SKILL.md updates |
| 1-2 | P2: Parallel Execution | Parallel brainstorm + initiative execution |
| 2-3 | P3: Token Optimization | Scoped tools, model routing, measured savings |
| 3-4 | P4: SDK Orchestrator (conditional) | scripts/orchestrate.ts for lightweight directives |

Total estimated effort: 4 directives (one per project), 4 weeks.

---

## Sources Consulted

- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Agent SDK npm package](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Code Subagent Cost Explosion](https://www.aicosts.ai/blog/claude-code-subagent-cost-explosion-887k-tokens-minute-crisis)
- [LangGraph vs CrewAI vs AutoGen Comparison 2026](https://dev.to/pockit_tools/langgraph-vs-crewai-vs-autogen-the-complete-multi-agent-ai-orchestration-guide-for-2026-2d63)
- [Multi-Agent LLM Orchestration — Deterministic Patterns](https://arxiv.org/abs/2511.15755)
- [7 Agentic AI Trends 2026](https://machinelearningmastery.com/7-agentic-ai-trends-to-watch-in-2026/)
- [OpenAI Swarm Framework](https://github.com/openai/swarm)
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

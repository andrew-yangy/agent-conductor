# Approved Plan: Improve Agent Productivity

Date: 2026-03-03
Directive: improve-agent-productivity
Classification: Strategic
Goal: agent-productivity (NEW top-level goal)

---

## CEO Decisions

1. **New top-level goal**: `agent-productivity` — separate from `workflow-orchestration` because it's about HOW agents work (infrastructure), not WHAT they do (pipeline steps)
2. **SDK deferred**: CC-native optimization first (included in plan, no API costs). SDK revisited when cost model makes sense or CC-native hits limits.
3. **Aggressive Alex reduction**: Thin Alex's prompt down AND add deterministic shell scripts for mechanical tasks (weight classification, file reading, checkpoint management)

---

## Brainstorm Synthesis

Sarah (CTO) advocated for immediate SDK orchestrator. Morgan (COO) advocated fixing operational bottlenecks first. CEO chose CC-native first with SDK as future option — cost was the deciding factor (SDK uses API key billing, not CC plan).

Both agreed: custom subagents are underused, Agent Teams are premature (3-7x cost), external frameworks unnecessary, scoped tools/prompts are the biggest quick win.

---

## Projects (3 Active + 1 Deferred)

### Project 1: Scope Reduction — Thin Alex + Deterministic Helpers (P0)

**Problem**: Alex reads 80KB+ of SKILL.md, does weight classification, sometimes codes, and acts as a Swiss Army knife instead of a thin coordinator.

**Work**:
- Create focused subagent definitions: `auditor` (read-only, haiku), `builder` (scoped tools, inherit model), `reviewer` (read-only, inherit model)
- Each gets a minimal system prompt (~2-5KB) instead of inheriting full SKILL.md
- Build deterministic shell scripts for mechanical tasks:
  - `scripts/classify-directive.sh` — weight classification via regex/heuristics on directive content
  - `scripts/read-context.sh` — reads and assembles context files for agent prompts
  - `scripts/checkpoint.sh` — manages checkpoint JSON (read/write/resume)
- Update SKILL.md so Alex uses named subagents + calls scripts for deterministic work
- Slim Alex's personality file — coordinator only, no building, no auditing

**Casting**: 1 engineer (builds agent defs + scripts + SKILL.md updates) + Sarah (reviews architecture)

**Definition of Done**:
- 3+ new named subagent definitions in `.claude/agents/` (auditor, builder, reviewer)
- 3 deterministic shell scripts for classification, context assembly, checkpoint management
- SKILL.md updated to reference named agents and call scripts
- Alex's personality explicitly scoped to coordination only
- Token reduction measurable: before/after spawn token counts documented

---

### Project 2: Parallel Execution — Unblock Concurrent Spawning (P0)

**Problem**: Brainstorm agents, independent initiatives, and build+review cycles all run sequentially despite being independent.

**Work**:
- Update SKILL.md brainstorm phase to explicitly spawn 2-3 agents with `run_in_background: true` and collect results
- Update Step 5 (execution) to identify independent initiatives and spawn them in parallel
- Add dependency-tracking: initiatives declare what files they modify; non-overlapping file sets run in parallel
- Add error recovery: if a background agent fails, log and continue (don't block pipeline)
- Document the pattern in `lessons/orchestration.md`

**Casting**: 1 engineer (SKILL.md updates + dependency logic) + Morgan (reviews orchestration pattern)

**Definition of Done**:
- Brainstorm phase spawns agents in parallel (not sequential)
- Independent initiatives execute concurrently
- Dependency conflicts detected and serialized
- Failed spawns handled gracefully (logged, pipeline continues)
- Pattern documented in lessons/orchestration.md

---

### Project 3: Token Optimization — Minimize Spawn Overhead (P1)

**Problem**: Every agent spawn loads 5K-15K tokens of context bootstrap plus 2K-8K tokens of tool descriptions. Most agents only need 3-4 tools but inherit 20+.

**Work**:
- Audit current spawn token costs (instrument a directive run, measure per-agent token usage)
- Restrict tool access per agent role via frontmatter `allowed_tools`:
  - auditor: `Read, Grep, Glob, Bash`
  - builder: `Read, Write, Edit, Bash, Glob, Grep`
  - reviewer: `Read, Grep, Glob`
- Model routing in agent definitions: `model: "haiku"` for exploration/audit, `model: "sonnet"` for building
- Minimal system prompts (~2KB each) injecting only needed context files
- Evaluate hooks (PreToolUse/PostToolUse) for quality gates without token overhead

**Casting**: 1 engineer (audits + implements) + Sarah (reviews token optimization strategy)

**Definition of Done**:
- Before/after token cost comparison for a sample directive
- Tool scoping implemented for all named agents via frontmatter
- Model routing implemented (haiku for cheap work, sonnet/opus for expensive)
- At least 50% reduction in per-agent spawn overhead documented

---

### Project 4: Agent SDK Orchestrator — DEFERRED

**Status**: Parked. Revisit when:
- CC-native optimization (Projects 1-3) hits diminishing returns
- API cost model becomes favorable (price drops, or CC plan doesn't cover needs)
- Need features CC subagents can't provide (structured JSON output, maxBudgetUsd circuit breakers, per-agent cost tracking)

**Research preserved**: See research reports in `.context/goals/workflow-orchestration/projects/improve-agent-productivity/`

---

## Sources

- Research: Agent SDK (1,281 lines) — `research-agent-sdk.md`
- Research: Orchestration Patterns (1,178 lines) — `research-orchestration-patterns.md`
- Research: Real-World Patterns (1,000+ lines) — `research-real-world-patterns.md`
- Brainstorm: Sarah + Morgan — `brainstorm.md`

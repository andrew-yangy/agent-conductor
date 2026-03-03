# Agent Productivity — Domain Context

## Problem Statement

The current agent orchestration is entirely LLM-based — spawning subagents via heavy SKILL.md prompts (~80KB). This causes:
1. Slow spawning (massive token overhead per agent)
2. Alex doing too much (orchestration + work + decision-making)
3. Sequential execution (teams spawned one at a time)
4. Failed spawns with no recovery
5. Missing internal context between agents

## Architecture Decision: CC-Native First

After deep research (March 2026) covering Claude Agent SDK, OpenAI Swarm, LangGraph, CrewAI, and Anthropic's harness engineering patterns, the team decided:

- **CC-native optimization first** — all improvements use Claude Code's existing subagent system (included in CC plan, no API key costs)
- **Agent SDK deferred** — revisit when API cost model makes sense or CC-native hits limits
- **Agent Teams skipped** — experimental, 3-7x token cost, wrong model for our C-suite pattern
- **External frameworks skipped** — CrewAI/LangGraph/AutoGen add unnecessary complexity

## Key Research Findings

1. **Token reduction**: 50K → 5K per agent spawn (10x) with proper isolation
2. **Promise.all() pattern**: Independent agents should run in parallel, not sequential
3. **Deterministic shell, non-deterministic core**: Code handles orchestration; LLMs handle intelligence
4. **Swarm's 150-LOC loop**: Proves orchestration doesn't need a framework
5. **CrewAI's LLM-as-orchestrator is the anti-pattern**: Exactly what we're moving away from

## Research Reports

- `../workflow-orchestration/projects/improve-agent-productivity/research-agent-sdk.md` — Claude Agent SDK deep dive
- `../workflow-orchestration/projects/improve-agent-productivity/research-orchestration-patterns.md` — Framework patterns (Swarm, LangGraph, CrewAI, harness engineering)
- `../workflow-orchestration/projects/improve-agent-productivity/research-real-world-patterns.md` — Real-world implementations, token costs, hooks
- `../workflow-orchestration/projects/improve-agent-productivity/brainstorm.md` — Sarah + Morgan brainstorm

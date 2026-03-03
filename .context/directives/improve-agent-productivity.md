# Improve Agent Productivity

## Problem Statement

The current agent orchestration is entirely LLM-based — spawning subagents via heavy SKILL.md prompts. This is slow and inefficient. Key pain points:

1. **Heavy SKILL.md causes slow spawning** — every agent spawn loads massive prompt templates, wasting tokens and time
2. **Alex does too much** — the Chief of Staff is doing more than orchestration; it's doing work that should be delegated
3. **Sequential spawning instead of parallel** — teams are spawned one at a time rather than concurrently
4. **Failed spawns with no recovery** — some teams don't spawn successfully and the pipeline doesn't handle this gracefully
5. **Missing internal context and logs** — agents lack visibility into what other agents did, losing context across the pipeline

## Research Questions

- **Agent SDK**: Can we use Anthropic's Claude Agent SDK (or similar) with scripts rather than pure LLM-based orchestration? What would the architecture look like?
- **Agent Teams**: Can we adopt or learn from agent team patterns? How do other frameworks structure multi-agent collaboration?
- **Built-in /batch**: Can we leverage Claude Code's built-in /batch skill for parallelization?
- **Framework landscape**: What are other agent frameworks doing for orchestration efficiency? (CrewAI, AutoGen, LangGraph, OpenAI Swarm, etc.)
- **Hybrid approaches**: Can we combine deterministic scripts with LLM agents to get the best of both?

## Desired Outcome

A new ongoing goal (`agents` or similar) dedicated to continuously improving agent productivity, with concrete initiatives to:
- Reduce agent spawn overhead
- Enable parallel execution where safe
- Improve error handling and recovery for failed spawns
- Give agents better internal context/logs
- Reduce Alex's scope to pure orchestration
- Explore non-LLM orchestration patterns (scripts, SDK, frameworks)

## Goal Alignment

workflow-orchestration

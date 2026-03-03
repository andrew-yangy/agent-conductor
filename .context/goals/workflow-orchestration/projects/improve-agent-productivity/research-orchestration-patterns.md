# Research: Deterministic Agent Orchestration Patterns

**Date**: 2026-03-03
**Purpose**: Deep research into how production frameworks orchestrate non-deterministic LLM agents with deterministic code. Patterns to steal for our TypeScript orchestrator replacing the 80KB SKILL.md prompt.

---

## Table of Contents

1. [OpenAI Swarm (and its successor, Agents SDK)](#1-openai-swarm)
2. [Anthropic's Harness Engineering](#2-anthropics-harness-engineering)
3. [LangGraph Orchestration Patterns](#3-langgraph-orchestration-patterns)
4. [CrewAI Process Patterns](#4-crewai-process-patterns)
5. [Claude Code Custom Subagents](#5-claude-code-custom-subagents)
6. [Claude Code /batch and Agent Teams](#6-claude-code-batch-and-agent-teams)
7. [Synthesis: Patterns to Steal](#7-synthesis-patterns-to-steal)

---

## 1. OpenAI Swarm

**Source**: https://github.com/openai/swarm

### Architecture Overview

Swarm is a deliberately minimal orchestration framework built on two primitives: **Agents** and **Handoffs**. It is stateless between calls (entirely powered by Chat Completions API) and educational in intent, but its patterns are production-worthy. OpenAI subsequently shipped the **Agents SDK** (March 2025) as the production successor, adding Guardrails and Tracing while keeping the same core loop.

### Key Data Structures

```python
# types.py — The entire type system fits in ~30 lines

class Agent(BaseModel):
    name: str = "Agent"
    model: str = "gpt-4o"
    instructions: Union[str, Callable[..., str]] = "You are a helpful agent."
    functions: list[AgentFunction] = []        # Tools scoped to THIS agent
    tool_choice: Optional[str] = None
    parallel_tool_calls: bool = True

class Response(BaseModel):
    messages: list = []
    agent: Optional[Agent] = None              # The active agent after run
    context_variables: dict = {}               # Mutable shared state

class Result(BaseModel):
    value: str = ""                            # String output
    agent: Optional[Agent] = None              # Agent to hand off to
    context_variables: dict = {}               # State updates

# AgentFunction = Callable that returns str | Agent | dict
```

### The Core Orchestration Loop

```python
# core.py — The entire orchestrator is ~150 lines

def run(self, agent, messages, context_variables={}, max_turns=inf):
    active_agent = agent
    context_variables = copy.deepcopy(context_variables)
    history = copy.deepcopy(messages)
    init_len = len(messages)

    while len(history) - init_len < max_turns and active_agent:
        # 1. Call the LLM with current agent's config
        completion = self.get_chat_completion(
            agent=active_agent,
            history=history,
            context_variables=context_variables,
            model_override=model_override,
        )
        message = completion.choices[0].message
        message.sender = active_agent.name
        history.append(message)

        # 2. No tool calls? We're done.
        if not message.tool_calls:
            break

        # 3. Execute tools, collect results
        partial_response = self.handle_tool_calls(
            message.tool_calls, active_agent.functions, context_variables
        )
        history.extend(partial_response.messages)
        context_variables.update(partial_response.context_variables)

        # 4. If a tool returned an Agent, HAND OFF
        if partial_response.agent:
            active_agent = partial_response.agent

    return Response(
        messages=history[init_len:],
        agent=active_agent,
        context_variables=context_variables,
    )
```

### How Handoffs Work

A handoff is just a tool function that returns an `Agent` instance:

```python
def transfer_to_sales():
    """Transfer the conversation to the sales agent."""
    return sales_agent  # This IS the handoff

# When handle_tool_calls processes this:
if isinstance(raw_result, Agent):
    result = Result(
        value=json.dumps({"assistant": raw_result.name}),
        agent=raw_result  # Sets partial_response.agent
    )
# Then in the loop: active_agent = partial_response.agent
```

The handoff is invisible to the LLM -- it just sees a function it can call. The orchestrator does the actual switching deterministically.

### How Tools Are Scoped Per Agent

```python
# Each agent carries its own function list
tools = [function_to_json(f) for f in agent.functions]
# Functions matched by name at execution time
function_map = {f.__name__: f for f in active_agent.functions}
```

When an agent hands off, the new agent's functions replace the old ones entirely. No global tool registry.

### Context Variables (Shared Mutable State)

```python
# If a function's signature includes 'context_variables', inject them
if __CTX_VARS_NAME__ in func.__code__.co_varnames:
    args[__CTX_VARS_NAME__] = context_variables

# After execution, merge any updates
context_variables.update(partial_response.context_variables)
```

Context variables persist across handoffs. They are the only state that survives agent transitions.

### OpenAI Agents SDK (Production Successor)

The Agents SDK (March 2025) adds three capabilities to the Swarm pattern:

1. **Guardrails**: Input/output validators that run in parallel with agent execution. Fail fast on policy violations.
2. **Tracing**: Built-in observability for debugging multi-agent flows.
3. **Sessions**: Persistent memory layer for maintaining working context within an agent loop.

The core loop remains the same: `Runner.run_sync(agent, "message")` with automatic tool invocation and handoff handling.

### Strengths

- Radically simple: ~150 lines of orchestration code
- Tools-as-handoffs pattern is brilliant -- agents don't know they're being swapped
- Context variables provide clean shared state without a global bus
- Function-level tool scoping (each agent only sees its own tools)
- Stateless between calls (easy to checkpoint)

### Weaknesses

- No built-in retry, checkpoint, or error recovery
- No parallel agent execution (strictly sequential handoffs)
- No concept of "tasks" or work items -- just conversations
- Context variables are untyped dicts (no schema enforcement)
- Educational only -- no production features (logging, rate limiting, etc.)

### Patterns to Steal

| Pattern | How to Apply |
|---------|-------------|
| **Tools-as-handoffs** | Agent functions can return a different agent config, triggering a deterministic switch |
| **Per-agent tool scoping** | Each agent definition includes its allowed tools; no global registry |
| **Context variables** | Typed shared state that persists across agent transitions |
| **Thin orchestration loop** | While loop: call LLM -> execute tools -> check for handoff -> repeat |
| **Stateless between calls** | Makes checkpoint/resume trivial |

---

## 2. Anthropic's Harness Engineering

**Source**: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

### Architecture Overview

Anthropic's harness pattern addresses the fundamental challenge of long-running agents: they must work across multiple context windows, and each new session starts with no memory. The solution is a **two-agent harness** with deterministic artifacts for continuity.

### The Two-Agent Pattern

```
Session 1 (Initializer Agent):
  Different prompt than subsequent sessions
  Creates: init.sh, claude-progress.txt, feature-list.json
  Establishes: git baseline, dev environment

Sessions 2-N (Coding Agent):
  Same prompt each time (different from Session 1)
  Reads: progress file + git log + feature list
  Works: one feature at a time
  Writes: git commit + progress update
```

Key insight: **asymmetric prompting**. The first session gets a setup prompt; all subsequent sessions get an implementation prompt. But they share identical tools, system prompt structure, and harness.

### The Deterministic State Artifacts

**claude-progress.txt** — The continuity mechanism:
```
[2026-03-01] Implemented user authentication flow
  - Added JWT token generation in auth.ts
  - Created login/register endpoints
  - Tests passing for happy path
  - TODO: Error handling for expired tokens

[2026-03-02] Fixed session management bug
  - Root cause: cookie not set with httpOnly flag
  - Applied fix in middleware/session.ts
  - All auth tests green
```

**feature-list.json** — Structured work tracking:
```json
{
  "category": "functional",
  "description": "New chat button creates a fresh conversation",
  "steps": [
    "Navigate to main interface",
    "Click the 'New Chat' button",
    "Verify a new conversation is created"
  ],
  "passes": false
}
```

Critical design decision: **JSON, not Markdown**. Anthropic found that models are less likely to inappropriately edit or overwrite JSON files. The structured format also prevents agents from gaming the progress tracking.

### Session Startup Sequence (Deterministic)

Every coding session follows this exact sequence:

1. `pwd` — Confirm working directory
2. Read `claude-progress.txt` + `git log --oneline -20`
3. Select highest-priority incomplete feature from feature list
4. Run `init.sh` to start dev environment
5. Run baseline end-to-end tests (Puppeteer MCP)
6. Implement ONE feature
7. `git commit` with descriptive message
8. Update progress file

This is deterministic orchestration: the harness forces this sequence, not the LLM.

### Error Recovery Patterns

| Failure Mode | Deterministic Recovery |
|-------------|----------------------|
| Agent tries to "one-shot" entire project | Feature list forces incremental work on single items |
| Code left in broken state | Git history + progress file allows reverting bad commits |
| Agent marks incomplete work as done | End-to-end tests verify before marking `passes: true` |
| Agent exhausts context | Session boundary + progress file = clean restart |
| Agent loses track of where it was | `git log` + progress file = instant state recovery |

### Key Design Principles

1. **Deterministic state artifacts**: JSON files, git commits (immutable), structured progress logs
2. **Explicit scope limitation**: "Work on only one feature at a time"
3. **Human-inspired workflow**: Mimic what effective software engineers do daily
4. **Testing as prerequisite**: Verify baseline works BEFORE implementing new features
5. **Feature list as contract**: Immutable specification that agents cannot modify
6. **JSON over Markdown**: Structured data resists LLM manipulation better

### Martin Fowler's Harness Engineering Extension

The Martin Fowler article (https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html) extends these concepts with three categories:

1. **Context Engineering**: Continuously enhanced knowledge base embedded in the codebase, dynamic context access
2. **Architectural Constraints**: Deterministic custom linters + structural tests enforcing boundaries
3. **Entropy Management**: Periodic "garbage collection" agents detecting documentation inconsistencies and constraint violations

### LangChain's Deep Agents Harness Patterns

The LangChain blog (https://blog.langchain.com/improving-deep-agents-with-harness-engineering/) identifies three optimization knobs for harnesses:

1. **System Prompt**: Guidance on problem-solving methodology
2. **Tools**: Executable functions available to the agent
3. **Middleware**: Hooks intercepting model and tool calls

Key middleware patterns:
- **PreCompletionChecklistMiddleware**: Intercepts the agent before exit, forces verification pass against task spec
- **LocalContextMiddleware**: Runs on initialization, maps directory structure and discovers environment
- **LoopDetectionMiddleware**: Tracks per-file edit counts, triggers reconsideration after N edits (prevents "doom loops")

### Strengths

- Battle-tested on real multi-day development tasks
- Elegant solution to the cross-context-window problem
- Deterministic artifacts survive agent failures
- Git provides immutable audit trail
- Feature list prevents scope creep and gaming

### Weaknesses

- Single-agent model (one agent per session)
- No parallel execution
- No dynamic tool scoping (all sessions get same tools)
- Progress file is append-only text (no structured querying)
- Unclear if multi-agent coordination would improve results

### Patterns to Steal

| Pattern | How to Apply |
|---------|-------------|
| **Asymmetric prompting** | Different system prompts for initialization vs. execution phases |
| **Deterministic session startup** | Forced sequence: read state -> verify baseline -> do work -> update state |
| **JSON for agent-managed state** | Structured data resists LLM manipulation; use JSON for all progress/task tracking |
| **Feature list as immutable spec** | Agents cannot modify their own task definitions |
| **Middleware hooks** | PreCompletion, LoopDetection, LocalContext — intercept agent at key points |
| **One feature per session** | Explicit scope limitation prevents context exhaustion |
| **Git as checkpoint** | Every meaningful state change = git commit = rollback point |

---

## 3. LangGraph Orchestration Patterns

**Source**: https://github.com/langchain-ai/langgraph

### Architecture Overview

LangGraph models agent workflows as **directed graphs** using a Bulk Synchronous Parallel (BSP) execution model inspired by Google's Pregel. Nodes are functions (including LLM calls), edges define control flow, and a centralized state object flows through the graph. Released production-ready as v1.0 in October 2025.

### Core Data Structures

```python
# State definition — TypedDict with optional reducers
class AgentState(TypedDict):
    messages: Annotated[list, operator.add]     # Accumulates (reducer = add)
    current_agent: str                           # LastValue (no reducer)
    task_status: dict                            # LastValue

# Graph definition
graph = StateGraph(AgentState)

# Add nodes — functions that take state and return partial state updates
graph.add_node("researcher", research_node)
graph.add_node("writer", writer_node)
graph.add_node("reviewer", reviewer_node)

# Add edges — deterministic control flow
graph.add_edge(START, "researcher")
graph.add_edge("writer", "reviewer")

# Add conditional edges — LLM or code decides next step
graph.add_conditional_edges(
    "researcher",
    route_after_research,          # Function returning node name(s)
    {"write": "writer", "research_more": "researcher", "done": END}
)

# Compile — validates and produces executable graph
app = graph.compile(checkpointer=MemorySaver())
```

### The Pregel Execution Loop (BSP Model)

Each "superstep" has three phases:

```
PLAN:   prepare_next_tasks()
        - Compare channel_versions vs versions_seen[node]
        - If any subscribed channel has new data -> node is eligible
        - Collect all eligible nodes

EXECUTE: PregelRunner runs eligible nodes IN PARALLEL
        - Each node reads from state channels
        - Each node writes partial updates
        - Writes are NOT visible to other nodes in same superstep

UPDATE:  apply_writes()
        - Apply all writes through reducer functions
        - Create checkpoint
        - Advance step counter
        - Loop back to PLAN

Termination: no eligible nodes, recursion limit, or interrupt
```

### Channel/State System

```
Channel Types:
  LastValue(type)              — Keeps most recent write (default)
  BinaryOperatorAggregate      — Applies reducer (e.g., list append)
  Topic(type)                  — Queue, cleared each step
  EphemeralValue(type)         — Single-use, cleared after read

State keys without Annotated -> LastValue channel
State keys with Annotated[list, operator.add] -> BinaryOperatorAggregate
```

### Checkpoint Architecture

```python
# Checkpoint data model
class Checkpoint(TypedDict):
    id: str                        # UUID v6 (monotonically increasing)
    ts: str                        # ISO 8601 timestamp
    channel_values: dict           # Deserialized state snapshot
    channel_versions: dict         # Version per channel
    versions_seen: dict            # Maps node_id -> processed versions
    pending_writes: list           # Unapplied writes (task_id, channel, value)

# Three checkpoint types:
# 1. Input checkpoint (step: -1) — initial state before any nodes run
# 2. Loop checkpoints (step: 0+) — after each superstep completes
# 3. Update checkpoints — manual state injection via update_state()

# Restoration:
checkpoint = checkpointer.get_tuple(config)
# Restores channel_values, uses versions_seen to determine eligible nodes,
# applies pending_writes
```

### Fan-Out / Fan-In (Parallel Branches)

```python
# Fan-out: one node spawns multiple parallel tasks
def router(state):
    return [Send("node_a", state), Send("node_b", state)]

# Fan-in: reducer merges results from parallel nodes
class State(TypedDict):
    results: Annotated[list, operator.add]  # All parallel writes accumulate

# node_a writes {"results": ["result_a"]}
# node_b writes {"results": ["result_b"]}
# After superstep: state["results"] = ["result_a", "result_b"]
```

### Conditional Routing

```python
def route_after_research(state: AgentState) -> str:
    """Deterministic code decides routing, not the LLM."""
    if state["needs_more_research"]:
        return "researcher"
    elif state["ready_to_write"]:
        return "writer"
    return END

graph.add_conditional_edges("researcher", route_after_research)
```

### Strengths

- True parallel execution within supersteps
- Checkpoint at every step (durable execution)
- State reducers prevent write conflicts
- Fan-out/fan-in for parallel branches with deterministic merge
- Human-in-the-loop via interrupts at any checkpoint
- Production-proven at scale (LangGraph 1.0)

### Weaknesses

- Heavy abstraction layer (Pregel, channels, supersteps)
- Python-centric (JS port exists but lags)
- State schema must be defined upfront (rigid TypedDict)
- Complexity of BSP model for simple sequential flows
- Debugging graph execution requires understanding Pregel internals
- Reducer semantics can be surprising (LastValue vs Accumulator)

### Patterns to Steal

| Pattern | How to Apply |
|---------|-------------|
| **Graph-as-code** | Define workflow as nodes + edges in TypeScript, not in an LLM prompt |
| **Conditional routing functions** | Deterministic code (not LLM) decides which node runs next |
| **State reducers** | Typed merge strategies when parallel agents write to same state key |
| **Checkpoint per step** | Save state after every node execution; resume from any point |
| **Fan-out with Send()** | Spawn parallel agent tasks from a single routing node |
| **Fan-in with reducers** | Merge parallel results deterministically |
| **versions_seen** | Track which nodes have processed which state changes to prevent duplicate execution |

---

## 4. CrewAI Process Patterns

**Source**: https://github.com/crewAIInc/crewAI

### Architecture Overview

CrewAI organizes agents into "Crews" with role-based specialization. Two process modes: **Sequential** (linear pipeline) and **Hierarchical** (manager delegates). The hierarchical mode is notable because the manager agent is itself an LLM -- making it "LLM-orchestrated orchestration" rather than deterministic orchestration.

### Core Data Model

```python
class Crew(BaseModel):
    agents: list[Agent]
    tasks: list[Task]
    process: Process = Process.sequential      # or Process.hierarchical
    manager_llm: Optional[str] = None          # Required for hierarchical
    manager_agent: Optional[Agent] = None      # Custom manager alternative
    planning: bool = False                     # Enable planning phase
    memory: bool = False
    verbose: bool = False
    max_rpm: Optional[int] = None              # Rate limiting

class Agent(BaseModel):
    role: str                                  # "Senior Researcher"
    goal: str                                  # "Find accurate information"
    backstory: str                             # Role-playing context
    tools: list[Tool] = []
    llm: Optional[str] = None
    allow_delegation: bool = False             # Can delegate to other agents
    max_iter: int = 25
    max_rpm: Optional[int] = None

class Task(BaseModel):
    description: str
    agent: Optional[Agent] = None              # Pre-assigned (sequential)
    expected_output: str
    context: list[Task] = []                   # Dependencies
    tools: list[Tool] = []
    async_execution: bool = False
```

### Sequential Process

```python
# Tasks execute in order, each agent completing before next begins
crew = Crew(
    agents=[researcher, writer, editor],
    tasks=[research_task, writing_task, editing_task],
    process=Process.sequential
)

# Execution: research_task(researcher) -> writing_task(writer) -> editing_task(editor)
# Each task's output is available as context to subsequent tasks
result = crew.kickoff(inputs={"topic": "AI orchestration"})
```

### Hierarchical Process

```python
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, writing_task],
    process=Process.hierarchical,
    manager_llm="gpt-4o",       # Manager is an LLM agent
    planning=True                # Enable planning phase
)
```

The manager agent:
1. **Analyzes** tasks and available agents
2. **Delegates** tasks to appropriate agents based on capabilities
3. **Validates** outputs before proceeding
4. Tasks are NOT pre-assigned; manager allocates dynamically

### Task Delegation Mechanism

```python
# In hierarchical mode, the manager has a DelegateWorkTool
# Manager agent calls: delegate_work(task="...", agent="researcher", context="...")
# The framework then:
#   1. Finds the named agent
#   2. Executes the task with that agent
#   3. Returns result to manager for validation

# allowed_agents parameter (PR #2068) restricts which agents can be delegated to:
task = Task(
    description="Research AI frameworks",
    allowed_agents=["researcher", "analyst"]  # Only these can receive delegation
)
```

### Kickoff Variants

```python
crew.kickoff()                   # Synchronous, single input
crew.kickoff_async()             # Thread-based async wrapper
crew.akickoff()                  # Native async (async/await)
crew.kickoff_for_each(inputs)    # Batch: run crew for each input set
crew.kickoff_for_each_async()    # Batch async
```

### Strengths

- Role-playing agents with backstories (good for domain specialization)
- Clean task dependency model via `context` parameter
- Planning phase can improve task execution
- Rate limiting built in (`max_rpm`)
- Batch execution via `kickoff_for_each`

### Weaknesses

- Hierarchical mode is LLM-orchestrating-LLMs (non-deterministic orchestration)
- Manager agent frequently takes over tasks itself (known bug #2838)
- Manager delegation uses string matching (fragile)
- DelegateWorkTool schema validation errors (bug #2606)
- No checkpoint/resume mechanism
- No parallel execution within sequential process
- Heavy Pydantic validation overhead

### Patterns to Steal

| Pattern | How to Apply |
|---------|-------------|
| **Role-based agent definitions** | Agents with typed role, goal, backstory = focused system prompts |
| **Task context dependencies** | Tasks can reference outputs of previous tasks |
| **Planning phase** | Optional pre-execution planning step before agents start work |
| **Rate limiting per agent** | Built-in RPM control shared across agents |
| **kickoff_for_each** | Batch pattern: same workflow, different inputs |

### Patterns to AVOID

| Anti-Pattern | Why |
|-------------|-----|
| **LLM as orchestrator** | Manager agent is non-deterministic; frequently takes over work itself |
| **String-based delegation** | `delegate_work(agent="researcher")` is fragile |
| **Role-playing as architecture** | Backstories are prompt engineering, not system design |

---

## 5. Claude Code Custom Subagents

**Source**: https://code.claude.com/docs/en/sub-agents

### Architecture Overview

Claude Code subagents are specialized AI assistants defined as Markdown files with YAML frontmatter. Each subagent runs in its own context window with a custom system prompt, scoped tool access, and independent permissions. The parent Claude Code session delegates tasks to subagents and receives summarized results.

### Subagent Definition Format

```yaml
# .claude/agents/code-reviewer.md
---
name: code-reviewer
description: Reviews code for quality and best practices. Use proactively after code changes.
tools: Read, Grep, Glob, Bash          # Explicit allowlist
disallowedTools: Write, Edit            # Denylist (evaluated after tools)
model: sonnet                           # sonnet | opus | haiku | inherit
permissionMode: default                 # default|acceptEdits|dontAsk|bypassPermissions|plan
maxTurns: 50                            # Max agentic turns
skills:                                 # Preloaded skill content
  - api-conventions
  - error-handling-patterns
memory: user                            # Persistent memory: user|project|local
background: false                       # Run as background task
isolation: worktree                     # Git worktree isolation
hooks:                                  # Lifecycle hooks
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
---

You are a senior code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

### Complete Frontmatter Schema

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (lowercase, hyphens) |
| `description` | Yes | When Claude should delegate to this subagent |
| `tools` | No | Allowlist of tools; inherits all if omitted |
| `disallowedTools` | No | Denylist; evaluated after `tools` |
| `model` | No | `sonnet`, `opus`, `haiku`, `inherit` (default: inherit) |
| `permissionMode` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` |
| `maxTurns` | No | Maximum agentic turns |
| `skills` | No | Skills injected into context at startup |
| `memory` | No | Persistent memory scope: `user`, `project`, `local` |
| `background` | No | Always run as background task (default: false) |
| `isolation` | No | `worktree` for git worktree isolation |
| `hooks` | No | Lifecycle hooks (PreToolUse, PostToolUse, Stop) |
| `mcpServers` | No | MCP servers available to this subagent |

### Built-in Subagents

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| **Explore** | Haiku | Read-only | Codebase search, file discovery |
| **Plan** | Inherit | Read-only | Research for planning mode |
| **General-purpose** | Inherit | All | Complex multi-step tasks |
| **Bash** | Inherit | Bash | Terminal commands in separate context |

### Dispatch Mechanism

Claude's main session decides when to delegate based on:
1. Task description in the user's request
2. The `description` field in subagent configurations
3. Current context

Explicit delegation: `"Use the code-reviewer subagent to review my changes"`

### Tool Scoping Deep Dive

```yaml
# Allowlist: only these tools available
tools: Read, Grep, Glob, Bash

# Denylist: remove from inherited or allowlisted set
disallowedTools: Write, Edit

# Restrict which subagents can be spawned (for agents run with --agent)
tools: Agent(worker, researcher), Read, Bash
# Only worker and researcher subagents can be spawned

# Block specific subagents via settings.json
{ "permissions": { "deny": ["Agent(Explore)", "Agent(my-custom-agent)"] } }
```

### Persistent Memory

When `memory` is set, the subagent gets a persistent directory:

| Scope | Location | Use When |
|-------|----------|----------|
| `user` | `~/.claude/agent-memory/<name>/` | Learnings across all projects |
| `project` | `.claude/agent-memory/<name>/` | Project-specific, shareable via VCS |
| `local` | `.claude/agent-memory-local/<name>/` | Project-specific, private |

The subagent's prompt includes instructions for reading/writing to this directory, plus the first 200 lines of `MEMORY.md` as initial context.

### Lifecycle Hooks

Hooks can be defined in the subagent frontmatter (scoped to that subagent) or in `settings.json` (global):

```yaml
# In subagent frontmatter:
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
  Stop:  # Converted to SubagentStop at runtime
    - hooks:
        - type: command
          command: "./scripts/cleanup.sh"

# In settings.json (global):
{
  "hooks": {
    "SubagentStart": [{ "matcher": "db-agent", "hooks": [...] }],
    "SubagentStop": [{ "hooks": [...] }]
  }
}
```

Hook exit codes: `0` = allow, `2` = block operation and feed error to Claude.

### Key Constraints

- Subagents CANNOT spawn other subagents (no nesting)
- Subagents receive only their custom system prompt + environment details, NOT the full Claude Code system prompt
- Results return to the main conversation context (can consume significant context)
- Each invocation creates a fresh instance (use resume to continue existing work)
- Auto-compaction triggers at ~95% context capacity

### Strengths

- Declarative agent definition (YAML + Markdown)
- Fine-grained tool scoping with allowlists and denylists
- Lifecycle hooks for validation and cleanup
- Persistent memory across sessions
- Model selection per agent (cost optimization)
- Git worktree isolation for parallel work
- Foreground/background execution modes

### Weaknesses

- No inter-subagent communication (only report back to parent)
- No shared state between subagents
- Context consumption when results return to parent
- Cannot dynamically create subagents at runtime
- Latency: subagents start fresh and may need to gather context

### Patterns to Steal

| Pattern | How to Apply |
|---------|-------------|
| **Declarative agent config** | YAML frontmatter: name, tools, model, permissions in one file |
| **Tool allowlists/denylists** | Two-pass tool filtering: allowlist first, then denylist |
| **Lifecycle hooks** | PreToolUse, PostToolUse, Start, Stop with matcher patterns |
| **Persistent memory** | Agent-scoped directories that survive across sessions |
| **Background execution** | Pre-approve permissions, then run concurrently |
| **Worktree isolation** | Each agent gets its own git worktree for conflict-free parallel work |
| **Model routing** | Route cheap tasks to Haiku, complex tasks to Opus |

---

## 6. Claude Code /batch and Agent Teams

### /batch Skill

**Source**: https://code.claude.com/docs/en/best-practices

The `/batch` command enables large-scale code migrations by running dozens of isolated agents in parallel.

**Architecture**:
```
User describes migration in natural language
  -> /batch analyzes codebase, identifies affected files
  -> Spawns N agents, each in its own git worktree
  -> Each agent works on its assigned files independently
  -> Each agent runs /simplify (auto-review) before finishing
  -> Each agent opens a pull request
  -> User reviews N PRs instead of one massive PR
```

**Key properties**:
- Requires git repository (enforced, not optional)
- Each agent runs in its own git worktree (full isolation)
- Each agent creates its own branch and PR
- If one agent fails, others are unaffected
- Auto-runs `/simplify` before PR creation

### Agent Teams

**Source**: https://code.claude.com/docs/en/agent-teams

Agent Teams (released February 2026, experimental) coordinate multiple Claude Code instances with a shared task list and inter-agent messaging.

**Architecture**:
```
Team Lead (main Claude Code session)
  |
  |-- Teammate 1 (independent context window)
  |-- Teammate 2 (independent context window)
  |-- Teammate 3 (independent context window)
  |
  Shared: Task List + Mailbox (SendMessage)
  Storage: ~/.claude/teams/{team-name}/config.json
           ~/.claude/tasks/{team-name}/
```

**Key mechanics**:

1. **Task coordination**: Shared task list with states: pending -> in progress -> completed. Tasks can have dependencies. File locking prevents race conditions on task claiming.

2. **Communication**: SendMessage for direct teammate communication, broadcast for all. Messages delivered automatically (no polling).

3. **Plan approval**: Teammates can work in read-only plan mode until the lead approves their approach.

4. **Quality gates via hooks**:
   - `TeammateIdle`: Runs when teammate is about to go idle; exit code 2 sends feedback
   - `TaskCompleted`: Runs when task is being marked complete; exit code 2 blocks completion

5. **Display modes**:
   - In-process: all teammates in one terminal (Shift+Down to cycle)
   - Split panes: each teammate in own tmux/iTerm2 pane

**Token costs**: 3-4x for a 3-teammate team doing the same work sequentially. ~7x when teammates run in plan mode. Each teammate has its own context window.

**Recommended**: 3-5 teammates, 5-6 tasks per teammate.

### Subagents vs Agent Teams vs /batch

| Feature | Subagents | Agent Teams | /batch |
|---------|-----------|-------------|--------|
| **Context** | Shares parent's session | Independent sessions | Independent worktrees |
| **Communication** | Report to parent only | Direct messaging | None (fully isolated) |
| **Coordination** | Parent manages | Shared task list | None needed |
| **Parallelism** | Foreground or background | Full parallel | Full parallel |
| **Output** | Results in parent context | Synthesized by lead | Individual PRs |
| **Token cost** | Lower (summarized) | 3-7x single session | N x single session |
| **Best for** | Focused research | Collaborative work | Codebase migrations |
| **Isolation** | Same repo | Same repo | Git worktrees |

### Patterns to Steal

| Pattern | How to Apply |
|---------|-------------|
| **Git worktree isolation** | Each parallel agent gets its own worktree; merge via PR |
| **Shared task list with file locking** | Tasks on disk, atomic claiming via file locks |
| **Plan-then-execute gate** | Agents plan in read-only mode; lead approves before implementation |
| **TeammateIdle/TaskCompleted hooks** | Quality gates that can reject completion and send feedback |
| **Direct inter-agent messaging** | Agents communicate without routing through coordinator |
| **Auto-review before output** | Run quality check (/simplify) before marking work complete |

---

## 7. Synthesis: Patterns to Steal for Our TypeScript Orchestrator

### Core Architecture Decision

Our orchestrator should follow the "deterministic orchestration of non-deterministic agents" pattern. This means:

```
Deterministic TypeScript code handles:
  - Agent lifecycle (spawn, monitor, terminate)
  - Task assignment and dependency resolution
  - State management and checkpointing
  - Tool scoping per agent
  - Routing decisions (which agent runs next)
  - Error recovery and retry
  - Progress tracking

LLM agents handle:
  - Understanding requirements
  - Generating code/content
  - Making judgment calls
  - Interpreting test results
```

### The 10 Must-Have Patterns

#### 1. Thin Orchestration Loop (from Swarm)

```typescript
async function run(agent: AgentConfig, state: OrchestratorState): Promise<Result> {
  let activeAgent = agent;
  let step = 0;

  while (step < maxSteps && activeAgent) {
    // Deterministic: select tools for this agent
    const tools = getToolsForAgent(activeAgent);

    // Non-deterministic: LLM does its thing
    const response = await callAgent(activeAgent, state, tools);

    // Deterministic: checkpoint
    await checkpoint(state, step);

    // Deterministic: check for handoff
    if (response.handoff) {
      activeAgent = resolveAgent(response.handoff);
    }

    // Deterministic: check for completion
    if (response.complete) break;

    step++;
  }
}
```

#### 2. Declarative Agent Configs (from Claude Code Subagents)

```typescript
interface AgentConfig {
  id: string;
  description: string;           // When to use this agent
  systemPrompt: string;          // The agent's instructions
  tools: string[];               // Allowlist
  disallowedTools?: string[];    // Denylist
  model: 'opus' | 'sonnet' | 'haiku';
  maxTurns: number;
  hooks?: {
    preToolUse?: HookConfig[];
    postToolUse?: HookConfig[];
    onComplete?: HookConfig[];
  };
}
```

#### 3. Typed Shared State with Reducers (from LangGraph)

```typescript
interface OrchestratorState {
  // LastValue semantics (latest write wins)
  currentPhase: string;
  activeAgent: string;

  // Reducer semantics (accumulate)
  messages: Message[];            // append reducer
  completedTasks: TaskResult[];   // append reducer
  errors: ErrorRecord[];          // append reducer
}

type Reducer<T> = (existing: T, incoming: T) => T;
const reducers: Record<string, Reducer<any>> = {
  messages: (a, b) => [...a, ...b],
  completedTasks: (a, b) => [...a, ...b],
};
```

#### 4. Checkpoint Per Step (from LangGraph + Anthropic Harness)

```typescript
interface Checkpoint {
  id: string;                     // UUID
  step: number;
  timestamp: string;
  state: OrchestratorState;       // Full state snapshot
  activeAgent: string;
  completedNodes: string[];       // Which nodes have run
  // Resume from any checkpoint
}

async function checkpoint(state: OrchestratorState, step: number) {
  const cp: Checkpoint = { id: uuid(), step, timestamp: now(), state: deepClone(state) };
  await writeJSON(`checkpoints/${cp.id}.json`, cp);  // JSON, not markdown
}
```

#### 5. Conditional Routing Functions (from LangGraph)

```typescript
// Deterministic code decides routing, not the LLM
function routeAfterResearch(state: OrchestratorState): string {
  if (state.errors.length > 0) return 'error-recovery';
  if (state.completedTasks.length < state.totalTasks) return 'executor';
  return 'reviewer';
}

// Graph definition
const graph = new WorkflowGraph<OrchestratorState>();
graph.addNode('planner', plannerAgent);
graph.addNode('executor', executorAgent);
graph.addNode('reviewer', reviewerAgent);
graph.addConditionalEdge('planner', routeAfterPlanning);
```

#### 6. Per-Agent Tool Scoping (from Swarm + Claude Code)

```typescript
function getToolsForAgent(agent: AgentConfig): Tool[] {
  let tools: Tool[];

  if (agent.tools.length > 0) {
    // Allowlist: only specified tools
    tools = allTools.filter(t => agent.tools.includes(t.name));
  } else {
    // Inherit all
    tools = [...allTools];
  }

  // Apply denylist
  if (agent.disallowedTools) {
    tools = tools.filter(t => !agent.disallowedTools.includes(t.name));
  }

  return tools;
}
```

#### 7. Asymmetric Prompting (from Anthropic Harness)

```typescript
function getSystemPrompt(agent: AgentConfig, isFirstRun: boolean): string {
  if (isFirstRun) {
    return agent.initializationPrompt;  // Setup: create files, establish baseline
  }
  return agent.executionPrompt;         // Steady state: read progress, do work
}
```

#### 8. Quality Gates with Hooks (from Claude Code Agent Teams)

```typescript
interface Hook {
  event: 'preToolUse' | 'postToolUse' | 'onComplete' | 'onIdle';
  matcher?: string;          // Tool name regex
  handler: (context: HookContext) => HookResult;
}

type HookResult =
  | { action: 'allow' }
  | { action: 'block', reason: string }     // Feeds reason back to agent
  | { action: 'modify', newInput: any };

// PreCompletion verification (from LangChain harness)
const verificationHook: Hook = {
  event: 'onComplete',
  handler: async (ctx) => {
    const testsPass = await runTests(ctx.state);
    if (!testsPass) return { action: 'block', reason: 'Tests failing. Fix before completing.' };
    return { action: 'allow' };
  }
};
```

#### 9. Git Worktree Isolation for Parallel Agents (from /batch + Agent Teams)

```typescript
async function spawnParallelAgents(tasks: Task[]): Promise<Result[]> {
  const worktrees = await Promise.all(
    tasks.map(t => createWorktree(t.id))       // Each agent gets isolated repo copy
  );

  const results = await Promise.all(
    tasks.map((task, i) => runAgent(task, { cwd: worktrees[i] }))
  );

  // Merge via PRs or cherry-pick
  return results;
}
```

#### 10. Loop Detection (from LangChain Harness)

```typescript
class LoopDetector {
  private editCounts: Map<string, number> = new Map();
  private threshold = 5;

  onToolUse(tool: string, target: string) {
    if (tool === 'Edit' || tool === 'Write') {
      const count = (this.editCounts.get(target) || 0) + 1;
      this.editCounts.set(target, count);

      if (count > this.threshold) {
        return {
          action: 'inject' as const,
          message: `You've edited ${target} ${count} times. Step back and reconsider your approach.`
        };
      }
    }
    return { action: 'allow' as const };
  }
}
```

### Architecture Comparison Matrix

| Dimension | Swarm | Anthropic Harness | LangGraph | CrewAI | Claude Code |
|-----------|-------|------------------|-----------|--------|-------------|
| **Orchestration** | Deterministic loop | Deterministic harness | Deterministic graph | LLM manager | LLM dispatch |
| **Parallelism** | None | None | BSP supersteps | Limited | Worktrees/Teams |
| **State** | context_variables dict | JSON files + git | Typed channels | Task context chain | Disk files |
| **Checkpoint** | None (stateless) | Git commits | Every superstep | None | Session transcripts |
| **Tool scoping** | Per agent | Per session | Per node (via state) | Per agent | Allowlist/denylist |
| **Error recovery** | None | Git revert | Checkpoint resume | Retry | Session resume |
| **Complexity** | ~150 LOC | ~500 LOC harness | ~5000 LOC | ~3000 LOC | Full product |

### What NOT to Do

1. **Don't use LLMs as orchestrators** (CrewAI's hierarchical manager problem). The manager frequently takes over tasks, makes non-deterministic routing decisions, and has fragile string-based delegation.

2. **Don't use Markdown for agent-managed state** (Anthropic's lesson). Use JSON -- models are less likely to corrupt structured data.

3. **Don't share context windows between parallel agents** (all frameworks agree). Each agent needs its own context window to prevent interference.

4. **Don't skip quality gates** (LangChain harness lesson). PreCompletion verification catches premature completion. LoopDetection catches doom loops.

5. **Don't make the orchestrator stateful between calls** (Swarm's lesson). Stateless orchestration + external checkpoints = easy resume.

---

## Sources

### OpenAI Swarm / Agents SDK
- [OpenAI Swarm GitHub](https://github.com/openai/swarm)
- [OpenAI Agents SDK Documentation](https://openai.github.io/openai-agents-python/)
- [Orchestrating Agents: Routines and Handoffs](https://cookbook.openai.com/examples/orchestrating_agents)

### Anthropic Harness Engineering
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Harness Engineering - Martin Fowler](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)
- [Improving Deep Agents with Harness Engineering - LangChain](https://blog.langchain.com/improving-deep-agents-with-harness-engineering/)

### LangGraph
- [LangGraph GitHub](https://github.com/langchain-ai/langgraph)
- [LangGraph Documentation](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangGraph Checkpointing Architecture - DeepWiki](https://deepwiki.com/langchain-ai/langgraph/4.1-checkpointing-architecture)
- [LangGraph Reference - StateGraph](https://reference.langchain.com/python/langgraph/graphs)

### CrewAI
- [CrewAI GitHub](https://github.com/crewAIInc/crewAI)
- [CrewAI Hierarchical Process Docs](https://docs.crewai.com/en/learn/hierarchical-process)
- [CrewAI Orchestration - DeepWiki](https://deepwiki.com/crewAIInc/crewAI/2.1-crew-configuration-and-orchestration)

### Claude Code
- [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Orchestrate Teams of Claude Code Sessions](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [Building a C Compiler with Parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)
- [Claude Code Agent Teams Guide](https://claudefa.st/blog/guide/agents/agent-teams)
- [Awesome Claude Code Subagents](https://github.com/VoltAgent/awesome-claude-code-subagents)

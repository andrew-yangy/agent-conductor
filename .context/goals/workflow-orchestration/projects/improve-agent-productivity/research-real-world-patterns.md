# Deep Research: Multi-Agent Orchestration in the Claude Ecosystem

**Date:** 2026-03-03
**Purpose:** Inform the design of a deterministic TypeScript orchestrator for the agent-conductor project
**Research Areas:** Claude Agent SDK, Claude Code subagents/teams, hooks, token optimization, hybrid architectures, agent definition format

---

## 1. Claude Agent SDK -- Real Implementations

### 1.1 SDK Overview and API Surface

The Claude Agent SDK (npm: `@anthropic-ai/claude-agent-sdk`, v0.2.63 as of Feb 2026) provides programmatic access to Claude Code's agentic capabilities. It is available in both TypeScript and Python.

**Sources:**
- [TypeScript SDK repo](https://github.com/anthropics/claude-agent-sdk-typescript)
- [SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [TypeScript API reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [V2 preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)

**Core Functions (TypeScript):**

```typescript
// V1: Async generator pattern
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    model: "claude-opus-4-6",
    maxTurns: 10,
    permissionMode: "bypassPermissions"
  }
})) {
  if ("result" in message) console.log(message.result);
}

// V2 (preview): Session-based send/stream pattern
import { unstable_v2_createSession } from "@anthropic-ai/claude-agent-sdk";

await using session = unstable_v2_createSession({ model: "claude-opus-4-6" });
await session.send("What is 5 + 3?");
for await (const msg of session.stream()) {
  // process messages
}
// Multi-turn: just call send() again
await session.send("Multiply that by 2");
```

**Key Options for `query()`:**

| Option | Type | Relevance to Our Orchestrator |
|--------|------|-------------------------------|
| `allowedTools` | `string[]` | Restrict tools per agent |
| `agents` | `Record<string, AgentDefinition>` | Define subagents programmatically |
| `hooks` | `Partial<Record<HookEvent, HookCallbackMatcher[]>>` | In-process hook callbacks |
| `mcpServers` | `Record<string, McpServerConfig>` | Custom tool servers |
| `maxTurns` | `number` | Bound agent execution |
| `maxBudgetUsd` | `number` | Cost cap per query |
| `permissionMode` | `PermissionMode` | `bypassPermissions` for automation |
| `resume` / `forkSession` | `string` / `boolean` | Session management |
| `systemPrompt` | `string \| preset` | Custom or Claude Code system prompt |
| `model` | `string` | Model routing |
| `effort` | `'low'\|'medium'\|'high'\|'max'` | Controls thinking depth |
| `settingSources` | `SettingSource[]` | Control which filesystem settings load |

**Subagents via SDK:**

```typescript
for await (const message of query({
  prompt: "Use the code-reviewer agent to review this codebase",
  options: {
    allowedTools: ["Read", "Glob", "Grep", "Task"],
    agents: {
      "code-reviewer": {
        description: "Expert code reviewer for quality and security reviews.",
        prompt: "Analyze code quality and suggest improvements.",
        tools: ["Read", "Glob", "Grep"]
      }
    }
  }
})) {
  // Messages from subagent context include parent_tool_use_id
}
```

**Custom Tools via MCP:**

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const customServer = createSdkMcpServer({
  name: "orchestrator-tools",
  version: "1.0.0",
  tools: [
    tool("get_directive", "Get the current directive details", {
      directiveId: z.string()
    }, async (args) => {
      const directive = await readDirective(args.directiveId);
      return { content: [{ type: "text", text: JSON.stringify(directive) }] };
    })
  ]
});

// Pass to query via mcpServers option
// Note: Custom MCP tools REQUIRE streaming input mode (async generator)
```

### 1.2 Official Demo Repos

**Source:** [claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos)

The official demos repo includes:
- **research-agent**: Multi-agent system that breaks research into subtopics, spawns parallel researcher subagents, executes concurrent web searches, and synthesizes findings. This is the most relevant pattern for us.
- **email-agent**: IMAP integration showing external service connectivity
- **hello-world-v2**: Updated patterns using V2 session API

### 1.3 Community Implementations

**Source:** [wshobson/agents](https://github.com/wshobson/agents) -- 112 specialized agents, 72 plugins, 16 workflow orchestrators

Key architectural pattern: **Three-tier model strategy**

| Tier | Model | Use Case |
|------|-------|----------|
| 1 | Opus 4.6 | Critical architecture, security, code review |
| 2 | Inherit | Complex tasks (user selects) |
| 3 | Sonnet 4.6 | Support with intelligence |
| 4 | Haiku 4.5 | Fast operational tasks |

Their multi-agent orchestration chains 7+ agents sequentially:
```
backend-architect -> database-architect -> frontend-developer ->
test-automator -> security-auditor -> deployment-engineer ->
observability-engineer
```

**Source:** [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) -- 127+ curated subagents across 10 categories

Key pattern: All agents share independent context windows, domain-specific system prompts, and configurable tool access. The "Meta & Orchestration" category (12 agents) specifically addresses multi-agent coordination.

### 1.4 Relevance to Our Orchestrator

**Directly applicable:**
- The SDK's `agents` option lets us define subagents programmatically in TypeScript -- no need for `.claude/agents/` files in automation scenarios
- `maxTurns`, `maxBudgetUsd`, and `allowedTools` provide deterministic constraints on agent behavior
- Session resume/fork enables checkpoint/resume patterns
- Custom MCP tools let us inject orchestrator-specific tools (directive lookup, state reporting, etc.)
- In-process hooks provide pre/post tool validation without shell overhead

**Gaps:**
- Subagents cannot spawn other subagents (no nesting)
- V2 session API is still unstable preview
- No built-in mechanism for inter-agent communication (that requires Agent Teams, which is experimental)

---

## 2. Claude Code Power User Patterns

### 2.1 Subagent Architecture

**Source:** [Claude Code subagent docs](https://code.claude.com/docs/en/sub-agents)

Three built-in subagents:
- **Explore**: Haiku model, read-only tools, for codebase search/analysis
- **Plan**: Inherits model, read-only, for plan-mode research
- **general-purpose**: Inherits model, all tools, for complex multi-step tasks

**Key constraint:** Subagents cannot spawn other subagents. If you need nested delegation, you must chain subagents from the main conversation or use Skills.

### 2.2 Agent Teams (Experimental)

**Source:** [Agent Teams docs](https://code.claude.com/docs/en/agent-teams)

Agent Teams provide true multi-agent coordination with inter-agent messaging. Enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

Architecture:
- **Team lead**: Main session that creates team, spawns teammates, coordinates
- **Teammates**: Separate Claude instances with own context windows
- **Task list**: Shared work items with dependency tracking and auto-unblocking
- **Mailbox**: File-based messaging (`~/.claude/teams/{name}/inboxes/`)

Communication operations:
- `spawnTeam`: Create team
- `write`: Message specific teammate
- `broadcast`: Message all (expensive)
- `requestShutdown` / `approveShutdown`: Graceful termination
- `approvePlan` / `rejectPlan`: Gate plan-mode workflows

**Real-world scale:** Nicholas Carlini used 16 parallel Claude agents to build a 100,000-line C compiler capable of compiling the Linux kernel. Cost: ~$20,000, ~2,000 sessions, 2 billion input tokens.
Source: [Building a C compiler with parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)

Key lessons from that project:
- Agents used Docker containers with isolated `/workspace` directories
- Synchronization via file-locking and `current_tasks/` directory
- Git merge conflict resolution forced competing agents to pick different tasks
- Test-driven development was essential for autonomous progress
- Context pollution was a major problem -- mitigated with `--fast` test flags and structured ERROR tags

### 2.3 Skills Pattern (Command -> Agent -> Skills)

**Source:** [Skills docs](https://code.claude.com/docs/en/skills), [DeepWiki analysis](https://deepwiki.com/shanraisshan/claude-code-best-practice/6.1-command-agent-skills-pattern)

The three-layer pattern separates:
1. **Commands** (orchestration): User-facing entry points
2. **Agents** (execution): Isolated contexts with specific tools
3. **Skills** (knowledge): Domain content loaded on-demand

Progressive disclosure minimizes context costs:
- At startup: only skill names/descriptions loaded (~100 tokens each)
- On invocation: full skill content loaded (~2,000 tokens)
- Supporting files: loaded on-demand within the skill

Built-in bundled skills demonstrate this pattern:
- `/simplify`: Spawns 3 parallel review agents (code reuse, quality, efficiency)
- `/batch`: Decomposes large changes into 5-30 independent units, spawns one background agent per unit in isolated git worktrees

### 2.4 Token Cost Reality

**Source:** [DEV Community - Sub agents burn tokens](https://dev.to/onlineeric/claude-code-sub-agents-burn-out-your-tokens-4cd8)

Real measurements:
- Pro Plan with 5 sub-agents: **~15 minutes** to exhaust quota
- 2x faster execution but 2x token burn rate
- $100 Max plan: exhausted in ~75 minutes with parallel agents

**Source:** [DEV Community - 50K tokens per subprocess turn](https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma)

**Critical finding for our orchestrator:** Each Claude Code subprocess inherits the entire config stack:
- `~/CLAUDE.md` project instructions
- All enabled plugins and skill definitions
- Complete MCP server tool catalogs
- User-level settings

**Before isolation:** ~50K tokens per subprocess turn (before any actual work)
**After isolation:** ~5K tokens per subprocess turn (10x reduction)

**Four-layer isolation architecture:**
1. Scoped working directory (blocks `~/CLAUDE.md` auto-loading)
2. Git boundary (`.git/HEAD` prevents upward directory traversal)
3. Empty plugin directory (`--plugin-dir` to empty folder)
4. Restricted setting sources (`--setting-sources project,local` only)

**Persistent stream-json mode** eliminates repeated system prompt injection:
```bash
claude --print \
  --input-format stream-json \
  --output-format stream-json \
  --session-id <id>
```

### 2.5 Anthropic's Multi-Agent Research System

**Source:** [Anthropic engineering blog](https://www.anthropic.com/engineering/multi-agent-research-system)

Anthropic's own Research feature uses an orchestrator-worker pattern:
- Lead agent analyzes query, develops strategy, spawns subagents
- External memory persists context (important when context exceeds 200K tokens)
- Detailed task descriptions prevent duplication: objective, output format, tool guidance, task boundaries
- Simple queries: 1 agent, 3-10 tool calls. Complex research: 10+ subagents
- Two parallelization types: lead spawns 3-5 subagents simultaneously; each subagent uses 3+ tools in parallel
- Cut research time by up to 90% for complex queries

**Error handling pattern:** Graceful degradation rather than restart. Let the agent know when a tool is failing and let it adapt. Combine with deterministic retry logic and regular checkpoints.

**Token economics:**
- Single agents: ~4x more tokens than chat
- Multi-agent systems: ~15x more tokens than chat
- Token usage explains 80% of performance variance in browsing tasks

**Current limitation:** Subagents execute synchronously -- lead waits for all to complete before proceeding. Asynchronous execution is future work.

---

## 3. Claude Code Hooks

### 3.1 Complete Hook System

**Source:** [Hooks guide](https://code.claude.com/docs/en/hooks-guide)

Hooks provide deterministic control over Claude Code behavior. Four hook types:
1. `"type": "command"` -- Run shell commands
2. `"type": "http"` -- POST to HTTP endpoints
3. `"type": "prompt"` -- Single-turn LLM evaluation
4. `"type": "agent"` -- Multi-turn verification with tool access

**Full Hook Event Lifecycle:**

| Event | When | Can Block? |
|-------|------|------------|
| `SessionStart` | Session begins/resumes | No |
| `UserPromptSubmit` | Prompt submitted | No |
| `PreToolUse` | Before tool execution | Yes (exit 2) |
| `PermissionRequest` | Permission dialog | Yes |
| `PostToolUse` | After tool succeeds | No* |
| `PostToolUseFailure` | After tool fails | No |
| `Notification` | Claude needs attention | No |
| `SubagentStart` | Subagent spawned | No |
| `SubagentStop` | Subagent finishes | No |
| `Stop` | Claude finishes responding | Yes (re-trigger) |
| `TeammateIdle` | Teammate about to go idle | Yes |
| `TaskCompleted` | Task being marked done | Yes |
| `ConfigChange` | Config file changes | Yes |
| `PreCompact` | Before compaction | No |
| `SessionEnd` | Session terminates | No |

**PreToolUse structured output for orchestration:**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Use rg instead of grep for better performance"
  }
}
```

Decisions: `"allow"` (proceed), `"deny"` (cancel + feedback), `"ask"` (show permission prompt).

**PreToolUse can modify tool inputs** (since v2.0.10):
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": { "command": "modified-command-here" }
  }
}
```

**Context injection via hooks:**
- `SessionStart` hooks: stdout added to context (great for post-compaction re-injection)
- `UserPromptSubmit` hooks: use `additionalContext` to inject text

### 3.2 Hooks for Orchestration

**Can hooks be used for orchestration?** Yes, significantly:

1. **Policy enforcement**: PreToolUse hooks can validate commands before execution (e.g., read-only database queries)
2. **Tool input modification**: PreToolUse can rewrite tool inputs
3. **Quality gates**: Stop hooks and TaskCompleted hooks can verify work quality before allowing completion
4. **Agent-based verification**: `"type": "agent"` hooks spawn a subagent to verify conditions
5. **Context management**: SessionStart hooks re-inject critical context after compaction
6. **Telemetry**: PostToolUse hooks log all actions to audit files

**Example: Stop hook that checks completeness (prompt-based):**
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "prompt",
        "prompt": "Check if all tasks are complete. If not, respond with {\"ok\": false, \"reason\": \"what remains to be done\"}."
      }]
    }]
  }
}
```

**Example: Agent-based verification hook:**
```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "agent",
        "prompt": "Verify that all unit tests pass. Run the test suite and check results. $ARGUMENTS",
        "timeout": 120
      }]
    }]
  }
}
```

### 3.3 SDK In-Process Hooks

When using the Agent SDK, hooks can be TypeScript callback functions rather than shell commands:

```typescript
import { query, HookCallback } from "@anthropic-ai/claude-agent-sdk";

const logFileChange: HookCallback = async (input) => {
  const filePath = (input as any).tool_input?.file_path ?? "unknown";
  await appendFile("./audit.log", `${new Date().toISOString()}: modified ${filePath}\n`);
  return {};
};

for await (const message of query({
  prompt: "Refactor utils.py",
  options: {
    permissionMode: "acceptEdits",
    hooks: {
      PostToolUse: [{ matcher: "Edit|Write", hooks: [logFileChange] }]
    }
  }
})) { ... }
```

### 3.4 Relevance to Our Orchestrator

Hooks give us deterministic control points within agent execution:
- **PreToolUse**: Enforce file access boundaries, prevent agents from touching wrong directories
- **PostToolUse**: Track what agents actually did for telemetry/reporting
- **Stop**: Verify task completion before marking done
- **SubagentStart/Stop**: Track agent lifecycle for the dashboard
- **SessionStart (compact matcher)**: Re-inject directive context after compaction

---

## 4. Token Optimization Strategies

### 4.1 Official Cost Data

**Source:** [Claude Code cost management](https://code.claude.com/docs/en/costs)

- Average cost: $6/developer/day, below $12 for 90% of users
- Monthly average with Sonnet 4.6: ~$100-200/developer
- Agent teams: ~7x more tokens than standard sessions (each teammate has own context window)

### 4.2 Model Routing

| Task Type | Recommended Model | Cost Ratio |
|-----------|------------------|------------|
| Codebase exploration | Haiku | Cheapest |
| Routine code edits | Sonnet | Mid |
| Complex architecture | Opus | Most expensive |
| Simple subagent tasks | Haiku | Cheapest |

The `effort` parameter (`low`/`medium`/`high`/`max`) controls thinking depth. Reducing effort on simple tasks saves output tokens significantly.

### 4.3 Context Reduction Strategies

**MCP tool description overhead:**
- Each MCP server adds tool definitions to context even when idle
- When tools exceed 10% of context window, Claude Code auto-defers them (tool search)
- Configure with `ENABLE_TOOL_SEARCH=auto:<N>` (e.g., `auto:5` for 5% threshold)
- **Prefer CLI tools** (`gh`, `aws`, etc.) over MCP servers -- no persistent tool definitions

**CLAUDE.md overhead:**
- Loaded into every session/subagent context at startup
- Keep under ~500 lines
- Move specialized instructions to Skills (loaded on-demand only)

**Subprocess isolation (critical for our project):**
- Unoptimized subprocess: ~50K tokens overhead per turn
- With isolation: ~5K tokens per turn (10x reduction)
- Use `settingSources: []` in SDK to load no filesystem settings
- Use `settingSources: ['project']` only when you need CLAUDE.md

**Conversation management:**
- 10K-token history resent with every message; after 20 exchanges = 200K tokens of history
- Use `/compact` or `/clear` proactively
- Custom compaction instructions preserve what matters
- Auto-compaction at ~95% capacity; configurable via `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`

### 4.4 Subagent Cost Patterns

**Why subagents are expensive:**
- 5,000-15,000 tokens to establish role and capabilities
- 500-2,000 tokens/minute for context maintenance per agent
- 1,000-5,000 tokens per collaboration/communication
- 200-1,000 tokens per tool execution

**Mitigation strategies:**
1. Keep subagent tasks small and self-contained
2. Use Haiku for exploration subagents (built-in Explore agent does this)
3. Limit concurrent subagents (recommended max: 3-4 specialized agents)
4. Use `maxTurns` to bound execution
5. Use `maxBudgetUsd` to cap cost per query
6. Delegate verbose operations to subagents so output stays in their context
7. Return only summaries to the main conversation

### 4.5 Relevance to Our Orchestrator

**Critical design decisions based on token research:**

1. **Default to `settingSources: []`** when spawning agents via SDK -- don't load filesystem settings unless needed
2. **Use stream-json mode** for persistent agent processes to avoid re-injecting system prompts
3. **Route models aggressively**: Haiku for exploration/validation, Sonnet for implementation, Opus only for complex architectural decisions
4. **Cap agent execution** with `maxTurns` and `maxBudgetUsd` on every spawn
5. **Inject only necessary context** via `systemPrompt` -- don't rely on CLAUDE.md inheritance
6. **Measure everything**: Use PostToolUse hooks to track token consumption per agent per task

---

## 5. Deterministic + LLM Hybrid Architectures

### 5.1 Anthropic's Own Pattern

**Source:** [Anthropic multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)

The production pattern: "The adaptability of AI agents built on Claude with deterministic safeguards like retry logic and regular checkpoints."

Key architectural elements:
- **Deterministic**: Task decomposition rules, retry logic, checkpoints, resource scaling guidelines
- **LLM-driven**: Strategy development, research execution, result synthesis
- **Hybrid**: Lead agent makes LLM decisions within deterministic bounds

### 5.2 The C Compiler Build Pattern

**Source:** [Anthropic engineering blog](https://www.anthropic.com/engineering/building-c-compiler)

Nicholas Carlini's architecture was notably simple:
- Docker containers for isolation
- File-based task claiming (deterministic)
- Git for synchronization (deterministic)
- Claude agents for actual coding (LLM-driven)
- CI/CD test suites for verification (deterministic)

The orchestration was almost entirely deterministic -- the only LLM-driven part was the actual code writing within each agent's container.

### 5.3 Temporal + LLM Pattern

**Source:** [IntuitionLabs - Agentic AI Temporal Orchestration](https://intuitionlabs.ai/articles/agentic-ai-temporal-orchestration)

Temporal enables coding workflows in TypeScript with durable execution:
- TypeScript workflow definitions (deterministic)
- LLM calls as activities within workflows (non-deterministic)
- Built-in retry, timeout, and compensation logic
- State persistence across failures

### 5.4 Multi-Agent Parallel Orchestration with Redis

**Source:** [DEV Community - Running 10+ Claude instances in parallel](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da)

Architecture:
- **Meta-Agent Orchestrator**: Claude instance for task analysis/decomposition only
- **Task Queue (Redis)**: Distributes work, tracks dependencies, prevents conflicts
- **Specialized Worker Agents**: Each with specific role, process from shared queue

Key implementation details:
- Topological sorting on tasks for dependency management
- Redis-based file locking (300-second timeouts) to prevent conflicts
- Unique `CLAUDE_SESSION_ID` per agent+task combination
- Exponential backoff for dependency resolution
- WebSocket dashboard for real-time monitoring

Results: 12,000+ lines refactored in 2 hours (vs 2-day manual estimate), 100% test pass rate, zero file conflicts.

### 5.5 The "Deterministic Shell, Non-Deterministic Core" Pattern

Across all implementations studied, a clear pattern emerges:

```
DETERMINISTIC LAYER (TypeScript/code):
  - Task decomposition and assignment
  - File locking and conflict prevention
  - Dependency graph management
  - Retry logic and error recovery
  - Token budget enforcement
  - Result aggregation and validation
  - CI/CD test verification

LLM LAYER (Claude agents):
  - Code understanding and generation
  - Strategy development for ambiguous tasks
  - Natural language interpretation
  - Creative problem-solving
  - Code review and quality assessment
```

### 5.6 Relevance to Our Orchestrator

This research strongly validates our planned architecture. Specific patterns to adopt:

1. **Task queue with dependency tracking** (like the Redis pattern, but we can use simpler in-memory or file-based)
2. **File locking/ownership** to prevent agent conflicts
3. **Test-driven verification** as deterministic quality gates
4. **Topological sort** for task ordering
5. **Budget caps per agent** via `maxBudgetUsd` and `maxTurns`
6. **Checkpoint/resume** via SDK session management
7. **Meta-agent for decomposition, worker agents for execution** -- but consider whether decomposition can be deterministic too

---

## 6. Claude Code Agent Definition Format

### 6.1 Complete Specification

**Source:** [Claude Code subagent docs](https://code.claude.com/docs/en/sub-agents)

Agent files: `.claude/agents/{name}.md` (project) or `~/.claude/agents/{name}.md` (user)

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
disallowedTools: Write, Edit
model: sonnet
permissionMode: dontAsk
maxTurns: 20
skills:
  - api-conventions
  - error-handling-patterns
memory: user
background: true
isolation: worktree
hooks:
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

You are a senior code reviewer. When invoked, analyze code and provide
specific, actionable feedback on quality, security, and best practices.
```

### 6.2 All Frontmatter Fields

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `name` | Yes | lowercase + hyphens | Unique identifier |
| `description` | Yes | string | When Claude should delegate to this agent |
| `tools` | No | CSV tool names | Allowlist. Inherits all if omitted |
| `disallowedTools` | No | CSV tool names | Denylist, removed from inherited set |
| `model` | No | `sonnet`, `opus`, `haiku`, `inherit` | Default: `inherit` |
| `permissionMode` | No | `default`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan` | Permission handling |
| `maxTurns` | No | number | Max agentic turns |
| `skills` | No | list of skill names | Skills injected at startup (full content, not just descriptions) |
| `mcpServers` | No | server names or inline defs | MCP servers available to this agent |
| `hooks` | No | hook config object | Lifecycle hooks scoped to this agent |
| `memory` | No | `user`, `project`, `local` | Persistent memory scope |
| `background` | No | boolean | Always run as background task |
| `isolation` | No | `worktree` | Run in isolated git worktree |

### 6.3 Tool Restriction Patterns

**Allow specific subagent spawning:**
```yaml
tools: Agent(worker, researcher), Read, Bash
```
Only `worker` and `researcher` subagents can be spawned.

**Deny specific subagents:**
```json
{
  "permissions": {
    "deny": ["Agent(Explore)", "Agent(my-custom-agent)"]
  }
}
```

### 6.4 Persistent Memory

When `memory` is set, the agent gets a persistent directory:
- `user`: `~/.claude/agent-memory/{name}/`
- `project`: `.claude/agent-memory/{name}/`
- `local`: `.claude/agent-memory-local/{name}/`

The agent's system prompt includes instructions for reading/writing `MEMORY.md` (first 200 lines auto-included). Read, Write, Edit tools auto-enabled.

### 6.5 CLI-defined Agents (for automation)

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  }
}'
```

Session-only, not saved to disk. Supports all frontmatter fields via JSON.

### 6.6 SDK-defined Agents (for programmatic use)

```typescript
options: {
  agents: {
    "code-reviewer": {
      description: "Expert code reviewer",
      prompt: "Analyze code quality and suggest improvements.",
      tools: ["Read", "Glob", "Grep"],
      model: "sonnet"
    }
  }
}
```

### 6.7 Relevance to Our Orchestrator

For our TypeScript orchestrator, we should primarily use the **SDK `agents` option** for programmatic agent definition rather than `.claude/agents/` files. This gives us:
- Dynamic agent creation based on task requirements
- No filesystem dependency for agent definitions
- Full control over system prompts, tools, and model per invocation
- Ability to inject task-specific context via `systemPrompt`

---

## 7. Skills System (Relevant to SKILL.md Pattern)

### 7.1 Complete Skills Specification

**Source:** [Skills docs](https://code.claude.com/docs/en/skills)

Skills are `SKILL.md` files with YAML frontmatter. They follow the Agent Skills open standard.

**All Frontmatter Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | No | Display name (defaults to directory name) |
| `description` | Recommended | What the skill does; Claude uses this for auto-invocation |
| `argument-hint` | No | Hint for autocomplete (e.g., `[issue-number]`) |
| `disable-model-invocation` | No | `true` = only user can invoke |
| `user-invocable` | No | `false` = hidden from `/` menu |
| `allowed-tools` | No | Tools allowed without permission when skill is active |
| `model` | No | Model override for this skill |
| `context` | No | `fork` = run in forked subagent context |
| `agent` | No | Subagent type when `context: fork` (default: `general-purpose`) |
| `hooks` | No | Hooks scoped to skill lifecycle |

**Dynamic context injection:**
```yaml
---
name: pr-summary
context: fork
agent: Explore
---
## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
```

The `!`command`` syntax runs shell commands before skill content is sent to Claude.

**String substitutions:** `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `${CLAUDE_SESSION_ID}`

---

## 8. Synthesis: Architecture Recommendations for Agent-Conductor

### 8.1 The Hybrid Architecture

Based on all research, the recommended architecture is:

```
DETERMINISTIC TYPESCRIPT ORCHESTRATOR
  |
  |-- Directive Pipeline (deterministic)
  |   |-- Parse directive
  |   |-- Decompose into tasks (can be LLM-assisted or rule-based)
  |   |-- Build dependency graph
  |   |-- Assign models per task type
  |   |-- Enforce budget caps
  |
  |-- Agent Spawner (deterministic shell, LLM core)
  |   |-- Use Agent SDK query() for each task
  |   |-- Configure: allowedTools, model, maxTurns, maxBudgetUsd
  |   |-- Configure: settingSources: [] (minimal context)
  |   |-- Inject task-specific systemPrompt
  |   |-- Track via PostToolUse hooks
  |
  |-- Checkpoint Manager (deterministic)
  |   |-- Resume sessions via SDK session management
  |   |-- Track agent state in filesystem/DB
  |   |-- Implement retry with exponential backoff
  |
  |-- Quality Gate (hybrid)
  |   |-- Deterministic: Run tests, linters
  |   |-- LLM: Code review via separate agent with review prompt
  |   |-- Hook-based: Stop hooks verify completeness
  |
  |-- Telemetry (deterministic)
  |   |-- PostToolUse hooks track all actions
  |   |-- Token usage via SDK messages
  |   |-- Dashboard updates via filesystem writes
```

### 8.2 Key Design Principles

1. **Minimize agent context**: Use `settingSources: []`, inject only task-specific system prompts
2. **Route models aggressively**: Haiku for exploration, Sonnet for implementation, Opus for architecture
3. **Cap everything**: `maxTurns`, `maxBudgetUsd` on every agent spawn
4. **Deterministic where possible**: Task decomposition, dependency management, file ownership, test verification
5. **LLM only where needed**: Code generation, ambiguous decision-making, creative problem-solving
6. **Hooks for control**: PreToolUse for policy enforcement, PostToolUse for telemetry, Stop for quality gates
7. **Session management for resilience**: Store session IDs, resume on failure
8. **File-based coordination**: Like the C compiler project, simple file locks and git-based sync work well

### 8.3 Estimated Token Costs

Based on research data:
- Simple task (Haiku, 5 turns, no exploration): ~5K-10K tokens
- Medium task (Sonnet, 15 turns, some exploration): ~50K-100K tokens
- Complex task (Opus, 30+ turns, deep exploration): ~200K-500K tokens
- Full directive pipeline (3-5 tasks): ~200K-1M tokens
- With isolation optimization: ~60-80% reduction from naive approach

### 8.4 Risks and Limitations

1. **Agent SDK is rapidly evolving** -- V2 is unstable preview, APIs may change
2. **Subagent nesting not supported** -- cannot compose agents arbitrarily
3. **Agent Teams experimental** -- not suitable for production orchestration yet
4. **Token costs scale linearly** with agent count and conversation length
5. **No built-in inter-agent communication** outside of Agent Teams
6. **Context compaction lossy** -- critical information can be lost
7. **File conflicts** remain a risk with parallel agents (need explicit ownership)
8. **Rate limits** become critical at scale -- need careful TPM/RPM management

---

## 9. Source Index

### Official Documentation
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [TypeScript SDK Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [TypeScript V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)
- [Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents)
- [Extend Claude with Skills](https://code.claude.com/docs/en/skills)
- [Automate Workflows with Hooks](https://code.claude.com/docs/en/hooks-guide)
- [Manage Costs Effectively](https://code.claude.com/docs/en/costs)
- [Agent Teams](https://code.claude.com/docs/en/agent-teams)

### Anthropic Engineering Blog
- [Building Agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
- [Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Building a C Compiler with Parallel Claudes](https://www.anthropic.com/engineering/building-c-compiler)

### GitHub Repositories
- [claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript)
- [claude-agent-sdk-demos](https://github.com/anthropics/claude-agent-sdk-demos)
- [wshobson/agents](https://github.com/wshobson/agents) -- 112 agents, 72 plugins, 16 orchestrators
- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) -- 127+ curated subagents

### Community Blog Posts and Analysis
- [Claude Code Sub Agents - Burn Out Your Tokens](https://dev.to/onlineeric/claude-code-sub-agents-burn-out-your-tokens-4cd8)
- [Why Claude Code Subagents Waste 50K Tokens Per Turn](https://dev.to/jungjaehoon/why-claude-code-subagents-waste-50k-tokens-per-turn-and-how-to-fix-it-41ma)
- [Multi-Agent Orchestration: Running 10+ Claude Instances in Parallel](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da)
- [Claude Code Swarm Orchestration Skill (Gist)](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea)
- [Sub-Agent Best Practices: Parallel vs Sequential](https://claudefa.st/blog/guide/agents/sub-agent-best-practices)
- [Claude Code Agent Teams Complete Guide 2026](https://claudefa.st/blog/guide/agents/agent-teams)

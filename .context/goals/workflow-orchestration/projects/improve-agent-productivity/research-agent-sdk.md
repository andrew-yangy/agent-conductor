# Claude Agent SDK -- Deep Research Report

**Date:** 2026-03-03
**Researcher:** Sarah Chen (CTO)
**Purpose:** Evaluate the Claude Agent SDK for building a deterministic orchestrator (`scripts/orchestrate.ts`)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [SDK Overview and Architecture](#2-sdk-overview-and-architecture)
3. [Core API Reference (TypeScript)](#3-core-api-reference-typescript)
4. [Subagents and Parallel Execution](#4-subagents-and-parallel-execution)
5. [Session Management and Persistence](#5-session-management-and-persistence)
6. [Hooks and Lifecycle](#6-hooks-and-lifecycle)
7. [Custom Tools and MCP Integration](#7-custom-tools-and-mcp-integration)
8. [Structured Outputs](#8-structured-outputs)
9. [Permissions and Safety](#9-permissions-and-safety)
10. [File Checkpointing](#10-file-checkpointing)
11. [Cost Tracking and Optimization](#11-cost-tracking-and-optimization)
12. [V2 Interface Preview](#12-v2-interface-preview)
13. [Effective Harnesses for Long-Running Agents](#13-effective-harnesses-for-long-running-agents)
14. [SDK vs Alternatives](#14-sdk-vs-alternatives)
15. [Limitations and Gotchas](#15-limitations-and-gotchas)
16. [Mapping to Our Orchestrator Needs](#16-mapping-to-our-orchestrator-needs)
17. [Sources](#17-sources)

---

## 1. Executive Summary

The Claude Agent SDK (renamed from Claude Code SDK in September 2025) is a TypeScript/Python library that wraps Claude Code into a programmable agent framework. Current version: v0.2.37 (TypeScript), 1.85M+ weekly npm downloads.

**Key finding:** The SDK is the right foundation for our orchestrator. It provides deterministic control over agent spawning, tool scoping, session management, and lifecycle hooks -- exactly what we need to replace SKILL.md-driven LLM orchestration with TypeScript code. The main architectural decision is whether to use the SDK's built-in subagent system (Claude decides when to delegate) or manage parallel `query()` calls ourselves via `Promise.all()` (we decide deterministically).

**Recommendation:** Use `Promise.all()` with independent `query()` calls for our orchestrator, NOT the SDK's subagent system. Subagents are Claude-initiated; we need deterministic, orchestrator-initiated parallelism. Use hooks for pre/post validation. Use sessions for checkpoint/resume.

---

## 2. SDK Overview and Architecture

### What the SDK Is

The Agent SDK gives you the same tools, agent loop, and context management that power Claude Code, programmable in TypeScript and Python. It wraps the Claude Code CLI as a child process and communicates via a streaming message protocol.

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Authentication

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Also supports Bedrock (`CLAUDE_CODE_USE_BEDROCK=1`), Vertex AI (`CLAUDE_CODE_USE_VERTEX=1`), and Azure (`CLAUDE_CODE_USE_FOUNDRY=1`).

### Minimal Example

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Built-in Tools

| Tool | What it does |
|------|--------------|
| Read | Read any file in the working directory |
| Write | Create new files |
| Edit | Make precise edits to existing files |
| Bash | Run terminal commands, scripts, git operations |
| Glob | Find files by pattern |
| Grep | Search file contents with regex |
| WebSearch | Search the web for current information |
| WebFetch | Fetch and parse web page content |
| Task | Invoke subagents |
| AskUserQuestion | Ask clarifying questions with multiple choice |
| TodoWrite | Create and manage task lists |

### Architecture Under the Hood

The SDK spawns a Claude Code CLI process and communicates via stdin/stdout JSON messages. This means:
- Each `query()` call creates a new process (or reuses via session resume)
- Tools execute inside the child process, NOT in your Node process
- Custom tools are exposed via in-process MCP servers that the SDK bridges to the child process
- System prompt, tools, and permissions are configured via the Options object

---

## 3. Core API Reference (TypeScript)

### `query()` Function

The primary entry point. Returns an async generator that streams messages.

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query;
```

### `Options` Type (Key Fields for Our Orchestrator)

```typescript
type Options = {
  // Agent identity and behavior
  systemPrompt?: string | { type: 'preset'; preset: 'claude_code'; append?: string };
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'max';

  // Tool control
  allowedTools?: string[];
  disallowedTools?: string[];
  tools?: string[] | { type: 'preset'; preset: 'claude_code' };

  // Subagents
  agents?: Record<string, AgentDefinition>;
  agent?: string;  // Agent name for the main thread

  // Sessions
  resume?: string;           // Session ID to resume
  sessionId?: string;        // Use specific UUID
  forkSession?: boolean;     // Fork when resuming
  persistSession?: boolean;  // Default: true

  // Cost control
  maxTurns?: number;
  maxBudgetUsd?: number;

  // Permissions
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk';
  allowDangerouslySkipPermissions?: boolean;  // Required for bypassPermissions
  canUseTool?: CanUseTool;   // Custom permission function
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;

  // Output
  outputFormat?: { type: 'json_schema'; schema: JSONSchema };
  includePartialMessages?: boolean;

  // Environment
  cwd?: string;
  env?: Record<string, string | undefined>;
  settingSources?: ('user' | 'project' | 'local')[];

  // MCP
  mcpServers?: Record<string, McpServerConfig>;

  // Advanced
  enableFileCheckpointing?: boolean;
  thinking?: ThinkingConfig;
  abortController?: AbortController;
  fallbackModel?: string;
  sandbox?: SandboxSettings;
  plugins?: SdkPluginConfig[];
};
```

### `Query` Object

```typescript
interface Query extends AsyncGenerator<SDKMessage, void> {
  interrupt(): Promise<void>;
  rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult>;
  setPermissionMode(mode: PermissionMode): Promise<void>;
  setModel(model?: string): Promise<void>;
  initializationResult(): Promise<SDKControlInitializeResponse>;
  supportedModels(): Promise<ModelInfo[]>;
  supportedAgents(): Promise<AgentInfo[]>;
  mcpServerStatus(): Promise<McpServerStatus[]>;
  streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
  stopTask(taskId: string): Promise<void>;
  close(): void;
}
```

### `AgentDefinition` Type

```typescript
type AgentDefinition = {
  description: string;               // When to use this agent
  prompt: string;                    // System prompt
  tools?: string[];                  // Allowed tools (inherits if omitted)
  disallowedTools?: string[];
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  mcpServers?: AgentMcpServerSpec[];
  skills?: string[];
  maxTurns?: number;
  criticalSystemReminder_EXPERIMENTAL?: string;
};
```

### SDKMessage Types

```typescript
type SDKMessage =
  | SDKAssistantMessage    // Claude's responses
  | SDKUserMessage         // User/tool results
  | SDKResultMessage       // Final result with cost, usage, session_id
  | SDKSystemMessage       // Init message with session_id, tools, model
  | SDKPartialAssistantMessage  // Streaming chunks
  | SDKCompactBoundaryMessage   // Context compaction events
  | SDKStatusMessage
  | SDKHookStartedMessage | SDKHookProgressMessage | SDKHookResponseMessage
  | SDKToolProgressMessage
  | SDKTaskNotificationMessage | SDKTaskStartedMessage | SDKTaskProgressMessage
  | SDKRateLimitEvent
  | SDKPromptSuggestionMessage;
```

### SDKResultMessage (Critical for Orchestrator)

```typescript
type SDKResultMessage =
  | {
      type: "result";
      subtype: "success";
      session_id: string;
      result: string;           // Text output
      total_cost_usd: number;   // Cost of this query() call
      num_turns: number;
      duration_ms: number;
      usage: NonNullableUsage;
      modelUsage: { [modelName: string]: ModelUsage };
      structured_output?: unknown;  // If outputFormat was set
    }
  | {
      type: "result";
      subtype: "error_max_turns" | "error_during_execution"
             | "error_max_budget_usd" | "error_max_structured_output_retries";
      errors: string[];
      total_cost_usd: number;
    };
```

---

## 4. Subagents and Parallel Execution

### How Subagents Work

Subagents are separate agent instances spawned via the `Task` tool. Key characteristics:

- **Claude decides when to spawn them** (based on the `description` field), unless you explicitly request one by name in your prompt
- **Separate context windows** -- subagent work does not pollute the main conversation
- **Cannot nest** -- subagents cannot spawn their own subagents
- **Invoked via the Task tool** -- must include "Task" in `allowedTools`

### Defining Subagents

```typescript
for await (const message of query({
  prompt: "Review the auth module for security issues",
  options: {
    allowedTools: ["Read", "Grep", "Glob", "Task"],
    agents: {
      "code-reviewer": {
        description: "Expert code reviewer for security reviews.",
        prompt: "You are a code review specialist...",
        tools: ["Read", "Grep", "Glob"],
        model: "sonnet"
      },
      "test-runner": {
        description: "Runs test suites and analyzes results.",
        prompt: "You are a test execution specialist...",
        tools: ["Bash", "Read", "Grep"]
      }
    }
  }
})) {
  // Messages from subagents have parent_tool_use_id set
  if ("result" in message) console.log(message.result);
}
```

### Dynamic Agent Factories

```typescript
function createAgent(level: "strict" | "basic"): AgentDefinition {
  return {
    description: "Security reviewer",
    prompt: `You are a ${level === "strict" ? "strict" : "balanced"} reviewer...`,
    tools: ["Read", "Grep", "Glob"],
    model: level === "strict" ? "opus" : "sonnet"
  };
}
```

### Parallel Execution via Promise.all() (Our Pattern)

The SDK does NOT have built-in `Promise.all()` parallel execution for subagents. Claude decides to parallelize subagents internally. For DETERMINISTIC parallel execution, we manage multiple `query()` calls ourselves:

```typescript
// Our orchestrator pattern: deterministic parallel agents
const results = await Promise.all([
  runAgent("auditor", directiveFile, auditPrompt, ["Read", "Glob", "Grep"]),
  runAgent("builder", directiveFile, buildPrompt, ["Read", "Edit", "Write", "Bash"]),
  runAgent("reviewer", directiveFile, reviewPrompt, ["Read", "Glob", "Grep"])
]);

async function runAgent(
  name: string,
  cwd: string,
  prompt: string,
  tools: string[]
): Promise<AgentResult> {
  let result: AgentResult | undefined;
  for await (const message of query({
    prompt,
    options: {
      allowedTools: tools,
      permissionMode: "acceptEdits",
      cwd,
      model: "claude-sonnet-4-5",
      maxTurns: 25,
      maxBudgetUsd: 2.0
    }
  })) {
    if (message.type === "result") {
      result = {
        name,
        success: message.subtype === "success",
        output: message.subtype === "success" ? message.result : "",
        cost: message.total_cost_usd,
        turns: message.num_turns
      };
    }
  }
  return result!;
}
```

### Subagent Resumption

Subagents can be resumed by capturing the `agentId` from Task tool results and passing it in a resumed session:

```typescript
// Extract agentId from message content
const content = JSON.stringify(message.message.content);
const match = content.match(/agentId:\s*([a-f0-9-]+)/);

// Resume the subagent in the same session
for await (const msg of query({
  prompt: `Resume agent ${agentId} and continue analysis`,
  options: { resume: sessionId }
})) { ... }
```

### Key Constraint: Subagents Cannot Nest

Subagents cannot spawn their own subagents. Do NOT include `Task` in a subagent's tools array. This is a hard architectural constraint that matches our flat orchestrator design.

---

## 5. Session Management and Persistence

### Session Lifecycle

1. Each `query()` call creates a session automatically
2. Session ID returned in the init message (`type: "system", subtype: "init"`)
3. Sessions persist to disk by default (`persistSession: true`)
4. Sessions can be resumed, forked, or listed

### Capturing the Session ID

```typescript
let sessionId: string | undefined;

for await (const message of query({
  prompt: "Read the authentication module",
  options: { allowedTools: ["Read", "Glob"] }
})) {
  if (message.type === "system" && message.subtype === "init") {
    sessionId = message.session_id;
  }
}
```

### Resuming Sessions

```typescript
// Resume with full context from previous query
for await (const message of query({
  prompt: "Now find all places that call it",
  options: { resume: sessionId }
})) {
  if ("result" in message) console.log(message.result);
}
```

### Forking Sessions

```typescript
// Fork creates a new branch from the resumed state
const forkedResponse = query({
  prompt: "Try a different approach",
  options: {
    resume: sessionId,
    forkSession: true  // New session ID, original preserved
  }
});
```

### Disabling Persistence

```typescript
// For ephemeral/automated workflows
options: { persistSession: false }
```

### Listing Past Sessions

```typescript
import { listSessions } from "@anthropic-ai/claude-agent-sdk";

const sessions = await listSessions({ dir: "/path/to/project", limit: 10 });
for (const s of sessions) {
  console.log(`${s.summary} (${s.sessionId}) - ${s.gitBranch}`);
}
```

### Session Data Structure

```typescript
type SDKSessionInfo = {
  sessionId: string;
  summary: string;
  lastModified: number;
  fileSize: number;
  customTitle?: string;
  firstPrompt?: string;
  gitBranch?: string;
  cwd?: string;
};
```

### Mapping to Our Checkpoints

Our orchestrator can use sessions as checkpoints:
- Capture `sessionId` from each agent run
- Store in directive state alongside `agentId` for subagent runs
- Resume on failure/retry by passing `resume: sessionId`
- Fork for exploratory branches

---

## 6. Hooks and Lifecycle

### Available Hook Events

| Hook | Triggers When | Key Use Case |
|------|--------------|--------------|
| `PreToolUse` | Before a tool executes | Block dangerous ops, modify inputs, auto-approve |
| `PostToolUse` | After tool completes | Log changes, audit, validate outputs |
| `PostToolUseFailure` | Tool execution fails | Error handling, retry logic |
| `Stop` | Agent execution stops | Save state, cleanup |
| `SessionStart` | Session begins | Initialize telemetry |
| `SessionEnd` | Session ends | Cleanup resources |
| `SubagentStart` | Subagent spawned | Track parallel tasks |
| `SubagentStop` | Subagent completes | Aggregate results |
| `PreCompact` | Context compaction | Archive full transcript |
| `PermissionRequest` | Permission dialog | Custom permission handling |
| `Notification` | Status messages | Forward to Slack/PagerDuty |
| `TaskCompleted` | Background task completes | Aggregate parallel results |
| `UserPromptSubmit` | User prompt submitted | Inject additional context |

### Hook Configuration Pattern

```typescript
const options = {
  hooks: {
    PreToolUse: [
      { matcher: "Write|Edit", hooks: [protectEnvFiles] },
      { matcher: "Bash", hooks: [validateBashCommands] },
      { hooks: [globalLogger] }  // No matcher = all tools
    ],
    PostToolUse: [
      { matcher: "Edit|Write", hooks: [auditFileChanges] }
    ],
    Stop: [
      { hooks: [saveCheckpoint] }
    ],
    SubagentStop: [
      { hooks: [aggregateResults] }
    ]
  }
};
```

### Hook Callback Signature

```typescript
type HookCallback = (
  input: HookInput,
  toolUseID: string | undefined,
  options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;
```

### PreToolUse Hook: Block Dangerous Operations

```typescript
const protectFiles: HookCallback = async (input, toolUseID, { signal }) => {
  const preInput = input as PreToolUseHookInput;
  const toolInput = preInput.tool_input as Record<string, unknown>;
  const filePath = toolInput?.file_path as string;

  if (filePath?.includes(".env") || filePath?.includes("credentials")) {
    return {
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "Cannot modify sensitive files"
      }
    };
  }
  return {};
};
```

### PreToolUse Hook: Modify Input (Sandbox Redirect)

```typescript
const sandboxRedirect: HookCallback = async (input) => {
  const preInput = input as PreToolUseHookInput;
  const toolInput = preInput.tool_input as Record<string, unknown>;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      updatedInput: {
        ...toolInput,
        file_path: `/sandbox${toolInput.file_path}`
      }
    }
  };
};
```

### PostToolUse Hook: Inject Context

```typescript
const addContext: HookCallback = async (input) => {
  return {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: "Remember: all test files must have 80% coverage"
    }
  };
};
```

### Hook Output: Full Type

```typescript
type SyncHookJSONOutput = {
  continue?: boolean;         // Should agent keep running?
  suppressOutput?: boolean;
  stopReason?: string;
  systemMessage?: string;     // Inject into conversation
  hookSpecificOutput?: {
    hookEventName: "PreToolUse";
    permissionDecision?: "allow" | "deny" | "ask";
    permissionDecisionReason?: string;
    updatedInput?: Record<string, unknown>;
  } | {
    hookEventName: "PostToolUse";
    additionalContext?: string;
    updatedMCPToolOutput?: unknown;
  } | /* ... other event types */;
};
```

### Async Hooks (Fire and Forget)

```typescript
const asyncLogger: HookCallback = async (input) => {
  sendToLoggingService(input).catch(console.error);
  return { async: true, asyncTimeout: 30000 };
};
```

### Hook Priority Rules

- **deny** takes priority over **ask**, which takes priority over **allow**
- If any hook returns deny, the operation is blocked regardless of others
- Hooks execute in array order within each event type

---

## 7. Custom Tools and MCP Integration

### Creating Custom Tools with `tool()` and `createSdkMcpServer()`

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const customServer = createSdkMcpServer({
  name: "orchestrator-tools",
  version: "1.0.0",
  tools: [
    tool(
      "read_directive",
      "Read a directive JSON file from the context tree",
      {
        directiveId: z.string().describe("The directive ID to read")
      },
      async (args) => {
        const content = await fs.readFile(
          `.context/directives/${args.directiveId}.json`, "utf-8"
        );
        return {
          content: [{ type: "text", text: content }]
        };
      }
    ),
    tool(
      "update_project_status",
      "Update a project's status in its project.json",
      {
        goalId: z.string(),
        projectId: z.string(),
        status: z.enum(["active", "completed", "blocked"])
      },
      async (args) => {
        // Update logic here
        return {
          content: [{ type: "text", text: `Updated ${args.projectId} to ${args.status}` }]
        };
      }
    )
  ]
});
```

### Using Custom Tools

CRITICAL: Custom MCP tools require streaming input mode (async generator), not a plain string prompt.

```typescript
async function* generateMessages() {
  yield {
    type: "user" as const,
    message: {
      role: "user" as const,
      content: "Read directive D-042 and analyze it"
    }
  };
}

for await (const message of query({
  prompt: generateMessages(),
  options: {
    mcpServers: { "orchestrator-tools": customServer },
    allowedTools: ["mcp__orchestrator-tools__read_directive"]
  }
})) { ... }
```

### Tool Name Format

MCP tools follow the pattern: `mcp__{server_name}__{tool_name}`

Example: `mcp__orchestrator-tools__read_directive`

### External MCP Servers

```typescript
// stdio-based MCP server
mcpServers: {
  playwright: { command: "npx", args: ["@playwright/mcp@latest"] }
}

// SSE-based MCP server
mcpServers: {
  remote: { type: "sse", url: "https://api.example.com/mcp" }
}

// HTTP-based MCP server
mcpServers: {
  http: { type: "http", url: "https://api.example.com/mcp" }
}
```

---

## 8. Structured Outputs

### JSON Schema Output Format

Get validated JSON from agent workflows. The agent uses tools freely, then the result conforms to your schema.

```typescript
const directiveAnalysis = {
  type: "object",
  properties: {
    weight: { type: "string", enum: ["light", "medium", "heavy"] },
    estimated_hours: { type: "number" },
    required_agents: {
      type: "array",
      items: { type: "string", enum: ["auditor", "builder", "reviewer", "scout"] }
    },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    rationale: { type: "string" }
  },
  required: ["weight", "estimated_hours", "required_agents", "risk_level", "rationale"]
};

for await (const message of query({
  prompt: "Analyze this directive and classify its complexity",
  options: {
    outputFormat: { type: "json_schema", schema: directiveAnalysis }
  }
})) {
  if (message.type === "result" && message.structured_output) {
    const analysis = message.structured_output as DirectiveAnalysis;
    // Deterministic routing based on structured output
  }
}
```

### With Zod Type Safety

```typescript
import { z } from "zod";

const DirectiveAnalysis = z.object({
  weight: z.enum(["light", "medium", "heavy"]),
  estimated_hours: z.number(),
  required_agents: z.array(z.enum(["auditor", "builder", "reviewer", "scout"])),
  risk_level: z.enum(["low", "medium", "high"]),
  rationale: z.string()
});

type DirectiveAnalysis = z.infer<typeof DirectiveAnalysis>;
const schema = z.toJSONSchema(DirectiveAnalysis);
```

### Error Handling

```typescript
if (message.type === "result") {
  if (message.subtype === "success" && message.structured_output) {
    const parsed = DirectiveAnalysis.safeParse(message.structured_output);
    if (parsed.success) { /* use parsed.data */ }
  } else if (message.subtype === "error_max_structured_output_retries") {
    // Schema too complex or task ambiguous -- fall back
  }
}
```

---

## 9. Permissions and Safety

### Permission Modes

| Mode | Description | Our Use Case |
|------|-------------|-------------|
| `default` | Standard behavior, prompts for approval | Not for automation |
| `acceptEdits` | Auto-approve file edits, Bash still needs approval | Builder agents |
| `bypassPermissions` | All tools auto-approved | Full automation (use cautiously) |
| `plan` | No tool execution, planning only | Pre-mortem / audit agents |
| `dontAsk` | Deny if not pre-approved, never prompt | CI/CD pipelines |

### Permission Evaluation Order

1. **Hooks** (PreToolUse) -- can allow/deny/ask
2. **Permission rules** (settings.json) -- deny > allow > ask
3. **Permission mode** -- the global default
4. **canUseTool callback** -- runtime interactive approval

### Warning: bypassPermissions + Subagents

When using `bypassPermissions`, ALL subagents inherit this mode and it CANNOT be overridden. Subagents get full autonomous system access. This is a security risk to be aware of.

### Custom Permission Function

```typescript
const canUseTool: CanUseTool = async (toolName, input, options) => {
  if (toolName === "Bash" && (input.command as string)?.includes("rm -rf")) {
    return { behavior: "deny", message: "Destructive commands not allowed" };
  }
  return { behavior: "allow" };
};
```

---

## 10. File Checkpointing

### How It Works

File checkpointing tracks modifications made through Write, Edit, and NotebookEdit tools. Bash-based file changes are NOT tracked.

### Enable and Use

```typescript
const response = query({
  prompt: "Refactor the auth module",
  options: {
    enableFileCheckpointing: true,
    permissionMode: "acceptEdits",
    extraArgs: { "replay-user-messages": null } // Required for checkpoint UUIDs
  }
});

let checkpointId: string | undefined;
let sessionId: string | undefined;

for await (const message of response) {
  if (message.type === "user" && message.uuid && !checkpointId) {
    checkpointId = message.uuid;  // First user message = restore point
  }
  if ("session_id" in message) sessionId = message.session_id;
}

// Later: rewind by resuming with empty prompt
const rewindQuery = query({
  prompt: "",
  options: { enableFileCheckpointing: true, resume: sessionId }
});
for await (const msg of rewindQuery) {
  await rewindQuery.rewindFiles(checkpointId!);
  break;
}
```

### Limitations

- Only Write/Edit/NotebookEdit tracked (NOT Bash file changes)
- Checkpoints tied to the session that created them
- File content only (not directory operations)

---

## 11. Cost Tracking and Optimization

### Per-Query Cost

```typescript
for await (const message of query({ prompt: "..." })) {
  if (message.type === "result") {
    console.log(`Cost: $${message.total_cost_usd}`);
    console.log(`Turns: ${message.num_turns}`);
    console.log(`Duration: ${message.duration_ms}ms`);
  }
}
```

### Per-Model Breakdown (TypeScript Only)

```typescript
if (message.type === "result") {
  for (const [model, usage] of Object.entries(message.modelUsage)) {
    console.log(`${model}: $${usage.costUSD.toFixed(4)}`);
    console.log(`  Input: ${usage.inputTokens}, Output: ${usage.outputTokens}`);
    console.log(`  Cache read: ${usage.cacheReadInputTokens}`);
  }
}
```

### Cost Guardrails

```typescript
options: {
  maxTurns: 25,        // Hard limit on conversation turns
  maxBudgetUsd: 2.0,   // Hard limit on spend per query()
}
```

If exceeded, the result message has `subtype: "error_max_turns"` or `"error_max_budget_usd"`.

### Accumulating Across Calls

```typescript
let totalSpend = 0;
for (const prompt of prompts) {
  for await (const msg of query({ prompt })) {
    if (msg.type === "result") totalSpend += msg.total_cost_usd ?? 0;
  }
}
```

### Token Deduplication

When Claude uses parallel tools, multiple messages share the same `id`. Deduplicate by ID to avoid double-counting.

```typescript
const seenIds = new Set<string>();
for await (const message of query({ prompt: "..." })) {
  if (message.type === "assistant") {
    if (!seenIds.has(message.message.id)) {
      seenIds.add(message.message.id);
      // Count tokens only once per unique ID
    }
  }
}
```

### Optimization Strategies

1. **Use effort levels**: `effort: 'low'` for simple classification, `effort: 'high'` for complex builds
2. **Model tiering**: Haiku for audits/reads, Sonnet for builds, Opus for reviews
3. **maxTurns + maxBudgetUsd**: Always set both as circuit breakers
4. **Prompt caching**: Automatic -- repeated system prompts are cached
5. **Auto-compaction**: Automatic when approaching context limits

---

## 12. V2 Interface Preview

A simplified interface is in unstable preview. Key difference: `send()` and `stream()` replace the async generator pattern.

### V2 Session API

```typescript
import { unstable_v2_createSession, unstable_v2_resumeSession } from "@anthropic-ai/claude-agent-sdk";

// Create session
await using session = unstable_v2_createSession({ model: "claude-opus-4-6" });

// Send and stream
await session.send("Hello!");
for await (const msg of session.stream()) {
  if (msg.type === "assistant") { /* ... */ }
}

// Multi-turn: just send again
await session.send("Follow up question");
for await (const msg of session.stream()) { /* ... */ }
```

### V2 One-Shot

```typescript
import { unstable_v2_prompt } from "@anthropic-ai/claude-agent-sdk";

const result = await unstable_v2_prompt("What is 2 + 2?", { model: "claude-opus-4-6" });
if (result.subtype === "success") console.log(result.result);
```

### V2 Resume

```typescript
await using resumed = unstable_v2_resumeSession(savedSessionId, { model: "claude-opus-4-6" });
await resumed.send("Continue where we left off");
```

### V2 Assessment

The V2 interface is simpler for multi-turn conversations but is marked UNSTABLE and missing features (session forking, some streaming patterns). For our orchestrator, **stick with V1** -- it is stable, fully featured, and `query()` maps cleanly to our fire-and-collect pattern. Re-evaluate V2 when it stabilizes.

---

## 13. Effective Harnesses for Long-Running Agents

From Anthropic's engineering blog post (https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

### Core Problem

Long-running agents must work in discrete sessions. Each new session starts with no memory of what came before. Context windows are limited, and complex projects span multiple windows.

### Two-Agent Architecture

1. **Initializer Agent** (first session):
   - Creates `init.sh` script for environment setup
   - Generates `claude-progress.txt` for state tracking
   - Produces feature list with 200+ end-to-end descriptions
   - Makes initial git commit

2. **Coding Agent** (subsequent sessions):
   - Reads progress files and git logs first
   - Works on ONE feature at a time (critical)
   - Commits changes with descriptive messages
   - Updates progress documentation before session ends

### Feature List Format

```json
{
  "category": "functional",
  "description": "New chat button creates fresh conversation",
  "steps": [
    "Navigate to main interface",
    "Click the 'New Chat' button",
    "Verify new conversation created"
  ],
  "passes": false
}
```

### Session Startup Protocol

Each coding agent begins with:
1. Run `pwd` to verify working directory
2. Read git logs and progress files
3. Select highest-priority incomplete feature
4. Execute `init.sh` to start dev server
5. Run verification tests before implementing new features

### Key Insight: Incremental Progress

The architecture proved critical for addressing the agent's tendency to do too much at once. Work on ONE feature, verify, commit, update progress.

### Relevance to Our Orchestrator

This pattern maps directly to our checkpoint/resume design:
- `claude-progress.txt` = our directive state JSON + project.json task status
- Feature list = our tasks[] array in project.json
- Git commits as checkpoints = our session-based resume
- One feature at a time = our per-initiative scope limiting

---

## 14. SDK vs Alternatives

### Agent SDK vs Client SDK (Direct API)

| Aspect | Client SDK | Agent SDK |
|--------|-----------|-----------|
| Tool execution | You implement the loop | SDK handles autonomously |
| Built-in tools | None | Read, Write, Edit, Bash, Glob, Grep, etc. |
| Session management | Build your own | Built-in persistence and resume |
| Context management | Manual | Auto-compaction, caching |
| Complexity | Higher (you own everything) | Lower (SDK owns the agent loop) |

**Verdict:** Agent SDK. We get the full tool suite and agent loop without reimplementing it. The orchestrator controls WHAT runs, not HOW Claude executes tools.

### Agent SDK vs Claude Code CLI

| Use Case | Best Choice |
|----------|------------|
| Interactive development | CLI |
| CI/CD pipelines | SDK |
| Custom applications | SDK |
| Production automation | SDK |
| One-off tasks | CLI |

**Verdict:** SDK for orchestrator, CLI for human interaction. They share the same underlying engine.

### Agent SDK Subagents vs Our Promise.all() Pattern

| Aspect | SDK Subagents | Promise.all() |
|--------|-------------|---------------|
| Who decides parallelism | Claude (LLM) | Our TypeScript code |
| Determinism | Non-deterministic | Fully deterministic |
| Context isolation | Yes (separate contexts) | Yes (separate query() calls) |
| Cost tracking | Per-subagent in parent result | Per-query() call result |
| Nesting | Cannot nest | Can orchestrate any way |
| Tool scoping | Per-agent definition | Per-query() options |

**Verdict:** Promise.all() with separate query() calls. Our orchestrator needs deterministic control over which agents run, when, and with what tools. We do not want Claude deciding the execution plan.

---

## 15. Limitations and Gotchas

### Architecture Limitations

1. **Each query() spawns a child process** -- overhead for many small calls. Amortized over long-running agents, but avoid chatty patterns.

2. **Subagents cannot nest** -- one level of delegation only. Our flat orchestrator design works within this constraint.

3. **Custom MCP tools require streaming input mode** -- cannot use a plain string prompt with `mcpServers`. Must use an async generator.

4. **No cross-session memory** -- each session starts clean. Progress must be tracked externally (files, git, our directive JSON).

5. **Context window limits** -- auto-compaction helps but loses detail. The effective context buffer is ~33K tokens (reduced in early 2026).

### Cost Gotchas

6. **Agent teams use ~7x more tokens** than standard sessions because each teammate maintains its own context window.

7. **bypassPermissions on subagents** -- inherits to all subagents, cannot override. Security risk if subagents have different trust levels.

8. **No session-level cost aggregation** -- each query() reports its own cost. Accumulate manually.

9. **Extended thinking enabled by default** (31,999 token budget). For simple classification tasks, disable or lower to save cost: `thinking: { type: 'disabled' }` or `effort: 'low'`.

### Operational Gotchas

10. **Hook event names are case-sensitive** -- `PreToolUse`, not `preToolUse`.

11. **Matchers only match tool names, not file paths** -- check file paths inside the callback.

12. **`systemMessage` in hook output** injects into the conversation that the model sees, but may not appear in SDK output. Log separately.

13. **File checkpointing does NOT track Bash changes** -- only Write/Edit/NotebookEdit.

14. **`settingSources` defaults to empty** -- no CLAUDE.md loading unless you explicitly add `settingSources: ["project"]`.

15. **Windows: long subagent prompts may fail** due to 8191 char command line limit.

---

## 16. Mapping to Our Orchestrator Needs

### Directive Classification (Deterministic)

```typescript
// Read directive file deterministically with TypeScript
const directive = JSON.parse(fs.readFileSync(`.context/directives/${id}.json`, "utf-8"));
const weight = classifyWeight(directive); // Pure TypeScript logic, no LLM

// OR: Use structured output for LLM-assisted classification
const classification = await classifyWithLLM(directive);
```

### Agent Spawning (Scoped Tools + Minimal Prompts)

```typescript
// Each agent gets exactly the tools it needs
const agentConfigs: Record<string, AgentConfig> = {
  auditor: {
    tools: ["Read", "Glob", "Grep"],
    permissionMode: "bypassPermissions",
    model: "claude-sonnet-4-5",
    maxTurns: 15,
    maxBudgetUsd: 1.0,
    effort: "medium"
  },
  builder: {
    tools: ["Read", "Edit", "Write", "Bash", "Glob", "Grep"],
    permissionMode: "acceptEdits",
    model: "claude-sonnet-4-5",
    maxTurns: 50,
    maxBudgetUsd: 5.0,
    effort: "high"
  },
  reviewer: {
    tools: ["Read", "Glob", "Grep"],
    permissionMode: "bypassPermissions",
    model: "claude-opus-4-6",
    maxTurns: 20,
    maxBudgetUsd: 3.0,
    effort: "high"
  }
};
```

### Parallel Execution

```typescript
// Deterministic parallel execution with Promise.all()
const parallelResults = await Promise.all(
  initiatives.map(init => runInitiative(init, agentConfigs))
);
```

### Checkpoint Management

```typescript
// Session-based checkpoints
interface DirectiveCheckpoint {
  directiveId: string;
  sessionIds: Record<string, string>;  // agent name -> session ID
  status: "executing" | "completed" | "failed";
  cost: number;
}

// Resume on failure
if (checkpoint.status === "failed") {
  const result = await query({
    prompt: "Continue from where you left off...",
    options: { resume: checkpoint.sessionIds["builder"] }
  });
}
```

### Pre/Post Validation via Hooks

```typescript
// Pre-validation: block dangerous operations
const preValidation: HookCallback = async (input) => {
  const preInput = input as PreToolUseHookInput;
  const toolInput = preInput.tool_input as Record<string, unknown>;

  // Block writes outside project directory
  if (preInput.tool_name === "Write" || preInput.tool_name === "Edit") {
    const filePath = toolInput.file_path as string;
    if (!filePath.startsWith(allowedDirectory)) {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: `Writes restricted to ${allowedDirectory}`
        }
      };
    }
  }
  return {};
};

// Post-validation: verify outputs
const postValidation: HookCallback = async (input) => {
  const postInput = input as PostToolUseHookInput;
  // Log all tool uses for audit trail
  await appendToAuditLog({
    tool: postInput.tool_name,
    input: postInput.tool_input,
    timestamp: Date.now()
  });
  return {};
};
```

### Structured Output for Agent Results

```typescript
// Force agents to return structured results
const agentResultSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["success", "partial", "failed"] },
    files_modified: { type: "array", items: { type: "string" } },
    summary: { type: "string" },
    issues_found: { type: "array", items: {
      type: "object",
      properties: {
        severity: { type: "string", enum: ["critical", "warning", "info"] },
        description: { type: "string" },
        file: { type: "string" }
      },
      required: ["severity", "description"]
    }}
  },
  required: ["status", "summary"]
};
```

---

## 17. Sources

### Official Documentation
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [TypeScript SDK Reference](https://platform.claude.com/docs/en/agent-sdk/typescript)
- [Python SDK Reference](https://platform.claude.com/docs/en/agent-sdk/python)
- [Hooks Guide](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [Subagents Guide](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Sessions Guide](https://platform.claude.com/docs/en/agent-sdk/sessions)
- [Structured Outputs](https://platform.claude.com/docs/en/agent-sdk/structured-outputs)
- [Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [File Checkpointing](https://platform.claude.com/docs/en/agent-sdk/file-checkpointing)
- [Cost Tracking](https://platform.claude.com/docs/en/agent-sdk/cost-tracking)
- [V2 Preview](https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview)

### GitHub Repositories
- [TypeScript SDK](https://github.com/anthropics/claude-agent-sdk-typescript) (v0.2.37)
- [Python SDK](https://github.com/anthropics/claude-agent-sdk-python) (v0.1.34)
- [Demo Applications](https://github.com/anthropics/claude-agent-sdk-demos)
- [Claude Code](https://github.com/anthropics/claude-code)

### Engineering Blog Posts
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Building Agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)

### npm
- [@anthropic-ai/claude-agent-sdk](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) (1.85M+ weekly downloads)

### Community Resources
- [Nader Dabit: Complete Guide to Building Agents](https://nader.substack.com/p/the-complete-guide-to-building-agents)
- [DataCamp: Claude Agent SDK Tutorial](https://www.datacamp.com/tutorial/how-to-use-claude-agent-sdk)
- [CodeSignal: Parallelizing Claude Agentic Systems in TypeScript](https://codesignal.com/learn/courses/parallelizing-claude-agentic-systems-in-typescript)
- [Agent Teams vs Subagents Comparison](https://charlesjones.dev/blog/claude-code-agent-teams-vs-subagents-parallel-development)

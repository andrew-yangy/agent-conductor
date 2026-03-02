# Research: Agent Orchestration Framework Comparison

Date: 2026-03-02
Context: Work state management KR shaping — comparing how frameworks handle state, sessions, human oversight

## Key Findings

### The Persistence Spectrum
1. **Infrastructure-grade** (LangGraph + Postgres, Temporal): Auto-checkpoint after every step, crash recovery. Production-grade.
2. **File-as-state** (Taskmaster, MetaGPT, Claude Code): State in files on disk. Trivially persistent, no special infra. Limited granularity.
3. **Ephemeral** (AutoGen, SWE-agent): Each session is fresh. Breaks for multi-session work.

### Nobody Solves Multi-Day Autonomous Work
No framework solves "AI company running for days" natively:
- **Devin** — closest for single-engineer (session sleep/resume), but not team coordination
- **LangGraph** — closest technically (threads persist indefinitely), but you build the graph + UI
- **Temporal** — actual infra answer for durable execution, increasingly used as backbone for AI agents

### The Backlog Gap (nobody has this)
No framework has first-class backlog that:
1. Persists structured work items across sessions
2. Allows mid-execution scope addition
3. Presents prioritized work for operator review
4. Auto-surfaces newly-unblocked work

Taskmaster AI is closest for task management but lacks autonomous execution. LangGraph can model it but you build it yourself.

### The CEO Dashboard Gap
Only Devin ships a real operator dashboard. LangGraph Studio is best technical debugging UI. The "CEO view of what the AI org is doing" is unsolved in open source.

### Best Patterns to Steal
| Pattern | From | What |
|---------|------|------|
| Checkpoint after every step | LangGraph | Auto-persist state to DB after each node execution |
| `interrupt()` + `Command` | LangGraph | Pause mid-workflow, human edits state, resume |
| Session sleep/resume | Devin | Sessions persist indefinitely, wake on demand |
| Work log with grades | Devin | Timestamped, color-coded step tracking |
| Interactive planning | Devin | Agent proposes plan in seconds, human reviews before execution |
| tasks.json as state | Taskmaster AI | Structured JSON file = trivially persistent, inspectable, resumable |
| Event sourcing | OpenHands | Immutable event log = complete history, replayable |
| Temporal workflows | Temporal | Durable execution wrapper for long-running agent work |

## Comparative Matrix

| Framework | Cross-session State | Auto-recovery | CEO Dashboard | Mid-task Scope Change | Unit of Work |
|---|---|---|---|---|---|
| CrewAI | Manual @persist | No | Enterprise only | No | Task |
| AutoGen/AG2 | Fresh each session | No | AutoGen Studio | Chat injection | Conversation |
| LangGraph | Auto checkpoint (DB) | Yes | LangGraph Studio | interrupt() + Command | Node/Thread |
| MetaGPT | Filesystem (fragile) | No | None | Very limited | SOP Stage |
| ChatDev | V2: 3-layer arch | No | V2: visual UI | Feedback at critical nodes | Phase |
| Devin | Session sleep/resume | Work log (no auto) | Full commercial UI | Chat + interactive planning | Session/Step |
| Claude Code | CLAUDE.md + memory | No | None (our dashboard) | Natural language | None native |
| OpenHands | V1 SDK event sourcing | V1 pause/resume | Web UI | Mid-session intervention | Task/Step |
| SWE-agent | None | None | None | N/A | Issue |
| Taskmaster AI | tasks.json on disk | Trivial (read file) | None (MCP only) | Full CRUD mid-project | Task/Subtask |

## What This Means for Our System

We are building something none of these frameworks do: **autonomous multi-agent company with persistent state, CEO dashboard, and cross-session continuity.** The closest comparable is Devin (for UX/dashboard quality) + LangGraph (for checkpoint architecture) + Taskmaster (for structured task state).

Our unique requirements that no framework addresses:
1. Multiple parallel goals/projects (not single-task)
2. CEO-level oversight (not developer-level debugging)
3. Bottom-up proposals from agents (not just top-down execution)
4. Research/reasoning persistence (not just task state)
5. Project hierarchy (teams/roadmaps) not flat task lists

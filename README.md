<h1 align="center">gruAI</h1>

<h3 align="center">Stop coding with AI.<br/>Start running an AI team.</h3>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-blue" alt="TypeScript" /></a>
  <a href="https://www.npmjs.com/package/gru-ai"><img src="https://img.shields.io/npm/v/gru-ai" alt="npm version" /></a>
  <a href="#"><img src="https://img.shields.io/badge/status-alpha-orange" alt="Status: Alpha" /></a>
</p>

<p align="center">
  <a href="#what-is-gruai">What Is gruAI?</a> •
  <a href="#quickstart">Quickstart</a> •
  <a href="#the-pipeline">The Pipeline</a> •
  <a href="#your-team">Your Team</a> •
  <a href="#why-is-the-output-better">Why It Works</a> •
  <a href="#the-context-tree">Context Tree</a>
</p>

<p align="center">
  <video src="docs/assets/demo.mp4" width="720" autoplay loop muted playsinline>
    <img src="docs/assets/game-office.png" alt="gruAI pixel-art office with agents working" width="720" />
  </video>
</p>

---

## What Is gruAI?

### Most AI tools help you code faster. gruAI lets you stop coding entirely.

You run your AI team just like a CEO, and the agents handle the rest: engineering, marketing, operations, and more. You hand down a directive ("add dark mode to the dashboard"). Your agents brainstorm the approach, challenge your assumptions, build, review each other's work, and ship — you approve the result.

The system is designed for **depth, not speed.** Agents accumulate institutional memory across directives — lessons learned, design rationale, standing corrections. Your 10th directive runs better than your 1st because the team remembers what went wrong.

**You make decisions. Agents make software.** Every directive flows through a 15-step pipeline — triage, audit, brainstorm, plan, build, review, and ship — grounded in published research from Anthropic and OpenAI on what actually makes AI output reliable.

### gruAI is right for you if:

- ✅ You want to give direction, not write prompts — and have agents that brainstorm, challenge your thinking, and get it right without a reprompt loop
- ✅ You want mandatory code review and mechanical verification, not optional "looks good to me"
- ✅ You want institutional memory — agents that learn from mistakes and carry lessons across every task
- ✅ You want a structured pipeline backed by context engineering research, not ad-hoc agent orchestration
- ✅ You coordinate specialized roles (CTO, COO, CPO, CMO, engineers) not generic "AI assistants"

---

## Quickstart

### Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Claude Code** — [install guide](https://docs.anthropic.com/en/docs/claude-code/overview)

### Setup

```bash
npx gru-ai init       # Scaffolds .context/, agents, and pipeline into your repo
```

This creates the `.context/` directory, agent definitions in `.claude/agents/`, and pipeline skills. Your existing code is untouched.

```bash
npx gru-ai start      # Launches the dashboard on localhost:4444
```

Open [localhost:4444](http://localhost:4444) to see the session monitor and directive tracker.

### Your first directive

In Claude Code, run:

```
/directive Add a health check endpoint at /api/health that returns 200 OK
```

The pipeline will triage it as lightweight, skip the heavy analysis phases, and run through build + review + completion in a few minutes. Once you see how it works end-to-end, scale up to bigger directives.

<details>
<summary><strong>Platform Support</strong></summary>

| Platform | Pipeline | Dashboard | Session Monitoring | Status |
|----------|:--------:|:---------:|:------------------:|--------|
| **Claude Code** | :white_check_mark: | :white_check_mark: | :white_check_mark: | **Production** — fully tested |
| **Codex CLI** | :construction: | :x: | :x: | Spawn adapter built, not yet integrated |
| **Gemini CLI** | :construction: | :x: | :x: | Spawn adapter built, experimental |
| **Aider** | :construction: | :x: | :x: | Spawn adapter built, experimental |
| **Cursor / Cline** | :x: | :x: | :x: | Planned |

The pipeline and dashboard are engine-agnostic by design — platform adapters handle the differences.

</details>

---

## The Pipeline

You say *"add a payment system."* The pipeline takes it from here.

| # | Step | Who | What Happens |
|:-:|------|-----|-------------|
| 1 | **Triage** | Automated | Classifies your directive by weight. *"Add a payment system"* spans API, database, and UI — classified **heavyweight**. Loads relevant [context per role](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), not a 200K-token dump. [Start simple, add complexity only when needed.](https://www.anthropic.com/research/building-effective-agents) |
| 2 | **Audit** | QA Engineer → CTO | Two-agent sequential audit. QA scans the codebase (which files, what state, what breaks). Then the CTO recommends approaches — identifies existing API patterns, database schema, and security considerations. |
| 3 | **Debate** | CTO + CPO + CMO | **Agents only — you're not in the room.** C-suite agents independently propose approaches, then [argue among themselves](https://www.anthropic.com/engineering/multi-agent-research-system). CTO pushes for Stripe, CPO argues for simpler in-house billing, CMO flags pricing page implications. They surface 3 questions for you. |
| 4 | **Clarify** | 👤 **You** | **You answer the 3 questions** from the debate. Catching misalignment here costs one interaction instead of a full reopen. |
| 5 | **Plan** | COO → 👤 **You** | COO decomposes into projects, assigns agents and reviewers, breaks tasks down with Definition of Done criteria. Payment system → 2 projects: backend engineer builds API, frontend engineer builds UI. CTO reviews both. **You approve the plan** before any code is written. |
| 6 | **Build** | Engineers | Builders work through tasks on an isolated branch. After each task, a [separate reviewer evaluates with fresh context](https://www.anthropic.com/research/building-effective-agents) — no builder reasoning, no confirmation bias. |
| 7 | **Review** | Reviewers + Automated | **The quality guarantee.** See below. |
| 8 | **Ship** | Automated | Lessons captured, design docs updated, CEO digest generated with files changed, review results, and revert commands. [Knowledge persists](https://arxiv.org/abs/2602.20478) for future directives. |
| 9 | **Accept** | 👤 **You** | You review the digest and decide: approve, amend, or reopen. The pipeline never ships without your sign-off. |

> *The pipeline runs 15 internal steps. Context loading, crash recovery, git isolation, and lesson extraction run automatically between the steps above.*

### The Review System

Every task is reviewed by a **different agent** than the one that built it. The reviewer never sees the builder's reasoning or chain of thought — only the code, the diff, and your original requirements. This prevents confirmation bias.

Reviews check two things. First, **code quality**: bugs, edge cases, data flow issues. Second — and this is what separates gruAI from a linter — **intent alignment**: does the build actually deliver what you asked for? The reviewer walks through your user scenario, verifies every Definition of Done criterion, and checks that your standing corrections were respected. A build that compiles but doesn't match your intent is a failed review.

When a review fails, the builder gets the findings and fixes the issues. The reviewer evaluates again with fresh context. This [evaluator-optimizer loop](https://www.anthropic.com/research/building-effective-agents) runs up to 3 times per task — each cycle narrows the gap between what you asked for and what was built.

After all tasks pass, bash scripts — not LLMs — [mechanically verify](https://openai.com/index/harness-engineering/) that every task was reviewed by a separate agent, every DOD criterion was evaluated, and review artifacts exist on disk. No review can be skipped, abbreviated, or self-certified.

### Weight Adaptation

| Weight | Example | Skips | You Decide At |
|--------|---------|-------|---------------|
| **Lightweight** | Fix a typo | Debate | Accept only |
| **Medium** | Add dark mode | Debate | Accept only |
| **Heavyweight** | New payment system | Nothing | Clarify + Plan + Accept |
| **Strategic** | Platform migration | Nothing | Clarify + Plan + Accept |

---

## Your Team

gruAI ships with 11 customizable agents. You are the CEO — everyone reports to you.

```mermaid
graph TD
    CEO["👤 CEO (You)<br/>Direction & Approvals"]
    CTO["CTO<br/>Architecture & Code Quality"]
    CPO["CPO<br/>Product & UX"]
    COO["COO<br/>Planning & Orchestration"]
    CMO["CMO<br/>Growth & Positioning"]
    BE["Backend<br/>Engineer"]
    DE["Data<br/>Engineer"]
    FS["Full-Stack<br/>Engineer"]
    FE["Frontend<br/>Engineer"]
    UX["UI/UX<br/>Designer"]
    QA["QA<br/>Engineer"]
    CB["Content<br/>Builder"]

    CEO --> CTO
    CEO --> CPO
    CEO --> COO
    CEO --> CMO
    CTO --> BE
    CTO --> DE
    CTO --> FS
    CPO --> FE
    CPO --> UX
    CPO --> QA
    CMO --> CB
```

C-suite agents have **institutional memory** — lessons and corrections persist across directives. Engineers spawn per-task with fresh context. All agents are markdown files in `.claude/agents/` — add, rename, or customize freely.

---

## Why Is the Output Better?

Every point below traces to published research from Anthropic and OpenAI. This isn't a workflow we invented — it's assembled from what the research says actually works.

- **Agents brainstorm and argue before anyone writes code.** For strategic directives, your C-suite agents independently propose approaches, then deliberate — challenging assumptions, resolving disagreements, and surfacing questions for you. Anthropic's research found [multi-agent outperformed single-agent by 90.2%](https://www.anthropic.com/engineering/multi-agent-research-system). The pipeline implements their [orchestrator-workers pattern](https://www.anthropic.com/research/building-effective-agents) where specialized agents collaborate, producing better results than any single agent.

- **Reviewers evaluate intent, not just code.** Each reviewer gets [fresh context](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) scoped to the task — they never see the builder's reasoning, preventing confirmation bias. They verify against your Definition of Done (what you asked for), not just whether the code compiles. This is Anthropic's [evaluator-optimizer pattern](https://www.anthropic.com/research/building-effective-agents): one agent generates, another evaluates, issues get fixed in-loop — not after the fact.

- **Context is isolated, not accumulated.** Each agent spawns with a [clean context window](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) scoped to exactly what it needs. No 200K-token sessions where the model forgets what it read at the start. Anthropic's context engineering research shows accuracy degrades as token count increases — gruAI treats context as a finite resource under active degradation.

- **Verification is mechanical.** Bash scripts — not LLMs — enforce pipeline integrity: schema validation, self-review prevention, step dependency checks, role assignment verification. This follows Anthropic's [poka-yoke principle](https://www.anthropic.com/research/building-effective-agents) (error-proof design) and OpenAI's finding that [invariants should be enforced through structural tests](https://openai.com/index/harness-engineering/), not judgment.

- **The harness determines output quality, not model intelligence.** Anthropic found that ["the task verifier must be nearly perfect, otherwise the agent solves the wrong problem"](https://www.anthropic.com/engineering/building-c-compiler). OpenAI's team reached the same conclusion: [3 engineers produced 1M lines of code](https://openai.com/index/harness-engineering/) not by writing better prompts, but by designing better environments and feedback loops. gruAI's 15-step pipeline IS that harness.

- **Memory compounds across directives.** Lessons, design rationale, and standing corrections persist in `.context/` and get loaded into every future agent. This implements the [codified context pattern](https://arxiv.org/abs/2602.20478) — hot-memory + specialized agents + cold-memory knowledge base.

---

## Why Not Just Use Claude Code Directly?

Claude Code is the execution engine. gruAI is the management layer on top.

Without gruAI, you prompt an agent, review the output, re-prompt to fix issues, manage context yourself, and hope nothing falls through the cracks. There is no review gate, no institutional memory, and no structure beyond what you hold in your head.

With gruAI, you hand down a directive and agents self-organize through a 15-step pipeline. Reviews are mandatory and mechanical — a different agent reviews each task, and bash scripts verify the reviews actually happened. Lessons persist across directives so your 10th task runs better than your 1st. You approve the result, not every step along the way.

gruAI doesn't replace Claude Code. It makes Claude Code work like a team instead of a solo assistant.

---

## The Context Tree

All state lives in `.context/` at your repo root — plain markdown and JSON, version-controlled alongside your code.

```
.context/
├── directives/              # All work lives here
│   └── dark-mode/
│       ├── directive.json   # Pipeline state, weight, progress
│       ├── directive.md     # CEO brief
│       ├── audit.md         # CTO's technical audit
│       ├── brainstorm.md    # C-suite deliberation
│       └── projects/
│           └── dark-mode/
│               └── project.json  # Tasks, DOD, agents, reviews
├── lessons/                 # What went wrong (reactive)
├── design/                  # Why the system works this way (proactive)
├── intel/                   # External research from /scout
└── reports/                 # CEO digests
```

**Directive → Projects → Tasks.** A directive is a unit of work ("add dark mode"). The COO decomposes it into projects, each with tasks, agents, reviewers, and a Definition of Done. `directive.json` tracks pipeline progress — any session can read it and resume where it left off. `project.json` is the source of truth for what needs building and whether it passed review.

**Knowledge compounds.** Lessons, design rationale, and standing corrections persist across directives. Agents load relevant context just-in-time — not everything, just what they need for their role and task. No database, no external service — just files.

---

<details>
<summary><strong>Terminal Support</strong></summary>

| Environment | Focus | Send Input | Notes |
|-------------|:-----:|:----------:|-------|
| iTerm2 + tmux | Yes | Yes | AppleScript + tmux pane switching |
| iTerm2 native | Yes | Yes | AppleScript with session ID |
| Warp + tmux | Yes | Yes | CGEvents + tmux |
| Warp native | Yes | No | CGEvents tab navigation |
| Terminal.app + tmux | Yes | Yes | Bring to front + tmux |

Linux and Windows support coming soon.

</details>

<details>
<summary><strong>Claude Code Hooks</strong></summary>

gruAI works without hooks. For instant status detection (permission prompts, idle states), add hooks to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "permission_prompt",
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'INPUT=$(cat); curl -s -X POST http://localhost:4444/api/events -H \"Content-Type: application/json\" -d \"{\\\"type\\\":\\\"permission_prompt\\\",\\\"sessionId\\\":\\\"$(echo $INPUT | jq -r .session_id)\\\",\\\"message\\\":\\\"$(echo $INPUT | jq -r .message)\\\"}\"'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash -c 'INPUT=$(cat); curl -s -X POST http://localhost:4444/api/events -H \"Content-Type: application/json\" -d \"{\\\"type\\\":\\\"stop\\\",\\\"sessionId\\\":\\\"$(echo $INPUT | jq -r .session_id)\\\"}\"'"
          }
        ]
      }
    ]
  }
}
```

</details>

<details>
<summary><strong>Scripts</strong></summary>

```bash
npm run dev          # Dev mode (server + client with hot reload)
npm run dev:server   # Server only (port 4444)
npm run dev:client   # Vite dev only
npm start            # Production server (serves built assets)
npm run build        # Production build
npm run type-check   # TypeScript check
npm run lint         # ESLint
```

</details>

<details>
<summary><strong>Claude Code Skills</strong></summary>

```
/gruai-agents        # Scaffold AI agent team with personalities and roles
/gruai-config        # Update framework files to latest version
/directive           # Run work through the directive pipeline
/report              # CEO dashboard report
/healthcheck         # Internal codebase health check
/scout               # External intelligence gathering
```

</details>

<details>
<summary><strong>Tech Stack</strong></summary>

| Layer | Stack |
|-------|-------|
| Server | Node.js + WebSocket + SQLite + chokidar |
| Frontend | React 19 + Vite + Zustand + Tailwind v4 + shadcn/ui |
| Game | Canvas 2D pixel-art engine, 16x16 tile system |
| Terminal | AppleScript (iTerm2) + CGEvents (Warp) + tmux CLI |
| Data | Zero external services -- reads from `~/.claude/` locally |

</details>

<details>
<summary><strong>Research References</strong></summary>

- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) (Anthropic, Dec 2024) — evaluator-optimizer, orchestrator-workers, poka-yoke
- [Effective Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (Anthropic, Sep 2025) — context rot, progressive disclosure, sub-agent isolation
- [Multi-Agent Research System](https://www.anthropic.com/engineering/multi-agent-research-system) (Anthropic, Jun 2025) — 90.2% multi-agent improvement, token usage = 80% of variance
- [Building a C Compiler](https://www.anthropic.com/engineering/building-c-compiler) (Anthropic, Feb 2026) — harness quality > model intelligence
- [Harness Engineering](https://openai.com/index/harness-engineering/) (OpenAI, Feb 2026) — 3 engineers + Codex = 1M lines, structural invariants
- [Codified Context](https://arxiv.org/abs/2602.20478) (ArXiv, Feb 2026) — hot-memory + specialized agents + cold-memory knowledge base

</details>

---

[MIT](LICENSE)

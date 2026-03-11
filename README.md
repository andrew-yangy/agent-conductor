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

<div align="center">
  <video src="https://github.com/user-attachments/assets/8859bc1f-8a04-47ac-9f94-35b9c71741eb" width="720" controls></video>
</div>

---

## What Is gruAI?

### Most AI tools help you code faster. gruAI lets you stop coding entirely.

You run your AI team just like a CEO, and the agents handle the rest: engineering, marketing, operations, and more. You hand down a directive ("add dark mode to the dashboard"). Your agents brainstorm the approach, challenge your assumptions, build, review each other's work, and ship — you approve the result.

The system is designed for **depth, not speed.** Agents accumulate institutional memory across directives — lessons learned, design rationale, standing corrections. Your 10th directive runs better than your 1st because the team remembers what went wrong.

**You make decisions. Agents make software.** Every directive flows through a 15-step pipeline — triage, audit, brainstorm, plan, build, review, and ship — grounded in published research from Anthropic and OpenAI on what actually makes AI output reliable.

---

## Is gruAI Right for You?

- ✅ You're running 10+ terminals, juggling context, reprompting the same mistakes — and you want to hand down a directive and walk away
- ✅ You've been burned by agents that "review" their own code — you want reviews that are mandatory, mechanical, and impossible to skip
- ✅ Your agents forget everything between sessions — you want a team that remembers what broke last time
- ✅ You're the bottleneck for every decision, every prompt, every context refresh — you want to be the CEO, not the project manager
- ✅ You like running a one-person company with a full AI team, and you want it to actually feel that way — not like managing a chatbot farm
- ✅ You want agents that push back on your ideas before building, not agents that say yes and ship the wrong thing

---

## The Pipeline

You type: `/directive Create a landing page for gruAI`. Here's what happens next.

**1. Triage** — *Automated*

Classified **heavyweight** — touches copy, layout, SEO, and design across multiple files. Each agent gets [role-scoped context](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): the CTO gets your tech stack and component patterns, the CMO gets your positioning docs, engineers get your existing layout system. Not a 200K-token dump. [Start simple, add complexity only when needed.](https://www.anthropic.com/research/building-effective-agents)

**2. Audit** — *QA Engineer → CTO*

QA scans the codebase: finds the existing `/app` route structure, the Tailwind config, that there's no `og:image` setup, and that the current root page is a placeholder. CTO recommends: reuse the existing layout components, add Open Graph meta from the start, keep it server-rendered for SEO — no need for a SPA or a CMS.

**3. Debate** — *CTO + CPO + CMO*

**You're not in the room.** The C-suite agents independently propose approaches, then [argue](https://www.anthropic.com/engineering/multi-agent-research-system):

> **CTO:** *"Static HTML page. One task, no framework overhead. We don't need React for a landing page — it's marketing content, not an app."*
>
> **CPO:** *"A static page won't convert. Developers want to see the product work before they install anything. We need an interactive demo or at minimum an embedded video walkthrough."*
>
> **CMO:** *"Neither matters if nobody finds it. An SPA landing page is invisible to Google. Server-rendered with proper meta tags, structured data, and a clear CTA — or we're building for an audience of zero."*

They find common ground: server-rendered page with an embedded demo video. Then they surface 3 questions for you.

**4. Clarify** — 👤 **You**

You answer 3 questions: *"Should the demo be live or a video?"* → video for now. *"Target audience — developers or technical founders?"* → developers first. *"Ship under /landing or replace the root?"* → replace root, the current placeholder adds no value.

**5. Plan** — *COO* → 👤 **You**

COO breaks it into 2 projects with 6 tasks:
- **Project 1:** Full-stack engineer builds page structure — hero with tagline and demo video, feature grid with pipeline highlights, agent team section, and Open Graph meta. 4 tasks.
- **Project 2:** Frontend engineer builds responsive layout — mobile breakpoints, CTA positioning, and dark mode support. 2 tasks.

CTO reviews both projects. Each task has a Definition of Done: *"Hero section renders demo video with fallback image, loads in under 2s on 3G."* **You approve the plan** before any code is written.

**6. Build** — *Engineers*

Full-stack engineer builds the hero section, feature grid, and OG meta on an isolated git branch. Each task runs in a [clean context window](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — the agent building the hero section doesn't carry leftover context from the meta tags task. After each task, a [separate reviewer evaluates with fresh context](https://www.anthropic.com/research/building-effective-agents) — no builder reasoning, no confirmation bias.

**7. Review** — *Reviewers + Automated*

> **Round 1:** CTO reviews the hero section. Finds 3 issues: missing `<meta description>` tag (SEO blind spot), layout breaks below 375px on the feature grid (iPhone SE), and no `loading="lazy"` on the demo video (kills page speed score). Sends findings back to builder with specific file locations and expected fixes.
>
> **Round 2:** Builder fixes all three. CTO reviews again with fresh context — doesn't remember giving the feedback, evaluates the code on its own merit. Finds one remaining issue: `#aaa` text on `#fff` background in the feature section fails WCAG AA contrast (4.5:1 required, got 2.7:1). Builder bumps to `#595959`. **Passes.**

Bash scripts [verify](https://openai.com/index/harness-engineering/) every task was reviewed by a different agent than the one that built it. No review can be skipped, faked, or self-certified. This [evaluator-optimizer loop](https://www.anthropic.com/research/building-effective-agents) runs up to 3 rounds per task.

**8. Ship** — *Automated*

Lessons captured: *"Always add OG meta tags when creating new pages"* and *"Check WCAG contrast on all text colors."* Design docs updated with the new route structure. CEO digest generated with all 8 files changed, both review rounds summarized, and `git revert` commands ready if needed. [Knowledge persists](https://arxiv.org/abs/2602.20478) — next time someone creates a page, agents already know about the OG tags.

**9. Accept** — 👤 **You**

You see the digest: 8 files changed, 2 review rounds, all 6 DOD criteria met, zero open issues. You open the page in your browser, check mobile, and approve. Or you say *"the hero copy needs work"* — and a targeted fix runs through the same pipeline with its own review.

> *The pipeline runs 15 internal steps. Context loading, crash recovery, git isolation, and lesson extraction run automatically between the steps above.*

### Weight Adaptation

Not every directive needs the full process.

| Weight | Example | Skips | You Decide At |
|--------|---------|-------|---------------|
| **Lightweight** | Fix a typo | Debate | Accept only |
| **Medium** | Add dark mode | Debate | Accept only |
| **Heavyweight** | New landing page | Nothing | Clarify + Plan + Accept |
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

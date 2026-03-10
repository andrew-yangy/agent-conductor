# Research-to-Pipeline Mapping

Detailed extraction from five foundational articles and how gruAI's pipeline implements each recommendation.

---

## Article 1: Building Effective Agents

- **Source:** Anthropic Research Blog
- **Authors:** Erik Schluntz, Barry Zhang
- **Date:** December 19, 2024
- **URL:** https://www.anthropic.com/research/building-effective-agents

### Extracted Recommendations

**R1.1 -- Start with the simplest solution; add complexity only when it demonstrably improves outcomes.**
Many applications succeed with "optimizing single LLM calls with retrieval and in-context examples." Do not reach for multi-agent patterns before proving simpler approaches insufficient.

**R1.2 -- Distinguish workflows (predefined code paths) from agents (LLM directs its own process).**
Workflows give predictable, repeatable execution. Agents give flexibility for open-ended problems. Choose based on task structure.

**R1.3 -- Prompt Chaining: decompose tasks into sequential steps with programmatic "gates" at intermediate points.**
Each LLM call processes the previous call's output. Use when tasks "easily and cleanly decompose into fixed subtasks" and when trading latency for accuracy.

**R1.4 -- Routing: classify input and direct it to a specialized followup task.**
Separate concerns through specialized prompts. Enables model selection (route easy queries to cheaper models, hard queries to capable ones).

**R1.5 -- Parallelization (Sectioning): break tasks into independent subtasks run simultaneously.**
"LLMs generally perform better when each consideration is handled by a separate LLM call, allowing focused attention on each specific aspect."

**R1.6 -- Parallelization (Voting): run the same task multiple times for diverse outputs.**
Multiple perspectives or attempts yield higher confidence. Example: code security reviews across multiple prompt variants.

**R1.7 -- Orchestrator-Workers: central LLM dynamically breaks down tasks, delegates to worker LLMs, synthesizes results.**
Use for "complex tasks where you can't predict the subtasks needed." Key difference from parallelization: subtasks are determined at runtime by the orchestrator.

**R1.8 -- Evaluator-Optimizer: one LLM generates, another evaluates in a feedback loop.**
Requires "clear evaluation criteria" and evidence that "iterative refinement provides measurable value."

**R1.9 -- Autonomous agents: LLMs plan and operate independently, getting ground truth from the environment at each step.**
Must include "stopping conditions (maximum iterations) to maintain control." Higher costs and potential for compounding errors. Requires "extensive testing in sandboxed environments, along with appropriate guardrails."

**R1.10 -- Prefer direct LLM API usage over frameworks.**
Frameworks "often create extra layers of abstraction that can obscure the underlying prompts and responses, making them harder to debug." If using frameworks, understand the underlying code.

**R1.11 -- Three core principles: simplicity, transparency (show planning steps), and carefully crafted agent-computer interface (ACI).**
Treat tool design with equal effort to human-computer interface design. Include "example usage, edge cases, input format requirements, and clear boundaries from other tools."

**R1.12 -- Poka-yoke for tool design: change arguments so mistakes are harder to make.**
Case study: SWE-bench agent spent more time optimizing tools than prompts. Requiring absolute file paths eliminated relative path errors.

**R1.13 -- Code is verifiable through automated tests; agents iterate on solutions using test results as feedback.**
Software development has "remarkable potential" because "the problem space is well-defined and structured" and "output quality is measurable objectively." Human review remains essential for "broader system requirements" alignment.

**R1.14 -- Give the model "enough tokens to think before it writes itself into a corner."**
Format selection: keep formats "close to what the model has seen naturally occurring in text." Avoid "formatting overhead such as having to keep an accurate count of thousands of lines of code."

---

## Article 2: Effective Context Engineering for AI Agents

- **Source:** Anthropic Engineering Blog
- **Authors:** Prithvi Rajasekaran, Ethan Dixon, Carly Ryan, Jeremy Hadfield (+ contributors)
- **Date:** September 29, 2025
- **URL:** https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

### Extracted Recommendations

**R2.1 -- Find "the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome."**
The guiding principle for all context decisions. Context engineering is the natural progression of prompt engineering.

**R2.2 -- Context rot: as token count increases, model ability to accurately recall information decreases.**
Transformer attention creates n-squared pairwise relationships. Models have "less experience with, and fewer specialized parameters for, context-wide dependencies." This is a performance gradient, not a hard cliff.

**R2.3 -- System prompts: find the "Goldilocks zone" between hardcoded brittle logic and vague high-level guidance.**
Extreme specificity creates "fragility and increases maintenance complexity." Extreme vagueness fails to provide "concrete signals for desired outputs." Optimal: "specific enough to guide behavior, yet flexible enough to provide strong heuristics."

**R2.4 -- Use distinct sections with XML tagging or Markdown headers to delineate system prompt regions.**
Structural organization (`<background_information>`, `<instructions>`, `## Tool guidance`, `## Output description`) helps the model parse intent.

**R2.5 -- Strive for "the minimal set of information that fully outlines expected behavior."**
"Minimal does not necessarily mean short; you still need to give the agent sufficient information up front."

**R2.6 -- Start with a minimal prompt on the best model, then add instructions and examples based on failure modes.**
Iterative prompt development beats upfront specification.

**R2.7 -- Tools should return token-efficient information and encourage efficient agent behaviors.**
Tools must be "self-contained, robust to error, and extremely clear with respect to their intended use."

**R2.8 -- Bloated tool sets underperform. Curate a minimal viable set.**
"If a human engineer can't definitively say which tool should be used in a given situation, an AI agent can't be expected to do better."

**R2.9 -- Few-shot examples are "pictures worth a thousand words."**
Curate "diverse, canonical examples" rather than listing exhaustive edge cases.

**R2.10 -- Progressive disclosure / just-in-time context: maintain lightweight identifiers (file paths, queries, links) and dynamically load data at runtime.**
Agents "assemble understanding layer by layer, maintaining only what's necessary in working memory." Trade-off: "runtime exploration is slower than retrieving pre-computed data."

**R2.11 -- Metadata as signals: folder hierarchies, naming conventions, and timestamps help agents understand how and when to utilize information.**

**R2.12 -- Hybrid context model: naive upfront loading + JIT retrieval.**
Claude Code example: "CLAUDE.md files are naively dropped into context up front, while primitives like glob and grep allow it to navigate its environment and retrieve files just-in-time."

**R2.13 -- Compaction: summarize conversation approaching context limits and reinitiate a new context window.**
Implementation: "Pass message history to the model to summarize and compress the most critical details. Preserve architectural decisions, unresolved bugs, and implementation details while discarding redundant tool outputs."

**R2.14 -- Tool result clearing: once a tool call is deep in history, the raw result is unnecessary.**
"One of the safest, lightest-touch forms of compaction."

**R2.15 -- Structured note-taking (agentic memory): agent regularly writes notes persisted outside the context window, pulled back in later.**
Provides "persistent memory with minimal overhead" for tracking "progress across complex tasks, maintaining critical context and dependencies."

**R2.16 -- Sub-agent architectures: specialized sub-agents handle focused tasks with clean context windows.**
"Each subagent might explore extensively, using tens of thousands of tokens or more, but returns only a condensed, distilled summary (often 1,000-2,000 tokens)." Clear separation of concerns: "detailed search context remains isolated within sub-agents."

**R2.17 -- Compaction for extensive back-and-forth. Note-taking for iterative development with milestones. Multi-agent for complex research and parallel exploration.**

---

## Article 3: How We Built Our Multi-Agent Research System

- **Source:** Anthropic Engineering Blog
- **Authors:** Jeremy Hadfield, Barry Zhang, Kenneth Lien, Florian Scholz, Jeremy Fox, Daniel Ford
- **Date:** June 13, 2025
- **URL:** https://www.anthropic.com/engineering/multi-agent-research-system

### Extracted Recommendations

**R3.1 -- Multi-agent with Opus lead + Sonnet subagents outperformed single-agent Opus by 90.2%.**
The dominant architecture: lead coordinates, subagents execute in parallel.

**R3.2 -- Token usage explained 80% of performance variance.**
Three factors explained 95%: token usage (80%), tool call frequency, model selection.

**R3.3 -- Parallel execution cut research time by up to 90% for complex queries.**

**R3.4 -- Improved tool descriptions resulted in 40% decrease in task completion time.**
"Bad tool descriptions can send agents down completely wrong paths."

**R3.5 -- Scale agent count to task complexity.**
Simple fact-finding: 1 agent, 3-10 tool calls. Direct comparisons: 2-4 subagents, 10-15 calls each. Complex research: 10+ subagents with divided responsibilities.

**R3.6 -- Each subagent requires: an objective, output format, guidance on tools/sources, and clear task boundaries.**
Without detailed delegation, agents "duplicate work, leave gaps, or fail to find necessary information."

**R3.7 -- Save plans to memory because context windows exceeding 200K tokens get truncated.**

**R3.8 -- Lead agent synthesizes results and decides whether more research is needed -- can create additional subagents or refine strategy.**
The orchestrator adapts based on subagent output quality.

**R3.9 -- Subagents store work in external systems, pass lightweight references back to the coordinator.**
Reduces "token overhead from copying large outputs."

**R3.10 -- Use Console with exact prompts and tools to simulate and watch agents step-by-step to identify failure modes.**

**R3.11 -- Orchestrator instructions must be "vague enough" to enable proper task distribution.**
Over-specific instructions cause subagents to "misinterpret the task or perform the exact same searches."

**R3.12 -- Search strategy: start with short, broad queries, then progressively narrow focus.**

**R3.13 -- Extended thinking improves instruction-following, reasoning, and efficiency.**
Thinking mode serves as "a controllable scratchpad."

**R3.14 -- Interleaved thinking after tool results: evaluate quality, identify gaps, refine next query.**

**R3.15 -- Agents need explicit tool selection heuristics: examine all tools first, match to intent, prefer specialized over generic.**

**R3.16 -- Self-improvement: Claude can diagnose failures and suggest improvements; agents can rewrite tool descriptions after testing dozens of times.**

**R3.17 -- Start evaluation with ~20 queries representing real usage patterns.**
Early development shows "dramatic impacts" from changes (30% to 80% success rate boosts).

**R3.18 -- LLM-as-Judge with rubric: factual accuracy, citation accuracy, completeness, source quality, tool efficiency.**
Scores 0.0-1.0 with pass/fail per criterion.

**R3.19 -- Focus on end-state evaluation (correct final state) rather than validating specific processes.**
"Agents may find alternative paths to the same goal."

**R3.20 -- State management: agents must resume from where errors occurred, not restart entirely.**
Use "retry logic and regular checkpoints."

**R3.21 -- Full production tracing for diagnostics without monitoring individual conversation contents.**

**R3.22 -- Rainbow deployments: gradually shift traffic between versions while keeping both running.**

**R3.23 -- Small changes to the lead agent can unpredictably change how subagents behave.**
Requires "frameworks for collaboration that define division of labor, problem-solving approaches, and effort budgets."

**R3.24 -- Multi-agent systems struggle with tasks requiring all agents to share the same context or involving many inter-agent dependencies.**

**R3.25 -- Upgrading to a better model provides a larger performance gain than doubling the token budget on a weaker model.**

---

## Article 4: Building a C Compiler with Parallel Claudes

- **Source:** Anthropic Engineering Blog
- **Author:** Nicholas Carlini
- **Date:** February 5, 2026
- **URL:** https://www.anthropic.com/engineering/building-c-compiler

### Extracted Recommendations

**R4.1 -- "The task verifier must be nearly perfect, otherwise Claude will solve the wrong problem."**
High-quality verification is the #1 priority. Without it, agents optimize for the wrong objective.

**R4.2 -- 16 agents across ~2,000 sessions, 2B input tokens, 140M output tokens, ~$20,000 total cost.**
100,000-line Rust compiler. 99% pass rate on standard test suites. Compiles Linux 6.9 on x86, ARM, RISC-V.

**R4.3 -- The Infinite Loop Pattern: automatically spawn new sessions when tasks complete.**
Eliminates requirement for human operators to remain present. Critical instruction: "break it into small pieces, track what you're working on, figure out what to work on next."

**R4.4 -- Design test output for agent consumption, not human inspection.**
Print only "a few lines of output." Log details to files for retrieval. Format errors as ERROR + reason on same line (grep-compatible). Pre-compute summary statistics to prevent recomputation.

**R4.5 -- Address agent time blindness.**
Claude "can't tell time and, left alone, will happily spend hours running tests instead of making progress." Solutions: print incremental progress infrequently, include `--fast` option (1-10% random samples), make subsamples deterministic per-agent but random across VMs.

**R4.6 -- Extensive documentation: each agent drops into a fresh container with no context.**
Requires comprehensive READMEs, progress files updated frequently, current status documentation.

**R4.7 -- Lock-based synchronization for parallel task coordination.**
Agents create text files in `current_tasks/` to claim tasks. Git synchronization forces conflicting agents to pick alternatives. "Merge conflicts are frequent, but Claude is smart enough to figure that out."

**R4.8 -- When all agents hit the same monolithic task, parallelization collapses.**
Solution: use a known-good oracle to compare against, enabling parallel bug fixing across files.

**R4.9 -- Agent specialization: dedicated roles for deduplication, performance, output efficiency, architecture review, documentation.**
Not all agents are identical -- role specialization improves overall output.

**R4.10 -- CI prevents new commits from breaking existing functionality.**
"New features and bugfixes frequently broke existing functionality," necessitating rigorous CI enforcement.

**R4.11 -- Agents maintain "a running doc of failed approaches and remaining tasks" when stuck.**
Persistent tracking of what has been tried prevents circular rework.

**R4.12 -- Specify high-level requirements; avoid implementation details.**
"Specified some aspects of the design (e.g., SSA IR for multiple optimization passes) but did not go into any detail on how to do so." Enables autonomous problem-solving while maintaining architectural coherence.

**R4.13 -- "The thought of programmers deploying software they've never personally verified is a real concern."**
Humans supervising "can ensure consistent quality and catch errors in real time. For autonomous systems, it is easy to see tests pass and assume the job is done, when this is rarely the case."

---

## Article 5: Harness Engineering -- Leveraging Codex in an Agent-First World

- **Source:** OpenAI Blog
- **Author:** Ryan Lopopolo
- **Date:** February 2026
- **URL:** https://openai.com/index/harness-engineering/

### Extracted Recommendations

**R5.1 -- Humans steer, agents execute. The engineering job is no longer writing code -- it is designing environments, specifying intent, and building feedback loops.**
Five-month experiment produced ~1M lines of production code, 0 manually-written lines, ~1,500 PRs merged with 3 engineers (~3.5 PRs/engineer/day).

**R5.2 -- Give the agent a map, not a 1,000-page instruction manual.**
Failed approach: monolithic AGENTS.md. Successful approach: lightweight AGENTS.md (~100 lines) as table of contents with pointers to deeper sources of truth in structured docs/.

**R5.3 -- Machine-readable artifacts over prose.**
Structured documentation consumed by both agents and linters. Cross-linked design and architecture docs with mechanical enforcement.

**R5.4 -- Enforce architectural invariants through custom linters and structural tests.**
Dependency sequence: Types > Config > Repo > Service > Runtime > UI. Agents restricted to operate within designated layers. Structural tests validate compliance and prevent modular layering violations.

**R5.5 -- "Taste invariants" -- a curated set of design principles encoded as rules.**
"These rules become multipliers: once encoded, they apply everywhere at once." Prevents architectural drift in agent-generated codebases.

**R5.6 -- Linters and CI validation ensure consistency.**
Standards enforced mechanically, not by review judgment. Reduces manual oversight requirements.

**R5.7 -- Sub-agents review a PR before it is shared.**
"Multiple sub-agents review a PR before it's ever shared" with humans. Automated review enforcement with custom instructions.

**R5.8 -- Codex validates "right structures are followed, module boundaries are respected, semantics are correct, and coverage meets the bar."**

**R5.9 -- Bug bash: went through over 100 issues in a single hour, most fixed within 24 hours.**

**R5.10 -- "Without the right guardrails and structure, it's easy to drift in the wrong direction and eventually slow yourself down."**
Guardrails are enablers of speed, not impediments.

---

## Mapping Table: Research Recommendations to gruAI Pipeline

| # | Research Recommendation | Source | gruAI Pipeline Step | How gruAI Implements It |
|---|------------------------|--------|---------------------|------------------------|
| 1 | Start simple, add complexity only when needed | Anthropic (R1.1) | 00-triage | Weight classification (lightweight/medium/heavyweight/strategic) adapts process complexity to task complexity. Lightweight skips brainstorm, auto-approves. |
| 2 | Use workflows (predefined paths) for predictable tasks | Anthropic (R1.2) | Pipeline architecture | The 15-step pipeline IS a predefined workflow. Steps execute sequentially with deterministic gates. Agent autonomy exists within steps, not across steps. |
| 3 | Prompt chaining with programmatic gates | Anthropic (R1.3) | All pipeline steps | Each step reads previous step's output (audit feeds plan, plan feeds approve, approve feeds execute). Gates: clarification, approve, review-gate, completion. |
| 4 | Route to specialized prompts by classification | Anthropic (R1.4) | 00-triage, 09-execute | Triage classifies by weight. Execute routes to specialized builder/reviewer agents per task. Agent registry maps roles to model selection (opus for quality-critical, sonnet for cost-efficient). |
| 5 | Parallelization (sectioning): independent subtasks in parallel | Anthropic (R1.5) | 09-execute | Wave-based parallelism: tasks with no file overlap run in parallel. Deterministic algorithm detects file conflicts and enforces sequential execution for overlapping tasks. |
| 6 | Orchestrator-workers: central LLM delegates dynamically | Anthropic (R1.7) | 05-planning + 09-execute | COO decomposes into projects/tasks (planning). CEO session orchestrates execution, spawning builder sub-agents per task. Orchestrator decides wave composition at runtime. |
| 7 | Evaluator-optimizer: generate then evaluate in feedback loop | Anthropic (R1.8) | 09-execute (code review) | Builder generates code. Code reviewer evaluates with fresh context. Fail triggers fix cycle (max 3). Same pattern for standard review (max 2 cycles). |
| 8 | Autonomous agents need stopping conditions and sandboxed testing | Anthropic (R1.9) | 08-worktree, fix cycle bounds | Worktree isolation sandboxes changes. Fix cycles bounded (max 3 code review, max 2 standard). Convergence detection prevents infinite loops. |
| 9 | Carefully craft agent-computer interface (ACI) | Anthropic (R1.11) | Agent templates, SKILL.md | Agent templates (.claude/agents/) define personality, tools, constraints. SKILL.md files define pipeline instructions. Validation scripts enforce structural requirements. |
| 10 | Poka-yoke: make mistakes harder | Anthropic (R1.12) | validate-*.sh scripts | validate-project-json.sh rejects wrong keys (initiatives vs tasks). validate-reviews.sh prevents self-review. validate-gate.sh enforces step dependencies. Mechanical error prevention, not LLM judgment. |
| 11 | Code is verifiable through automated tests | Anthropic (R1.13) | 09-execute, review-gate | DOD criteria verified by reviewers. Build reports include test results. Review-gate mechanically checks that all tasks have review artifacts. |
| 12 | Smallest set of high-signal tokens | Anthropic (R2.1) | design/context-flow.md | Pipeline loads one step doc at a time. Builders receive only task scope, not full plan. Context reduced 15,847 to 8,966 words (-43%). |
| 13 | Context rot: accuracy degrades as token count increases | Anthropic (R2.2) | Context architecture | Measured degradation begins at 8K-16K tokens. Sub-agent architecture ensures each agent starts with fresh, focused context. Pipeline step docs are separate files read sequentially, never loaded all at once. |
| 14 | System prompt Goldilocks zone | Anthropic (R2.3) | Agent templates, SKILL.md | Agent templates provide role-specific heuristics (not hardcoded logic, not vague guidance). SKILL.md has imperative gate at top ("DO NOT read source code") to prevent LLM skip. |
| 15 | Structural organization with XML/Markdown headers | Anthropic (R2.4) | All pipeline docs | Pipeline step docs use consistent H2/H3 hierarchy. Builder prompts in 09-execute use labeled sections (CEO Brief, Task Scope, Audit Findings, etc.). |
| 16 | Tools should return token-efficient information | Anthropic (R2.7) | MCP tools | MCP status/backlog tools return structured JSON summaries, not raw file contents. Directives discovered via glob patterns, not full tree scans. |
| 17 | Curate minimal viable tool set | Anthropic (R2.8) | Agent spawn pattern | Builders get only the tools they need (filesystem access, build commands). No access to MCP directive management tools. Reviewers get read-only access. |
| 18 | Progressive disclosure / JIT context | Anthropic (R2.10) | 03-read-context | Context step loads vision.md, preferences.md, relevant lessons, relevant design docs -- not everything. Builders receive per-task context, not full directive context. |
| 19 | Hybrid context: upfront + JIT | Anthropic (R2.12) | CLAUDE.md + glob/grep | CLAUDE.md loaded upfront (map of the system). Design docs and lessons loaded JIT per role. Audit findings loaded JIT per task. |
| 20 | Compaction: summarize and reinitiate at context limits | Anthropic (R2.13) | 01-checkpoint | Checkpoint step detects prior session death and recovers state from directive.json. Does not re-execute completed steps. Equivalent to reinitiation with compressed state. |
| 21 | Structured note-taking / agentic memory | Anthropic (R2.15) | .claude/agent-memory/ | Persistent agent memory directories per agent. Notes persist across conversations. MEMORY.md loaded into system prompt. Detailed topic files linked from MEMORY.md. |
| 22 | Sub-agents with clean context windows returning condensed summaries | Anthropic (R2.16) | 09-execute | Each builder gets fresh context scoped to one task. Returns structured build report. Each reviewer gets fresh context (no builder reasoning). Orchestrator synthesizes. |
| 23 | Multi-agent outperformed single-agent by 90.2% | Anthropic (R3.1) | Pipeline architecture | Cited in design/pipeline-architecture.md as rationale for sub-agent architecture. CEO session coordinates; builders, reviewers, COO, CTO operate as sub-agents. |
| 24 | Token usage explains 80% of performance variance | Anthropic (R3.2) | Context engineering | Drove the -43% context reduction (15,847 to 8,966 words). Every unnecessary token competes for attention. Step docs kept focused. |
| 25 | Scale agent count to task complexity | Anthropic (R3.5) | 00-triage + agent-model.md | Lightweight: 1 builder + 1 reviewer. Medium: 1-2 builders + reviewers. Heavyweight: multiple builders (wave-parallel) + full audit + C-suite brainstorm. Strategic: same + deliberation round. |
| 26 | Each subagent needs: objective, output format, tool guidance, task boundaries | Anthropic (R3.6) | 09-execute builder prompt | Builder prompt includes: task scope, DOD criteria, CEO brief, audit findings, output format requirements (build report structure), tool constraints, brainstorm alignment requirement. |
| 27 | Save plans to memory (context windows truncate at 200K) | Anthropic (R3.7) | plan.json, directive.json | Plan persisted as plan.json. Pipeline state persisted in directive.json. No reliance on session memory for plan recall. |
| 28 | Subagents store work externally, pass lightweight references | Anthropic (R3.9) | Project artifacts | Build reports, review outputs stored as files in project directory. Orchestrator reads summaries, not raw build output. project.json tracks status without embedding full results. |
| 29 | Orchestrator instructions "vague enough" for proper distribution | Anthropic (R3.11) | 05-planning (COO prompt) | COO receives directive scope and codebase reality (audit), not implementation details. COO determines project decomposition and task assignments autonomously. |
| 30 | End-state evaluation over process validation | Anthropic (R3.19) | DOD verification | DOD criteria check final state ("component renders X", "function exports Y"), not implementation path. Reviewers verify outcomes, not process. |
| 31 | Checkpoint-based recovery, resume from error point | Anthropic (R3.20) | 01-checkpoint, directive.json | directive.json IS the checkpoint. Any session reads it and resumes from first incomplete step. No re-execution of completed steps. project.json tracks task-level progress. |
| 32 | Frameworks for collaboration defining division of labor and effort budgets | Anthropic (R3.23) | Pipeline architecture | Pipeline defines exact role separation (CEO/COO/CTO/builder/reviewer). Trust boundaries prevent role bleed. Weight system defines effort budgets per complexity level. |
| 33 | Task verifier must be nearly perfect | Anthropic (R4.1) | review-gate, validate-*.sh | Cited in design/verification.md as core principle. Validation scripts mechanically check review existence, self-review prevention, DOD verification presence. Review-gate STOPS pipeline if validation fails. |
| 34 | Design test output for agent consumption | Anthropic (R4.4) | Structured JSON artifacts | plan.json, project.json, directive.json use machine-parseable JSON. Validation scripts produce grep-compatible error output. Build reports use structured format with labeled sections. |
| 35 | Address agent time blindness | Anthropic (R4.5) | Fix cycle bounds | Max 3 code review cycles, max 2 standard review cycles. Convergence detection (same bug in 2 consecutive cycles = escalate). Prevents agents from looping indefinitely on fix cycles. |
| 36 | Extensive documentation for fresh-context agents | Anthropic (R4.6) | Pipeline step docs, agent templates | Each builder drops into a fresh context. Gets comprehensive prompt with all needed context (CEO brief, audit findings, task scope, DOD). No reliance on prior session context. |
| 37 | Lock-based synchronization for parallel coordination | Anthropic (R4.7) | Wave-based parallelism | Wave algorithm detects file overlap mechanically. Tasks with conflicting files run sequentially. Tasks with independent files run in parallel. No lock files -- deterministic pre-computation. |
| 38 | Agent specialization by role | Anthropic (R4.9) | Agent registry | Builder, reviewer, COO, CTO, auditor, designer each have dedicated agent templates with role-specific personality, constraints, and tools. Not all agents are generic. |
| 39 | CI prevents regressions | Anthropic (R4.10) | review-gate, DOD | Review-gate prevents merging without review. DOD criteria include non-regression requirements. Type-check and validation scripts run as part of pipeline verification. |
| 40 | Running doc of failed approaches | Anthropic (R4.11) | .context/lessons/ | Lessons files capture what went wrong and how to avoid it. Loaded into agent context per role. Updated during wrapup step (10-wrapup.md, step 6f). |
| 41 | Specify high-level requirements, not implementation details | Anthropic (R4.12) | directive.md (CEO brief) | CEO writes scope and intent. COO determines project decomposition. CTO determines task-level implementation approach. Builder determines code-level implementation. No level dictates to the level below. |
| 42 | Human verification remains essential for deployed software | Anthropic (R4.13) | 11-completion-gate | CEO personally approves completion for every directive. No auto-completion. CEO sees files changed, test results, review summary, before/after metrics. |
| 43 | Humans steer, agents execute | OpenAI (R5.1) | Pipeline architecture | CEO session NEVER builds (hard rule). CEO sets direction via directive.md. Pipeline delegates to agent sub-agents. CEO reviews results at completion gate. |
| 44 | Give a map, not a 1,000-page manual (~100-line pointer file) | OpenAI (R5.2) | CLAUDE.md + .context/ tree | CLAUDE.md is the map (~navigation guide to .context/ structure). Detailed content lives in directive files, design docs, lessons. Agents follow CLAUDE.md pointers to load what they need. |
| 45 | Machine-readable artifacts over prose | OpenAI (R5.3) | JSON schemas throughout | directive.json, project.json, plan.json are all JSON. Validation scripts parse mechanically. Prose (directive.md, reports) is for human consumption only. |
| 46 | Enforce invariants through linters and structural tests | OpenAI (R5.4) | validate-*.sh scripts | validate-project-json.sh enforces schema (agent, reviewers, tasks with DOD). validate-reviews.sh enforces self-review prevention. validate-gate.sh enforces step dependencies. validate-cast.sh enforces role assignments. |
| 47 | "Taste invariants" -- encoded design principles as multipliers | OpenAI (R5.5) | preferences.md, vision.md, design/ | preferences.md = CEO standing orders (taste invariants). vision.md = system guardrails. design/ docs = architectural principles. All loaded into agent context. Apply everywhere at once. |
| 48 | Sub-agents review PRs before sharing with humans | OpenAI (R5.7) | 09-execute (code review + standard review) | Code review by dedicated reviewer sub-agent. Standard review by second reviewer sub-agent. Both must pass before work reaches CEO at completion gate. |
| 49 | Guardrails are enablers of speed, not impediments | OpenAI (R5.10) | Weight adaptation | "Every step that was skipped for efficiency eventually caused a failure." Pipeline runs ALL steps for ALL weights -- only brainstorm is skipped for lightweight/medium. Cost of running lightweight steps is small; cost of skipping them is CEO reopen. |

---

## Cross-Cutting Themes

### Theme 1: The Harness IS the Product

All five articles converge on the same insight: model intelligence is necessary but not sufficient. The harness (pipeline, validation, feedback loops) determines output quality.

- Anthropic agents article: "carefully craft your agent-computer interface"
- Anthropic context article: "smallest set of high-signal tokens"
- Anthropic multi-agent article: "bad tool descriptions send agents down wrong paths" (40% time improvement from better descriptions)
- Anthropic compiler article: "task verifier must be nearly perfect"
- OpenAI harness article: "humans steer, agents execute"

**gruAI implementation:** The pipeline steps, validation scripts, and review gates ARE the product. design/pipeline-architecture.md opens with this principle.

### Theme 2: Context Is a Finite Resource Under Active Degradation

Context rot is real and measurable. Every article addresses it differently but converges on the same prescription: minimize, structure, isolate.

- Anthropic context article: n-squared attention, degradation at 8K-16K tokens
- Anthropic multi-agent article: token usage explains 80% of performance variance
- Anthropic compiler article: each agent in fresh container with no prior context
- OpenAI harness article: 100-line map file, not 1,000-page manual

**gruAI implementation:** 43% context reduction. Progressive disclosure (one step doc at a time). Sub-agent isolation (fresh context per task). Structured JSON over prose. CLAUDE.md as map file.

### Theme 3: Fresh Context Beats Accumulated Context

Sub-agents with clean context windows outperform single agents with accumulated context. This is the strongest finding across articles.

- Anthropic agents article: sub-agents for focused tasks
- Anthropic context article: "sub-agents handle focused tasks with clean context windows"
- Anthropic multi-agent article: 90.2% improvement over single-agent
- Anthropic compiler article: "each agent dropped into a fresh container"

**gruAI implementation:** Every builder, reviewer, and auditor spawns with fresh context scoped to its specific task. No shared session state between parallel builders. Reviewers explicitly excluded from builder reasoning (fresh-context review).

### Theme 4: Mechanical Verification Over LLM Judgment

Wherever possible, replace LLM-based verification with mechanical checks.

- Anthropic agents article: poka-yoke (error-proof design)
- Anthropic compiler article: CI prevents regressions, task verifier nearly perfect
- OpenAI harness article: linters, structural tests, dependency validation

**gruAI implementation:** validate-project-json.sh, validate-reviews.sh, validate-gate.sh, validate-cast.sh -- all bash scripts, no LLM involved. review-gate hard gate blocks on structural violations. Known gap: DOD criteria still require LLM judgment, not machine-verifiable assertions.

### Theme 5: Human-in-the-Loop at Trust Boundaries

Every article advocates for human review at key decision points, not continuous human involvement.

- Anthropic agents article: "human review remains essential for broader system requirements"
- Anthropic context article: (implicit in agent architecture -- human sets goals)
- Anthropic multi-agent article: human testing catches "edge cases that evals miss"
- Anthropic compiler article: "deploying software they've never personally verified is a real concern"
- OpenAI harness article: engineers review PRs, set direction, define taste

**gruAI implementation:** Two CEO gates: approve (heavyweight/strategic, before execution burns tokens) and completion (all weights, before directive closes). CEO sees files changed, test results, review summary. No directive auto-completes.

### Theme 6: Persistent State Survives Session Death

Agent sessions are inherently fragile. State must live outside the session.

- Anthropic context article: structured note-taking, external memory
- Anthropic multi-agent article: resume from error point, checkpoints
- Anthropic compiler article: progress files, running docs, current status files
- OpenAI harness article: (implicit in CI/PR workflow -- work persists in git)

**gruAI implementation:** directive.json IS the checkpoint. project.json tracks task-level progress. Updated after every task completion. Any session reads these files and resumes. .claude/agent-memory/ provides cross-session agent memory.

---

## Identified Gaps (Research Recommendations NOT Yet Implemented)

| # | Research Recommendation | Source | Gap in gruAI |
|---|------------------------|--------|-------------|
| 1 | Sub-agents return condensed 1-2K token summaries | Anthropic (R2.16, R3.9) | Builders return full output. No explicit output size constraint or summarization step. |
| 2 | Mid-task compaction (summarize + reinitiate) | Anthropic (R2.13) | Checkpoint handles session-level recovery but not mid-task context compaction within a builder session. |
| 3 | Voting (same task, multiple perspectives) | Anthropic (R1.6) | No voting pattern. Each task assigned to one builder. Could be used for critical tasks (security-sensitive, architecture-defining). |
| 4 | Tool result clearing (discard old tool results) | Anthropic (R2.14) | Not implemented. Old tool results accumulate in context during long builder sessions. |
| 5 | Self-improvement (agents rewrite tool descriptions) | Anthropic (R3.16) | Agents don't modify their own templates or skill docs. Improvement happens manually during lessons/design-doc updates. |
| 6 | Machine-verifiable DOD criteria | Anthropic (R4.1), OpenAI (R5.4) | DOD criteria are prose-based, verified by LLM reviewers. Adding verifiable assertions ("type-check passes", "test exits 0") would improve autonomous reliability. Noted in design/verification.md as a known gap. |
| 7 | Rainbow deployments (gradual traffic shift) | Anthropic (R3.22) | Not applicable to current single-user setup but relevant if pipeline serves multiple users. |
| 8 | Few-shot examples in agent prompts | Anthropic (R2.9) | Agent templates and pipeline docs use instructional text, not canonical input/output examples. Adding examples of good build reports, good reviews could improve output quality. |
| 9 | Time-blindness mitigation (progress printing, --fast test subsets) | Anthropic (R4.5) | Fix cycle bounds address this partially. No explicit progress printing or test subsampling for builder agents. |
| 10 | Formal evaluation set (~20 queries, LLM-as-Judge rubric) | Anthropic (R3.17, R3.18) | No formal evaluation framework for pipeline quality. Validation scripts check structure, not output quality. |

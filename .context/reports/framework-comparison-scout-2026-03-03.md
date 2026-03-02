# Agent Conductor -- Framework Comparison Scout

Date: 2026-03-03
Researcher: Sarah Chen (CTO)

## Frameworks Analyzed

### CrewAI (crewAIInc/crewAI)
Role-based multi-agent orchestration. 20K+ GitHub stars. Python-native, fully independent of LangChain. Two architecture modes: Crews (autonomous role-playing agents with delegation) and Flows (event-driven production pipelines with structured state). Runs 12M+ executions/day in production. Unified memory system with short-term (ChromaDB/RAG), long-term (SQLite3), and entity memory, plus LLM-inferred importance/scope scoring. Supports sequential, hierarchical, and consensus-based task execution.

### AutoGen / Microsoft Agent Framework (microsoft/autogen)
Conversation-based multi-agent framework. In October 2025 Microsoft merged AutoGen with Semantic Kernel into the unified "Microsoft Agent Framework" (public preview, GA targeted Q1 2026). Event-driven distributed architecture. Thread-based state model for reproducible runs. Built-in OpenTelemetry instrumentation for distributed traces of agent actions, tool invocations, and state changes. Conversation patterns: two-agent chat, sequential chat, group chat, nested chat -- composable like LEGO blocks. Known vulnerability: Corba attacks block 79-100% of agents in 1.6-1.9 turns.

### LangGraph (langchain-ai/langgraph)
Graph-based stateful agent workflows. Reached v1.0 in late 2025. Models workflows as state machines with nodes, edges, and conditional routing. Built-in persistence layer with checkpointers (SQLite, PostgreSQL, S3). State reducers define how concurrent updates merge. First-class human-in-the-loop via `interrupt()` function -- programmatic pausing mid-node based on runtime conditions. Time-travel debugging: replay any checkpoint, fork execution from any state, explore alternative branches. Durable execution survives failures and can span hours/days.

### MetaGPT (FoundationAgents/MetaGPT)
Software company simulation. ICLR 2024 paper. Shared message pool architecture with publish-subscribe: agents publish structured documents (not dialogue) to a central pool; others subscribe by role. Strict SOPs (Standard Operating Procedures) govern agent collaboration. Roles: Product Manager, Architect, Project Manager, Engineer, QA. Structured output communication achieves 85.9% Pass@1 on code generation benchmarks. Launched MGX (MetaGPT X) commercial product in Feb 2025. AFlow paper accepted at ICLR 2025 (top 1.8%) for automated agentic workflow generation.

### ChatDev (OpenBMB/ChatDev)
Virtual software company using waterfall SDLC phases. Chat chain mechanism breaks development into atomic subtasks handled by dual-agent pairs (instructor + assistant). Communicative dehallucination through multi-turn dialogue reduces code hallucinations by 67%. Experiential Co-Learning module (Dec 2023) enables cross-task learning. MacNet (Jun 2024) scales to 1000+ agents. ChatDev 2.0 introduces three-layer architecture: Server (state), Runtime (execution), Workflow (logic). Puppeteer-style orchestrator (May 2025) uses RL-optimized central coordinator.

---

## Gap Analysis

### Things They Do That We Don't

**1. Graph-Based Workflow Definition (LangGraph)**
LangGraph models workflows as explicit state machines with typed nodes, conditional edges, and state reducers. Our directive pipeline is a linear markdown document with numbered steps and prose-encoded branching ("if heavyweight, do X; if lightweight, do Y"). LangGraph's approach gives you: visual debugging of execution paths, formal verification that all states are reachable, and programmatic conditional routing based on runtime state. Our SKILL.md encodes the same logic but it lives in natural language that agents must interpret, which is why we have lessons like "Morgan produces prose before JSON" -- the pipeline instructions themselves are ambiguous.

**Assessment: Real gap, medium priority.** We don't need to adopt LangGraph literally (we're CLI-based, not a Python library), but we should extract our pipeline into a declarative schema (JSON/YAML state machine) rather than prose instructions. This would eliminate an entire class of "agent misinterpreted the step" bugs.

**2. Structured Memory System (CrewAI)**
CrewAI has a unified memory architecture with four distinct memory types: short-term (current session context via RAG), long-term (task results persisted in SQLite across sessions), entity memory (people/places/concepts), and contextual memory (inferred from all three). Memories are scored by semantic similarity, recency, and importance. Our memory is flat markdown files (lessons.md, MEMORY.md) with no retrieval mechanism beyond "read the whole file." As lessons.md grows, agents get a wall of text with no relevance filtering.

**Assessment: Real gap, high priority.** Our lessons.md is already 129 lines and growing. It will hit diminishing returns when agents can't distinguish relevant lessons from noise. We don't need CrewAI's full vector DB setup, but we need some form of relevance-based retrieval -- even just topic-based lesson files that agents read selectively.

**3. Time-Travel Debugging (LangGraph)**
LangGraph saves a checkpoint after every super-step. You can replay any checkpoint, modify state, and fork execution from that point. This enables: "the agent made a bad decision at step 3 -- let me rewind and try a different input." Our checkpointing only captures step boundaries (step-3, step-4, step-5) and only supports resume-from-scratch for in-progress initiatives. We cannot fork, we cannot replay with modified state, and we cannot inspect intermediate states for debugging.

**Assessment: Nice to have, low priority for now.** Our checkpoint system is young (shipped 2026-03-02). Time-travel is a luxury. What matters more is that our checkpoints reliably resume -- and they do. Revisit when we hit debugging pain that simple re-runs can't solve.

**4. Observability and Telemetry (AutoGen/Microsoft Agent Framework)**
Microsoft Agent Framework has built-in OpenTelemetry instrumentation: every agent decision, tool call, and state change generates structured traces that flow into monitoring tools. We have zero observability. We can't answer: "how many tokens did this directive cost?" or "which phase took the longest?" or "what's our reviewer pass rate across directives?" Our only record is the digest report, which is a narrative summary, not structured metrics.

**Assessment: Real gap, high priority.** We're flying blind on cost and quality. We don't need full OpenTelemetry, but we need structured logging: token counts per agent call, wall time per phase, review outcomes as structured data. This is prerequisite for any optimization work.

**5. Publish-Subscribe Communication (MetaGPT)**
MetaGPT uses a shared message pool where agents publish structured documents and subscribe to what's relevant to their role. Communication is asynchronous and role-filtered. Our agents communicate through the orchestrator (Alex) who manually passes context between phases. There's no shared state that agents can read/write independently -- every piece of context must be explicitly included in the spawn prompt.

**Assessment: Not applicable to our architecture.** Our agents are ephemeral subprocesses spawned by Claude Code, not persistent services. They can't subscribe to a message pool. Our "pass context via prompt" approach is the correct pattern for CLI-spawned agents. The real lesson from MetaGPT is that structured output beats dialogue (which we already implement via JSON schemas).

**6. Automated Workflow Generation (MetaGPT AFlow)**
MetaGPT's AFlow paper (ICLR 2025, top 1.8%) automates the generation of agentic workflows -- the system discovers optimal agent coordination patterns rather than having them hand-coded. Our directive pipeline is entirely hand-crafted in SKILL.md. Every process type, every phase sequence, every casting rule was designed manually.

**Assessment: Interesting research, not actionable yet.** AFlow requires reinforcement learning infrastructure we don't have. But the principle is valid: our process types (fix, design-then-build, etc.) should be evaluated empirically. Are they the right categories? Do the phase sequences actually produce better outcomes? We should track this data (see gap #4) before we can answer.

**7. Experiential Co-Learning (ChatDev)**
ChatDev's agents accumulate "shortcut-oriented experiences" across tasks -- learning which patterns work and propagating that knowledge to future runs. Our lessons.md is the manual equivalent, but it requires a human to curate entries. There's no automated mechanism for agents to identify and persist what they learned.

**Assessment: Medium priority.** We already have the infrastructure (lessons.md, MEMORY.md). What we're missing is automated lesson extraction: after each directive, the system should analyze what went wrong/right and propose new lessons. Currently this is Step 6d (manual update). It should be a structured agent task with human approval.

**8. RL-Optimized Orchestration (ChatDev 2.0)**
ChatDev 2.0's puppeteer-style paradigm uses a learnable central orchestrator trained with reinforcement learning to dynamically sequence agents. Our Alex follows a static pipeline. The sequence of phases per process type is fixed at authoring time. There's no adaptation based on what's working.

**Assessment: Not actionable.** Requires RL training infrastructure and far more execution data than we have. File under "interesting for 2027."

---

### Things We're Doing Wrong

**1. Natural Language Pipeline Definition**
Every major framework uses code or declarative schemas for workflow definition. LangGraph uses Python graph definitions. CrewAI uses Python class decorators. MetaGPT uses SOPs encoded in code. We use a 1000+ line markdown file (SKILL.md) that agents must parse and follow. This is the root cause of multiple lessons: "Morgan produces prose before JSON," "step ordering in directive," "follow-ups must be processed BEFORE the digest." These are all symptoms of agents misinterpreting prose instructions.

**What works better:** Declarative process definitions that are machine-parseable. The process types (fix, design-then-build, etc.) should be JSON schemas defining phase sequences, not prose paragraphs. The branching logic (lightweight/medium/heavyweight) should be a decision tree, not paragraphs of classification rules.

**2. Monolithic Orchestrator Context**
Our SKILL.md is ~80KB of instructions loaded into a single agent's context. Research shows (Google/MIT scaling paper, Dec 2025) that coordination overhead ranges from 58% to 515% of the base task cost depending on topology. By loading the ENTIRE pipeline into Alex's context, we're paying maximum coordination overhead -- Alex must hold the full pipeline, all context files, all agent personalities, AND manage execution state.

**What works better:** LangGraph and CrewAI both separate workflow definition from execution. The orchestrator only needs to know the current step and the transition rules, not the full pipeline. Our Step 5 alone (Execute Initiatives) is ~250 lines of prose covering 7 process types -- Alex doesn't need the `content` process type instructions when executing a `fix` type initiative.

**3. No Token Budget Awareness**
CrewAI explicitly tracks token usage. AutoGen/Microsoft Agent Framework has built-in cost metrics. LangGraph's checkpointing inherently tracks state size. Our system has no concept of token cost. Morgan's personality file says "Budget-conscious. You always ask: what's the cheapest way?" but there's no mechanism to actually measure or limit token spend. We discovered this problem the hard way: "Strategic planning should be separate from codebase scanning -- 97K token, 218s planning phase."

**What works better:** Token budgets per phase. Measure actual spend. Kill agents that exceed their budget. This is a prerequisite for cost optimization.

**4. Retry Logic is Too Simplistic**
Our retry logic: if a reviewer returns "critical," respawn the engineer once, then re-run only the critical reviewer. If still critical, mark as partial and move on. LangGraph allows forking from any state and trying alternative approaches. CrewAI supports task delegation and reassignment. AutoGen's conversation patterns allow iterative refinement through multi-turn dialogue.

**What works better:** Differentiated retry strategies. A critical review for "wrong approach" should not retry with the same approach -- it should go back to the design phase. A critical review for "missing edge case" should patch, not restart. Our single-strategy "respawn engineer with fix instructions" works for minor issues but fails for fundamental approach problems.

**5. No Parallel Execution Within Initiatives**
LangGraph supports parallel node execution with state reducers to merge concurrent updates. CrewAI Flows support `@router` for conditional parallel paths. Our initiatives execute strictly sequentially. Even within a single initiative, phases are serial (design -> clarify -> build -> review). For large initiatives with independent subtasks, this is unnecessarily slow.

**What works better:** Allow Morgan to flag subtasks within an initiative as parallelizable. But don't force it -- our lesson "sequential execution is fine until proven otherwise" is correct. The issue is we have no mechanism to opt in to parallelism even when it's clearly safe.

---

### Things We Over-Engineer

**1. Seven Process Types**
We define 7 process types: fix, design-then-build, research-then-build, full-pipeline, research-only, migration, content. Most frameworks get by with 2-3 patterns: CrewAI has sequential and hierarchical. LangGraph has linear and branching. ChatDev has its 4-phase waterfall.

Our 7 types are really just variations of a single pattern with optional phases:
- fix = build + review
- design-then-build = design + clarify + build + review
- research-then-build = research + design + clarify + build + review
- full-pipeline = spec + design + clarify + build + tech-review + product-review
- research-only = research + report
- migration = research + design + clarify + build(incremental) + review
- content = keyword-research + outline + draft + seo-review + review

**Simpler alternative:** One pipeline definition with optional phases. Morgan specifies which phases to include for each initiative instead of picking from a taxonomy. `"phases": ["research", "design", "build", "review"]` is more flexible than `"process": "research-then-build"` and eliminates the mental overhead of remembering 7 type names and their phase sequences.

**2. C-Suite Challenge Phase**
We spawn 1-2 C-suite agents to independently "challenge or endorse" every heavyweight directive before Morgan plans it. The research evidence: multi-agent coordination adds 58-515% overhead (Google/MIT scaling paper). For what benefit? Our lessons say "C-suite challenges catch over-engineering" and "C-suite challenges catch scope creep early." Valid. But the implementation -- spawning separate sonnet-model agents with full context just for a 3-5 sentence gut check -- is heavy for what it delivers.

**Simpler alternative:** Include the challenge prompt in Morgan's planning prompt. Morgan already reads all the context. Add a "before planning, identify 2-3 risks and flag any over-engineering concerns" section to Morgan's instructions. This gives you the same skeptical evaluation without the overhead of separate agent calls. Reserve separate challenger agents for directives the CEO explicitly flags as controversial.

**3. Multi-Reviewer Casting Matrix**
Our casting rules for reviewers are elaborate: Sarah for architecture, Marcus for product, Morgan for process, Priya for content. Multi-reviewer guidance specifies when to add which reviewer alongside which primary. This creates 2-4 review agent calls per initiative. Most frameworks (CrewAI, ChatDev, MetaGPT) use a single QA/review agent with a comprehensive prompt.

**Simpler alternative:** Default to one reviewer per initiative. The reviewer prompt already includes code quality, user perspective, DOD verification, corrections check, and regression risk assessment. That's a comprehensive review. Add a second reviewer only when the initiative crosses domains (e.g., touches both UI and auth). Our lesson "domain-matched reviewers catch more than single-reviewer defaults" is true, but the marginal value of the second reviewer diminishes for routine work.

**4. Worktree Isolation for Every Directive**
We create a git worktree for every medium/heavyweight directive. This adds setup complexity, requires path management in every agent prompt, and has caused bugs ("worktree doesn't include uncommitted files from main"). Most frameworks don't manage git at all -- they trust the developer to handle version control.

**Simpler alternative:** Use worktrees only when the CEO has uncommitted changes they want to preserve (which is actually the only case where isolation matters). For clean working directories, work directly on a branch. The overhead of worktree management has caused more bugs than it's prevented.

**5. Artifact Persistence Per Phase**
We write artifacts for every phase of every initiative to `.context/artifacts/{directive}/{initiative}/{phase}.md`. This creates a deep directory tree of markdown files. For a 4-initiative directive with 4 phases each, that's 16 artifact files. The only consumer of these artifacts is the checkpoint-resume system, which uses them to provide context when restarting an in-progress initiative.

**Simpler alternative:** Write artifacts only for phases that produce output needed by downstream phases (design docs needed by builders, research needed by designers). Skip artifact persistence for build reports and review JSONs -- these are already captured in the checkpoint file and the digest. This cuts artifact writes by ~50%.

---

### Our Unique Strengths

**1. Complexity Triage (Lightweight / Medium / Heavyweight)**
None of the five frameworks analyzed have a built-in mechanism to assess task complexity and adjust process overhead accordingly. CrewAI runs every task through the same crew/flow definition. LangGraph runs every input through the same graph. MetaGPT runs the full SOP pipeline for everything. ChatDev runs all four waterfall phases for everything.

Our triage step is genuinely valuable. The insight -- "not everything needs the full pipeline" -- seems obvious but no framework implements it. The Google/MIT scaling paper validates this: coordination overhead ranges from 58-515%, and multi-agent coordination yields diminishing returns above 45% single-agent baseline. Our lightweight path (Alex just does it) avoids this overhead for simple tasks. This is a competitive advantage.

**2. CEO Context Shielding (Chief of Staff Pattern)**
Our Alex pattern -- delegating to a background agent so the CEO's context window stays clean -- is unique. No other framework addresses the problem of "the person steering the system loses cognitive capacity as implementation noise accumulates." CrewAI, LangGraph, AutoGen all assume the human operator is a developer who wants to see everything. Our pattern is designed for a CEO who wants to see outcomes, not process.

This is a genuine insight about the human-in-the-loop experience. LangGraph's `interrupt()` pauses execution and hands control to the human with full execution state -- the opposite of context shielding. Our approach: "Alex handles it, CEO reviews the summary" is better for the solo-founder use case.

**3. Pre-Build Clarification Phase (from ChatDev)**
We explicitly adopted ChatDev's dual-agent dehallucination pattern and formalized it as a phase in our pipeline. ChatDev's original version uses free-form dialogue between instructor and assistant. Our version is structured: engineer asks 3-5 specific questions about scope boundaries, edge cases, integration points, and ambiguous requirements. The designer/auditor responds. This is archived as a clarification artifact.

No other framework has formalized this as a distinct pipeline phase. LangGraph could implement it as a node, but it's not a standard pattern. CrewAI's agents can "ask questions" but it's ad-hoc, not structured.

**4. Standing Corrections and Preferences Distribution**
Our preferences.md with Standing Corrections is distributed to every agent. This ensures the CEO's accumulated "never do X again" feedback persists across all future work. Combined with lessons.md (project-level) and conductor/lessons.md (framework-level), we have a three-tier knowledge distribution system.

No framework has an equivalent. CrewAI's long-term memory stores task results, not behavioral corrections. MetaGPT's SOPs are static. AutoGen has no cross-session correction mechanism.

**5. OKR-Driven Decomposition**
Our goal -> key result -> initiative -> task decomposition is business-logic-aware. Morgan doesn't just break work into subtasks -- she defines measurable outcomes (KRs) that the work must achieve, and each initiative maps to exactly one KR. This means we can assess directive success against business objectives, not just "did the code ship."

MetaGPT and ChatDev decompose into software artifacts (PRD, design, code, tests). CrewAI decomposes into tasks. LangGraph decomposes into graph nodes. None of them connect work to measurable business outcomes.

**6. Mandatory User-Perspective Review**
Our review prompt requires every reviewer to evaluate work from the CEO/end-user perspective alongside code quality. This addresses our hard-won lesson: "agents build mechanically without testing the user experience -- 9 bugs found by CEO in 10 seconds." No other framework mandates user-perspective evaluation as part of the review process. MetaGPT's QA agent tests for code correctness. ChatDev's reviewer looks for bugs. Neither asks "would a human actually want to use this?"

---

## Recommended Actions

### High Priority (address within next 2 directive cycles)

**H1. Add Structured Telemetry**
Effort: 1-2 days. Track token counts per agent call, wall time per phase, review outcomes (pass/fail/critical rates), and directive-level totals. Write to a structured JSON log file per directive. This unlocks all future optimization work.
Source: Microsoft Agent Framework's OpenTelemetry integration, Google/MIT scaling research data needs.

**H2. Split lessons.md by Topic**
Effort: Half day. Break lessons.md into topic files (agent-behavior.md, orchestration.md, state-management.md, review-quality.md). Agents read only relevant files based on their role. Sarah reads architecture lessons, not state parser bugs. This is the minimum viable version of CrewAI's relevance-scored memory.
Source: CrewAI's multi-type memory system, our own lessons.md growing to 129 lines.

**H3. Replace Process Types with Phase Lists**
Effort: 1 day. Eliminate the 7 process type taxonomy. Morgan specifies `"phases": ["design", "build", "review"]` directly. SKILL.md shrinks by ~200 lines. Engineers don't need to know the process type name -- they just receive their phase's instructions.
Source: All frameworks use simpler workflow definitions than our 7-type taxonomy.

### Medium Priority (address within 1-2 weeks)

**M1. Inline Challenge into Morgan's Planning**
Effort: Half day. Move the C-suite challenge from a separate agent spawn to a section in Morgan's planning prompt: "Before planning, identify the top 3 risks and flag any scope concerns." Reserve separate challenger agents for CEO-flagged controversial directives only.
Source: Google/MIT scaling paper showing 58-515% coordination overhead per additional agent.

**M2. Add Token Budget Tracking**
Effort: 1 day. Estimate token costs before execution. Set soft limits per phase. Log actual vs estimated. Don't block on overruns yet -- just measure. Over 5-10 directives, use the data to set appropriate limits.
Source: CrewAI's explicit token tracking, our own "97K token planning phase" surprise.

**M3. Differentiated Retry Strategies**
Effort: 1 day. When a review is "critical," classify the failure: wrong-approach (retry from design), missing-functionality (patch and re-review), or quality-issue (patch and re-review with relaxed threshold). Current one-size-fits-all retry is too blunt.
Source: LangGraph's fork-from-checkpoint pattern, ChatDev's iterative refinement.

**M4. Simplify Worktree Usage**
Effort: Half day. Default to branch-only (no worktree). Use worktree only when `git status` shows uncommitted changes the CEO wants to preserve. Document this in SKILL.md.
Source: Repeated worktree bugs in our lessons.md.

### Low Priority (backlog for future consideration)

**L1. Declarative Pipeline Schema**
Effort: 2-3 days. Extract the SKILL.md pipeline into a machine-parseable JSON/YAML schema. The SKILL.md becomes a thin wrapper that reads the schema and executes it. This is the foundation for automated workflow optimization (MetaGPT AFlow direction).
Source: LangGraph's graph definition, MetaGPT's SOPs in code.

**L2. Automated Lesson Extraction**
Effort: 1-2 days. After each directive, spawn an agent to analyze the execution (from checkpoint + digest) and propose new lessons. Human approves or rejects. This is a lightweight version of ChatDev's Experiential Co-Learning.
Source: ChatDev's co-learning module.

**L3. Selective Artifact Persistence**
Effort: Half day. Only write artifacts for phases whose output is consumed by downstream phases. Skip build reports and review JSONs as standalone artifacts -- they're already in the checkpoint.
Source: Reducing unnecessary file writes; no framework persists every intermediate output.

**L4. Parallel Subtask Support**
Effort: 2 days. Allow Morgan to flag subtasks within an initiative as parallelizable. Alex spawns them concurrently and merges results. Only enable when Morgan explicitly marks subtasks as independent.
Source: LangGraph's parallel node execution with state reducers.

---

## Key Takeaways

1. **We're actually well-positioned.** Our unique strengths (triage, context shielding, user-perspective review, OKR decomposition) address real problems that no other framework solves. These aren't novelties -- they're hard-won solutions to problems we actually hit.

2. **Our biggest weakness is observability.** We can't measure cost, quality trends, or phase efficiency. Every other enterprise-grade framework (LangGraph, AutoGen/Microsoft) treats observability as foundational. We should too.

3. **Our biggest over-engineering is the process type taxonomy.** Seven named types with prose-encoded phase sequences is complexity that buys us nothing over Morgan specifying phases directly.

4. **The research validates our conservative approach.** The Google/MIT scaling paper (Dec 2025) found that multi-agent coordination yields diminishing or negative returns once single-agent baseline exceeds ~45%. Our triage step that routes simple work to a single agent (Alex) is empirically correct. Our instinct to "not invoke everyone for routine work" (Morgan's casting rules) is backed by data showing 17x error amplification in uncoordinated groups.

5. **We should resist the temptation to add more agents.** Every framework comparison shows that more agents = more overhead. Our lessons independently discovered this: "lightweight implementations beat full-scope," "sequential execution is fine until proven otherwise." Stay the course.

---

## Sources

### Framework Documentation and Repositories
- [CrewAI GitHub](https://github.com/crewAIInc/crewAI)
- [CrewAI Flows Documentation](https://docs.crewai.com/en/concepts/flows)
- [CrewAI Memory System](https://docs.crewai.com/en/concepts/memory)
- [AutoGen / Microsoft Agent Framework GitHub](https://github.com/microsoft/autogen)
- [Microsoft Agent Framework Overview](https://learn.microsoft.com/en-us/agent-framework/overview/agent-framework-overview)
- [LangGraph GitHub](https://github.com/langchain-ai/langgraph)
- [LangGraph Interrupts Documentation](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Persistence Documentation](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Time Travel](https://langchain-ai.github.io/langgraph/concepts/time-travel/)
- [MetaGPT GitHub](https://github.com/FoundationAgents/MetaGPT)
- [MetaGPT ICLR 2024 Paper](https://proceedings.iclr.cc/paper_files/paper/2024/file/6507b115562bb0a305f1958ccc87355a-Paper-Conference.pdf)
- [ChatDev GitHub](https://github.com/OpenBMB/ChatDev)

### Comparison and Analysis Articles
- [Open Source AI Agent Frameworks Compared (2026)](https://openagents.org/blog/posts/2026-02-23-open-source-ai-agent-frameworks-compared)
- [LangGraph vs AutoGen vs CrewAI Architecture Analysis 2025](https://latenode.com/blog/platform-comparisons-alternatives/automation-platform-comparisons/langgraph-vs-autogen-vs-crewai-complete-ai-agent-framework-comparison-architecture-analysis-2025)
- [AI Agent Frameworks Compared (2026)](https://arsum.com/blog/posts/ai-agent-frameworks/)
- [CrewAI Framework 2025 Complete Review](https://latenode.com/blog/ai-frameworks-technical-infrastructure/crewai-framework/crewai-framework-2025-complete-review-of-the-open-source-multi-agent-ai-platform)
- [MetaGPT Multi Agent Framework Explained 2026](https://aiinovationhub.com/metagpt-multi-agent-framework-explained/)
- [ChatDev 2.0: From Virtual Company to Zero-Code Platform](https://yuv.ai/blog/chatdev)

### Research Papers
- [Towards a Science of Scaling Agent Systems (Google/MIT, Dec 2025)](https://arxiv.org/abs/2512.08296) -- 17x error amplification, coordination overhead quantification, capability saturation thresholds
- [MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework (ICLR 2024)](https://arxiv.org/html/2308.00352v6) -- structured output vs dialogue, executability scores
- [Code in Harmony: Evaluating Multi-Agent Frameworks](https://openreview.net/pdf?id=URUMBfrHFy) -- cross-framework benchmark comparison
- [Why Your Multi-Agent System is Failing: The 17x Error Trap](https://towardsdatascience.com/why-your-multi-agent-system-is-failing-escaping-the-17x-error-trap-of-the-bag-of-agents/) -- practical implications of scaling research

### Enterprise and Industry Analysis
- [Microsoft Agent Framework Convergence Blog](https://cloudsummit.eu/blog/microsoft-agent-framework-production-ready-convergence-autogen-semantic-kernel/)
- [AutoGen OpenTelemetry Documentation](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/framework/telemetry.html)
- [AI Agent Memory Comparative Analysis (CrewAI, LangGraph, AutoGen)](https://dev.to/foxgem/ai-agent-memory-a-comparative-analysis-of-langgraph-crewai-and-autogen-31dp)
- [Agentic AI Frameworks: Complete Enterprise Guide 2026](https://www.spaceo.ai/blog/agentic-ai-frameworks/)
- [What is MetaGPT? (IBM)](https://www.ibm.com/think/topics/metagpt)
- [What is ChatDev? (IBM)](https://www.ibm.com/think/topics/chatdev)

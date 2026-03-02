# Backlog: Agent Conductor
<!-- last-reviewed: 2026-03-02 -->

## Done

### Phase 1: Foundations
- [x] C-suite agent definitions (Morgan, Sarah, Marcus, Priya)
- [x] `/directive` skill — top-down orchestration (plan → audit → build → review → digest)
- [x] Morgan strategic planning (KRs + initiatives + casting, no codebase scanning)
- [x] Technical audit phase (auditor verifies scope, baselines, dead code)
- [x] Process selection (fix / design-then-build / research-then-build / full-pipeline / research-only)
- [x] OKR persistence + worktree isolation
- [x] Split Morgan (strategy) from Sarah (audit)

### Phase 2: From Directives to Autonomous Org

#### Quick Wins
- [x] Create `.context/preferences.md` — CEO standing orders
- [x] Add `guardrails` section to `.context/vision.md`

#### Slice A: Risk-Based Execution Authority
- [x] Add `risk_level` + `follow_ups` to audit JSON schema in SKILL.md
- [x] Add auto-execute logic for low-risk follow-ups after build phase
- [x] Add batch-approval presentation for medium-risk items
- [x] Add auto-write-to-backlog for high-risk items
- [x] Update digest template with execution labels

#### Slice B: Bottom-Up Proposals (`/patrol`)
- [x] Create `/patrol` skill (`.claude/skills/patrol/SKILL.md`)
- [x] Define patrol scope per agent (what to check, where to look, what tools to use)
- [x] Each agent outputs JSON findings + proposals
- [x] Morgan consolidation step — merges, deduplicates, prioritizes
- [x] CEO approval gate — approve/modify/reject each proposal
- [x] Approved proposals auto-create directive files in inbox/
- [x] Simple `proposals.log` — track what's proposed, by whom, accepted/rejected, CEO's reason

#### Slice C: CEO Report (`/report`)
- [x] Create `/report` skill (`.claude/skills/report/SKILL.md`)
- [x] Aggregate: git log, worktree list, pending items from recent directives
- [x] Read all `okrs.md` files, summarize status
- [x] Read `proposals.log`, compute acceptance rates
- [x] Daily mode: concise 3-section output
- [x] Weekly mode: full report with metrics and recommendations

#### Slice D: Challenge Mode
- [x] Add Step 2b to SKILL.md (C-Suite Challenge)
- [x] Add "challenge" behavior guidance to agent personality files
- [x] Present challenges in Step 4 alongside plan
- [x] Keep lightweight — short structured output, not dialogue

#### Slice F: Self-Evaluation
- [x] Define metrics to track (acceptance rate, audit accuracy, build success)
- [x] Post-directive self-assessment step (compare planned vs actual)
- [x] Include performance metrics in weekly `/report`
- [x] Auto-update lessons.md with new learnings when directives complete

### Chief of Staff Agent Pattern ✅ Done (2026-03-02)
- [x] Create Alex Rivera (Chief of Staff) agent definition — `.claude/agents/alex-cos.md`
- [x] Pattern: main session = CEO, Alex = executor/orchestrator, agents = workers
- [x] CEO session delegates directives to Alex, stays clean for strategic decisions
- [x] Alex spawns agents, collects results, returns CEO-grade summaries
- [x] Chrome MCP workaround: visual verification bounces back to CEO via "Needs CEO Eyes" section
- [x] Updated SKILL.md with user-perspective review and mandatory UX verification improvements (Part 3 of conductor-ceo-experience)

### Context Separation ✅ Done (2026-03-02)
- [x] Create `.context/vision.md` — framework's own vision
- [x] Create `.context/lessons.md` — orchestration lessons separate from project lessons
- [x] Move agent personalities to conductor repo, symlink from sw/
- [x] Move core skills (directive, scout, healthcheck, report) to conductor repo, symlink from sw/
- [x] Move framework context (lessons, vision, discussions, intelligence, reports) to conductor repo, symlink from sw/
- [x] Consumer-owned state (inbox/, done/, logs) stays in sw/
- [x] Verify all symlinks resolve correctly

### Phase 3: From Code Scanner to Autonomous Company
- [x] Create `/scout` skill — external intelligence gathering (replaces outward part of /patrol)
- [x] Create `/healthcheck` skill — internal maintenance (replaces inward part of /patrol)
- [x] Delete `/patrol` — replaced by scout + healthcheck
- [x] Add Technology Intelligence section to Sarah's personality + WebSearch/WebFetch tools
- [x] Add Market Intelligence section to Marcus's personality
- [x] Add Growth Intelligence section to Priya's personality
- [x] Add Ecosystem Intelligence section to Morgan's personality + WebSearch/WebFetch tools
- [x] Update `/report` with External Intelligence + Internal Health sections
- [x] Create intelligence/ and healthchecks/ directory structure
- [x] Update conductor vision with new architecture (outward-looking, autonomous loop)

## Phase 4: Workflow Optimization (steal from external frameworks)

### P1 — Steal Soon

### ~~Progress journal / checkpoint-resume~~ ✅ Done (2026-03-02)
- **Priority**: P1
- **Source**: Directive checkpoint-resume, 2026-03-02
- **Context**: Implemented Step 0 (checkpoint detection + resume), Checkpoint Protocol (schema, write mechanism), checkpoint writes at 8+ transition points, artifact persistence for all 7 process types, cleanup after digest. Reviewed by Sarah — PASS_WITH_NOTES, all critical issues fixed.

### ~~Request-clarify loops for engineers~~ ✅ Done (2026-03-02)
- **Priority**: P1
- **Source**: Directive request-clarify-loops, 2026-03-02
- **Context**: Added selective pre-build clarification to 4 complex process types (design-then-build, research-then-build, full-pipeline, migration). Simple processes (fix, content) skip it. Reviewed by Sarah — PASS after fixes (forward-reference, artifact_paths schema, full-pipeline responder). KR-12 ACHIEVED.

### Manager re-planning mid-directive — DEFERRED (2026-03-02)
- **Priority**: P1
- **Trigger**: When an audit reveals Morgan's plan is fundamentally wrong (next occurrence where audit contradicts plan)
- **Source**: Directive optimize-conductor-workflows, 2026-03-01
- **Context**: Stolen from CrewAI hierarchical process. Morgan currently plans once upfront and the plan is fixed. She should be able to re-plan mid-directive if the audit or build phase reveals the plan is wrong.
- **Challenge (2026-03-02)**: Both Sarah AND Morgan challenged — over-engineering a zero-frequency problem. Re-plan triggers re-audit → re-approve, adding ~50 lines of non-linear branching. Sarah's alternative: add `scope_problem` field to reviewer output → escalate to CEO directly. Waiting for trigger to fire.

### ~~Verbal self-reflection format for lessons~~ ✅ Done (2026-03-02, lightweight)
- **Priority**: P1
- **Source**: Directive reflexion-lessons, 2026-03-02
- **Context**: Both Sarah and Morgan challenged the full Reflexion migration as a category error (research applies to agent loops, not static docs). Implemented lightweight version: (1) fixed duplication in conductor/lessons.md (State Management appeared twice), (2) added Step 6b to SKILL.md with failure-mode format hint, (3) existing flat facts stay as-is. Full Reflexion migration deferred — the real problem is scale/discoverability, not format.

### ~~Episodic memory consolidation~~ ✅ Done (2026-03-02, lightweight)
- **Priority**: P1
- **Source**: Directive episodic-memory-consolidation, 2026-03-02
- **Context**: Both Sarah and Morgan challenged the full personality-file-update approach as creating dual source of truth with conductor/lessons.md. Implemented lightweight: (1) Added conductor/lessons.md to Step 2 read list and all agent prompts, (2) Added consolidation trigger to Step 6b (every 10th directive, consolidate patterns), (3) Fixed lessons.md duplication. Full personality updates deferred — personality files are behavioral contracts, lessons.md is the knowledge store.

### P2 — Steal Later

### Async parallel initiatives
- **Priority**: P2
- **Trigger**: When sequential execution becomes the bottleneck (directive takes >2 hours with 3+ independent initiatives) — **NOT FIRED** (no reports show >2 hour execution times; all directives complete within normal timeframes)
- **Source**: Directive optimize-conductor-workflows, 2026-03-01
- **Context**: Stolen from AutoGen v0.4 event-driven architecture. Run independent initiatives concurrently. Requires dependency tracking between initiatives.

### Tree search for strategy exploration
- **Priority**: P2
- **Trigger**: When Morgan's single-plan approach fails twice (plan fundamentally wrong after audit) — **NOT FIRED** (zero plan failures found across 19 directive reports; reviewers found implementation issues but never fundamental plan errors)
- **Source**: Directive optimize-conductor-workflows, 2026-03-01
- **Context**: Stolen from AI Scientist v2. Explore 2-3 strategic approaches in parallel with entropy-guided selection, instead of Morgan committing to one plan upfront.

### ~~Agent personality evolution from experience~~ ✅ Done (2026-03-02)
- **Priority**: P2
- **Trigger**: After episodic memory consolidation is implemented and running — **FIRED** (episodic memory consolidation done 2026-03-02)
- **Source**: Directive optimize-conductor-workflows, 2026-03-01
- **Context**: Added `## Learned Patterns` section to all 4 agent personality files (Morgan, Sarah, Marcus, Priya) with role-relevant patterns extracted from conductor/lessons.md. Added personality evolution trigger to SKILL.md Step 6d — on every 10th directive consolidation cycle, patterns are re-extracted per agent role. Max 8 patterns per agent to prevent bloat. Personality files remain behavioral contracts; learned patterns are curated excerpts, not duplicates.

### Dashboard checkpoint visibility
- **Priority**: P2
- **Trigger**: When checkpoint-resume is used 3+ times and CEO wants dashboard visibility — **NOT FIRED** (no checkpoints directory exists yet; checkpoint-resume hasn't been exercised in production)
- **Source**: Directive checkpoint-resume audit, 2026-03-02
- **Context**: Extend scripts/index-state.ts to scan .context/checkpoints/ and include active checkpoints in conductor.json for dashboard visibility. Add stale checkpoint detection (>7 days old).

### ~~Auto-move directive from inbox/ to done/ on completion~~ ✅ Done (2026-03-02, automated)
- **Priority**: P2
- **Source**: Directive checkpoint-resume audit, 2026-03-02
- **Context**: Originally manual (moved 5 directives by hand). Now automated: added Step 6f to SKILL.md that runs `mv .context/inbox/$ARGUMENTS.md .context/done/` after digest is written. Added to ALWAYS rules. Directive files are automatically archived on completion.

### ~~Foreman skip-marker safety~~ ✅ Done (2026-03-02)
- **Priority**: P1 (bug fix)
- **Source**: Alex Rivera backlog audit, 2026-03-02
- **Context**: Standalone `scripts/foreman.ts` was missing skip marker filtering — would have launched deferred/manual directives via launchd. Server-side foreman had the check but standalone didn't. Also: both foreman implementations missed DEFERRED in backlog `isDone` check. MCP `conductor_launch_directive` had no guardrail for skipped directives. Fixed all three code paths, added lesson to conductor/lessons.md.

## Future Ideas
- ~~Agent-conductor as MCP server~~ ✅ Done (2026-03-02) — Built MCP server at `mcp-server/` with 5 tools: conductor_status, conductor_backlog, conductor_add_backlog, conductor_launch_directive, conductor_report. Uses @modelcontextprotocol/sdk. CEO needs to add to ~/.claude/settings.json to activate.
- A2A protocol support for cross-framework agent communication
- Community personality packs (different org styles)
- ~~Token cost tracking dashboard~~ ✅ Done (2026-03-02) — Added total cost (USD) card to Insights page + per-model cost breakdown. Uses existing `costUSD` field from Claude Code stats-cache.json.
- ~~Consumer CLI (`npx agent-conductor init`)~~ ✅ Done (2026-03-02) — Built CLI at `cli/` with interactive setup, agent subsetting, template scaffolding, global config management. Works via `npx tsx cli/index.ts init`. Needs build step before npm publish.
- ~~Scheduled runs (cron-triggered scouts and reports)~~ ✅ Done (2026-03-02) — Created `scripts/scheduled-runs.sh` for invoking /scout and /report via CLI. Includes 3 macOS LaunchAgent plist templates (daily scout at 8am, daily report at 6pm, weekly report Monday 9am). Uses `claude -p --dangerously-skip-permissions`.
- Automatic autonomy adjustment based on acceptance rates (deferred — needs more data)
- Engineer proposals (deferred — ephemeral agents lack persistent context)
- ~~Intelligence trending~~ ✅ Done (2026-03-02) — Built `scripts/intelligence-trends.ts`, API endpoint `/api/intelligence`, tabbed Insights page with Intelligence tab showing summary cards, cross-scout signals, agent performance, trending topics, product coverage.
- ~~Cross-scout pattern detection~~ ✅ Done (2026-03-02) — Integrated into intelligence-trends.ts + updated `/scout` SKILL.md consolidation rule #7 for auto-promotion of cross-scout signals. Dashboard shows signals with agent dots and strength badges.

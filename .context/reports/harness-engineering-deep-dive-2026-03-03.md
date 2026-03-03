# Harness Engineering Deep Dive — Round 2 (Full Article Analysis)

**Date**: 2026-03-03
**Source**: Full article text from https://openai.com/index/harness-engineering/ (read via Chrome MCP)
**Team**: Sarah (CTO), Marcus (CPO), Priya (CMO), Morgan (COO)
**Supersedes**: harness-engineering-adoption-2026-03-03.md (Round 1, based on secondary sources)

## What Changed from Round 1

Round 1 used secondary sources (InfoQ, Martin Fowler, eng-leadership newsletter). Round 2 read the full article. Key differences:

1. **SKILL.md IS the anti-pattern** — OpenAI explicitly tried one big AGENTS.md and it failed. Our 82.5KB directive SKILL.md is the same mistake. Round 1 missed this entirely.
2. **Progressive disclosure** — AGENTS.md as ~100-line TOC, `docs/` as the knowledge base. Not just "docs as source of truth" but a specific 2-layer architecture we don't have.
3. **5 feedback loops, not 1** — We only have agent review. OpenAI has: lint (instant) → structural tests (commit) → agent review (post-build) → doc-gardening (weekly) → quality grades (monthly).
4. **Custom lint error messages as remediation** — Lint failures include exact instructions for how to fix. Deterministic check + LLM guidance in one.
5. **Doc-gardening agent** — Recurring background process scanning for stale docs, opening fix-up PRs. Not a one-shot healthcheck.
6. **Execution plans as versioned artifacts** — Morgan's plans saved as diffable artifacts, not ephemeral context.
7. **Per-worktree app isolation** — Full app instance + ephemeral observability per worktree. We use worktrees but don't isolate app state.
8. **"Corrections are cheap, waiting is expensive"** — Minimal blocking gates. Our medium-risk approval gate contradicts this.
9. **Agent-to-agent review** — "Humans may review PRs, but aren't required to." Our C-suite review is already this; we should lean harder into it.
10. **6-hour autonomous overnight runs** — Scale ambition we should target.

## Team Analysis

### Sarah (CTO) — Architecture & Enforcement

**Key finding: Our SKILL.md is the anti-pattern.**

OpenAI explicitly warns against dumping everything into one file. Their AGENTS.md is ~100 lines — a table of contents pointing into `docs/`. Our directive SKILL.md is 82.5KB of inline instructions. This is the #1 structural problem.

**Proposed SKILL.md restructure:**
```
SKILL.md (~120 lines)          — routing map: "what process? → which doc"
docs/pipeline/
  fix.md                       — fix process phases + agent prompts
  design-then-build.md         — design process phases
  full-pipeline.md             — full pipeline phases
  research-only.md             — research process
  migration.md                 — migration process
  content.md                   — content process
  checkpoint-protocol.md       — checkpoint schema + resume logic
  follow-up-processing.md      — risk classification + follow-up handling
```

**5 feedback loops we need (we have 1):**

| Loop | Speed | OpenAI Has | We Have |
|------|-------|-----------|---------|
| Custom lint rules | Instant | Yes — with remediation messages | No |
| Structural tests | On commit | Yes — boundary checks | No |
| Agent review | Post-build | Yes | Yes (only this one) |
| Doc-gardening | Weekly | Yes — background agent | No (/healthcheck is bi-weekly, manual) |
| Quality grades | Monthly | Yes — per-domain longitudinal | No |

**Escalation ladder (new concept):**
Convention (docs) → Documented rule (lessons.md) → Lint rule (ESLint plugin) → Structural test (scripts/)

When a convention is violated twice, promote it. Don't keep writing prose that agents ignore.

**Implementation sequence:**
- Week 1: SKILL.md restructure + context tier system (what agents see first vs on-demand)
- Week 2: Custom ESLint plugin (`eslint-plugin-conductor`) — JSON schema validation, import boundaries, SKILL.md structure checks
- Week 3: Doc-gardening agent + mechanical pre-review (diff analysis before Sarah reviews)
- Week 4: Per-worktree app isolation + quality scorecard

### Marcus (CPO) — Product & CEO Experience

**Key finding: "Corrections are prose, not enforcement."**

The CEO has stated the same corrections multiple times. Each time, they get added to lessons.md as prose. Agents read prose inconsistently. OpenAI's answer: promote repeated corrections into code (lint rules, structural tests). Our answer should be the same.

**Correction-to-code pipeline (new):**
1. CEO states a correction → captured in lessons.md (status quo)
2. Same correction appears twice → auto-escalate: create a lint rule or structural test that catches it mechanically
3. Standing Corrections become testable assertions, not reading comprehension tests

**Gate analysis — what to cut:**
- Medium-risk follow-up approval gate: CEO reviews 3-8 items after every directive. OpenAI says "corrections are cheap, waiting is expensive." Proposal: auto-execute medium-risk items that don't touch guardrails. CEO reviews in /report, reverts if needed.
- Result: CEO's 45 min/week → ~30 min/week

**Progressive disclosure for /report (new):**

Current /report is a data dump. OpenAI's principle: agents (and humans) should be taught where to look, not given everything at once.

```
Tier 1: Decision Queue (5 min)
  — Items that need CEO approval (high-risk only)
  — Proposals from /scout awaiting review

Tier 2: Exceptions (5 min)
  — Failed initiatives, blocked work, quality grade drops
  — Only shown if something went wrong

Tier 3: Details (on-demand)
  — Full initiative reports, OKR progress, timing data
  — Available but not pushed
```

**Self-validation for UI work (new):**
After UX verification, run mechanical checks: every `onClick` handler wired, every route reachable, every API call has error state. Don't rely solely on visual inspection.

### Priya (CMO) — Positioning & Content

**Key finding: "Should not be assumed to generalize" is THE positioning gift.**

OpenAI explicitly disclaims generalizability. This creates a massive opening: we ARE the generalization layer. OpenAI proved harness engineering works at scale. Agent-conductor makes it accessible to teams who aren't OpenAI.

**Positioning update:**
> "OpenAI proved harness engineering works. Agent-conductor makes it accessible."

This is cleaner and more compelling than Round 1's positioning. It doesn't compete with OpenAI — it builds on their validation.

**Vocabulary adoption is non-negotiable:**
The article defines the industry's vocabulary NOW. Every concept we use must map to harness engineering terms within 2 weeks, or we become invisible to developers searching for these patterns.

| Our Term | Harness Engineering Term |
|----------|------------------------|
| `.context/` tree | Context engineering |
| SKILL.md pipelines | Architectural constraints |
| /healthcheck + /scout | Entropy management |
| C-suite domain ownership | Organizational constraints (our extension) |
| Risk taxonomy | Autonomy boundaries |
| Lessons.md | Institutional memory / garbage collection |

**Revised content plan (4-part blog series):**
1. "We've Been Doing Harness Engineering Without Knowing It" — pattern mapping, credibility builder
2. "The Organizational Layer OpenAI Doesn't Cover" — our moat, what we add
3. "From 1,000-Page Manual to 100-Line Map" — SKILL.md restructure story (build in public)
4. "5 Feedback Loops Every Agent Framework Needs" — Sarah's analysis, practical guide

**Framework comparison page using harness engineering as evaluation criteria:**

| Criterion | CrewAI | LangGraph | MetaGPT | Agent-Conductor |
|-----------|--------|-----------|---------|-----------------|
| Context engineering | Minimal | Manual | Shared memory | Full `.context/` tree |
| Architectural constraints | Role-based | Graph edges | SOP docs | SKILL.md + risk taxonomy |
| Entropy management | None | None | None | /healthcheck + /scout + lessons |
| Organizational layer | No | No | Partial (roles) | Full (C-suite, challenge, autonomy) |

**Timing: 7-14 day window.** The article wave peaks in ~2 weeks. After that, every framework will claim alignment. First mover advantage is real.

### Morgan (COO) — Operations & Process

**Key finding: SKILL.md restructure is the #1 operational takeaway.**

Not just because it's an anti-pattern, but because it's the root cause of multiple operational failures:
- Agent prompt bloat (82.5KB loaded every directive)
- Agents ignoring instructions (too much to process)
- Inconsistent phase execution (buried in prose)
- Difficult to update (one change risks breaking everything)

**Progressive disclosure architecture for directive pipeline:**
```
Layer 1: SKILL.md (~120 lines)
  — Process selection rules
  — Phase sequence per process type
  — "Read docs/pipeline/{process}.md for details"

Layer 2: docs/pipeline/*.md (~6 files)
  — Full phase instructions per process type
  — Agent prompts and cast rules
  — Loaded on-demand per initiative

Layer 3: docs/reference/*.md
  — Checkpoint protocol
  — Follow-up processing rules
  — Risk classification guide
  — Loaded only when needed
```

**Gate optimization — what to remove:**
1. Medium-risk follow-up approval gate → auto-execute, review in /report
2. Result: fewer CEO interruptions, faster directive completion
3. Safety net: /report shows what was auto-executed, CEO can revert

**Quality grades (new concept from article):**
Track quality scores per domain over time:
- Code quality grade (type errors, lint violations, test coverage)
- Context quality grade (stale docs, missing lessons, orphan state files)
- Pipeline quality grade (initiative success rate, retry frequency, checkpoint usage)
- CEO experience grade (decision queue length, time-to-review, revert frequency)

Measured longitudinally, not per-directive. Trends matter more than snapshots.

**Doc-gardening as event-triggered process:**
Don't run on a schedule (like /healthcheck bi-weekly). Trigger on events:
- After every 5th directive: scan for stale docs
- After lessons.md exceeds 400 lines: consolidate
- After any file in `.context/` is >30 days old: flag for review
- After a CEO correction: check if it's already in lessons.md

**Execution plan versioning (new):**
Morgan's plans currently exist only in the directive's context window. If context exhausts, the plan is gone (checkpoint stores it, but as a blob). Proposal: save Morgan's plan as a versioned artifact (`artifacts/{directive}/plan-v1.json`), diffable across iterations.

## Updated Priority Stack

### P0 — This Week

| # | Proposal | Champion | What Changed from Round 1 |
|---|----------|----------|--------------------------|
| 1 | **SKILL.md restructure** | Sarah + Morgan | NEW — Round 1 didn't identify this as an anti-pattern |
| 2 | **Deterministic constraint checker** | Sarah | Upgraded — now includes custom lint with remediation messages |
| 3 | **Correction-to-code pipeline** | Marcus | NEW — 2-strike escalation from prose to code |
| 4 | **Adopt harness vocabulary** | Priya | Same priority, tighter 2-week window |

### P1 — Next 2 Weeks

| # | Proposal | Champion | What Changed from Round 1 |
|---|----------|----------|--------------------------|
| 5 | **Progressive disclosure /report** | Marcus | NEW — 3-tier report redesign |
| 6 | **Doc-gardening agent** | Sarah + Morgan | NEW — event-triggered, not scheduled |
| 7 | **Remove medium-risk approval gate** | Morgan + Marcus | NEW — "corrections are cheap, waiting is expensive" |
| 8 | **Blog series (4 parts)** | Priya | Revised — new angles from full article |
| 9 | **Execution plan versioning** | Morgan | NEW — plans as diffable artifacts |
| 10 | **Pre-review diff analysis** | Sarah | Same from Round 1 |

### P2 — Month 2

| # | Proposal | Champion | What Changed from Round 1 |
|---|----------|----------|--------------------------|
| 11 | **Quality grades per domain** | Sarah + Morgan | NEW — longitudinal tracking |
| 12 | **Framework comparison page** | Priya | Enhanced — harness engineering as evaluation criteria |
| 13 | **Per-worktree app isolation** | Sarah | NEW — full app instance per worktree |
| 14 | **Context tier system** | Morgan | NEW — what agents see first vs on-demand |
| 15 | **Self-validation for UI** | Marcus | NEW — mechanical checks after UX verification |

## Consensus Shifts from Round 1

1. **SKILL.md is a bigger problem than we thought.** Round 1 called our context engineering "strong." Round 2 says the execution is right but the architecture is wrong — we have context engineering principles but deliver them as a monolith.

2. **Deterministic enforcement is deeper than "add a script."** Round 1 proposed a boundary checker. Round 2 proposes a full escalation ladder with 5 feedback loops, custom lint with remediation, and correction-to-code promotion.

3. **CEO experience should improve, not just be maintained.** Round 1 validated 45 min/week. Round 2 proposes cutting to 30 min/week via progressive disclosure and gate removal.

4. **Positioning window is tighter than expected.** Round 1 said "adopt vocabulary." Round 2 says "2-week window before every framework claims alignment."

5. **Entropy management needs to be continuous, not periodic.** Round 1 said "/healthcheck bi-weekly is moderate." Round 2 says event-triggered doc-gardening + quality grades are the real pattern.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| SKILL.md restructure breaks existing directives | Run 2 directives on old SKILL.md, 2 on new, compare outcomes |
| Removing medium-risk gate causes quality regression | Track revert frequency in /report for first month |
| Vocabulary adoption feels like bandwagoning | Lead with substance (SKILL.md restructure), vocabulary follows naturally |
| 2-week content window is too aggressive | Priya produces outline + first post this week, remaining 3 over next 2 weeks |
| Doc-gardening agent creates noise | Start with weekly cadence, tune event triggers based on data |

## Self-Assessment

**Article coverage**: Full article text analyzed by all 4 agents. No secondary source gaps.

**Round 2 delta**: 7 entirely new proposals that Round 1 missed. 4 existing proposals significantly upgraded. 1 proposal (split lessons.md) deprioritized (already done in conductor repo).

**Strongest insight**: Sarah's identification that SKILL.md IS the anti-pattern OpenAI warns against. This reframes our entire approach to architectural constraints.

**Biggest disagreement**: Morgan wants to remove the medium-risk gate immediately. Marcus wants to keep it for 1 month with tracking, then remove. Both approaches are valid — CEO decides.

**What we still don't know**: Whether SKILL.md restructure will actually reduce agent errors (need to measure), whether quality grades will be meaningful at our scale (need to try), and whether the 2-week positioning window is real (need to watch the discourse).

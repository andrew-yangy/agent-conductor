# Directive: Resolve Framework Comparison Scout Findings

**Source**: Scout 2026-03-03, Sarah Chen (CTO) framework comparison report
**Priority**: P1
**Risk**: medium (conductor framework changes, no production impact)
**Goal alignment**: agent-conductor

## Objective

Sarah's framework comparison scout identified 3 high-priority and 4 medium-priority improvements to the conductor. Resolve the high-priority items and the quick medium-priority wins.

## Scope

### High Priority

**H1: Add Structured Telemetry**
Track token counts per agent call, wall time per phase, review outcomes (pass/fail/critical rates), and directive-level totals. Write to a structured JSON log file per directive. This unlocks all future optimization work.

**H2: Split lessons.md by Topic**
Break conductor/lessons.md into topic files (agent-behavior.md, orchestration.md, state-management.md, review-quality.md). Agents read only relevant files based on their role. Update SKILL.md agent spawn prompts to reference topic-specific files instead of the monolith.

**H3: Replace Process Types with Phase Lists**
Eliminate the 7 process type taxonomy in SKILL.md. Morgan specifies `"phases": ["design", "build", "review"]` directly for each initiative. Update SKILL.md Step 5 to read phase lists instead of switching on process type names.

### Medium Priority (quick wins only)

**M1: Inline Challenge into Morgan's Planning**
Move the C-suite challenge from separate agent spawns (Step 2b) into Morgan's planning prompt. Add "Before planning, identify top 3 risks and flag over-engineering concerns" to Morgan's instructions. Reserve separate challengers for CEO-flagged controversial directives only.

**M4: Simplify Worktree Usage**
Default to branch-only (no worktree). Use worktree only when `git status` shows uncommitted changes. Update SKILL.md Step 4b.

### Also Add

**User Scenario Field**: Add `user_scenario` to Morgan's initiative schema. A one-sentence description of how the user will experience this initiative. Reviewers walk this scenario during review.

## Intelligence Context

- Full report: `.context/reports/framework-comparison-scout-2026-03-03.md`
- Google/MIT scaling paper validates reduced coordination overhead
- Every enterprise framework (LangGraph, AutoGen) treats telemetry as foundational
- CrewAI has topic-based memory; our flat lessons.md is unsustainable at 129+ lines

## Success Criteria

- Directive pipeline produces a telemetry JSON log alongside the digest
- lessons.md split into topic files, agents receive only relevant topics
- Morgan outputs phase lists instead of process type names
- SKILL.md Step 2b inlined into Morgan's prompt (separate challengers removed from default flow)
- Worktree only created when working directory is dirty
- Morgan's initiative schema includes user_scenario field

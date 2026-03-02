# Directive Report: Resolve Framework Comparison Scout Findings

**Date**: 2026-03-03
**Directive**: conductor-scout-fixes
**Planned by**: Alex Rivera (Chief of Staff), inline execution (MEDIUM classification)

## Summary

Resolved all 3 high-priority and 2 medium-priority findings from Sarah's framework comparison scout report, plus the user_scenario field addition. The directive pipeline now has structured telemetry, topic-based lessons, composable phase lists replacing the 7-type taxonomy, inlined challenge mode, simplified worktree usage, and user scenario tracking.

## Changes Delivered

### H1: Structured Telemetry
- Added Telemetry Protocol section to SKILL.md with JSON schema for per-directive telemetry
- Schema tracks: wall time per phase, review outcomes (pass/fail/critical), initiative completion rates
- Telemetry file written to `.context/telemetry/{directive-name}.json`
- Integrated telemetry summary section into digest template
- Added telemetry to ALWAYS rules
- Created telemetry directory in agent-conductor repo

### H2: Split lessons.md by Topic
- Split monolithic lessons.md (128 lines, 17 sections) into 5 topic files:
  - `lessons/agent-behavior.md` -- agent behavior patterns, UX perspective
  - `lessons/orchestration.md` -- planning, sequencing, context management, batch execution
  - `lessons/state-management.md` -- checkpoints, state indexer, parsing, dashboard
  - `lessons/review-quality.md` -- reviewer effectiveness, risk classification, incomplete items
  - `lessons/skill-design.md` -- pipeline rules, repo separation, foreman, anti-patterns
- Updated lessons.md to be an index with topic-file table and usage instructions
- Created symlink from sw/ to agent-conductor/ for the lessons/ directory
- Updated SKILL.md Step 2 to reference topic-specific files
- Updated SKILL.md agent spawn rules to load role-relevant topics only
- Updated SKILL.md Step 6d to write to topic files instead of monolith

### H3: Replace Process Types with Phase Lists
- Eliminated the 7 process type taxonomy (fix, design-then-build, research-then-build, full-pipeline, research-only, migration, content)
- Morgan now specifies `"phases": ["build", "review"]` directly per initiative
- Replaced 7 `### Process:` sections in Step 5 with unified Phase Execution Reference
- Updated Morgan's prompt schema: `"process"` field replaced with `"phases"` array
- Updated checkpoint schema: `"process"` field replaced with `"phases"` array
- Updated all NEVER/ALWAYS rules to use phase terminology
- Documented common phase patterns as guidance (not rigid rules)
- Added CLARIFICATION PHASE RULES for when to auto-include clarification

### M1: Inline Challenge into Morgan's Planning
- Moved C-suite challenge from separate agent spawns (Step 2b) into Morgan's planning prompt
- Morgan now outputs a `"challenges"` JSON section with risks, over-engineering flags, and recommendation
- Step 2b updated: separate challengers only for CEO-flagged controversial or heavyweight cross-domain directives
- Updated Step 4 plan presentation to show Morgan's inline challenge analysis
- Updated Morgan's personality file with "Challenge Mode (Inline in Planning)" section
- Updated Medium Process triage to clarify inline vs separate challenge

### M4: Simplify Worktree Usage
- Step 4b renamed to "Branch / Worktree Isolation"
- Default changed from worktree to branch-only: `git checkout -b directive/$ARGUMENTS`
- Worktree only created when `git status` shows uncommitted changes
- Updated Step 7 to reference branch name instead of worktree path
- Updated Medium Process triage to mention branch-only default

### User Scenario Field
- Added `"user_scenario"` to Morgan's initiative schema
- Added USER SCENARIO RULES to Morgan's planning prompt
- Updated reviewer prompt to walk the user_scenario during review
- Updated plan presentation to show user scenario per initiative
- Added Phase Design section to Morgan's personality file

## Files Modified

### SKILL.md (`/Users/yangyang/Repos/agent-conductor/.claude/skills/directive/SKILL.md`)
- Step 2: Topic-specific lesson file references
- Step 2b: Scoped to heavyweight/controversial only
- Step 3: Morgan's prompt with phases, challenges, user_scenario
- Step 3b: Topic-specific auditor lessons
- Step 4: Updated challenge presentation format
- Step 4b: Branch-only default, worktree when dirty
- New: Telemetry Protocol section
- Step 5: Unified Phase Execution Reference (replaces 7 process sections)
- Step 6c: Telemetry summary in digest template
- Step 6d: Topic file references for lesson updates
- NEVER/ALWAYS rules: Updated throughout
- Checkpoint schema: phases replaces process
- Line count: 1210 -> 1320

### lessons.md (`/Users/yangyang/Repos/agent-conductor/.context/lessons.md`)
- Converted from 128-line monolith to index file (26 lines) with topic table
- Line count: 128 -> 26

### New topic files (`/Users/yangyang/Repos/agent-conductor/.context/lessons/`)
- `agent-behavior.md` (22 lines)
- `orchestration.md` (47 lines)
- `state-management.md` (47 lines)
- `review-quality.md` (37 lines)
- `skill-design.md` (40 lines)

### Morgan's personality (`/Users/yangyang/Repos/agent-conductor/.claude/agents/morgan-coo.md`)
- Challenge Mode: Updated to "Inline in Planning" with JSON output section
- New: Phase Design section with available phases and rules

### Symlink
- `sw/.context/lessons/` -> `agent-conductor/.context/lessons/`

## Telemetry

(First directive with telemetry protocol -- no telemetry data generated yet. The protocol is defined; next directive execution will produce the first telemetry file.)

## Self-Assessment

### Scope Coverage
- H1 (Telemetry): Protocol defined, schema ready, digest integration done. First real data on next directive.
- H2 (Topic split): Complete. 128 lines split into 5 files, index created, SKILL.md updated, symlink created.
- H3 (Phase lists): Complete. 7 process types eliminated, phase array in schema, unified execution reference.
- M1 (Inline challenge): Complete. Morgan's prompt updated, Step 2b scoped down, personality file updated.
- M4 (Worktree simplification): Complete. Branch-only default, worktree only when dirty.
- User scenario: Complete. Schema, reviewer prompt, plan presentation, Morgan personality all updated.

### Risk Assessment
- All changes are to conductor framework files (SKILL.md, lessons.md, personality files)
- No production code touched
- No user-facing impact
- Symlinks verified working

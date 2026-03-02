# Conductor: Brainstorm Integration + Goal Structure (Option B)

## Context
Brainstorm session (2026-03-03) produced Option B ("Structured Goals") as CEO's chosen direction. CEO also identified that brainstorming should be embedded into the directive flow rather than CEO-invoked — the team brainstorms autonomously based on CEO direction.

**Decision source**: `.context/discussions/goal-structure-redesign-2026-03-03.md`
**CEO chose**: Option B (Structured Goals) — go straight to B, skip A.
**CEO insight**: "As CEO, I just give directions. It's the team's job to brainstorm solutions."

## Deliverables

### 1. Capture Option B Decision
Update the discussion doc with the CEO's decision and reasoning. Mark as decided.

### 2. Rewire /directive — Auto-Trigger Brainstorm for Heavyweight
Modify Morgan's triage in /directive SKILL.md so heavyweight directives auto-trigger C-suite brainstorm:
- Morgan detects heavyweight (strategic, cross-cutting, multiple valid approaches)
- Morgan asks CEO 2-3 clarifying questions (only CEO touchpoint)
- C-suite brainstorms autonomously — parallel research, independent perspectives, synthesis
- Morgan presents recommendation with reasoning
- CEO approves/adjusts, then execution proceeds
- C-suite is sufficient for brainstorm — specialists come in during execution, not brainstorming

### 3. Update /brainstorm Skill
- Note brainstorm is normally auto-triggered by /directive triage for heavyweight work
- Standalone invocation still works for explicit "I want to think through X" moments
- The standalone path is the exception, not the normal workflow
- Update the "How Brainstorm Fits the Conductor Flow" section

### 4. Implement Option B Goal Structure
Based on brainstorm non-negotiables:
- Design `goal.json` schema per goal folder (lifecycle state, metadata, links to children)
- Goal lifecycle states: exploring → active → paused → done
- Feature status tracked in data (goal.json or feature.json), not directory conventions
- Structured backlog format with staleness flags and trigger conditions
- Kill directive-level KRs — DOD is sufficient for execution acceptance
- Goal-level OKRs stay (quarterly strategic goals)
- Every directive must reference a goal
- Update state indexer (`scripts/index-state.ts`) to read new structure

# Directive Report: Conductor /batch + HTTP Hooks Adoption

**Date**: 2026-03-02
**Directive**: conductor-batch-hooks-adoption
**Source**: Scout 2026-03-02, proposed by Morgan

## Summary

Comprehensive research on Claude Code native primitives (HTTP hooks, /batch, agent teams, WorktreeCreate/Remove). Core insight: Claude Code builds the **infrastructure layer** while conductor is the **business logic layer** — complementary, not competitive.

## Key Findings

### HTTP Hooks (17 events, production-ready)
Biggest immediate win. Enables:
- `SessionStart` → load work state from dashboard (solves KR-4: orientation < 2 min)
- `PreCompact` + `SessionEnd` → persist checkpoint state (solves "lossy continuation summaries")
- `PreToolUse` → enforceable guardrails (block prisma migrate, production writes)
- `TaskCompleted` → automated verification gates (type-check before task completion)
- `Notification` → CEO desktop alerts when approval needed

### /batch Command (February 2026)
Convenience wrapper for parallel, independent tasks with automatic worktree isolation. Good for Step 6b (low-risk follow-ups) but NOT for our sequential priority-based initiative execution.

### Agent Teams (Experimental, 13 operations)
Most similar to our conductor but operates at different abstraction level — coordinates Claude Code sessions, not business-level initiatives. Monitor for GA, then evaluate adoption.

### WorktreeCreate/WorktreeRemove Hooks
Could replace manual `git worktree add` in directive Step 4b. Low priority — current approach works, native just makes it cleaner.

## What to KEEP (our unique value)
- C-suite personalities (no native equivalent)
- Directive pipeline (challenge → plan → audit → approve → build → review → digest)
- Risk taxonomy (low/medium/high with auto-execute/approve/backlog)
- Strategic planning and KR decomposition
- Technical audit pre-build
- Scout intelligence / bottom-up proposals
- OKR persistence and lifecycle
- Dashboard operating surface

## What to DELEGATE to Claude Code
- Worktree lifecycle → native `--worktree` + hooks
- Session state persistence → `PreCompact` + `SessionEnd` HTTP hooks
- Guardrail enforcement → `PreToolUse` hooks
- Quality gates → `TaskCompleted` hooks
- Parallel cleanup → `/batch` for independent low-risk tasks

## Recommended Adoption Phases

1. **Phase 1 (This week)**: HTTP hooks for state persistence + guardrails
2. **Phase 2 (Next cycle)**: Worktree standardization via hooks
3. **Phase 3 (After Phase 2)**: Quality gates via TaskCompleted hooks
4. **Phase 4 (When GA)**: Agent teams evaluation for initiative execution
5. **Phase 5 (Nice to have)**: /batch for parallel cleanup

## Status: COMPLETED (Research)
Strategy documented. Phase 1 (HTTP hooks) is the highest-impact next step — directly addresses the work state management problem.

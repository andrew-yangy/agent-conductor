# Directive: Restructure Review Quality in Conductor Pipeline

**Priority**: P0
**Risk**: medium
**Recommended process**: design-then-build
**Goal alignment**: agent-conductor

## Objective

The conductor's review step is not catching real issues. A CEO correction to separate Agent Conductor from Platform was marked "DONE" after repo separation, but the dashboard UI still grouped them together. The review step signed off on it. This is a systemic quality gap.

## Problem Statement

1. **DOD is too coarse.** Directives have no explicit acceptance criteria. Reviewers check "does the code work?" but not "does this satisfy what the CEO actually meant?"
2. **Reviewers don't cross-reference CEO corrections.** Standing principles in memory/preferences get ignored because reviewers don't read them.
3. **No visual verification enforcement.** UI-touching work gets code review but nobody opens the browser to check.
4. **The whole flow needs auditing** — not just the review step. Morgan's planning, the audit, the DOD definition, and the review all contribute to quality gaps.

## Required Changes

### 1. CEO Corrections Checklist in Review
Reviewers must read memory CRITICAL section and `.context/preferences.md` and verify the work doesn't violate any standing principles. Add to reviewer prompt.

### 2. Mandatory Visual Verification for UI Work
If a directive touches UI code, the review step must include browser verification. Not optional, not "if time permits."

### 3. Harsher Review Persona
Sarah's review prompt should explicitly say: find what's MISSING, not just confirm what's there. Check every surface the change touches. The reviewer's job is to be the CEO's last line of defense.

### 4. DOD as Part of Directive Files
Every directive should have explicit acceptance criteria that the reviewer checks against. Morgan should generate DOD during planning. Reviewers verify against DOD, not just "code compiles."

### 5. Full Flow Audit
Review the entire pipeline (SKILL.md) — Morgan's planning, audit step, build instructions, review step — and identify where quality checks are weak or missing. This is end-to-end, not just patching the review.

## Success Criteria

- SKILL.md updated with stronger review requirements
- Reviewer prompts include CEO corrections cross-reference
- DOD generation added to Morgan's planning output
- Visual verification is mandatory (not advisory) for UI work
- Review prompt explicitly instructs harsh, surface-complete checking
- At least one existing directive's review could have caught the Platform grouping bug with these changes

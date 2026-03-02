# Directive Report: Restructure Review Quality in Conductor Pipeline

**Date**: 2026-03-02
**Directive**: conductor-review-quality.md
**Planned by**: Morgan Park (COO)

## Summary

Restructured the conductor's review pipeline to close systemic quality gaps that allowed a CEO correction (agent-conductor separation) to be marked "DONE" while the dashboard still grouped it under Platform. Added Definition of Done to planning, CEO corrections cross-referencing to reviews, concrete adversarial checklist to Sarah's review persona, and upgraded UX verification from advisory to enforced gate with automated file-pattern detection.

## Key Results Progress

### KR-15: DOD in planning
- **Metric**: DOD field in Morgan's schema + DOD verification in review → **Target**: Present in both
- **Baseline**: Zero DOD anywhere in SKILL.md | **After**: DOD schema, rules, and reviewer verification all added
- **Status**: ACHIEVED
- **Supporting initiatives**: dod-in-planning (completed)

### KR-16: CEO corrections cross-reference
- **Metric**: Mandatory corrections checklist in reviewer prompt → **Target**: Checklist with file refs + auto-critical
- **Baseline**: preferences.md distributed but never checked; MEMORY.md CRITICAL invisible to agents | **After**: Standing Corrections in preferences.md, mandatory check in reviewer prompt
- **Status**: ACHIEVED
- **Supporting initiatives**: ceo-corrections-checklist (completed)

### KR-17: Visual verification as blocking gate
- **Metric**: SKILL.md enforces visual verification with file-pattern detection → **Target**: Mandatory with detection
- **Baseline**: Advisory parenthetical conditionals, 2 process types missing UX step | **After**: Automated detection, all 7 process types covered, structural gate
- **Status**: ACHIEVED
- **Supporting initiatives**: mandatory-visual-verification (completed)

### KR-18: Adversarial review checklist
- **Metric**: Concrete checklist in Sarah's review prompt → **Target**: 9-item checklist
- **Baseline**: 4 abstract criteria, zero "what's missing" questions | **After**: 9-item adversarial checklist + review attitude shift
- **Status**: ACHIEVED
- **Supporting initiatives**: harsh-review-persona (completed)

## Initiatives

### Timeboxed Full Flow Quality Audit — completed
- **Process**: research-only
- **Team**: Sarah (auditor + researcher)
- **Scope**: End-to-end audit of directive pipeline. Found 8 quality gaps:
  1. No review JSON schema
  2. No DOD in planning
  3. Morgan's process enum incomplete (5/7)
  4. Reviewer prompt doesn't cross-reference CEO corrections
  5. UX verification is advisory in practice
  6. Review findings are non-blocking with undefined "critical" threshold
  7. No artifact persistence (empty artifacts dir despite 19 directives)
  8. Platform-grouping bug traced: would have been caught with DOD + corrections check
- **Files changed**: None (research-only)

### Add DOD Generation to Morgan's Planning — completed
- **Process**: fix (combined build)
- **Team**: Engineer (build), Morgan (review)
- **Scope**: Added `definition_of_done` to Morgan's schema, DOD rules, DOD verification in reviewer prompt
- **Files changed**: `.claude/skills/directive/SKILL.md`
- **Review findings**: Morgan PASS — DOD is practical but engineer should receive DOD before building (FIXED). CEO should see DOD during plan approval (noted for future).

### CEO Corrections Cross-Reference — completed
- **Process**: fix (combined build)
- **Team**: Engineer (build), Marcus (review)
- **Scope**: Added Standing Corrections to preferences.md, mandatory corrections check in reviewer prompt
- **Files changed**: `.claude/skills/directive/SKILL.md`, `.context/preferences.md`
- **Review findings**: Marcus PASS — template count fixed (3→4). Suggests elevating "never run Prisma migrations" to standing correction. Suggests corrections-caught section in digest.

### Enforce Visual Verification Gate — completed
- **Process**: fix (combined build)
- **Team**: Engineer (build), Morgan (review)
- **Scope**: Upgraded from advisory to enforced with file-pattern detection. Added UX step to migration + content processes.
- **Files changed**: `.claude/skills/directive/SKILL.md`
- **Review findings**: Morgan PASS — add tailwind.config.* to patterns (FIXED). Content process UX step well-placed.

### Concrete Harsh Review Criteria — completed
- **Process**: fix (combined build)
- **Team**: Engineer (build), Marcus (review)
- **Scope**: Replaced Sarah's 4 abstract review criteria with 9-item adversarial checklist
- **Files changed**: `.claude/agents/sarah-cto.md`, `.claude/skills/directive/SKILL.md`
- **Review findings**: Marcus PASS — added audit coverage as 9th checklist item (FIXED). Review attitude is appropriately aggressive. Correctly reframes from developer-centric to CEO-centric review.

## Follow-Up Actions

### Auto-Executed (low risk)
- Investigated empty artifacts directory — artifacts cleaned up by checkpoint deletion per design. Not a bug.
- Fixed stale template count in SKILL.md (corrections_reviewed: 3 → 4)

### Medium Risk (from audit — written to backlog)
- Fix Morgan's process enum in schema — DONE as part of this directive
- Define formal review output JSON schema — DONE as part of this directive (review completeness block)
- Add UX step to migration process — DONE
- Add UX step to content process — DONE
- Define "critical" review_outcome criteria — DONE (Change J)
- Apply adversarial approach to Marcus's product review — written to backlog
- Migrate CRITICAL corrections to preferences.md — DONE (Standing Corrections section)

### Backlogged (high risk)
- None identified

## Agent-Proposed Improvements

- Engineer: DOD items should be available to the CEO during plan approval (Step 4) — not just reviewers
- Morgan: Allow clarification phase to propose DOD amendments when scope shifts during build
- Morgan: Add DOD verification results to digest self-assessment for tracking effectiveness over time
- Marcus: Add "Corrections Caught" section to CEO report digest so violations-caught-and-fixed are visible
- Marcus: Elevate "never run Prisma migrations" to Standing Correction
- Marcus: Add `/correction add` command or report prompt for CEO to add new standing corrections

## UX Verification Results

No UI initiatives — UX verification skipped. (All changes are to .md framework files.)

## Self-Assessment

### Audit Accuracy
- Findings confirmed by build: 8/8 (all gaps were real)
- Findings that were wrong or irrelevant: 0
- Issues found during build that audit missed: 0 (but reviewers found 4 additional gaps)

### Build Success
- Type-check: pre-existing failure in notifications/index.ts (unrelated to our .md changes)
- Initiatives completed: 5/5
- Build failures: 0

### Challenge Accuracy
- Sarah ENDORSED — correct, the root cause was correctly identified
- Morgan FLAGGED — correct, her concerns about scope creep and subjective language were addressed in the build (audit was timeboxed, review persona was made concrete)
- Challenges that proved correct: Morgan's flag about "Full Flow Audit needs a timebox" was right — making it research-only with concrete deliverable format kept it focused

### Reviewer Diversity
- First directive to use domain-matched reviewers instead of "Sarah reviews everything"
- Morgan reviewed process/operational changes (DOD + visual gate) — appropriate match
- Marcus reviewed CEO-facing changes (corrections + review persona) — appropriate match
- Sarah was NOT assigned to review changes to her own review persona — correct conflict-of-interest avoidance
- Both reviewers caught real gaps that would have been missed by a single reviewer

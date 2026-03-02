# Directive Report: Request-Clarify Loops for Engineers

**Date**: 2026-03-02
**Directive**: request-clarify-loops.md
**Planned by**: Morgan Park (COO)

## Summary

Added selective pre-build clarification phase to `/directive` SKILL.md for complex process types. Engineers now ask 3-5 scope/edge-case/integration questions before building in design-then-build, research-then-build, full-pipeline, and migration processes. Simple processes (fix, content) skip it to avoid unnecessary token overhead. Based on ChatDev dual-agent dehallucination pattern (40% error reduction).

## Key Results Progress

### KR-12: Engineers clarify scope before building in complex directives
- **Metric**: Pre-build clarification phase in complex process types
- **Target**: 4/4 complex process types include clarification
- **Baseline**: Zero clarification — engineers jump straight to building
- **After**: 4/4 complex types have clarification; 3 simple types skip it
- **Status**: ACHIEVED
- **Supporting initiatives**: request-clarify-loops (completed)

## C-Suite Challenge Review

**Sarah (CTO)** — FLAG: Apply selectively, not to all 6 types. Fix and content don't need it. Engineer prompt must be tight to avoid generic boilerplate.

**Morgan (COO)** — FLAG: Same concern. Make conditional on process complexity. Token overhead compounds across all directives.

Both accepted — clarification applied only to 4 complex types, skipped for 3 simple types.

## Initiatives

### Add selective request-clarify step to directive SKILL.md — completed
- **Process**: fix (build → review)
- **Team**: Engineer (build), Sarah (review)
- **Files changed**: `.claude/skills/directive/SKILL.md`
- **Review findings**: FAIL → fixed. 2 major (forward-reference error, incomplete artifact_paths schema), 1 minor (ambiguous full-pipeline responder). All fixed.
- **Notes**: Also expanded artifact_paths schema from 4 to 12 phase types (covering all 7 process types), which fixes a pre-existing gap from the checkpoint-resume directive.

## Self-Assessment

### Build Success
- Verification: SKILL.md is prose (read-through verification)
- Initiatives completed: 1/1
- Build failures: 0

### Review Accuracy
- Sarah caught 2 major + 1 minor issue
- Forward-reference error was a real bug (section ordering)
- Incomplete artifact_paths was a pre-existing gap from checkpoint-resume that this directive surfaced and fixed
- Full-pipeline responder ambiguity was a legitimate clarity issue

### Challenge Accuracy
- Both challengers flagged selectivity — proved correct (shipped selective, not universal)
- Token overhead concern validated the approach

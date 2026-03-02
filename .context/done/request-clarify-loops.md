# Directive: Request-Clarify Loops for Engineers

## Objective

Add a request-clarify round before the build phase in `/directive` SKILL.md. Currently engineers jump straight to building from audit findings, which leads to hallucination errors when they misunderstand scope. Stolen from ChatDev's dual-agent dehallucination pattern — adding one request-clarify round before building reduces hallucination errors 40%.

## Scope

Modify `.claude/skills/directive/SKILL.md` to add a pre-build clarification step for all process types that include a build phase (fix, design-then-build, research-then-build, full-pipeline, migration, content). The engineer reviews the audit findings + scope + design (if available) and asks clarifying questions. The auditor or designer responds. Then the engineer builds.

## Success Criteria

- All 6 build-capable process types include a request-clarify step before building
- The clarification is ONE round only (not a dialogue loop) — engineer asks, auditor responds, then build
- Checkpoint writes cover the new phase
- Minimal token overhead — the clarification should be lightweight (no full re-audit)

## Background

Source: ChatDev dual-agent dehallucination research. Backlog item from optimize-conductor-workflows directive (2026-03-01). Priority P1.

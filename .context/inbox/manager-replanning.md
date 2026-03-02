<!-- foreman:skip -->
# Directive: Manager Re-Planning Mid-Directive
**Status**: deferred

## Objective

Add the ability for Morgan to re-plan mid-directive when the audit or build phase reveals the original plan is fundamentally wrong. Currently Morgan plans once upfront and the plan is fixed — if the audit discovers the scope is wrong, there's no mechanism to re-plan without restarting the entire directive. Stolen from CrewAI's hierarchical process pattern.

## Scope

Modify `.claude/skills/directive/SKILL.md` to add conditional re-planning triggers:

1. **After audit phase (if we had one)**: Currently the simplified SKILL.md doesn't have a separate audit step, but if a build or design phase reveals the plan is wrong, the orchestrator should be able to re-invoke Morgan.

2. **After a critical review**: If a reviewer returns `review_outcome: "critical"` AND the issue is a fundamental scope problem (not just a code bug), escalate to Morgan for re-planning instead of just retrying the build.

3. **Re-planning mechanism**: Morgan receives the original plan + the contradicting evidence (audit findings, review results, build failures) and produces a revised plan. The revised plan replaces the original, and execution continues from the revised point.

## Success Criteria

- SKILL.md includes a re-planning trigger after critical review outcomes where the reviewer flags a scope problem
- Morgan re-planning produces a revised plan that replaces only the remaining initiatives (completed work is preserved)
- Max 1 re-plan per directive (circuit breaker to prevent infinite loops)
- Checkpoint tracks re-planning state
- Lightweight — this is a failsafe, not a routine step

## Background

Source: CrewAI hierarchical process. Backlog item from optimize-conductor-workflows directive (2026-03-01). Priority P1.

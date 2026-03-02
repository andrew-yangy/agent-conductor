# Directive: Episodic Memory Consolidation

## Objective

After 17 completed directives, extract cross-directive patterns from lessons.md and directive reports, then consolidate into generalized rules that update agent personality files. This is how agents genuinely improve over time — not from individual lessons, but from patterns that emerge across many episodes. Stolen from MemRL (2026).

## Scope

1. Read all 17 directive reports in `.context/reports/` and both lessons files (`.context/lessons.md`, `.context/lessons.md`)
2. Extract patterns that appear across 3+ directives (not one-off events)
3. Categorize patterns by agent: which lessons apply to Sarah's domain? Morgan's? Marcus's? Priya's?
4. Update agent personality files (`.claude/agents/*.md`) with learned patterns — add a "Learned from Experience" section
5. Add a `/consolidate` instruction or Step 6c to SKILL.md that triggers consolidation periodically

## Success Criteria

- Each agent personality file has a "Learned from Experience" section with patterns relevant to their domain
- Patterns are derived from actual directive history (citations to specific directives)
- SKILL.md has a consolidation trigger (e.g., "after every 10th directive, run consolidation")
- Consolidation doesn't bloat personality files — each agent gets 3-8 concise learned patterns

## Background

Source: MemRL (2026) framework. Backlog item from optimize-conductor-workflows directive (2026-03-01). Priority P1. Trigger condition met: 17 directive reports exist (threshold was 10).

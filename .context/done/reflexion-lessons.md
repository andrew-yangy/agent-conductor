# Directive: Verbal Self-Reflection Format for Lessons

## Objective

Upgrade the lessons format in `.context/lessons.md` and `.context/lessons.md` from flat facts to Reflexion-style verbal self-reflection. Current lessons are one-liner facts ("X works this way"). Reflexion format stores WHY things failed and what to try next: `[tried] → [why failed] → [next approach]`. Per Reflexion framework research: 22% improvement on sequential decisions.

## Scope

1. Define a new lesson format template in SKILL.md's Step 6d (Update Lessons)
2. Migrate existing conductor/lessons.md entries to Reflexion format where applicable (not all lessons are from failures — some are just patterns/facts that stay as-is)
3. Update the lesson-writing instructions so future directive runs produce Reflexion-format lessons

## Success Criteria

- SKILL.md Step 6d has explicit Reflexion format template
- conductor/lessons.md entries that describe failures/surprises are upgraded to [tried → failed → next approach] format
- Entries that are just stable patterns/facts remain as flat facts (not everything needs the full format)
- Future agents know to write new lessons in Reflexion format when the lesson came from a failure

## Background

Source: Reflexion framework research. Backlog item from optimize-conductor-workflows directive (2026-03-01). Priority P1. Trigger: "When lessons.md exceeds 300 lines OR lessons start repeating." Current conductor/lessons.md is ~91 lines, project lessons.md is ~323 lines — project lessons.md has exceeded the threshold.

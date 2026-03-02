# Lessons: Review Quality

> How reviews work, what makes them effective, common review pitfalls.
> Relevant to: Sarah (review), Marcus (product review), Morgan (process review)

## Reviewer Effectiveness

- **Domain-matched reviewers catch more than single-reviewer defaults.** Morgan reviewing process changes and Marcus reviewing CEO-facing changes both found gaps that a single Sarah review would have missed (DOD not in engineer prompt, stale template count, missing audit coverage checklist item). Match reviewer to what's being changed.
- **Never assign an agent to review changes to its own behavior.** Sarah reviewing changes to Sarah's review persona is a conflict of interest — the exact blind spot the review is supposed to catch. Same applies to Morgan reviewing changes to Morgan's planning.
- **Standing Corrections must be in a distributable file, not session memory.** MEMORY.md CRITICAL section was completely invisible to spawned agents (session-scoped). Moving corrections to preferences.md (which all agents receive) made them enforceable.
- **DOD must flow to both builder AND reviewer.** Initially only the reviewer received DOD items — the engineer was building blind to acceptance criteria. Include definition_of_done in the engineer's spawn prompt so they know what "done" looks like before starting.

## Build Regressions

- **Engineers remove existing sections when adding new ones nearby.** When an engineer adds a new section to a template file (e.g., report SKILL.md), they may accidentally delete adjacent sections. The Autopilot section was entirely removed while adding Corrections Caught. Multi-reviewer caught it — single-reviewer likely wouldn't have. Always diff the full file after edits to template files, not just the new additions.

## Risk Classification

- **When in doubt, classify UP.** A misclassified low-risk action that breaks something erodes trust faster than a medium-risk action that got CEO approval.
- **Guardrail violations are automatically high risk.** Any action that would violate a guardrail in `vision.md` requires CEO sign-off regardless of how "simple" it seems.
- **Dead code deletion is genuinely low risk.** If the auditor confirms files are dead (no imports, no route usage), deleting them is safe to auto-execute.

## Incomplete "Done" Items

- **"Done" in the backlog != actually wired in.** The Chief of Staff pattern was marked Done: alex-cos.md created, lessons documented, SKILL.md footnote added. But the `/directive` skill was never modified to actually SPAWN Alex. The pieces existed but the integration point was missing. Root cause: the backlog checked off deliverables (files created) without checking the user-facing behavior (does `/directive` actually delegate?). Fix: DOD for integration work must include "invoke the feature and verify end-to-end" — not just "files exist."
- **Backlog items should have a "verify" step.** Like the verify command for code (`npm run type-check`), process changes need a verification action: "Run `/directive test` and confirm Alex is spawned, CEO session stays clean." Without this, reviewers check the files but not the flow.

## Verify artifact_paths

- **Verify artifact_paths schema covers all process types.** The checkpoint-resume directive created artifact_paths with only 4 keys, but 7 process types produce 12 distinct artifact files. Sarah's review caught this during request-clarify-loops — always expand schema examples to match all known variants.

# Backlog: Conductor Review Quality
<!-- last-reviewed: 2026-03-02 -->

## Done

### DOD in Planning ✅ Done (2026-03-02)
- Added `definition_of_done` field to Morgan's initiative schema
- Added DOD rules to Morgan's prompt
- Added DOD verification block to reviewer prompt
- Engineers receive DOD items before building

### CEO Corrections Cross-Reference ✅ Done (2026-03-02)
- Added Standing Corrections section to preferences.md
- Added mandatory corrections check to reviewer prompt
- Violations are automatically review_outcome: "critical"

### Mandatory Visual Verification Gate ✅ Done (2026-03-02)
- Upgraded from advisory to enforced with file-pattern detection
- Added UX step to migration + content processes
- Added tailwind.config.* to detection patterns

### Concrete Adversarial Review Checklist ✅ Done (2026-03-02)
- Replaced 4 abstract criteria with 9-item mandatory checklist
- Added Review Attitude section
- Added audit coverage as checklist item (from Marcus review)

### Multi-reviewer casting system ✅ Done (2026-03-02)
- Changed cast.reviewer to cast.reviewers (array) across all schemas and 7 process types
- Added reviewer-type definitions (Sarah/Marcus/Morgan/Priya domains)
- Added multi-reviewer casting guidance (UI→Marcus, process→Morgan, etc.)
- Updated morgan-coo.md with multi-reviewer casting rules

### DOD in CEO plan approval (Step 4) ✅ Done (2026-03-02)
- Step 4 now shows DOD items per initiative in approval template
- Added DOD review guidance for CEO (flag vague, misaligned, incomplete)

### Corrections-caught section in CEO report ✅ Done (2026-03-02)
- Added Corrections Caught section to directive digest (Step 6c)
- Added Corrections Caught section to daily report template
- Added Corrections Caught section + per-agent stats to weekly report template

## Future Ideas
- DOD amendments during clarification phase (when scope shifts)
- DOD effectiveness tracking (pass/fail rates over time in digest self-assessment)
- `/correction add` command for CEO to add new standing corrections from report workflow
- Elevate "never run Prisma migrations" to Standing Correction (Marcus suggestion)

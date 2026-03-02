# Build: Kill Directive-Level KRs

## Changes to /Users/yangyang/Repos/agent-conductor/.claude/skills/directive/SKILL.md

1. **Morgan's instructions**: Removed "Identify 2-5 Key Results" step, replaced with "Define initiatives" + "Define DOD"
2. **Morgan's JSON schema**: Removed `key_results` array and `key_result_id` from initiatives. `definition_of_done` retained as primary acceptance gate.
3. **KEY RESULT RULES**: Replaced with DEFINITION OF DONE RULES (5 concrete rules with good/bad examples)
4. **Step 4 presentation**: Changed from "grouped by Key Result" to "grouped by priority" (P0/P1/P2)
5. **Step 6**: Replaced 30-line "Persist Key Results" with 3-line "Update Goal OKRs (if applicable)" — only updates existing okrs.md, never creates new KRs
6. **Digest template**: Replaced "Key Results Progress" with "Definition of Done Assessment" (MET/NOT MET checklist)
7. **Minor refs**: Updated 3 other KR references to DOD/OKR language

## Verification
- `grep key_result` → 0 matches (clean)
- `grep -c "definition_of_done|DOD"` → 23 matches
- Goal-level OKR references (okrs.md) correctly preserved
- Challenges, phases, casting, review mechanics all intact

## What's preserved
- Goal-level OKRs (okrs.md) — still referenced, not created from directives
- DOD at initiative level — already existed, now elevated as primary gate
- All review mechanics, checkpoint schema, challenge system

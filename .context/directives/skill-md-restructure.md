# Restructure directive SKILL.md into routing map + modular docs

## Problem

The directive SKILL.md is 1389 lines / 75KB — a monolith that fills agent context windows. This is the anti-pattern OpenAI's harness engineering article warns against. Every other harness engineering initiative (constraint checker, correction pipeline, progressive disclosure) depends on SKILL.md being navigable and modular.

## What We Want

Split SKILL.md into a ~120-line routing map + modular docs. The routing map is what agents load; they pull in step docs on-demand.

- Routing map: step ID, one-line purpose, file path, conditional logic
- Pipeline docs (`docs/pipeline/*.md`): one file per step or logical step-group
- Reference docs (`docs/reference/*.md`): schemas (Morgan plan JSON, reviewer JSON, checkpoint JSON), templates (digest, approval), rules (ALWAYS rules, failure handling)
- Update Alex spawn prompt to reference routing map instead of inlining full SKILL.md

## Scope OUT

- Changing pipeline logic or step ordering
- Adding new steps or features
- Modifying agent personality files
- Dashboard changes

## Success Criteria

1. SKILL.md is <150 lines and contains only routing logic + file references
2. Every step from the original SKILL.md exists in exactly one docs/pipeline/*.md file
3. All JSON schemas, templates, and rules are in docs/reference/*.md files
4. A directive can be executed end-to-end using the new structure (manual smoke test)
5. No content is lost — diff of concatenated new files vs original SKILL.md shows only structural changes
6. Alex spawn prompt references routing map, not inlined SKILL.md

## Verification

- `wc -l` on SKILL.md shows <150 lines
- `ls docs/pipeline/` shows files covering all steps (0 through 7 + failure handling)
- `ls docs/reference/` shows schema, template, and rules files
- `grep` for every `## Step` heading from original — each must appear in exactly one pipeline doc

## Notes

- This is a pure restructure — NO logic changes, NO new features
- The original SKILL.md content must be preserved exactly, just reorganized
- All work happens in `.claude/skills/directive/` within agent-conductor

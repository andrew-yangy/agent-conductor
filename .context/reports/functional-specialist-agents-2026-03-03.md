# Directive Report: Make Specialist Agents Functional

**Date:** 2026-03-03
**Directive:** functional-specialist-agents
**Classification:** Heavyweight
**Status:** Completed

## TL;DR

Made the 5 specialist agents (Riley/Frontend, Jordan/Backend, Casey/Data, Taylor/Content, Sam/QA) functional in the directive pipeline. When Morgan casts a directive, she can now assign a specialist with domain-specific prompt context instead of a generic "engineer". The session scanner recognizes specialist names, and the org page will show their sessions automatically.

## Changes

### Initiative 3: Session Scanner (simple)
- Added 5 specialist entries to `KNOWN_AGENTS` in `server/parsers/session-scanner.ts`
- Role strings match existing `agent-config.ts` entries

### Initiative 1: Prompt Templates (moderate)
- Created 5 specialist template files in `.claude/agents/`:
  - `riley-frontend.md` -- React 19, Tailwind v4, shadcn/ui, Zustand patterns
  - `jordan-backend.md` -- Node.js HTTP server, WebSocket, chokidar, aggregator patterns
  - `casey-data.md` -- JSONL parsing, state machine, indexer, `.context/` structure
  - `taylor-content.md` -- Markdown conventions, `.context/` directory tree, JSON schemas
  - `sam-qa.md` -- TypeScript project references, build verification, type sync checks
- All templates contain REAL patterns extracted from codebase audit (not generic advice)
- All follow "You are {Name} {LastName}, {Role}" pattern for scanner compatibility
- YAML frontmatter consistent with existing C-suite agent files

### Initiative 2: SKILL.md Updates (moderate)
- Updated Morgan's cast schema: `builder` field now accepts `riley | jordan | casey | taylor | sam` alongside `engineer`
- Added SPECIALIST BUILDER ASSIGNMENT rules with file-pattern matching guidance
- Added specialist agent spawn rules in Step 5: load template from `.claude/agents/{name}-{domain}.md`, prepend to task prompt
- Backward compatible: `"builder": "engineer"` still works with no template loaded

## Metrics

- 5 new files created (specialist templates)
- 1 server file modified (session-scanner.ts -- 5 new entries)
- 1 SKILL.md updated (3 sections: cast schema, casting rules, spawn rules)
- Type-check: PASS
- Build: PASS

## Follow-ups

None required -- all three initiatives completed as planned.

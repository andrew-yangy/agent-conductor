# Alex Memory

## Project Structure
- Frontend: Vite + React + shadcn/ui, builds to `dist/`, served by Hono server
- Server: `server/index.ts` (Hono), state in `server/state/aggregator.ts`
- Session parsing: `server/parsers/session-state.ts` (state machine), `server/parsers/session-scanner.ts` (prompt extraction)
- Type defs: `server/types.ts` (server), `src/stores/types.ts` (frontend), `server/state/work-item-types.ts` (Zod schemas) -- keep all three in sync
- Build: `npx vite build` for frontend, `npx tsc --noEmit` for type-check (never use `npm run lint`, it OOMs)
- Data pipeline (post glob-reads migration): source files (.context/) -> StateWatcher (direct reads) -> aggregator -> WebSocket -> dashboard
- ContextWatcher is dead code (still on disk but not imported) -- StateWatcher replaced it

## Context Tree Paths (Current)
- Goals: `.context/goals/*/goal.json`
- Projects: `.context/goals/*/projects/*/project.json` (tasks embedded)
- Backlogs: `.context/goals/*/backlog.json` (JSON array, not markdown)
- Directives: `.context/directives/*.json` (flat, status in JSON) + optional `.md` brief
- Reports: `.context/reports/*.md`
- Intel: `.context/intel/` (was conductor/intelligence/)
- Lessons: `.context/lessons/*.md` (was lessons.md single file)

## Key Patterns
- Session data flows: JSONL files -> session-state.ts (bootstrap/incremental) -> aggregator.ts -> WebSocket -> dashboard store -> components
- Subagent files: `~/.claude/projects/{dir}/{uuid}/subagents/agent-{agentId}.jsonl`
- Agent identity: detected from initial prompt patterns ("You are {Name}"), stored in `agentName`/`agentRole` on Session
- Known agents: Alex, Sarah, Morgan, Marcus, Priya -- each has a color in the frontend
- "Feature" type kept in code (FeatureRecord) but maps to project.json -- renamed deferred to avoid cascading 86+ occurrences

## Execution Notes
- Medium directives: Skip Morgan planning if scope is clear, audit codebase directly, build, verify
- Always run both `npx tsc --noEmit` AND `npx vite build` to verify changes
- Dashboard changes are low-risk (no production impact) -- safe playground
- Cannot spawn subagents from within Claude Code session -- execute directly when Agent tool unavailable

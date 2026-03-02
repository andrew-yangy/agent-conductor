# Alex Memory

## Project Structure
- Frontend: Vite + React + shadcn/ui, builds to `dist/`, served by Hono server
- Server: `server/index.ts` (Hono), state in `server/state/aggregator.ts`
- Session parsing: `server/parsers/session-state.ts` (state machine), `server/parsers/session-scanner.ts` (prompt extraction)
- Type defs: `server/types.ts` (server), `src/stores/types.ts` (frontend) -- keep in sync
- Build: `npx vite build` for frontend, `npx tsc --noEmit` for type-check (never use `npm run lint`, it OOMs)

## Key Patterns
- Session data flows: JSONL files -> session-state.ts (bootstrap/incremental) -> aggregator.ts -> WebSocket -> dashboard store -> components
- Subagent files: `~/.claude/projects/{dir}/{uuid}/subagents/agent-{agentId}.jsonl`
- Agent identity: detected from initial prompt patterns ("You are {Name}"), stored in `agentName`/`agentRole` on Session
- Known agents: Alex, Sarah, Morgan, Marcus, Priya -- each has a color in the frontend

## Execution Notes
- Medium directives: Skip Morgan planning if scope is clear, audit codebase directly, build, verify
- Always run both `npx tsc --noEmit` AND `npx vite build` to verify changes
- Dashboard changes are low-risk (no production impact) -- safe playground

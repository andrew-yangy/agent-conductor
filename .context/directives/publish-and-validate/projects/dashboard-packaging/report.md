# Build Report: dashboard-packaging

## Summary

All 4 tasks completed successfully. The gru-ai npm package now ships a fully functional dashboard and monitoring server that resolves paths correctly when installed as a dependency in a consumer project.

## Files Changed

### Created
- `server/paths.ts` -- Centralized path resolution (consumerRoot vs packageRoot)
- `src/stores/agent-registry-store.ts` -- Zustand store for runtime agent registry
- `src/components/game/useOfficeAgents.ts` -- Hook deriving AgentDesk[] from registry store

### Modified (server)
- `server/index.ts` -- Added /api/agent-registry endpoint, uses paths.ts for dist/ resolution
- `server/watchers/directive-watcher.ts` -- Uses paths.ts for .context/directives resolution
- `server/parsers/session-scanner.ts` -- Uses loadAgentRegistry() from paths.ts, defensive field access
- `server/state/aggregator.ts` -- Uses consumerRoot from paths.ts, fixed dead teams references
- `server/notifications/notifier.ts` -- Fixed dead teams reference (getStaleTeamSessionIds)
- `server/actions/send-input.ts` -- Removed dead state.teams reference

### Modified (frontend)
- `src/components/game/types.ts` -- Removed static OFFICE_AGENTS, added buildOfficeAgents() and buildAgentCharMap()
- `src/components/game/CanvasOffice.tsx` -- Accepts agents prop, module-level maps moved to mapsRef
- `src/components/game/GamePage.tsx` -- Fetches registry on mount, passes agents to CanvasOffice
- `src/components/game/panels/TeamPanel.tsx` -- Uses useOfficeAgents() hook
- `src/components/game/panels/AgentPanel.tsx` -- Uses useOfficeAgents() hook
- `src/components/game/AgentTicker.tsx` -- Uses useOfficeAgents() hook
- `src/components/game/SidePanel.tsx` -- Removed unused static import

### Modified (CLI)
- `cli/commands/start.ts` -- Added .context/ to isInitialized() check

## Brainstorm Alignment

The implementation closely followed the brainstorm's recommended approach:

- **Followed**: Centralized path resolution in `server/paths.ts` with dual-root pattern (consumerRoot for .context/, packageRoot for dist/). GRUAI_PROJECT_PATH env var bridging CLI to server. Runtime registry loading via Zustand store + /api/agent-registry endpoint. Defensive field access in session-scanner.
- **Deviated**: The brainstorm suggested a `useAgentRegistry()` context provider pattern. Instead used a Zustand store (`agent-registry-store.ts`) which is the established project convention. This is simpler and avoids wrapping the component tree in a provider. Also added a `useOfficeAgents()` hook that multiple components share, reducing duplication versus each component calling buildOfficeAgents() independently.

## Proposed Improvements

1. **bin name mismatch**: The package bin is `gru-ai` (matching npm package name) but the CLI branding says `gruai`. Consider adding a `gruai` alias in the bin field so both work.
2. **Runtime dependency bloat**: 19 runtime deps include UI libraries (radix, lucide-react, react, zustand) that are only needed at build time since the client is pre-built to dist/. These could be moved to devDependencies in a future cleanup, but requires careful testing since the server tsconfig may reference shared types.
3. **Registry schema validation**: The /api/agent-registry endpoint returns raw JSON without schema validation. A Zod schema would catch malformed registries early and return helpful error messages.
4. **Session scope for new projects**: When running from a fresh project directory, the server logs "Project filter directory not found" since there are no Claude sessions yet. This is expected but the log message could be friendlier.

## User Walkthrough

1. Install: `npm install gru-ai`
2. Initialize: `npx gru-ai init` (scaffolds .context/ and .claude/)
3. Start: `npx gru-ai start` (boots server on port 4444)
4. Open `http://localhost:4444` in browser
5. The pixel-art office dashboard loads with agents from `.claude/agent-registry.json`
6. If no registry exists, the server falls back to a bundled default with empty agents
7. If no `.context/` exists, the CLI prints a clear error directing the user to run `gru-ai init`

## Verification Results

- `npx tsc --noEmit`: Clean (0 errors)
- `npx vite build`: Clean (dist/ produced)
- `tsc -p server/tsconfig.json`: Clean (dist-server/ produced)
- `tsc -p cli/tsconfig.json`: Clean (dist-cli/ produced)
- `npm pack`: 215 files, 2.4 MB tarball
- Tarball install + `gru-ai start`: Server boots, all endpoints return HTTP 200
- Agent registry endpoint: Returns 12 agents from consumer's .claude/agent-registry.json
- Static assets (HTML, JS, CSS): All served correctly from dist/
- No devDependencies leaked into runtime

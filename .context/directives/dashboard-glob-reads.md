# Dashboard Glob Reads — Rewrite Server for New Context Tree

After the context tree migration, the dashboard server still reads from deleted/renamed paths (state/, inbox/, done/, intelligence/, lessons.md, backlog.md, features/active/done/). Rewrite ALL server, script, MCP, and frontend code to glob source files directly from the new structure. Kill the indexer (index-state.ts) -- dashboard reads goal.json, project.json, directive.json, backlog.json directly.

**Goal alignment**: ui

## Scope

### In Scope
- server watchers (state-watcher, context-watcher, goal-watcher)
- server/index.ts endpoints (foreman findInboxWork, findBacklogWork)
- MCP server tools (paths.ts, status.ts, backlog.ts, directive.ts)
- scripts (foreman.ts, intelligence-trends.ts, index-state.ts)
- CLI scaffolding
- frontend API fetchers and types
- work-item-types.ts

### Out of Scope
- SKILL.md files (already updated)
- agent .md files (already updated)
- sw consumer repo migration

## Success Criteria
- Dashboard loads and renders all 3 pages (dashboard, projects, insights) with real data from .context/
- Zero references to state/, inbox/, done/, intelligence/, backlog.md, features/ in server/, scripts/, mcp-server/
- MCP tools (status, backlog, directive) return correct data from new paths
- Foreman scheduler can find and launch directives from directives/ directory

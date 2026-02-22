# Agent Conductor

A real-time dashboard for monitoring and managing [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agent teams. See what every agent is doing, approve prompts from the browser, and get notified when agents need attention.

![Dashboard](https://img.shields.io/badge/status-alpha-orange) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue) ![React](https://img.shields.io/badge/React-19-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Why

When running Claude Code agent teams (`/team-build`), you end up with multiple agents working in parallel across tmux panes. Switching between panes to check status, approve prompts, and track progress is tedious. Agent Conductor gives you a single dashboard to see everything at once.

## Features

- **Session discovery** — automatically finds all Claude Code sessions by scanning `~/.claude/projects/` JSONL files. No configuration needed.
- **Live activity** — see what each agent is doing in real-time (editing files, running commands, thinking)
- **Session tree** — sessions grouped by project, with subagents nested under their parent
- **Team monitoring** — track team members, task progress, and agent status
- **Send input** — approve/reject prompts and send text to agents directly from the dashboard
- **Stale team cleanup** — delete old teams and task lists with one click
- **macOS notifications** — native alerts when agents need attention (even when the browser is minimized)

## Quick Start

```bash
git clone https://github.com/andrew-yangy/agent-conductor.git
cd agent-conductor
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The server runs on port 4444.

That's it. Agent Conductor automatically discovers your Claude Code sessions from `~/.claude/`.

## How It Works

Agent Conductor watches the Claude Code data directory (`~/.claude/`) for changes:

```
~/.claude/
  projects/           # Session JSONL logs (primary data source)
    {project}/
      {session}.jsonl  # Each Claude Code session
      {session}/subagents/agent-*.jsonl
  teams/              # Team configs (from /team-build)
  tasks/              # Task lists
```

**Architecture:**

```
JSONL files ──> File watchers (chokidar) ──> Aggregator ──> WebSocket ──> React dashboard
                                                  ↑
                                            Hook events (optional enrichment)
```

- **Sessions** are discovered by scanning JSONL files on disk. Active sessions (file modified < 30s ago) get their metadata extracted via tail-read (last 8KB only — safe for large files).
- **Activity** is parsed from the last JSONL entries — which tool is running, what file is being edited.
- **Teams** are read from `~/.claude/teams/*/config.json`.
- **Hook events** (if configured) enrich session status with waiting/error states.

## Configuration

Config lives at `~/.conductor/config.json` (auto-created on first run):

```json
{
  "claudeHome": "~/.claude",
  "server": { "port": 4444 },
  "notifications": {
    "macOS": true,
    "browser": true
  }
}
```

### Optional: Claude Code hooks

For richer status detection (waiting for approval, errors), add hooks to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "stop": ["bash", "-c", "curl -s -X POST http://localhost:4444/api/events -H 'Content-Type: application/json' -d '{\"type\":\"stop\",\"sessionId\":\"'$SESSION_ID'\",\"project\":\"'$PROJECT'\"}'"],
    "notification": ["bash", "-c", "curl -s -X POST http://localhost:4444/api/events -H 'Content-Type: application/json' -d '{\"type\":\"'$TYPE'\",\"sessionId\":\"'$SESSION_ID'\",\"project\":\"'$PROJECT'\",\"message\":\"'$MESSAGE'\"}'"]
  }
}
```

Hooks are optional — session discovery works without them via filesystem scanning.

## Tech Stack

- **Server**: Node.js with raw `http.createServer` + `ws` WebSocket + SQLite (better-sqlite3) + chokidar file watching
- **Frontend**: React 19 + Vite + Zustand + Tailwind v4 + shadcn/ui + Radix primitives
- **Zero external services** — everything runs locally, reads from `~/.claude/`

## Scripts

```bash
npm run dev          # Start server + client (concurrent)
npm run dev:server   # Server only (port 4444)
npm run dev:client   # Vite dev server only
npm run build        # Production build
npm run type-check   # TypeScript check
npm run lint         # ESLint
```

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/state` | Full dashboard state |
| GET | `/api/events` | Recent events |
| POST | `/api/events` | Add hook event |
| POST | `/api/actions/focus-session` | Focus tmux pane |
| POST | `/api/actions/send-input` | Send input to agent |
| DELETE | `/api/teams/:name` | Delete stale team |
| GET | `/api/config` | Get config |
| PATCH | `/api/config` | Update config |
| WS | `ws://localhost:4444` | Real-time updates |

## License

MIT

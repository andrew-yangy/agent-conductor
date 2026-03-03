# Projects page repo grouping + dynamic project discovery

**Goal alignment**: ui

## Background

The Projects page currently renders all goals in a flat list — sw and agent-conductor goals are mixed together with no visual separation. When multiple repos are registered, the CEO can't tell which goals belong to which repo at a glance.

Additionally, the current project registration is hardcoded in `~/.conductor/config.json`. Projects should be discovered dynamically from Claude's own files rather than requiring manual config.

## What needs to happen

### 1. Dynamic project discovery from .claude files

Instead of hardcoding projects in `~/.conductor/config.json`, discover them automatically:
- Read `~/.claude/projects/` — each subdirectory represents a project Claude has worked with
- The directory names encode the repo path (e.g., `-Users-yangyang-Repos-sw` for `/Users/yangyang/Repos/sw`)
- For each discovered project path, check if `.context/` exists — if so, it's a conductor-enabled project
- Fall back to config.json entries if they exist (backward compat), but prefer auto-discovery
- The config.json `projects` array becomes optional — auto-discovery is the default

### 2. Group goals by repo on the Projects page

- Add repo header sections that visually separate goals by their source repository
- Each section shows the repo name and path
- Goals are grouped under their repo header
- The Active Work section at the top can remain cross-repo (it's useful to see all in-progress work together)

## Success criteria

- Projects page shows goals grouped under repo headers (e.g., "Wisely" and "Agent Conductor")
- Server discovers projects automatically from ~/.claude/projects/ without manual config
- Removing a project from config.json doesn't break anything — auto-discovery picks it up
- State-watcher reads from all discovered repos
- Type-check passes

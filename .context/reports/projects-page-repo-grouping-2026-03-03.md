# Projects Page Repo Grouping + Dynamic Discovery

**Directive:** projects-page-repo-grouping
**Date:** 2026-03-03
**Classification:** Medium
**Status:** Completed

## Summary

Replaced hardcoded project config with dynamic discovery from `~/.claude/projects/` and added repo-grouped goal display on the Projects page.

## Changes

### Backend: Dynamic project discovery (`server/config.ts`)
- Added `discoverProjects()` that scans `~/.claude/projects/`, decodes directory names to real filesystem paths using recursive backtracking, checks for `.context/` to filter conductor-enabled repos
- Modified `loadConfig()` to merge discovered projects with `config.json` entries (discovery is primary, config.json provides name overrides and fallback entries)
- Path decoding handles hyphenated directory names correctly (e.g. `agent-conductor` stays as one component, not split into `agent/conductor`)

### Backend: Repo tagging (`server/watchers/state-watcher.ts`)
- Goals, features, and backlog items now carry `repoId` and `repoName` fields from their source project

### Types: Three-way sync
- `server/state/work-item-types.ts` (Zod schemas): added `repoId`/`repoName` to GoalRecord, FeatureRecord, BacklogRecord
- `server/types.ts`: added `source` field to ProjectConfig
- `src/stores/types.ts` (frontend): mirrored `repoId`/`repoName` additions

### Frontend: Repo grouping (`src/components/projects/ProjectsPage.tsx`)
- Goals section now groups by `repoId` with visual repo headers (GitBranch icon + repo name + goal count)
- Headers only appear when multiple repos are present (single-repo setup looks unchanged)
- Active Work section remains cross-repo as specified

## Verification

- `npx tsc --noEmit` passes
- `npx vite build` passes
- Path decoding algorithm tested against all 7 entries in `~/.claude/projects/` -- correctly decoded all valid paths and filtered to 2 conductor-enabled repos

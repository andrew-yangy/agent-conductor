# Lessons: Skill Design & Pipeline

> How the directive pipeline works, common design pitfalls.
> Relevant to: Alex (execution), Morgan (planning)

## Pipeline Rules

- **`npm run lint` OOMs on large projects.** Use `npm run type-check` as the verify command, not lint.
- **Directive filenames must be kebab-case.** Used in git branch names and file paths. Spaces break worktree creation.
- **Follow-ups must be processed BEFORE the digest is written.** The digest template references follow-up results — can't populate those sections until follow-ups are handled.
- **Step ordering in directive: persist KRs -> process follow-ups -> write digest.** Data flows forward: KR status informs follow-up decisions, follow-up results appear in the digest.
- **Worktree isolation is essential for directives.** Without it, `git diff --stat` mixes directive changes with pre-existing uncommitted work.
- **Worktree doesn't include uncommitted files from main.** Files created by previous directives but not yet committed won't exist in the worktree. Copy from main repo before editing. Always verify with `ls` first.

## Repo Separation

- **Symlinks are the right separation mechanism.** Move framework code (skills, agents, conductor context) to the conductor repo, replace originals with symlinks. Consumer-owned state (inbox/, done/, logs) stays local. Relative paths `../../../agent-conductor/...` work because both repos share a parent directory.
- **Dashboard serves from dist/, not vite dev.** The server uses `serveStatic()` from `dist/` directory. Vite HMR only works if you're hitting the vite dev port directly. After any frontend changes, run `npx vite build` to update the served bundle.
- **Chokidar can silently fail with many watchers.** Multiple zombie conductor processes (from old `tsx watch` instances) exhaust macOS FSEvents. The watcher shows `ready: true` but never fires. Fix: restart the server, or better: kill stale processes.
- **Server state loads once at startup.** If state files don't exist when `readAndUpdate()` runs at startup, the API returns null forever (chokidar won't fire because the watcher never detected the initial files). Server restart after generating state files fixes it.

## Foreman / Scheduler

- **Skip markers must be checked in ALL code paths, not just the server.** The standalone `scripts/foreman.ts` was missing skip marker filtering (`<!-- foreman:skip -->`, `DEFERRED`, `**Requires**: manual`) — only the server-side foreman in `server/index.ts` had it. Would have launched deferred directives via launchd. When adding a safety check, grep for every code path that does the same operation.
- **Backlog DEFERRED detection needs explicit check.** The `isDone` heuristic (checks for `~~` or `Done` in heading) misses `DEFERRED` items. Both the standalone and server-side foreman had this gap. Add `line.includes('DEFERRED')` to the isDone check.
- **MCP tools need guardrails too.** `conductor_launch_directive` had no warning when trying to launch a deferred/manual directive. Any interface that can trigger work needs the same safety gates as the automated scheduler.

## What Doesn't Work

- **"Bag of agents" with no coordination.** Research shows 17x error amplification in poorly coordinated groups.
- **Natural language interfaces between agents.** Typed JSON schemas beat freeform dialogue (MetaGPT: 3.75 vs 2.25 executability score).
- **Automatic autonomy adjustment.** Needs more data before the system can self-tune. Manual tuning based on acceptance rates for now.

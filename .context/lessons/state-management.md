# Lessons: State Management

> Checkpoints, state files, worktrees, persistence patterns.
> Relevant to: Alex (execution), Sarah (review), engineers (build)

## Checkpoint-Resume

- **Combine initiatives that modify the same file.** The checkpoint-resume directive had 5 initiatives (audit, schema, writes, resume, cleanup) all targeting SKILL.md. Combining into one build avoided merge conflicts and saved 4 agent round-trips.
- **C-suite challenges catch scope creep early.** Morgan challenged the original scope as over-engineered — recommended half-day build instead of multi-week. Both Sarah and Morgan independently flagged dashboard integration as separate work. The scoped-down version shipped cleanly.
- **In-progress initiatives restart from scratch on resume.** Attempting partial-phase resume (e.g., resume mid-build) adds enormous complexity for marginal benefit. Only completed initiatives are truly skipped. The wasted work (re-running one initiative's phases) is small relative to the complexity savings.
- **Dead schema fields confuse implementers.** Sarah caught that `audit_findings` and `challenges` were in the checkpoint schema but nothing wrote to them. Ghost fields in schemas create false expectations. Only include fields that have writers.

- **Checkpoint files must be updated after EVERY phase, not just planned transitions.** The conductor-brainstorm-goals directive completed 2.5 initiatives before context exhaustion. The checkpoint was still at step-4 (pre-execution state) because updates weren't persisted during the fast-moving build phases. On resume, the orchestrator had to reconstruct state from filesystem evidence (git log, grep for changes, file existence). Fix: treat checkpoint writes as non-negotiable after every phase — the Write tool call is cheap, context reconstruction is expensive.
- **goal.json is the right granularity for goal metadata.** Designed and validated on 16 goals. Key design decision: features in goal.json are metadata only — the filesystem (active/done directories) remains the source of truth for spec/tasks content. This avoids dual-write problems.
- **JSON as single source of truth for structured data eliminates parser sprawl.** The indexer had 5 separate markdown backlog parsers (340 lines) because backlog formats were wildly inconsistent. Migrating to backlog.json eliminated all 5 parsers and removed 9 phantom items caused by parser bugs (double-counting, ghost entries). JSON -> JSON aggregation is inherently more reliable than markdown -> JSON parsing.
- **Migration scripts should run the old parsers one final time.** To migrate backlog.md -> backlog.json, use the existing parsers to produce the initial JSON, then delete the parsers. Don't rewrite the parsing logic — leverage it one last time and throw it away.

## State Indexer & Dashboard

- **Index-then-replace is safer than replace-in-place.** The state indexer READS existing .context/ and produces parallel JSON state files. Originals are untouched. This avoids the "migration breaks everything" risk. Cutover to JSON-first writes happens later, incrementally.
- **DirectiveWatcher was built but never had a writer.** The optimize-conductor-workflows directive reported this as done, but the writer was NOT added to SKILL.md. Checkpoint: always verify writer AND reader exist.
- **Re-index state after every directive.** Dashboard won't show latest work unless the indexer runs. Added as Step 6e in SKILL.md.
- **Review-then-fix is the right cycle.** Spawning Sarah + Marcus as background reviewers while continuing other work, then fixing findings, caught 10 real issues in a single iteration.

## Parsing & Data Integrity

- **Structured data must live in JSON, not markdown.** Backlog.md files used 3+ inconsistent formats (tables, headings, bullets, checklists) requiring 5 separate parsers that still produced phantom items. backlog.json eliminated all parsing and deduplication problems. Lesson: if data will be consumed programmatically, write it as JSON from day one.
- **Feature deduplication is necessary.** Features can exist in both active/ and done/ directories during transition. The indexer derives active/done status from goal.json feature status, not directory membership.
- **Eager state fetch in AppLayout is essential.** Without it, workState is null on dashboard home. Fetch on mount with ref guard to avoid double-fetching, "current ?? fetched" pattern to not overwrite WebSocket data.
- **Context compaction resume works reliably.** Tested 3 times: context window hits limit -> session compacted -> new session starts with continuation summary -> picks up exactly where it left off.
- **Directory-based counts != status-based counts.** `goal.activeFeatures` (from active/ directory) and `goal.doneFeatures` (from done/ directory) don't match feature status. Features can be done but still in active/. Always derive counts from `feature.status`, never from directory membership.
- **Done features with incomplete tasks need 100% bars.** Features marked done but with 0/N tasks show empty bars at 0%. Force `completionPct = 100` when status is 'done'.

## UI Components

- **shadcn Progress component needs indicatorClassName for color variants.** Default Progress only supports one bar color. Add an `indicatorClassName` prop for per-instance color overrides (green for done, yellow for in-progress).
- **Artifact contentSummary contains raw markdown.** The indexer stores the first non-heading line(s) as contentSummary, including `**bold**` markers. Parse `**Key**: Value` patterns with regex into structured key-value grids for clean display.

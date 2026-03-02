# Backlog — Conductor UX

## Rich directive notifications
- **Source**: Walkthrough ceo-runs-directive (2026-03-02)
- **Severity**: Critical
- **Type**: Missing functionality
- **Description**: macOS and browser notifications contain zero directive context — just "Session abc123... in agent-conductor". CEO must context-switch to terminal to learn anything.
- **Fix**: Connect DirectiveWatcher to Notifier. When directive completes, fire notification with directive name, initiative completion count, and Needs CEO Eyes count. E.g. "improve-security: Done — 4/4 initiatives. 1 needs your eyes."
- **Files**: server/notifications/notifier.ts, server/watchers/directive-watcher.ts
- **Effort**: Medium

## ~~Heavyweight plan TL;DR summary~~ ✅ DONE (2026-03-02)
- **Status**: Completed — added CEO Quick Summary TL;DR section to SKILL.md Step 4
- **Report**: conductor/reports/directive-skill-fixes-2026-03-02.md

## Eliminate heavyweight double-spawn
- **Source**: Walkthrough ceo-runs-directive (2026-03-02)
- **Severity**: Major
- **Type**: Slow
- **Description**: Heavyweight directives require two background agent spawns — planning then execution. Each spawn takes 15-30s for prompt construction. Doubles CEO interaction overhead.
- **Fix**: Option A: Alex pauses at approval gate by watching for a file write instead of stopping. Option B: Alex returns short summary, CEO approves, sends message to still-running agent.
- **Files**: .claude/skills/directive/SKILL.md (Steps 0a, 4)
- **Effort**: Medium

## Directive-aware notification context
- **Source**: Walkthrough ceo-runs-directive (2026-03-02)
- **Severity**: Major
- **Type**: Missing functionality
- **Description**: Notifier only knows session ID and project — no directive context. Cannot distinguish "Alex finished a directive" from "random session finished".
- **Fix**: Emit `directive_completed` event from DirectiveWatcher. Notifier subscribes and fires directive-specific notification with name, status, initiative counts.
- **Files**: server/notifications/notifier.ts, server/watchers/directive-watcher.ts, server/state/aggregator.ts
- **Effort**: Medium

## ~~Classification examples for security directives~~ ✅ DONE (2026-03-02)
- **Status**: Completed — added explicit security classification examples to SKILL.md Step 0b
- **Report**: conductor/reports/directive-skill-fixes-2026-03-02.md

## UX verification: one instruction, not a checklist
- **Source**: Walkthrough ceo-runs-directive (2026-03-02)
- **Severity**: Minor
- **Type**: Confusing
- **Description**: SKILL.md prescribes a 5-item QA checklist for UX verification. Ideal is one focused test instruction per initiative.
- **Fix**: Rewrite UX verification instruction: "Write ONE test instruction per initiative — the single most important thing the CEO should verify, with exact URL and expected result."
- **Files**: .claude/skills/directive/SKILL.md (UX Verification Phase)
- **Effort**: Quick

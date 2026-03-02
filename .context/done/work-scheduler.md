# Directive: Autonomous Work Scheduler (Foreman)

**Priority**: P1
**Source**: CEO — "should we have a role running as cron to check if agents are idle and there's something in the backlog that can be running?"

## The Problem

The CEO has to manually kick off every batch of work. When one batch finishes, execution stops until the CEO says "keep going." This has been raised EVERY session. Memory notes and personality nudges don't fix it — the fix is structural.

## Solution: Work Scheduler

A cron-triggered script ("Foreman") that keeps the pipeline moving autonomously.

### Core Loop

Every N minutes (configurable, default 15):

1. **Check capacity**: Are there active Claude sessions running? How many? (Max concurrent configurable, default 1)
2. **Check budget**: Read daily token/cost ceiling from config. Check today's usage against it. Stop if over budget.
3. **Check work**: Read backlog files, check trigger conditions, find ready items sorted by priority (P0 > P1 > P2)
4. **Launch**: If capacity available + budget ok + work ready → launch a Claude batch session with Alex as executor
5. **Log**: Record what was launched, when, estimated cost, in a scheduler log

### Budget System

Config file at `~/.conductor/scheduler.json`:
```json
{
  "enabled": true,
  "check_interval_minutes": 15,
  "max_concurrent_sessions": 1,
  "daily_budget": {
    "max_tokens": 5000000,
    "max_cost_usd": 50
  },
  "work_sources": [
    { "type": "inbox", "path": ".context/inbox/" },
    { "type": "backlog", "path": ".context/goals/*/backlog.md" }
  ],
  "quiet_hours": { "start": "23:00", "end": "07:00" }
}
```

### Work Priority Resolution

1. P0 inbox directives (execute immediately)
2. P1 inbox directives
3. P1 backlog items with met triggers
4. P2 inbox directives
5. P2 backlog items with met triggers
6. Future Ideas (only if explicitly promoted)

### Trigger Checking

The foreman must be able to evaluate trigger conditions on backlog items. Triggers are natural language in the backlog — the foreman reads them and makes a judgment call (using Claude) on whether they've been met. Examples:
- "When checkpoint-resume is used 3+ times" → check if checkpoint files exist
- "After episodic memory consolidation is implemented" → check if backlog item is marked done
- "When sequential execution becomes the bottleneck" → check directive timing data

### Dashboard Integration

- Add "Scheduler" section to dashboard showing: enabled/disabled, budget remaining, next check time, recent launches
- "Auto-pilot" toggle on dashboard to enable/disable
- Kill switch: CEO can pause all scheduled work instantly

### Implementation

- Script: `scripts/foreman.sh` or `scripts/foreman.ts`
- Uses `claude --batch` or `claude -p` for non-interactive execution
- launchd plist for macOS scheduling (or cron)
- Reads config from `~/.conductor/scheduler.json`
- Logs to `~/.conductor/scheduler.log`

## Success Criteria

- CEO can enable auto-pilot, go do other things, come back to completed work
- Budget limits are respected — never exceeds daily ceiling
- Work priority is correct — P0 before P1 before P2
- Dashboard shows scheduler status and recent activity
- CEO can pause/resume with one click
Done

---
name: "report"
description: "CEO dashboard — daily or weekly report on project health, OKR progress, pending approvals, and team performance. Takes an optional argument: 'daily' (default) or 'weekly'."
---

# CEO Report

Generate a CEO report. Mode: $ARGUMENTS (default: daily)

## Step 1: Determine Mode

Parse `$ARGUMENTS`:
- If empty, "daily", or "d" → **daily mode**
- If "weekly" or "w" → **weekly mode**

## Step 2: Gather Data

Read ALL of these:

### Always (both modes)
- `.context/vision.md` — for context on what matters
- `.context/preferences.md` — CEO standing orders
- `.context/goals/_index.md` — goals overview

### External Intelligence (from /scout)
- Read `.context/intelligence/latest/*.json` — latest scout outputs per agent
- Summarize key intelligence by domain: technology, product, growth, operations
- Highlight any act_now or this_week urgency items

### Internal Health (from /healthcheck)
- Read `.context/healthchecks/latest/*.json` — latest healthcheck outputs
- Summarize findings by severity
- Note any auto-fixed items from the last healthcheck

### Project Inventory (both modes)
- Read `.context/goals/inventory.json` — machine-readable project inventory
- If inventory.json doesn't exist, walk `.context/goals/*/active/*/tasks.json` for completion data
- Read all `.context/goals/*/backlog.md` for backlog counts

### Decision Queue (both modes)
- Scan `.context/reports/` for recent directive reports with unaddressed high-risk follow-ups
- Read `.context/healthchecks/latest/*.json` for high-risk findings
- Read all backlogs for P0 items needing CEO decision

### What Changed
Run these commands:
```bash
# Recent commits on main (last 7 days for weekly, last 24h for daily)
git log --oneline --since="{timeframe}" main

# Active worktrees (directive branches in progress)
git worktree list

# Recently modified context files
find .context/ -name "*.md" -mtime -{days} -type f | head -20
```

### What Needs Input
- Check `.context/inbox/` — pending directives awaiting execution
- Check for medium/high risk follow-ups in recent reports (`.context/reports/`)
- Check for items in backlogs marked as needing CEO decision

### Autopilot Status
- Read `~/.conductor/scheduler.json` for config (enabled, budget, quiet hours)
- Read `~/.conductor/scheduler.log` for today's activity (launches, skips, errors)
- Summarize: enabled/disabled, budget remaining, recent launches, any errors

### What's At Risk
- Run `npm run type-check` — are there build errors?
- Check for active features with no recent progress (`.context/goals/*/active/*/`)
- Read recent directive reports for failed/blocked initiatives

### OKR Progress (both modes, but expanded in weekly)
- Read ALL `okrs.md` files in `.context/goals/*/`
- Summarize status per KR: ACHIEVED / PROGRESSED / NOT STARTED / BLOCKED

### Weekly-Only Data
- Read `.context/proposals.log` — compute acceptance rates per agent
- Read `.context/lessons.md` — any new lessons this week?
- Read `.context/lessons.md` — any new project lessons?
- Count commits per area (apps/buywisely, apps/sellwisely, packages/) for activity distribution
- Read all directive reports from the past 7 days

## Step 3: Generate Report

### Daily Report Format

```
# Daily Report — {date}

## External Intelligence (from latest /scout)
- **Technology (Sarah)**: {summary + any act_now/this_week items}
- **Product (Marcus)**: {summary + competitor moves}
- **Growth (Priya)**: {summary + channel opportunities}
- **Ecosystem (Morgan)**: {summary + framework updates}
{If no scout data: "No scout data yet — run /scout to gather external intelligence."}

## Internal Health (from latest /healthcheck)
- **Build status**: {type-check pass/fail}
- **Security**: {npm audit summary}
- **Operations**: {stale goals, backlog health}
{If no healthcheck data: "No healthcheck data yet — run /healthcheck."}

## Autopilot
{Read ~/.conductor/scheduler.json and ~/.conductor/scheduler.log}
- **Status**: {enabled/disabled}
- **Budget**: ${spent_today} / ${daily_max} ({pct}%)
- **Recent launches**: {list directives launched today, or "none"}
- **Last check**: {time of most recent check entry}
{If scheduler.json doesn't exist: "Not configured — run scripts/foreman.sh to initialize."}

## Corrections Caught (from recent directives)
{Read recent directive reports for Corrections Caught data.}
- **Last directive**: {name} — {violations_found} violations found, {violations_fixed} fixed
- **Standing Corrections verified**: {count} across {N} initiatives
{If no recent directive data: "No directive executed recently."}
{If violations were found: list each with correction name and resolution}

## What Changed
{Recent commits, summarized by area. Not a raw git log — group and summarize.}
{Active worktrees/branches and their status.}

## Project Inventory

{Read .context/goals/inventory.json if it exists. If not, walk .context/goals/*/ manually.}

### Active Goals ({count})
| Goal | Active Features | Done | Backlog | Status |
|------|----------------|------|---------|--------|
| {goal title} | {count} ({list names}) | {done_count} | {backlog_count} | {status badge} |

### Partially-Done Alerts
{For each active feature: read tasks.json, compute completion %. Flag features where:
- completion > 0% but < 100%
- AND last file modification in the feature folder > 7 days ago}

⚠️ **{feature name}** ({goal}) — {X}% complete, stale {N} days
   Last activity: {date} | Tasks: {completed}/{total}

{If no partially-done alerts: "All active features are either fresh or complete."}

### Completed But Not Archived
{Features in active/ folders with 100% task completion — should be moved to done/ via /feature-done}
- {feature name} ({goal}) — 100% complete, still in active/

## What Needs Your Input
{Pending directives in inbox/ — list with one-line description each}
{Medium/high risk items awaiting approval from recent directives}
{Backlog items flagged for CEO decision}
{If nothing: "Nothing pending — all clear."}

## What's At Risk
{Build errors from type-check, if any}
{Stale active features with no recent changes}
{Failed/blocked initiatives from recent directives}
{If nothing: "No risks identified."}

## Decision Queue

{Aggregate items needing CEO decision from multiple sources:}

### From Recent Directives
{Scan .context/reports/ for the last 3 directive reports.
For each, check the "Follow-Up Actions" section for high-risk backlogged items.
Cross-reference with .context/goals/*/backlog.md to see if they've been addressed.}

- **{action}** — Backlogged from {directive name} ({date})
  Risk: {high} | Status: {addressed/pending}

### From Backlogs
{Scan all .context/goals/*/backlog.md for items explicitly marked as needing CEO decision
or items with Priority P0 that are not yet started}

### From Healthchecks
{Read .context/healthchecks/latest/*.json for high-risk findings}

{If nothing: "No pending decisions — all clear."}

## OKR Snapshot
{For each goal with OKRs:}
**{Goal Name}**
- KR-1: {description} — {status} ({metric}: {current} / {target})
- KR-2: ...
```

### Weekly Report Format

```
# Weekly Report — Week of {date}

## Executive Summary
{3-5 bullet overview of the week: what shipped, what's in progress, what needs attention}

## External Intelligence (from latest /scout)
- **Technology (Sarah)**: {summary + action items}
- **Product (Marcus)**: {summary + competitor moves}
- **Growth (Priya)**: {summary + opportunities}
- **Ecosystem (Morgan)**: {summary + framework updates}
- **Intelligence gathered this week**: {count by urgency level}
{If no scout data: "No scout data yet — run /scout."}

## Internal Health (from latest /healthcheck)
- **Build status**: {type-check pass/fail}
- **Security**: {npm audit summary, CVE count}
- **Operations**: {goal freshness, backlog health}
- **Auto-fixed this period**: {count and summary}
{If no healthcheck data: "No healthcheck data yet — run /healthcheck."}

## Autopilot
{Read ~/.conductor/scheduler.json and ~/.conductor/scheduler.log}
- **Status**: {enabled/disabled}
- **Budget**: ${spent_today} / ${daily_max} ({pct}%)
- **This week**: {count} directives auto-launched, {total estimated cost}
- **Errors this week**: {count, or "none"}
{If scheduler.json doesn't exist: "Not configured — run scripts/foreman.sh to initialize."}

## What Changed This Week
{Commits grouped by area with counts}
{Directives executed and their outcomes}
{Features completed or progressed}

## Project Inventory

{Read .context/goals/inventory.json if it exists. If not, walk .context/goals/*/ manually.}

### Active Goals ({count})
| Goal | Active Features | Done | Backlog | Status |
|------|----------------|------|---------|--------|
| {goal title} | {count} ({list names}) | {done_count} | {backlog_count} | {status badge} |

### Partially-Done Alerts
{For each active feature: read tasks.json, compute completion %. Flag features where:
- completion > 0% but < 100%
- AND last file modification in the feature folder > 7 days ago}

⚠️ **{feature name}** ({goal}) — {X}% complete, stale {N} days
   Last activity: {date} | Tasks: {completed}/{total}

{If no partially-done alerts: "All active features are either fresh or complete."}

### Completed But Not Archived
{Features in active/ folders with 100% task completion — should be moved to done/ via /feature-done}
- {feature name} ({goal}) — 100% complete, still in active/

## What Needs Your Input
{Same as daily, but covering the full week}

## What's At Risk
{Same as daily, but covering the full week}
{Trend: are risks increasing or decreasing?}

## Decision Queue

{Aggregate items needing CEO decision from multiple sources:}

### From Recent Directives
{Scan .context/reports/ for the last 3 directive reports.
For each, check the "Follow-Up Actions" section for high-risk backlogged items.
Cross-reference with .context/goals/*/backlog.md to see if they've been addressed.}

- **{action}** — Backlogged from {directive name} ({date})
  Risk: {high} | Status: {addressed/pending}

### From Backlogs
{Scan all .context/goals/*/backlog.md for items explicitly marked as needing CEO decision
or items with Priority P0 that are not yet started}

### From Healthchecks
{Read .context/healthchecks/latest/*.json for high-risk findings}

{If nothing: "No pending decisions — all clear."}

## What Shifted This Week

{Compare current project inventory against what was reported in the most recent saved weekly report
in .context/reports/weekly-*.md}

### New Work Started
- {feature name} ({goal}) — started this week

### Completed This Week
- {feature name} ({goal}) — moved to done/

### Went Stale (no activity >7 days)
- {feature name} ({goal}) — last activity {date}

### Priority Changes
{Any backlog items that were promoted from /scout this week}

{If no previous weekly report exists: "First weekly report — no comparison available."}

## OKR Progress
{Full OKR breakdown per goal — same as daily but with week-over-week changes if prior report exists}

## Team Performance
{From proposals.log:}
- **Proposals this week**: {count} ({count} approved, {count} rejected, {count} deferred)
- **By agent**:
  - Sarah: {proposed} proposed, {accepted} accepted ({rate}%)
  - Marcus: {proposed} proposed, {accepted} accepted ({rate}%)
  - Priya: {proposed} proposed, {accepted} accepted ({rate}%)
  - Morgan: {proposed} proposed, {accepted} accepted ({rate}%)

{From directive reports:}
- **Directives completed**: {count}
- **Initiatives**: {completed}/{total} ({rate}%)
- **Build success rate**: {pass}/{total} type-checks passed

{From directive reports this week:}
- **Corrections enforced**: {total corrections checked across all directives}
- **Violations caught**: {count} (by agent: Sarah {N}, Marcus {N}, Morgan {N})
- **Violation types**: {which standing corrections were violated most}

## Corrections Caught This Week
{Aggregate corrections_check data from all directive reports this week:}

| Correction | Directive | Caught By | Resolution |
|------------|-----------|-----------|------------|
| {correction} | {directive} | {reviewer} | {fixed/noted} |

- **Trend**: {more/fewer/same violations as last week}
{If no violations: "Clean week — all standing corrections respected across all directives."}

## Lessons Learned
{New entries in lessons.md or conductor/lessons.md from this week}
{If none: "No new lessons captured this week."}

## Recommendations
{Morgan-style operational recommendations:}
- What should the CEO focus on next week?
- Any goals that need re-prioritization?
- Any process improvements to consider?
```

## Step 4: Display Report

Output the report directly to the CEO. Do NOT write it to a file unless the CEO asks.

For weekly reports, also offer: "Would you like me to save this report to `.context/reports/weekly-{date}.md`?"

## Failure Handling

| Situation | Action |
|-----------|--------|
| No OKR files exist | Skip OKR section, note "No OKRs tracked yet" |
| No scout data (intelligence/latest/) | Skip external intelligence section, note "No scout data yet — run /scout" |
| No healthcheck data (healthchecks/latest/) | Skip internal health section, note "No healthcheck data yet — run /healthcheck" |
| No proposals.log exists | Skip team performance section, note "No scout/patrol data yet" |
| Type-check fails to run | Note the error, skip build health section |
| No recent commits | Note "No commits in {timeframe}" |
| No directive reports | Skip directive outcomes section |
| No inventory.json and no active features | Note "No active projects tracked yet" in Project Inventory |
| No tasks.json in a feature folder | Skip that feature in completion calculations |
| No previous weekly report for comparison | Note "First weekly report — no comparison available" in Shift Tracking |
| No conductor reports for Decision Queue | Note "No directive history to scan" |
| No healthcheck data for Decision Queue | Skip "From Healthchecks" subsection |
| No ~/.conductor/scheduler.json | Note "Autopilot not configured" in Autopilot section |
| No ~/.conductor/scheduler.log | Note "No scheduler activity yet" |

## Rules

### NEVER
- Create files without CEO requesting it (reports are displayed, not saved by default)
- Run slow commands (no `npm run build`, no `npm run lint`)
- Modify any files (this is a read-only operation)
- Include raw git logs (always summarize and group)

### ALWAYS
- Read preferences.md before generating
- Show concrete numbers (counts, percentages, dates)
- Flag items needing CEO action prominently
- Keep daily reports under 5 minutes reading time
- Keep weekly reports under 15 minutes reading time
- Group information by importance, not by source

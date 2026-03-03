# Standing Scenarios — Cognitive Walkthrough
<!-- Add new scenarios as core user flows emerge. Run /walkthrough all periodically. -->

## ceo-runs-directive
- **Actor**: CEO (solo founder)
- **Trigger**: CEO types `/directive improve-security`
- **Goal**: Get the work done without blocking my session. Review the plan quickly, approve, and get back a summary when it's done.
- **Critical path**:
  1. CEO invokes /directive — session should stay free immediately
  2. Alex plans in background — CEO can do other work
  3. CEO gets notified — short plan summary, not a wall of text
  4. CEO approves in 30 seconds — not a 5-minute read
  5. Alex executes in background — CEO is free again
  6. CEO gets done summary — Done / Changes / Needs CEO Eyes / Next
  7. CEO does UX verification if needed — clear instructions on what to check
- **Success criteria**: CEO's context window stays clean. Total CEO involvement < 5 minutes for a medium directive.

## ceo-morning-review
- **Actor**: CEO
- **Trigger**: CEO opens a new session in the morning, wants to know what happened overnight
- **Goal**: In under 2 minutes, know: what was accomplished, what needs my attention, what's next.
- **Critical path**:
  1. CEO types `/report daily` or asks "what happened?"
  2. System produces a concise summary of overnight work
  3. CEO sees: completed directives, pending approvals, blockers, next priorities
  4. CEO can drill into any item for detail
  5. CEO decides what to focus on today
- **Success criteria**: CEO knows the state of everything in 2 minutes. No surprises.

## ceo-has-idea
- **Actor**: CEO
- **Trigger**: CEO is mid-task on Project A, has an idea for Project B
- **Goal**: Capture the idea with context, continue Project A, nothing lost.
- **Critical path**:
  1. CEO describes the idea naturally ("we should add competitor comparison pages")
  2. System writes it to the right `goals/{goal}/backlog.json` with enough context to act on later
  3. CEO continues current work — no context switch
  4. Idea appears in next /report or /scout review as a backlog item
- **Success criteria**: Zero ideas lost. Zero context switches. Idea lands in the correct goal's backlog.json and is actionable when reviewed later.

## ceo-continuous-execution
- **Actor**: CEO
- **Trigger**: CEO says "do the backlogs" or "keep going"
- **Goal**: Alex works through all actionable backlog items autonomously, CEO reviews periodically.
- **Critical path**:
  1. Alex scans all backlogs across all goals
  2. Alex triages each item (lightweight/medium/heavyweight)
  3. Lightweight items: just done, no CEO involvement
  4. Medium items: planned and executed, CEO gets summary
  5. Heavyweight items: queued for CEO approval
  6. Alex keeps going until nothing actionable remains
  7. CEO checks in when notified, not constantly
- **Success criteria**: CEO says "do the backlogs" once. Work happens continuously. CEO reviews outcomes, not process.

## ceo-checks-project-status
- **Actor**: CEO
- **Trigger**: CEO wants to know where a specific goal or project stands
- **Goal**: See goal progress, active projects, pending tasks, and blockers — without reading raw JSON.
- **Critical path**:
  1. CEO asks "what's the status of {goal}?" or opens the dashboard
  2. System reads `goals/{goal}/goal.json` + all `goals/{goal}/projects/*/project.json`
  3. CEO sees: goal summary, active projects with task completion %, blockers, backlog depth
  4. CEO can drill into any project to see individual tasks and their status
  5. CEO decides whether to intervene or let work continue
- **Success criteria**: CEO knows goal health in 60 seconds. Can identify blockers without reading project.json files manually.

## ceo-reviews-scout-proposals
- **Actor**: CEO
- **Trigger**: Weekly /scout run produces intelligence and proposals
- **Goal**: Review what the team found in the outside world, approve or reject proposals, set direction for the week.
- **Critical path**:
  1. CEO runs /scout or reviews scout output from .context/intel/latest/
  2. Each C-suite agent's findings are summarized concisely
  3. Proposals are presented with: what, why, effort, risk
  4. CEO approves proposals → they become directives in .context/directives/
  5. Rejected proposals are noted with reasoning for future reference
- **Success criteria**: CEO reviews external intel and approves/rejects proposals in under 15 minutes. Approved proposals become actionable directives.

## directive-executes-project
- **Actor**: The conductor system (Alex + agents)
- **Trigger**: CEO approves a directive via /directive {name}
- **Goal**: Execute the directive end-to-end, produce a project with completed tasks, update all state.
- **Critical path**:
  1. Alex reads directive from .context/directives/{name}.md
  2. Morgan plans initiatives with phases and agent casting
  3. Auditor scans codebase, produces baseline findings
  4. CEO approves plan (heavyweight) or Alex auto-approves (medium)
  5. Engineers execute initiatives — each phase produces artifacts in goals/{goal}/projects/{project}/
  6. Reviewers verify DOD criteria are met
  7. project.json is created/updated with tasks, DOD status, and verification results
  8. directive.json status updated to "completed", digest written to .context/reports/
- **Success criteria**: Directive produces a completed project with all tasks done, DOD verified, and a clean digest. State is consistent across directive.json, project.json, and reports/.

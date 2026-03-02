---
name: "walkthrough"
description: "Cognitive walkthrough — simulate real user scenarios against the current system to find gaps between ideal and actual. Takes an optional scenario name or 'all' to run standing scenarios. Run after major directives or periodically as a reality check."
---

# Walkthrough — Cognitive Walkthrough

Simulate user scenarios against the current system. Find what's broken, missing, or surprising.

**The pattern:** For each scenario, design what SHOULD happen (ideal), trace what DOES happen (actual), report the gaps.

**Arguments:** `$ARGUMENTS`
- A specific scenario name (e.g., `ceo-runs-directive`) → run just that one
- `all` → run all standing scenarios
- A free-text scenario description (e.g., `"seller wants to see competitor prices"`) → ad-hoc walkthrough
- Empty → list available scenarios and ask which to run

## Step 1: Load Scenarios

### If $ARGUMENTS is a scenario name or "all":

Read standing scenarios from `.context/scenarios.md`.

Each scenario has:
- **Name**: slug identifier
- **Actor**: who is performing the action (CEO, seller, shopper, developer)
- **Trigger**: what starts the flow ("CEO types /directive improve-security")
- **Goal**: what the actor wants to achieve
- **Critical path**: the steps that MUST work for the scenario to succeed

If `all`, load all scenarios. If a specific name, load just that one.

### If $ARGUMENTS is free text:

Treat it as an ad-hoc scenario. Spawn Marcus (CPO) to formalize it:

```
You are Marcus Rivera, CPO. The CEO described a user scenario informally:

"{$ARGUMENTS}"

Formalize it into this structure:
{
  "name": "slug-name",
  "actor": "who is doing this",
  "trigger": "what starts the flow",
  "goal": "what the actor wants to achieve",
  "critical_path": [
    "Step 1: what should happen first",
    "Step 2: what should happen next",
    ...
  ],
  "success_criteria": "how do you know the scenario succeeded"
}

Think from the ACTOR's perspective, not the system's. What does the actor expect at each step? What would surprise or frustrate them?

CRITICAL OUTPUT FORMAT: First character must be `{`, last must be `}`. JSON only.
```

### If $ARGUMENTS is empty:

Read `.context/scenarios.md` and list available scenarios:

```
Available scenarios:
1. ceo-runs-directive — CEO issues a directive, wants it handled without blocking
2. ceo-morning-review — CEO opens dashboard, wants to know what happened overnight
3. ...

Which scenario to walk through? (or describe a new one)
```

Use AskUserQuestion with the scenario names as options.

## Step 2: Design the Ideal (per scenario)

For each scenario, spawn Marcus (CPO) to design the **ideal experience** — what SHOULD happen if everything worked perfectly.

Marcus receives:
- His personality from `.claude/agents/marcus-cpo.md`
- The scenario definition
- `.context/vision.md` — so the ideal aligns with the north star
- `.context/preferences.md` — CEO expectations

```
You are Marcus Rivera, CPO. You are designing the IDEAL user experience for this scenario. Don't look at the current implementation — design from scratch what the perfect flow would be.

SCENARIO:
- Actor: {actor}
- Trigger: {trigger}
- Goal: {goal}

For each step of the critical path, describe:
1. What the actor does
2. What the system should do in response
3. What the actor sees/experiences
4. How long it should take (instant / seconds / minutes / async)
5. What would frustrate the actor at this step

Then describe the END STATE: what does "success" look like from the actor's perspective?

Think like a product designer, not an engineer. The actor doesn't care about checkpoints, worktrees, or JSON schemas. They care about: did the thing work? Was it fast? Did I have to babysit it?

CRITICAL OUTPUT FORMAT: First character must be `{`, last must be `}`. JSON only.

{
  "scenario": "{name}",
  "ideal_flow": [
    {
      "step": 1,
      "actor_action": "what the actor does",
      "system_response": "what should happen",
      "actor_experience": "what they see/feel",
      "timing": "instant | seconds | minutes | async",
      "frustration_risk": "what could annoy the actor here"
    }
  ],
  "end_state": "what success looks like",
  "key_expectations": ["the non-negotiable things the actor expects"]
}
```

## Step 3: Trace the Actual (per scenario)

For each scenario, spawn Sarah (CTO) to trace what ACTUALLY happens in the current system. She reads code, config, and skill files to follow the real execution path.

Sarah receives:
- Her personality from `.claude/agents/sarah-cto.md`
- The scenario definition
- Marcus's ideal flow (from Step 2)
- `.context/lessons.md` — known issues
- `.context/preferences.md`

```
You are Sarah Chen, CTO. You are tracing what ACTUALLY happens in the current system for this scenario. Read the real code and config — don't guess.

SCENARIO:
- Actor: {actor}
- Trigger: {trigger}
- Goal: {goal}
- Critical path: {steps}

IDEAL FLOW (from Marcus):
{Marcus's ideal_flow JSON}

For each step of the ideal flow, trace what the current system actually does:
1. Read the relevant files (SKILL.md, agent files, code)
2. Follow the execution path step by step
3. Note where reality matches the ideal
4. Note where reality DIVERGES from the ideal
5. Note where the system does NOTHING (missing functionality)

Be thorough. Grep for entry points, read the actual instructions, trace the branching logic. Don't assume — verify.

CRITICAL OUTPUT FORMAT: First character must be `{`, last must be `}`. JSON only.

{
  "scenario": "{name}",
  "actual_flow": [
    {
      "ideal_step": 1,
      "ideal_expectation": "what Marcus said should happen",
      "actual_behavior": "what the system actually does",
      "status": "match | diverge | missing | broken",
      "evidence": "file:line or config entry that proves this",
      "notes": "explanation of the gap, if any"
    }
  ],
  "gaps_found": [
    {
      "id": "gap-slug",
      "severity": "critical | major | minor | cosmetic",
      "type": "missing | broken | wrong | slow | confusing",
      "description": "what's wrong",
      "ideal": "what should happen",
      "actual": "what does happen",
      "evidence": "file:line",
      "suggested_fix": "how to close the gap"
    }
  ],
  "working_well": ["things that match the ideal — acknowledge what's good"]
}
```

## Step 4: Synthesize Gaps

After all scenarios are traced, consolidate the findings:

1. **Deduplicate** — the same gap may appear in multiple scenarios
2. **Prioritize** — critical gaps that block the actor's goal come first
3. **Cross-reference** — gaps that appear in 2+ scenarios are systemic
4. **Classify effort** — quick fix (< 1 hour), medium (half day), large (1+ days)

## Step 5: Present to CEO

```
# Walkthrough Report — {date}

## Scenarios Walked: {count}

### {Scenario Name}
**Actor**: {actor} | **Goal**: {goal}

**Ideal vs Actual:**
| Step | Ideal | Actual | Status |
|------|-------|--------|--------|
| 1 | {ideal} | {actual} | ✅ match / ⚠️ diverge / ❌ missing |
| 2 | ... | ... | ... |

**Gaps Found: {count}**
- [{severity}] **{description}** — {type}
  Ideal: {what should happen}
  Actual: {what does happen}
  Fix: {suggested fix} ({effort})

**Working Well:**
- {things that matched the ideal}

(repeat per scenario)

## Systemic Gaps (appear in 2+ scenarios)
- **{gap}** — found in: {scenario list}

## Summary
- Total gaps: {count} ({critical}, {major}, {minor})
- Scenarios fully passing: {count}/{total}
- Top 3 fixes by impact: {list}
```

Then ask the CEO:
- "Create directive from gaps" — bundle gaps into a directive in inbox/
- "Add to backlog" — write gaps to the relevant goal's backlog
- "Note only" — just keep the report

## Step 6: Save Report

Write the full report to `.context/reports/walkthrough-{date}.md`

If gaps were approved as a directive, create it in `.context/inbox/`.

## Standing Scenarios File

If `.context/scenarios.md` doesn't exist, create it with starter scenarios on first run. The CEO and team add scenarios over time as new flows become important.

## Failure Handling

| Situation | Action |
|-----------|--------|
| Marcus can't formalize ad-hoc scenario | Ask CEO to clarify the scenario |
| Sarah can't find the entry point for a step | Mark as "missing — no implementation found" |
| A scenario has no gaps | Report it as passing — this is good news |
| scenarios.md doesn't exist | Create it with starter scenarios, then run |

## Rules

### NEVER
- Skip the ideal design (Step 2) — the whole point is comparing ideal vs actual
- Have the same agent design ideal AND trace actual — separate perspectives prevent bias
- Mark a gap as "minor" if it blocks the actor's goal — that's critical by definition
- Trace the actual by reading docs/comments — read the real code/config

### ALWAYS
- Design ideal BEFORE tracing actual — don't let current state constrain the ideal
- Include evidence (file:line) for every gap — no hand-waving
- Acknowledge what's working well — not just gaps
- Save the report even if no gaps found (it's a health signal)
- Use Marcus for ideal (product thinking) and Sarah for actual (technical tracing)

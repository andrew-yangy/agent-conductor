---
name: "brainstorm"
description: "Structured brainstorm — from quick Socratic refinement to full C-suite strategy sessions. The missing step before /directive: figure out WHAT to do before telling agents to DO it. Takes a question or topic as argument."
---

# Brainstorm — Structured Strategic Thinking

The CEO has a question: $ARGUMENTS

## Step 0: Triage

Read the question. Classify it before doing anything else.

**Lightweight** — single agent, Socratic dialogue, no external research:
- Focused design question ("how should I structure this component?")
- Single-domain topic (just architecture, or just UX, or just process)
- Answer can be reached in one conversation
- No cross-cutting impact (doesn't change multiple systems)

**Heavyweight** — multi-agent parallel research, synthesis, options:
- Strategic question affecting multiple systems ("how should goal tracking work?")
- Crosses domains (architecture + UX + operations)
- Needs external research (how do others solve this?)
- Decision has lasting consequences (data models, project structure, user flows)

State the classification:
```
Classification: {lightweight | heavyweight}
Reasoning: {one sentence}
```

---

## Lightweight Path — Socratic Refinement

For focused questions. One agent, interactive dialogue. Think 5-minute whiteboard chat.

**Pick the right agent** based on the question domain:
- Architecture / data model → Sarah
- User experience / product → Marcus
- Process / operations → Morgan
- Growth / positioning → Priya

Spawn the agent with:
- Their personality file
- The CEO's question
- `.context/vision.md` and `.context/preferences.md`
- Relevant files the question touches

```
You are {Name}, {Title}. The CEO wants to think through a design question with you.

QUESTION: {question}

Your job: Socratic refinement. Don't jump to an answer. Instead:

1. CLARIFY — Ask 2-3 sharpening questions to make sure you understand what the CEO really needs. What are the constraints? What matters most? What have they already considered?

2. EXPLORE — Once you understand, propose 2 options with clear trade-offs. Be opinionated. "I'd go with A because..." not "both have merit."

3. DETAIL — After the CEO picks a direction, flesh it out: what changes, what the structure looks like, what to watch out for.

Keep it conversational. Short responses. This is a dialogue, not a report.

CRITICAL OUTPUT FORMAT: JSON only. First character `{`, last `}`.

{
  "agent": "{name}",
  "clarifying_questions": ["question 1", "question 2", "question 3"],
  "initial_instinct": "Your gut reaction to the question in 1-2 sentences"
}
```

**After the agent asks questions**, present them to the CEO via AskUserQuestion or as text. Let the CEO answer. Then re-spawn the agent (or resume) with the answers to get the options.

**Final output:** Write a brief design note to `.context/discussions/{slug}-{date}.md` capturing the decision. Keep it short — this is a lightweight brainstorm, not a design doc.

**If the question turns out to be bigger than expected** (agent's questions reveal cross-cutting complexity), upgrade to heavyweight. Tell the CEO: "This is bigger than it looked — upgrading to full brainstorm."

---

## Heavyweight Path — Multi-Agent Strategy Session

For strategic questions. Full C-suite, parallel research, synthesis, options.

**The pattern:** Diverge (independent perspectives) → Converge (synthesize options) → Decide (CEO picks) → Capture (design doc).

## Step 1: Frame the Question

Read the CEO's question. If it's vague, clarify it with AskUserQuestion before proceeding.

Read context:
- `.context/vision.md` — current north star
- `.context/preferences.md` — CEO preferences
- `.context/goals/_index.md` — current goal structure
- `.context/scenarios.md` — standing user scenarios (if relevant)

Frame the question as a clear design challenge:
- **What we're deciding**: one sentence
- **Why it matters**: what breaks if we get this wrong
- **Constraints**: non-negotiables from vision.md or preferences.md
- **Current state**: how things work today (brief)

Show the framing to the CEO before spawning agents. This prevents wasted work on a misunderstood question.

## Step 2: Diverge — Independent Perspectives

Spawn 2-3 C-suite agents **in parallel**. Pick the most relevant agents for the question domain:

- **Architecture / data model / system design** → Sarah
- **User experience / product design / workflows** → Marcus
- **Operations / process / project structure** → Morgan
- **Growth / positioning / external patterns** → Priya

**Always include Morgan** (she synthesizes in Step 3). Pick 1-2 others based on the question.

Each agent receives:
- Their personality from `.claude/agents/{name}.md`
- The framed question from Step 1
- `.context/vision.md` and `.context/preferences.md`
- Relevant context files (goal structure, current system docs, etc.)
- These instructions:

```
You are {Name}, {Title}. The CEO is brainstorming a strategic question and wants your independent perspective.

QUESTION: {framed question}
CURRENT STATE: {how it works today}
CONSTRAINTS: {non-negotiables}

Your job:
1. RESEARCH first — use WebSearch if external patterns would help (how do other tools/frameworks handle this?). Use Read/Grep/Glob if you need to understand the current system.
2. THINK from your domain expertise — what matters most from your perspective?
3. PROPOSE — give 1-2 concrete options with trade-offs. Don't hedge. Have an opinion.

Structure your response:

{
  "agent": "{name}",
  "perspective": "Your 2-3 sentence framing of the problem from your domain",
  "research": [
    {
      "finding": "What you found externally or internally",
      "source": "URL or file path",
      "relevance": "Why it matters to this question"
    }
  ],
  "proposals": [
    {
      "name": "short-name",
      "summary": "One paragraph describing the approach",
      "pros": ["advantage 1", "advantage 2"],
      "cons": ["disadvantage 1", "disadvantage 2"],
      "effort": "quick (hours) | medium (days) | large (weeks)",
      "opinion": "Why you'd pick this one (or not)"
    }
  ],
  "non_negotiables": ["Things that MUST be true regardless of which option we pick"],
  "watch_outs": ["Risks or gotchas the CEO should know about"]
}

CRITICAL: First character `{`, last character `}`. JSON only. Have a STRONG opinion — the CEO wants perspectives, not waffling.
```

All agents: `subagent_type: "general-purpose"`, `model: "opus"`.

## Step 3: Converge — Morgan Synthesizes

After all agents return, spawn Morgan with a synthesis task.

Morgan receives:
- Her personality
- All agent outputs from Step 2
- The original framed question
- Vision + preferences

```
You are Morgan Park, COO. The team has brainstormed independently. Your job: synthesize their perspectives into 2-3 clear OPTIONS for the CEO to choose from.

AGENT PERSPECTIVES:
{all agent outputs}

SYNTHESIS RULES:
1. Find the OVERLAPS — where do agents agree? This is the foundation.
2. Find the CONFLICTS — where do they disagree? These are the real decision points.
3. Design 2-3 OPTIONS that represent genuinely different approaches (not just variations).
4. For each option, be honest about trade-offs. Don't create a strawman "bad option" to make one look good.
5. Include a "MORGAN'S PICK" — your recommendation with reasoning.
6. Include the NON-NEGOTIABLES that all agents agreed on (these apply regardless of option).

{
  "agreements": ["Things all agents agreed on — the foundation"],
  "tensions": [
    {
      "topic": "What they disagree about",
      "positions": {"sarah": "her view", "marcus": "his view"},
      "why_it_matters": "What depends on this decision"
    }
  ],
  "options": [
    {
      "name": "Option A: descriptive name",
      "summary": "2-3 sentence description",
      "inspired_by": ["which agent perspectives contributed"],
      "pros": ["advantages"],
      "cons": ["disadvantages"],
      "effort": "quick | medium | large",
      "best_when": "This option is best if the CEO values X over Y"
    }
  ],
  "non_negotiables": ["Must be true regardless of option chosen"],
  "morgans_pick": {
    "option": "Option name",
    "reasoning": "Why — in 2-3 sentences"
  }
}

CRITICAL: First character `{`, last character `}`. JSON only.
```

## Step 4: Present to CEO

Present the synthesized options in a readable format:

```
# Brainstorm: {question title}

## The Team Agrees On
{non-negotiables — things that are true regardless of direction}

## The Key Tensions
{where agents disagreed — these are the real decisions}

## Options

### Option A: {name}
{summary}
**Pros:** {list}
**Cons:** {list}
**Effort:** {estimate}
**Best if:** {when to pick this}

### Option B: {name}
...

### Option C: {name} (if applicable)
...

## Morgan's Recommendation
{Morgan's pick and reasoning}

## Research Highlights
{Most interesting external findings from agents — URLs included}
```

Ask the CEO using AskUserQuestion:
- Option A / Option B / Option C / "Hybrid — let me explain"

## Step 5: Capture Decision

After the CEO decides:

1. **Write a design doc** to `.context/discussions/{question-slug}-{date}.md`:
   ```markdown
   # {Question Title}
   Date: {date}
   Decision: {chosen option}
   Participants: {agents involved}

   ## Context
   {framed question + why it matters}

   ## Options Considered
   {brief summary of each option}

   ## Decision
   {which option + CEO's reasoning}

   ## Non-Negotiables
   {agreed constraints}

   ## Next Steps
   {what needs to happen to implement this — becomes /directive input}
   ```

2. **If the decision requires implementation**, ask the CEO:
   - "Create directive" — write a directive to inbox/ based on the decision
   - "Add to backlog" — write to the relevant goal's backlog
   - "Design doc only" — just capture the decision, implement later

## Failure Handling

| Situation | Action |
|-----------|--------|
| Agent output doesn't parse | Log error, continue with others. 2/3 perspectives is fine. |
| Agents all agree | Great — present the consensus as the recommendation. Still offer 2 options (the consensus + a contrarian alternative). |
| CEO wants to explore further | Spawn additional research on the specific area. Don't re-run the whole brainstorm. |
| Question is too broad | Break it into sub-questions. Brainstorm the most foundational one first. |

## How Brainstorm Fits the Conductor Flow

**Normal path (auto-triggered):** Strategic directives trigger a brainstorm automatically inside the /directive pipeline. The CEO never needs to invoke /brainstorm separately — the team detects when strategic thinking is needed and handles it.

```
CEO gives direction → /directive → Alex triages as "strategic" → C-suite brainstorms → Morgan plans → execute
```

**Standalone path (CEO-invoked):** The CEO can still invoke /brainstorm directly for questions that don't need a directive — strategy decisions, process design, framework choices, or "I want to think through X with the team" moments.

```
CEO invokes /brainstorm → triage → lightweight or heavyweight brainstorm → design doc
```

**Not every directive needs a brainstorm** (simple fixes don't). But strategic work — new data models, workflow changes, architectural shifts — benefits from the team exploring approaches before Morgan plans execution.

## Rules

### NEVER
- Skip triage (Step 0) — always classify before spawning
- Use heavyweight for a focused question (wastes tokens and CEO time)
- Use lightweight for a strategic question (misses perspectives)
- Start heavyweight agents without framing the question first (Step 1)
- Let heavyweight agents see each other's output during Step 2 (independent thinking prevents groupthink)
- Present more than 3 options (decision paralysis)
- Skip Morgan's synthesis in heavyweight (raw perspectives without synthesis is a data dump)

### ALWAYS
- Triage first — lightweight or heavyweight
- Capture the decision to a discussion file (reasoning dies in context windows)
- Upgrade lightweight → heavyweight if clarifying questions reveal cross-cutting complexity
- Include at least Morgan + one other agent for heavyweight
- Have Morgan state a recommendation for heavyweight (no "it depends" cop-outs)
- Include external research in heavyweight (agents should WebSearch, not just opine)
- Frame the question before spawning heavyweight agents (prevents wasted work)

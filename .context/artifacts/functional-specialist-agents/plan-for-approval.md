# Plan: Make Specialist Agents Functional

**Directive**: functional-specialist-agents
**Classification**: Heavyweight
**Reasoning**: Crosses system boundaries (prompt templates + SKILL.md pipeline + session scanner + org page), changes the core directive execution pipeline (how engineers are spawned and cast).

---

## TL;DR

- **What**: Make specialist agents (Riley/Frontend, Jordan/Backend, Casey/Data, Taylor/Content, Sam/QA) actually functional -- when Morgan casts a directive, she assigns a specialist with domain-specific prompt context instead of a generic "engineer"
- **Scope**: 3 initiatives (1 moderate, 2 simple)
- **Risk**: Proceed as-is -- well-scoped, clear requirements, builds on existing infrastructure
- **Auto-ships**: 0 (heavyweight -- all go through review)
- **Needs your call**: Nothing beyond plan approval

Approve all / Approve with changes / Reject

---

## Risk & Scope Assessment

**Risks:**
1. Specialist prompt templates could become stale as the codebase evolves -- templates reference specific file paths and patterns that change. Mitigation: keep templates lean (conventions + patterns, not exhaustive file lists) and add a note that they should be refreshed periodically.
2. Morgan's casting logic could become complex if file-pattern matching is too granular. Mitigation: use simple prefix-based rules in Morgan's prompt, not a regex engine.
3. Session scanner identity detection might not match specialist names if prompt templates use a different naming pattern than "You are {Name}". Mitigation: the templates will follow the exact same "You are {Name} {LastName}, {Role}" pattern the scanner already detects.

**Over-engineering flags:**
- None -- this is a natural follow-up to the specialist-agents-and-org-teams directive. The infrastructure (agent-config.ts, org page, session scanner patterns) is already in place. We just need to wire up the functional layer.

**Recommendation:** Proceed as-is.

---

## Initiative 1: Create Specialist Prompt Templates

**Priority**: P0 | **Complexity**: moderate | **Phases**: build, review

**Scope**: Create 5 specialist prompt template files in `.claude/agents/` that inject domain-specific knowledge for each specialist. Each template should be 1-2KB of actionable technical context extracted from the actual codebase -- real file paths, real conventions, real patterns. NOT persona flavor text. The templates follow the existing agent file pattern (YAML frontmatter + markdown body) but focus on technical context rather than personality.

**User scenario**: When a directive touches frontend code, Riley's template gets loaded into the engineer spawn prompt, providing React/Tailwind/shadcn patterns specific to this project -- resulting in higher-quality builds that follow existing conventions.

**Cast**:
- Auditor: Sarah (audit the codebase to extract real patterns for each specialist domain)
- Builder: engineer (specialist: casey -- data/pipeline work extracting patterns)
- Reviewers: Sarah (technical accuracy of templates), Morgan (casting rule alignment)

**Files to create**:
- `.claude/agents/riley-frontend.md` -- React + Tailwind + shadcn/ui + zustand patterns from this project
- `.claude/agents/jordan-backend.md` -- Hono server + WebSocket + chokidar + state management patterns
- `.claude/agents/casey-data.md` -- Session parsing + state indexing + JSONL + .context/ file structure patterns
- `.claude/agents/taylor-content.md` -- Markdown/MDX conventions + documentation patterns
- `.claude/agents/sam-qa.md` -- Type-checking + build validation + verification patterns

**Template structure** (each file):
```
---
name: {specialist-id}
description: |
  {Name}, {Role} -- specialist prompt template. Loaded by the directive pipeline
  when Morgan casts this specialist for an initiative's build phase.
model: inherit
memory: project
---

# {Name} {LastName} -- {Role}

You are {Name} {LastName}, {Role}. You are a specialist engineer with deep knowledge
of this project's {domain} patterns.

## Project Context
{2-3 sentences about the project and this specialist's domain}

## Key Files & Patterns
{Real file paths, real conventions, real patterns extracted from audit}

## Conventions
{Specific coding conventions for this domain in this project}

## Common Pitfalls
{Things that go wrong in this domain -- from lessons.md and codebase analysis}

## Verification
{Domain-specific verification commands and checks}
```

**Definition of Done**:
1. All 5 template files exist in `.claude/agents/` with 1-2KB of actionable content each
2. Templates reference real file paths and patterns from the actual codebase (not generic advice)
3. Templates follow the "You are {Name} {LastName}, {Role}" pattern for session scanner compatibility
4. Templates include YAML frontmatter consistent with existing agent files
5. Type-check passes (`npx tsc --noEmit`)

---

## Initiative 2: Update SKILL.md Casting & Engineer Spawn Logic

**Priority**: P0 | **Complexity**: moderate | **Phases**: build, review

**Scope**: Update `.claude/skills/directive/SKILL.md` in three areas:
1. **Morgan's casting output** -- add a `specialist` field to the cast schema so Morgan can specify `"builder": "riley"` instead of just `"engineer"`
2. **Engineer spawn rules** (Step 5) -- when the cast specifies a named specialist, load their prompt template from `.claude/agents/{specialist-id}-{role}.md` and prepend it to the engineer's task prompt (same pattern used for named C-suite agents)
3. **File-pattern matching guidance** -- add casting guidance to Morgan's prompt so she assigns specialists based on active files from the audit

**Changes to Morgan's plan schema** (in Step 3):
```json
"cast": {
  "builder": "engineer | riley | jordan | casey | taylor | sam",
  ...
}
```

When `builder` is a specialist name (not "engineer"), the Step 5 spawn logic loads their template.

**Specialist assignment guidance for Morgan** (add to casting rules):
- Files matching `*.tsx`, `*.jsx`, `components/`, `src/components/` --> Riley (Frontend)
- Files matching `server/`, `api/`, `*.ts` under server/ --> Jordan (Backend)
- Files matching `scripts/`, `parsers/`, `state/`, data pipelines --> Casey (Data)
- Files matching `*.md`, `*.mdx`, `content/` --> Taylor (Content)
- Testing/validation/QA work --> Sam (QA)
- When scope crosses domains, use the dominant domain's specialist
- When no clear domain match, use generic "engineer" (backward compatible)

**Changes to Step 5 spawn rules**:
```
**Specialist agents** (Riley, Jordan, Casey, Taylor, Sam): Load prompt template
from `.claude/agents/{specialist-id}-{domain}.md` and prepend it to the task prompt.
The specialist's name appears in the agent spawn `name` field for session tracking.
Specialists follow the same spawn pattern as named C-suite agents.
```

**User scenario**: Morgan's plan JSON includes `"builder": "riley"` for frontend initiatives. Alex spawns the engineer with Riley's frontend template prepended, so the builder knows this project's React patterns, component architecture, and Tailwind conventions.

**Cast**:
- Auditor: Sarah (audit current SKILL.md patterns)
- Builder: engineer
- Reviewers: Morgan (casting rule accuracy), Sarah (technical correctness)

**Definition of Done**:
1. Morgan's plan schema in SKILL.md includes `specialist` option for the `builder` field
2. Step 5 engineer spawn rules handle specialist templates (load from `.claude/agents/`)
3. Specialist assignment guidance is included in Morgan's casting rules section
4. File-pattern matching rules are documented for Morgan's reference
5. Backward compatible -- `"builder": "engineer"` still works with no template

---

## Initiative 3: Update Session Scanner for Specialist Recognition

**Priority**: P1 | **Complexity**: simple | **Phases**: build, review

**Scope**: The session scanner in `server/parsers/session-scanner.ts` already has a `KNOWN_AGENTS` map and `extractAgentIdentity()` function that detects agent names from prompt patterns like "You are {Name}". The specialist agents need to be added to `KNOWN_AGENTS` so their sessions show up correctly on the org page.

**Current state** (from audit):
```typescript
const KNOWN_AGENTS: Record<string, { name: string; role: string }> = {
  'alex': { name: 'Alex', role: 'Chief of Staff' },
  'sarah': { name: 'Sarah', role: 'CTO' },
  'morgan': { name: 'Morgan', role: 'COO' },
  'marcus': { name: 'Marcus', role: 'CPO' },
  'priya': { name: 'Priya', role: 'CMO' },
};
```

**Required change**: Add specialist agents:
```typescript
const KNOWN_AGENTS: Record<string, { name: string; role: string }> = {
  // C-suite
  'alex': { name: 'Alex', role: 'Chief of Staff' },
  'sarah': { name: 'Sarah', role: 'CTO' },
  'morgan': { name: 'Morgan', role: 'COO' },
  'marcus': { name: 'Marcus', role: 'CPO' },
  'priya': { name: 'Priya', role: 'CMO' },
  // Specialists
  'riley': { name: 'Riley', role: 'Frontend Developer' },
  'jordan': { name: 'Jordan', role: 'Backend Developer' },
  'casey': { name: 'Casey', role: 'Data Engineer' },
  'taylor': { name: 'Taylor', role: 'Content Builder' },
  'sam': { name: 'Sam', role: 'QA Engineer' },
};
```

The org page (`src/components/org/OrgPage.tsx`) already has `agent-config.ts` entries for all 5 specialists with colors, team assignments, and display properties. It uses `agentSessions = sessions.filter(s => s.agentName?.toLowerCase() === config.id)` to match sessions to agents. Once the scanner recognizes specialist names, sessions will automatically appear under their cards on the org page.

**User scenario**: When Riley is building a frontend initiative, the org page shows Riley's card as "Working" with a green pulse dot and the current task description, just like the C-suite agents.

**Cast**:
- Auditor: Sarah
- Builder: engineer
- Reviewers: Sarah

**Definition of Done**:
1. All 5 specialist agents added to `KNOWN_AGENTS` in `session-scanner.ts`
2. Role strings match `agent-config.ts` entries (Frontend Developer, Backend Developer, etc.)
3. `extractAgentIdentity()` correctly identifies specialist names from prompt text containing "You are Riley Kim, Frontend Developer" etc.
4. Type-check passes (`npx tsc --noEmit`)
5. Build passes (`npx vite build`)

---

## Execution Plan

1. **Init 3 first** (session scanner) -- smallest, independent, unblocks org page visibility
2. **Init 1 next** (prompt templates) -- requires codebase audit to extract real patterns
3. **Init 2 last** (SKILL.md updates) -- depends on knowing the final template file names from Init 1

All work is in the agent-conductor repo. No cross-repo dependencies.

**Verify command**: `npx tsc --noEmit && npx vite build`

---

## What This Does NOT Change

- C-suite behavior -- Sarah, Marcus, Morgan, Priya continue to plan/audit/review/challenge as before
- Engineer fallback -- generic "engineer" spawning still works when no specialist is assigned
- Existing agent personality files -- C-suite `.md` files are untouched
- Team groupings on org page -- already implemented, no changes needed
- Data model -- no new types, no schema changes

# Initialize gruai Agent Team

Scaffold a variable-sized AI agent team into the current project. This replaces the old `gruai init` CLI command.

## What This Does

1. Prompts the user to choose a team size preset (Starter, Standard, Full, or Custom)
2. Generates agents with random names for the selected roles
3. Creates `.claude/agents/*.md` personality files from role templates
4. Creates `.claude/agent-registry.json` (team config -- the game reads this)
5. Scaffolds `.context/` tree (vision, lessons, directives, reports, backlog)
6. Creates `CLAUDE.md` project instructions with agent roster
7. Creates `gruai.config.json` project config

## Instructions

### Step 0: Resolve Package Root

Before reading any templates, resolve the gruai package root directory. This ensures paths work whether gruai is installed via npm, linked locally, or running from source.

```bash
GRUAI_ROOT="$(bash "$(npm root)/gru-ai/cli/resolve-pkg-root.sh" 2>/dev/null || bash "cli/resolve-pkg-root.sh")"
```

All template paths below are relative to `$GRUAI_ROOT` (e.g., `$GRUAI_ROOT/cli/templates/agent-roles/cto.md`).

### Step 1: Choose Team Size

Ask the user to choose a team size preset. Present these options:

```
Team size presets:

  1) Starter   (4 agents:  CEO + COO, CTO, Full-Stack)
  2) Standard  (7 agents:  CEO + COO, CTO, CPO, Frontend, Backend, Full-Stack, QA)
  3) Full      (11 agents: CEO + all roles including CMO, Design, Data, Content)
  4) Custom    (pick your own roles -- minimum: COO + CTO + 1 builder)
```

**Preset role mappings:**

| Preset | Role IDs included |
|--------|-------------------|
| Starter (4) | coo, cto, fullstack |
| Standard (7) | coo, cto, cpo, frontend, backend, fullstack, qa |
| Full (11) | coo, cto, cpo, cmo, frontend, backend, fullstack, data, qa, design, content |
| Custom | User selects from full role list |

The agent count shown (4, 7, 11) includes the CEO who is always present.

**Custom mode validation:** If the user chooses Custom, present the full role list and ask them to enter role IDs as a comma-separated list. Validate their selection:
- **Required:** COO (`coo`) and CTO (`cto`) must be included. Reject without them.
- **Minimum 1 builder:** At least one non-C-suite role must be included (e.g., fullstack, frontend, backend, data, qa, design, content). Reject if only C-suite roles are selected.
- If validation fails, show the error and re-prompt.

Store the selected preset name (starter/standard/full/custom) and the resolved list of role IDs for use in subsequent steps.

### Step 2: Generate Agent Names

Generate unique random first names for **only the selected roles** (from Step 1). Pair each with a random last name. The full role reference table:

| # | Role ID | Title | Role | C-Suite | Reports To | Domains |
|---|---------|-------|------|---------|------------|---------|
| 1 | cto | CTO | Chief Technology Officer | yes | ceo | Architecture, Security, Code Quality, Tech Intelligence |
| 2 | coo | COO | Chief Operating Officer | yes | ceo | Planning, Casting, Sequencing, Ecosystem Intelligence |
| 3 | cpo | CPO | Chief Product Officer | yes | ceo | Product Strategy, UX, Prioritization, Market Intelligence |
| 4 | cmo | CMO | Chief Marketing Officer | yes | ceo | Growth, SEO, Positioning, Growth Intelligence |
| 5 | frontend | FE | Frontend Developer | no | cto | React, Tailwind, Components, UI |
| 6 | backend | BE | Backend Developer | no | cto | Server, API, Database, Infra |
| 7 | fullstack | FS | Full-Stack Engineer | no | cto | Full-Stack, Cross-Domain |
| 8 | data | DE | Data Engineer | no | cto | Pipelines, Indexing, State, Parsers |
| 9 | qa | QA | QA Engineer | no | cto | Testing, Validation, QA, Edge Cases |
| 10 | design | UX | UI/UX Designer | no | cpo | UI Design, UX, Wireframes, Visual Review |
| 11 | content | CB | Content Builder | no | cmo | MDX, Copywriting, SEO Content, Docs |

Only generate names for roles in the selected role ID list. Skip roles not in the selection.

The agent ID is the first name lowercased (e.g., "aria"). The agent file is `{firstname-lowercase}-{roleid}.md` (e.g., `aria-cto.md`).

For `reportsTo`, resolve the role ID to the generated agent's ID. E.g., if the CTO agent is named "Aria", then agents reporting to "cto" should have `reportsTo: "aria"`. **If the role a builder reports to is not in the selected team, set `reportsTo` to "ceo" as a fallback.** For example, if UX Designer (reports to CPO) is selected but CPO is not, the designer reports to CEO.

### Step 3: Create Personality Files

For each **selected** agent, read the role template from `$GRUAI_ROOT/cli/templates/agent-roles/{roleid}.md`. Replace these placeholders:
- `{{NAME}}` -> full name (e.g., "Aria Chen")
- `{{FIRST_NAME}}` -> first name (e.g., "Aria")
- `{{FIRST_NAME_LOWER}}` -> lowercase first name (e.g., "aria")

Write the rendered file to `.claude/agents/{firstname-lowercase}-{roleid}.md`.

Only create personality files for agents in the selected team. Do NOT create files for roles that were not chosen.

### Step 4: Create agent-registry.json

Write `.claude/agent-registry.json` with this structure. **Only include agents for selected roles plus the static CEO entry.** Add a top-level `teamSize` field.

```json
{
  "teamSize": "starter",
  "agents": [
    {
      "id": "ceo",
      "name": "CEO",
      "title": "CEO",
      "role": "Chief Executive Officer",
      "description": "Sets direction, reviews proposals, approves work",
      "agentFile": null,
      "reportsTo": null,
      "domains": ["Strategy", "Direction", "Approval"],
      "color": "text-foreground",
      "bgColor": "bg-foreground/10",
      "borderColor": "border-foreground/30",
      "dotColor": "bg-foreground",
      "isCsuite": true
    }
    // ... only agents for selected roles
  ],
  "teams": [
    // ... only teams that have at least one member (see rules below)
  ]
}
```

**`teamSize` field:** Set to the preset name chosen in Step 1: `"starter"`, `"standard"`, `"full"`, or `"custom"`.

**Team construction rules:**

There are four possible teams. For each team, include it **only if at least one of its member roles is in the selected team**. If the team has zero members, omit it entirely.

| Team ID | Team Name | Lead Role | Member Roles |
|---------|-----------|-----------|--------------|
| engineering | Engineering | CTO | cto, backend, data, fullstack |
| product | Product | CPO | cpo, frontend, design, qa |
| growth | Growth | CMO | cmo, content |
| operations | Operations | COO | coo |

**`leadAgentId` fallback:** If the designated lead role for a team is not in the selected team, use the first available member's agent ID as the lead instead.

**`memberAgentIds`:** Only include agent IDs for roles that are actually in the selected team. Never include IDs for agents that don't exist in the `agents` array.

**Color map by role:**

| Role | color | bgColor | borderColor | dotColor |
|------|-------|---------|-------------|----------|
| CTO | text-violet-400 | bg-violet-500/15 | border-violet-500/40 | bg-violet-500 |
| COO | text-emerald-400 | bg-emerald-500/15 | border-emerald-500/40 | bg-emerald-500 |
| CPO | text-blue-400 | bg-blue-500/15 | border-blue-500/40 | bg-blue-500 |
| CMO | text-amber-400 | bg-amber-500/15 | border-amber-500/40 | bg-amber-500 |
| FE | text-pink-400 | bg-pink-500/15 | border-pink-500/40 | bg-pink-500 |
| BE | text-teal-400 | bg-teal-500/15 | border-teal-500/40 | bg-teal-500 |
| FS | text-indigo-400 | bg-indigo-500/15 | border-indigo-500/40 | bg-indigo-500 |
| DE | text-cyan-400 | bg-cyan-500/15 | border-cyan-500/40 | bg-cyan-500 |
| QA | text-lime-400 | bg-lime-500/15 | border-lime-500/40 | bg-lime-500 |
| UX | text-rose-400 | bg-rose-500/15 | border-rose-500/40 | bg-rose-500 |
| CB | text-orange-400 | bg-orange-500/15 | border-orange-500/40 | bg-orange-500 |

**Team colors (same regardless of team size):**

| Team | color | bgColor | borderColor |
|------|-------|---------|-------------|
| Engineering | text-violet-400 | bg-violet-500/10 | border-violet-500/30 |
| Product | text-blue-400 | bg-blue-500/10 | border-blue-500/30 |
| Growth | text-amber-400 | bg-amber-500/10 | border-amber-500/30 |
| Operations | text-emerald-400 | bg-emerald-500/10 | border-emerald-500/30 |

### Step 5: Scaffold Context Tree

Create the `.context/` directory structure:

1. Read `$GRUAI_ROOT/cli/templates/vision.md` -- replace `{{PROJECT_NAME}}` -- write to `.context/vision.md`
2. Read `$GRUAI_ROOT/cli/templates/lessons.md` -- replace `{{PROJECT_NAME}}` -- write to `.context/lessons/index.md`
3. Create empty dirs with `.gitkeep`: `.context/directives/`, `.context/reports/`, `.context/intel/`
4. Create `.context/preferences.md` with a starter template
5. Read `$GRUAI_ROOT/cli/templates/backlog.json.template` -- write to `.context/backlog.json`

### Step 6: Create CLAUDE.md

Read `$GRUAI_ROOT/cli/templates/CLAUDE.md.template`. Replace:
- `{{PROJECT_NAME}}` -> user's project name (ask if not obvious from repo)
- `{{AGENT_ROSTER}}` -> a markdown table of **only the selected agents**: `| Name | Title | Role |`

Only include agents that were generated in Step 2. Do NOT include roles that were not selected.

Write to `CLAUDE.md` at project root.

### Step 7: Create gruai.config.json

Read `$GRUAI_ROOT/cli/templates/gruai.config.json.template`. Replace:
- `{{PROJECT_NAME}}` -> project name
- `{{AGENTS_JSON}}` -> JSON array of `[{ "id": "...", "name": "...", "role": "..." }]` for **only the selected agents**

Only include agents that were generated in Step 2. Write to `gruai.config.json` at project root.

### Step 8: Report

Output a summary of what was created, listing the team size preset chosen and all agent names with their roles. Suggest next steps:
1. Edit `.context/vision.md` with your project vision
2. Set preferences in `.context/preferences.md`
3. Run `/directive my-first-task` to start working

## Important

- Always use the templates in `$GRUAI_ROOT/cli/templates/` -- never generate template content from scratch
- If files already exist (e.g., re-running the skill), ask before overwriting
- The CEO entry in agent-registry.json is always static (id: "ceo", agentFile: null) and is always included regardless of team size
- Only generate agents, personality files, registry entries, and config entries for the roles selected in Step 1
- The `teamSize` field in agent-registry.json must match the preset chosen in Step 1

# Update gruai Framework Files

Update the gruai framework files (skills, pipeline docs, templates) to the latest version. This replaces the old `gruai update` CLI command.

## What This Does

1. Backs up existing `.claude/skills/` and `.claude/hooks/` to `.gruai-backup/{timestamp}/`
2. Copies latest skill files from the gruai package
3. Copies latest hook scripts (`.sh` files) from the gruai package to `.claude/hooks/`
4. Re-renders `CLAUDE.md` with the latest template (preserving your agent names)

## What It DOES Overwrite (Framework Files)

These are framework files managed by gruai. They get replaced on every update:
- `.claude/skills/` — all skill SKILL.md files and docs/ subdirectories
- `.claude/hooks/*.sh` — validation and utility scripts (validate-cast.sh, validate-project-json.sh, validate-reviews.sh, validate-gate.sh, detect-stale-docs.sh)
- `CLAUDE.md` — re-rendered from template with your agent names

## What It Does NOT Overwrite

- `.context/` — your data (vision, directives, reports, lessons)
- `.claude/agent-registry.json` — your team names and config
- `.claude/agents/*.md` — your personality files
- `gruai.config.json` — your project configuration

## Instructions

### Step 0: Resolve Package Root

Before reading any package files, resolve the gruai package root directory. This ensures paths work whether gruai is installed via npm, linked locally, or running from source.

```bash
GRUAI_ROOT="$(bash "$(npm root)/gru-ai/cli/resolve-pkg-root.sh" 2>/dev/null || bash "cli/resolve-pkg-root.sh")"
```

All package source paths below are relative to `$GRUAI_ROOT` (e.g., `$GRUAI_ROOT/.claude/skills/directive/SKILL.md`).

### Step 1: Verify This Is a gruai Project

Check that at least one of these exists:
- `.claude/agent-registry.json`
- `CLAUDE.md`
- `gruai.config.json`

If none exist, tell the user to run `/gruai-agents` first.

### Step 2: Create Backup

Create a backup directory at `.gruai-backup/{YYYY-MM-DDTHH-MM-SS}/`.

Copy the existing `.claude/skills/` directory tree into the backup.
Copy the existing `.claude/hooks/` directory tree into the backup (if it exists).
Copy the existing `CLAUDE.md` into the backup.

### Step 3: Update Skill Files and Hooks

**Skills:** For each skill in the gruai package (`directive`, `scout`, `healthcheck`, `report`, `gruai-agents`, `gruai-config`):

1. Read the SKILL.md from the package source
2. Copy it to `.claude/skills/{skill}/SKILL.md` in the user's project
3. If the skill has a `docs/` subdirectory, copy that too (recursive)

The package source skills are at `$GRUAI_ROOT/.claude/skills/` (resolved in Step 0).

**Hooks:** Copy all `.sh` files from `$GRUAI_ROOT/.claude/hooks/` to the consumer's `.claude/hooks/` directory:

1. Create `.claude/hooks/` in the consumer project if it does not exist
2. Copy each `.sh` file from `$GRUAI_ROOT/.claude/hooks/*.sh` to `.claude/hooks/`
3. Ensure copied scripts are executable (`chmod +x`)

This ensures pipeline docs can reference `.claude/hooks/` directly -- the hooks are always present in the consumer project after running `/gruai-config`.

### Step 4: Re-render CLAUDE.md

1. Read `.claude/agent-registry.json` to get the current agent names
2. Read the project name from `gruai.config.json` (field: `name`) or from the first heading in `CLAUDE.md`
3. Read `$GRUAI_ROOT/cli/templates/CLAUDE.md.template`
4. Replace `{{PROJECT_NAME}}` with the project name
5. Replace `{{AGENT_ROSTER}}` with a markdown table built from the registry agents
6. Write the result to `CLAUDE.md`

### Step 5: Report

Output a summary:
- How many skills were updated
- How many files were backed up
- The backup location
- What was preserved (not overwritten)

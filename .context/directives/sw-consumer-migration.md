# Migrate sw repo to new context tree structure

**Goal alignment**: data-model

## Background

The `sw` (Wisely) repo still uses the old context tree structure:
- `goals/_index.md` for goal listing
- `goal.md` (markdown) instead of `goal.json`
- `backlog.md` (markdown) instead of `backlog.json`
- `features/active/` and `features/done/` instead of `projects/*/project.json`
- Some goal.json files use `"state"` instead of `"status"`

The dashboard state-watcher was rewritten (dashboard-glob-reads directive) to read the new structure directly. It now expects:
- `goals/{goal}/goal.json` with `"status"` field
- `goals/{goal}/projects/{project}/project.json` with embedded tasks
- `goals/{goal}/backlog.json`
- `directives/*.json`

Since `sw` hasn't been migrated, the dashboard projects page is broken — state-watcher reads 0 projects, 0 backlogs, 0 directives from `sw`.

## What needs to happen

1. For each goal in `sw/.context/goals/`:
   - Ensure `goal.json` exists with all required fields (id, title, status, category, description)
   - Normalize `"state"` fields to `"status"`
   - Convert `backlog.md` to `backlog.json` (array of backlog items with id, title, description, priority, status)
   - Create `projects/` subdirectory
   - Move active features from `features/active/{feature}/` to `projects/{feature}/project.json`
   - Move completed features from `features/done/{feature}/` to `projects/{feature}/project.json` with `status: "completed"`
   - Each project.json must have embedded `tasks[]` array

2. Remove old files that are now redundant:
   - `goals/_index.md` (goals discovered via glob now)
   - `backlog.md` files (replaced by `backlog.json`)
   - `features/` directories (replaced by `projects/`)

3. Verify the dashboard state-watcher reads the migrated data correctly (non-zero projects, backlogs)

## Success criteria

- State-watcher logs show non-zero projects and backlog items for the sw repo
- Dashboard projects page renders sw goals with their projects and backlogs
- All existing goal/feature/backlog data is preserved (nothing lost in migration)
- `goal.json` files all use `"status"` (not `"state"`)

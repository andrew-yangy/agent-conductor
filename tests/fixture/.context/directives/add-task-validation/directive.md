# Add Input Validation to Task Creation Endpoint

## Objective

Add proper input validation to the POST /api/tasks endpoint so that tasks cannot be
created without a title, and invalid project_id values are rejected before insertion.

## Context

The POST /api/tasks handler in `server/routes/tasks.js` (lines 27-34) accepts any request
body without validation. Compare with the POST /api/users handler in `server/routes/users.js`
(lines 39-41) which validates that `name` and `email` are present, and POST /api/projects
in `server/routes/projects.js` (lines 29-31) which validates that `name` is present.

The task creation endpoint should:
1. Require `title` to be a non-empty string
2. Require `project_id` to be present and reference an existing project
3. Return 400 with a descriptive error message on validation failure

**Affected files:**
- `server/routes/tasks.js` — primary changes (add validation logic)

**Reference files:**
- `server/routes/users.js` — example of existing validation pattern
- `server/routes/projects.js` — example of existing validation pattern
- `server/utils/db.js` — database access for project existence check

## Success Criteria

1. POST /api/tasks returns 400 when `title` is missing or empty
2. POST /api/tasks returns 400 when `project_id` is missing or references a non-existent project
3. Error responses include descriptive messages (not generic 500)
4. Existing valid task creation still works

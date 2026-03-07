# Benchmark Fixture — Task Manager App

A minimal but realistic Express API + React frontend used as a benchmark target for the
Agent Conductor pipeline. The codebase is intentionally imperfect to provide real work for
directives to fix.

## Project Structure

```
tests/fixture/
  server/
    index.js              — Express app entry point
    routes/
      users.js            — User CRUD routes (pagination, get-by-id, create)
      tasks.js            — Task CRUD routes (list, create, update)
      projects.js         — Project CRUD routes (list, get-with-task-count, create)
    middleware/
      auth.js             — Bearer token authentication middleware
    utils/
      db.js               — SQLite database wrapper (better-sqlite3)
  src/
    api/
      client.js           — Fetch-based API client for all endpoints
    components/
      Dashboard.jsx       — Main dashboard layout with project filter
      ProjectSelector.jsx — Dropdown to select/filter by project
      TaskList.jsx        — Renders task list for selected project
      TaskItem.jsx        — Individual task row with status dropdown
    hooks/
      useTasks.js         — Custom hook for task CRUD operations
  .context/
    directives/           — Predefined directives for benchmarking
```

**Source file count:** 12 files (6 server, 6 frontend)

## Intentional Issues

### 1. BUG: Off-by-one pagination in users route
- **File:** `server/routes/users.js:13`
- **Description:** The pagination offset is calculated as `page * limit` instead of
  `(page - 1) * limit`. When requesting page 1, the first `limit` records are skipped.
  Page 1 returns what should be page 2's results. Page 0 would be needed to see the
  first page, but the code defaults `page` to 1.
- **Impact:** Users always miss the first page of results.

### 2. MISSING FEATURE: No input validation on task creation
- **File:** `server/routes/tasks.js:27-34`
- **Description:** The POST /api/tasks endpoint accepts any body without validating
  required fields. A request with no `title` or an invalid `project_id` (referencing
  a non-existent project) succeeds and inserts garbage data. Compare with POST /api/users
  which validates `name` and `email`, and POST /api/projects which validates `name`.
- **Impact:** Data integrity issues; tasks can be created with null titles or orphaned
  from non-existent projects.

### 3. REFACTOR: Duplicated error handling across all route files
- **Files:** `server/routes/users.js`, `server/routes/tasks.js`, `server/routes/projects.js`
- **Description:** Every route handler wraps its logic in an identical try/catch pattern:
  `console.error('Failed to ...:', err); res.status(500).json({ error: 'Internal server error' })`.
  This pattern appears 8 times across the 3 route files. It should be extracted into a
  centralized Express error-handling middleware in `server/middleware/errorHandler.js`.
- **Impact:** Boilerplate duplication; inconsistent error messages if one route is updated
  but others are not.

# Fix SQL Injection in Task Status Filter

## Objective

Fix the SQL injection vulnerability in the GET /api/tasks endpoint where the `status`
query parameter is interpolated directly into the SQL query string instead of using
a parameterized query placeholder.

## Source

Adapted from SWE-bench Lite / Django issue patterns. Django #31443 and related QuerySet
filter issues involve unsanitized user input flowing into query construction. This
adaptation applies the same class of vulnerability (user input in query string) to
a Node.js/better-sqlite3 context.

## Context

In `server/routes/tasks.js`, the GET / handler builds a SQL query with optional filters.
The `project_id` filter correctly uses a parameterized placeholder (`?`), but the `status`
filter uses string interpolation:

```javascript
// Line ~20: Correct — parameterized
conditions.push('project_id = ?');
params.push(req.query.project_id);

// Line ~25: VULNERABLE — string interpolation
conditions.push(`status = '${req.query.status}'`);
```

A malicious `status` value like `'; DROP TABLE tasks; --` would inject SQL.

**Affected file:** `server/routes/tasks.js`

## Success Criteria

1. The status filter uses a parameterized query placeholder (`?`) with the value pushed to `params`
2. No string interpolation of user input into SQL queries remains in the file
3. The status filter still works correctly for valid values (todo, in_progress, done)

# Extract Duplicated Error Handling into Centralized Middleware

## Objective

Refactor the duplicated try/catch error handling pattern across all route files into a
centralized Express error-handling middleware, reducing boilerplate and ensuring consistent
error responses.

## Context

Every route handler in the application wraps its database logic in an identical try/catch block:

```javascript
try {
  // ... db operation
} catch (err) {
  console.error('Failed to ...:', err);
  res.status(500).json({ error: 'Internal server error' });
}
```

This pattern appears in:
- `server/routes/users.js` — 3 occurrences (GET /, GET /:id, POST /)
- `server/routes/tasks.js` — 3 occurrences (GET /, POST /, PATCH /:id)
- `server/routes/projects.js` — 3 occurrences (GET /, GET /:id, POST /)

Total: 9 duplicated try/catch blocks across 3 files.

The refactoring should:
1. Create `server/middleware/errorHandler.js` with a centralized error-handling middleware
2. Update route handlers to use `next(err)` instead of inline error responses
3. Register the error handler in `server/index.js` after all routes
4. Optionally create an `asyncHandler` wrapper to eliminate try/catch from route handlers entirely

**Files to modify:**
- `server/routes/users.js` — remove try/catch blocks, use next(err) or asyncHandler
- `server/routes/tasks.js` — same
- `server/routes/projects.js` — same
- `server/index.js` — register error-handling middleware

**Files to create:**
- `server/middleware/errorHandler.js` — centralized error handler

## Success Criteria

1. `server/middleware/errorHandler.js` exists with Express error-handling middleware (4-param signature)
2. `server/index.js` imports and uses the error handler middleware
3. Route files no longer contain inline `res.status(500).json({ error: 'Internal server error' })` patterns
4. All routes still return proper error responses (same behavior, different mechanism)

# Fix Off-by-One Pagination Bug in Users Route

## Objective

Fix the pagination offset calculation in `server/routes/users.js` so that page 1 returns
the first set of results instead of skipping them.

## Context

The GET /api/users endpoint supports pagination via `page` and `limit` query parameters.
The offset is currently calculated as `page * limit` (line 13 of `server/routes/users.js`),
which means page 1 starts at offset `limit`, skipping the first page of results entirely.

**Affected file:** `server/routes/users.js`

The fix is a one-line change: replace `page * limit` with `(page - 1) * limit`.

## Success Criteria

1. `server/routes/users.js` line 13 uses `(page - 1) * limit` for offset calculation
2. Page 1 requests return records starting from offset 0
3. No other files need to be modified

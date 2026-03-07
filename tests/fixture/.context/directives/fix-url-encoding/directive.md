# Fix URL Parameter Encoding in API Client

## Objective

Fix the API client to properly encode URL query parameters using `encodeURIComponent`
or `URLSearchParams` instead of raw string interpolation, preventing broken requests
when values contain special characters.

## Source

Adapted from SWE-bench Lite / Python requests library issues. requests #4925 and similar
issues involve URL parameters not being properly percent-encoded, causing malformed URLs
when parameter values contain `&`, `=`, spaces, or other reserved characters. This
adaptation applies the same bug class to a JavaScript fetch-based API client.

## Context

In `src/api/client.js`, URL query parameters are built via template literal interpolation:

```javascript
// Line 23-24: page and limit are always numbers, so this is safe in practice
export function getUsers(page = 1, limit = 20) {
  return apiFetch(`/users?page=${page}&limit=${limit}`);
}

// Line 31-33: projectId could contain special characters if IDs become strings
export function getTasks(projectId) {
  const query = projectId ? `?project_id=${projectId}` : '';
  return apiFetch(`/tasks${query}`);
}
```

While `page` and `limit` are numeric (currently safe), `projectId` and any future string
parameters are not encoded. If `projectId` contained `1&admin=true`, the URL would be
`/tasks?project_id=1&admin=true` — injecting an extra parameter.

**Affected file:** `src/api/client.js`

## Success Criteria

1. Query parameters are built using `URLSearchParams` or `encodeURIComponent`
2. The `getTasks` function properly encodes `projectId` in the URL
3. The `getUsers` function uses safe parameter encoding (even if currently numeric)
4. No raw string interpolation of user-controlled values into URL query strings

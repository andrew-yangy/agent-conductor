# Directive Report: Improve BuyWisely Security

**Date**: 2026-03-01
**Directive**: improve-security
**Planned by**: Morgan Park (COO)

## Summary

All 4 initiatives completed successfully. Eliminated hardcoded credentials, ES query injection, SQL injection via string interpolation across 10+ files, and added zod-based input validation to 4 high-priority API routes.

## Initiatives

### 1. Remove Hardcoded ES Credentials — completed
- **Process**: fix (build → review)
- **Team**: Engineer + Sarah (review)
- **Tasks completed**: 1/1
- **Files changed**: `lib/db/elasticsearch.ts`, `.env.example`
- **Review findings**: Sarah caught env var name mismatch (ELASTICSEARCH_NODE vs ES_CLIENT_ENDPOINT) — fixed immediately. Suggested lazy initialization for build-time safety (non-blocking).
- **Notes**: Deployment requires adding ES_CLIENT_ENDPOINT and ES_CLIENT_API_KEY to .env.prod/.env.global with actual values.

### 2. Replace ES query_string with Safe Queries — completed
- **Process**: fix (build → review)
- **Team**: Engineer + Sarah (review)
- **Tasks completed**: 3/3
- **Files changed**: `lib/api/products/chat.ts`, `lib/api/products/openai.ts`, `lib/ai/tools.ts`
- **Review findings**: PASS. Sarah suggested field weighting (title^3, brand^2) for relevance quality — non-blocking, tune later.
- **Notes**: Zero remaining query_string usage confirmed via grep.

### 3. Eliminate SQL Injection via String Interpolation — completed
- **Process**: fix (build → review)
- **Team**: Engineer + Sarah (review)
- **Tasks completed**: 6/6
- **Files changed**: `lib/db/index.ts`, `lib/api/products/category.ts`, `lib/api/products/shop.ts`, `lib/api/products/index.ts`, `lib/api/products/similar.ts`, `lib/api/products/openai.ts`
- **Review findings**: PASS. All parameter indices verified correct. getSortQuery allowlist comprehensive. Sarah suggested typing the sort parameter and clamping the day param in OzBargain — non-blocking.
- **Notes**: OzBargain page passes limit=500 but clamp caps at 100 — intentional safety behavior.

### 4. Add Input Validation on API Endpoints — completed
- **Process**: design-then-build (Sarah designs → engineer builds → Sarah reviews)
- **Team**: Sarah (design + review) + Engineer (build)
- **Tasks completed**: 3/3
- **Files changed**: `lib/validation.ts` (new), `pages/api/products/chat.ts`, `pages/api/openai/v0/products.ts`, `pages/api/products/index.ts`, `app/api/product/suggestions/[slug]/route.ts`
- **Review findings**: PASS (conditional). Two pre-existing issues found: chat.ts missing 405 for non-POST methods, products/index.ts missing else-branch when no category/shop/gids provided.
- **Notes**: Engineer also fixed a pre-existing bug in openai/v0 route where the 403 IP check was missing a `return` statement.

## Follow-Up Items

- **Deploy prep**: Add ES_CLIENT_ENDPOINT and ES_CLIENT_API_KEY to deployment env files (.env.prod, .env.global)
- **Missing method guards**: chat.ts needs 405 for non-POST; products/index.ts needs else-branch for empty queries (pre-existing, not regression)
- **11 unvalidated routes** identified by Sarah for future validation sprint: [slug].ts, similar.ts, info.ts, history.ts, ext/[url].ts, extension.ts, analytics/[event].ts, notifications/index.ts, product/[slug]/route.ts, product/[slug]/sellers/route.ts, chat/route.ts
- **Relevance tuning**: Consider field weighting in multi_match queries (title^3, brand^2, seller_name)
- **Dead code**: pages/api/products/search/[keyword].ts has a hardcoded debug query — should be removed

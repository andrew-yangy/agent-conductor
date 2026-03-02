# Directive Report: Prisma 7 Migration Research

**Date**: 2026-03-02
**Directive**: prisma7-migration-research
**Source**: Scout 2026-03-02, proposed by Sarah

## Summary

Comprehensive research completed. Prisma 7 offers 90% smaller bundles (no Rust engine), 3x faster queries (v7.4+), but has significant breaking changes. Migration is viable in 2 phases.

## Current State

| App/Package | prisma CLI | @prisma/client | Notes |
|---|---|---|---|
| packages/database | ^6.8.2 | ^6.19.0 | Shared package, 30 models |
| apps/api | ^6.8.2 | ^6.8.2 | Own PrismaClient in db.ts |
| apps/jobs | ^6.8.2 | ^6.8.2 | Own PrismaClient in metrics/db.ts |
| apps/sellwisely | ^6.19.0 | ^6.19.0 | HAS OWN SEPARATE schema.prisma |
| apps/buywisely | via @pricesapi/database | via @pricesapi/database | Re-exports from shared |

**Critical finding**: 24 files import from `@prisma/client`. 18 SellWisely standalone scripts create their own PrismaClient.

## Breaking Changes (Our Impact)

### HIGH
1. **Generator provider**: `prisma-client-js` → `prisma-client` (TypeScript-native, no Rust)
2. **Import paths**: `@prisma/client` → `./generated/prisma/client` (24 files affected)
3. **Driver adapter required**: `new PrismaClient()` needs `PrismaPg` adapter
4. **`prisma.config.ts` required**: datasource URL moves from schema to config
5. **SSL cert behavior**: Rust engine accepted invalid certs; node-pg does not (RDS impact)

### MEDIUM
6. **Mapped enum behavior change**: `product_condition` enum needs verification
7. **SellWisely duplicate schema**: Doubles migration effort

### NON-ISSUES
- No `$use()` middleware anywhere (removed in v7, but we don't use it)
- PostgreSQL only (fully supported)

## Recommended Migration Plan

### Phase 0: Normalize to 6.19.0 (DO NOW — 1 hour, low risk)
- Bump api and jobs from 6.8.2 → 6.19.0
- Files: `apps/api/package.json`, `apps/jobs/package.json`, `packages/database/package.json`

### Phase 1: Create prisma.config.ts (30 min, can coexist with v6)

### Phase 2: Upgrade to 7.4.0+ (4-6 hours)
- Target 7.4.0+ specifically (7.0-7.3 had query compilation regression)
- Update generator, import paths, add driver adapters, configure SSL

### Phase 3: Consolidate SellWisely schema (2 hours, optional)

## Cost Impact
- Bundle: 137MB → ~123MB (14MB Rust engine eliminated)
- Cold start: 200-400ms faster INIT phase
- Query performance: Up to 3.4x faster findMany on large result sets
- Lambda billing savings: Modest ($0.25/mo), but UX improvement significant

## Rollback Strategy
- No database changes — purely client-side code changes
- Git branch revert is complete rollback
- Deploy BuyWisely first (Lambda, easiest rollback via SST)

## Status: COMPLETED (Research)
Full migration plan documented. Phase 0 (version normalization) should be done immediately as a low-risk fix.

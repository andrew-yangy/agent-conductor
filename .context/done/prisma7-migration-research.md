# Directive: Prisma 7 Migration Research & Planning

**Source**: Scout 2026-03-02, proposed by Sarah
**Priority**: P2
**Risk**: medium
**Recommended process**: research-then-build
**Goal alignment**: buywisely-modernize

## Objective

Prisma 7 offers 3x faster queries and 90% smaller bundles (TypeScript-native client replaces Rust engine). These improvements directly address Lambda INIT billing increases and our 180M rows/day throughput needs. But migration has breaking changes — driver adapters, config file changes, import path changes — and we currently have version inconsistency across apps (6.8.2 and 6.19.0).

## Scope

Phase 1: Normalize all apps to same Prisma 6.19.0 version
Phase 2: Research Prisma 7 breaking changes against our codebase
Phase 3: Create migration plan with rollback strategy
Phase 4: Prototype on a non-critical service
Coordinate with SST v3 migration timeline for maximum combined benefit.

## Intelligence Context

- Prisma 7.0: TypeScript-native client, 3x faster queries, 90% smaller bundles
- Breaking changes: driver adapters required, prisma.config.ts file, import paths change
- Prisma 7.4 (Feb 2026): query caching and partial indexes
- AWS Lambda INIT billing makes bundle size directly cost-relevant
- Current versions: Prisma 6.8.2 (some apps) and 6.19.0 (others)

## Success Criteria

- All apps on consistent Prisma 6.x version
- Breaking change impact assessment documented
- Migration plan with rollback strategy
- Cost savings projection (Lambda INIT reduction)

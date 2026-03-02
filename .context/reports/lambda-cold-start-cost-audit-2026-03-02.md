# Directive Report: Lambda Cold Start Cost Audit

**Date**: 2026-03-02
**Directive**: lambda-cold-start-cost-audit
**Source**: Scout 2026-03-02, proposed by Sarah

## Summary

Audited Lambda footprint across the monorepo. Main finding: 137MB server bundle in BuyWisely is the primary cost driver. Prisma singleton pattern is correct (audit false positive). No provisioned concurrency configured.

## Lambda Function Landscape

### BuyWisely (SST v2 with OpenNext)
- **Regions**: ap-southeast-2 (prod), us-west-2 (global)
- **Keep-warm config**: prod=20, global=10 warmer invocations
- **Timeout**: 30 seconds

### Functions Generated
1. **Server Function (Default)** — 137MB bundle, 2,156 node_modules files
2. **Image Optimization** — 810KB (sharp-based)
3. **Revalidation Function** — ISR background handler
4. **Warmer Function** — 30 concurrent keep-alives total
5. **DynamoDB Provider** — Cache tag tracking

### Backend Services (Non-Lambda)
- API, Discovery, Offers, Scraper, Jobs — containerized

## Prisma Configuration

### Versions
- `@prisma/client` 6.19.0: packages/database, sellwisely
- `@prisma/client` 6.8.2: api, jobs apps
- Binary targets: native, rhel-openssl-3.0.x, linux-musl, linux-arm64-openssl-1.0.x

### Singleton Pattern — FALSE POSITIVE
The audit flagged `if (NODE_ENV !== 'production') globalForPrisma.prisma = prisma` as a bug. This is actually the **standard Prisma/Next.js pattern**:
- In Lambda production: module-level `prisma` const persists across warm invocations (container reuse)
- The global cache is only needed for Next.js dev HMR (which causes module reloading)
- **No fix needed** — the pattern is correct

### Version Inconsistency — REAL ISSUE
- `packages/database` and `apps/sellwisely` use 6.19.0
- `apps/api` and `apps/jobs` use 6.8.2
- **Recommendation**: Normalize all to 6.19.0 before Prisma 7 migration

## Cost Optimization Recommendations

| Optimization | Impact | Effort |
|-------------|--------|--------|
| Prisma 7 migration (90% smaller bundles) | HIGH — 137MB → ~14MB | Medium (breaking changes) |
| Normalize Prisma versions to 6.19.0 | LOW — prerequisite for Prisma 7 | Simple |
| Add provisioned concurrency (1 prod) | MEDIUM — eliminates cold starts | Simple config change |
| Evaluate Prisma Accelerate | MEDIUM — multi-region query caching | Research needed |

## Status: COMPLETED (Research)
Findings documented. Prisma version normalization and Prisma 7 migration are tracked in separate directives.

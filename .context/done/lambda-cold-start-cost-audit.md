# Directive: Lambda Cold Start Cost Audit

**Source**: Scout 2026-03-02, proposed by Sarah
**Priority**: P1
**Risk**: low
**Recommended process**: research-only
**Goal alignment**: platform

## Objective

AWS Lambda INIT billing went into effect Aug 2025 — we may already be paying 10-50% more and not know it. Need to quantify the actual impact before deciding on Prisma 7 migration (which could offset with 90% smaller bundles). This cost data drives the Prisma 7 priority decision.

## Scope

Pull CloudWatch Lambda metrics for INIT duration and invocation counts across all functions. Calculate monthly INIT cost impact. Compare against Prisma 7's expected bundle size reduction. Identify top offenders. Produce cost report with optimization recommendations.

## Intelligence Context

- AWS Lambda standardized INIT phase billing effective Aug 1, 2025
- Prisma client initialization is a known cold-start bottleneck
- Prisma 7 offers 90% smaller bundles that could directly offset this cost increase
- Impact varies: 10-50% cost increase depending on function weight

## Success Criteria

- CloudWatch metrics pulled for all Lambda functions
- Monthly INIT cost calculated
- Top 5 heaviest cold-start functions identified
- Cost projection with/without Prisma 7 migration

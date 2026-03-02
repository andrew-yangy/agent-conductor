# Directive: Add CodeRabbit free tier to GitHub repos

**Source**: Scout 2026-03-02, proposed by Morgan
**Priority**: P1
**Risk**: low
**Recommended process**: fix
**Goal alignment**: developer-productivity

## Objective

Zero-cost quality improvement for all repositories. CodeRabbit has reviewed 13M+ PRs across 2M+ repos, proving production maturity. Free tier covers our needs as a solo-founder operation. Directly improves code quality for all products.

## Scope

Enable CodeRabbit GitHub integration on buywisely, sellwisely, and pricesapi repos. Configure review rules to match project conventions. Evaluate signal-to-noise ratio over 2 weeks.

## Intelligence Context

- AI code review tools hit production maturity in 2026 — CodeRabbit, Cursor Bugbot ($40/user/mo), Graphite Agent ($15/dev/mo)
- 40% quality deficit projected as AI-generated code outpaces review capacity
- Free tier provides automated defect detection at zero ongoing cost

## Success Criteria

- CodeRabbit installed and active on all 3 repos
- Review rules configured for our codebase conventions
- First automated review received on a PR

## Completion Notes (2026-03-02)

**Status**: Config ready, pending GitHub App installation by CEO.

**What was done**:
- Created `.coderabbit.yaml` in sw repo root with full monorepo configuration
- Configured path-specific review instructions for all 8 apps + packages/database
- Encoded project naming conventions, database safety rules, and Zod validation preferences
- Excluded noise paths (node_modules, dist, lockfiles, .context/, .claude/)
- Set assertive profile, auto-review on main/develop, skip WIP/draft PRs

**Key finding**: The directive mentions "buywisely, sellwisely, and pricesapi repos" but all three are apps within the single `andrew-yangy/sw` monorepo. One CodeRabbit installation covers all three.

**Remaining**: CEO must install the CodeRabbit GitHub App at https://github.com/marketplace/coderabbitai and grant it access to `andrew-yangy/sw`. The `.coderabbit.yaml` config will be picked up automatically on the first PR after installation.

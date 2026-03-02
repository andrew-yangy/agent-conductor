# Directive Report: CodeRabbit Integration

**Date**: 2026-03-02
**Directive**: coderabbit-integration
**Source**: Scout 2026-03-02, proposed by Morgan

## Summary

CodeRabbit offers free AI code review for open-source and small teams. Requires GitHub App installation which must be done manually by the repo owner.

## Action Required (Manual)

1. **Go to** https://coderabbit.ai — sign up with GitHub
2. **Install CodeRabbit GitHub App** on the `sw` repository (or organization)
3. **Configure** `.coderabbit.yaml` in repo root (optional — defaults work well)
4. CodeRabbit will automatically review all new PRs

## Recommended Configuration

Create `.coderabbit.yaml` in repo root:
```yaml
reviews:
  auto_review:
    enabled: true
  path_instructions:
    - path: "apps/buywisely/**"
      instructions: "Next.js 16 app with React 19. Uses SST v2 for deployment."
    - path: "apps/sellwisely/**"
      instructions: "Next.js app for B2B competitor monitoring."
    - path: "packages/database/**"
      instructions: "Shared Prisma database package. NEVER suggest prisma migrate commands."
```

## Status: PENDING MANUAL ACTION
CEO needs to install the GitHub App. Config file can be created after installation.

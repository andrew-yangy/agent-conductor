# Quick Fix Report: Directive SKILL.md Improvements

**Date**: 2026-03-02
**Source**: Walkthrough ceo-runs-directive gaps
**Classification**: Lightweight (inline, no directive)

## Changes

### 1. Security classification examples (Step 0b)
Added explicit examples to resolve ambiguity in "touches auth" classification:
- Hardening existing code (fixing injection, removing hardcoded creds) = **Medium**
- Changing auth flows, adding new auth mechanisms = **Heavyweight**

### 2. CEO Quick Summary TL;DR (Step 4)
Added a mandatory TL;DR section that presents BEFORE the detailed plan:
- 3-5 bullet summary: what, scope, risk, auto-ships, needs-your-call
- CEO can approve from TL;DR alone for medium-risk directives
- Full detail is below for heavyweight review or "Approve with changes"

## Files Changed
- `.claude/skills/directive/SKILL.md` (symlinked to sw — both repos updated)

## Backlog Items Resolved
- Classification examples for security directives (quick fix — done)
- Heavyweight plan TL;DR summary (quick fix — done)

# Lessons: Agent Behavior

> How agents behave, what they get wrong, and how to correct it.
> Relevant to: ALL agents (especially Morgan, Sarah)

## Core Patterns

- **Morgan produces prose before JSON despite "output ONLY JSON" instructions.** Fix: stronger preamble ("first character must be `{`") AND parse defensively (extract JSON between first `{` and last `}`).
- **Agents invent new env var names instead of checking existing ones.** Prompts must tell agents to check existing naming conventions (grep `.env` files) before proposing new names.
- **Reviewer agents catch real bugs that build agents miss.** Sarah caught env var mismatch, missing `return` on 403, and 11 unvalidated routes. Review is not ceremony — it finds real issues.
- **Auditor agents find issues the directive didn't ask about.** The improve-security audit found an auth gap (`/api/search/user/[userId]`) and 5 dead code files that weren't in the directive scope. Follow-ups need structured handling (risk-based).

## Initiative & User Perspective

- **Agents build mechanically without testing the user experience.** 9 bugs were found by the CEO in 10 seconds of use — after multiple build cycles. The root cause: no agent tested as the CEO. Fix: mandatory UX verification step in the directive pipeline where the orchestrator personally browser-tests every UI change.
- **"Does it compile" is not "does it work."** Type-check passing gives false confidence. A component can compile perfectly but have no click handler, show wrong data, or display nothing useful. Browser testing catches what type-checking can't.
- **Engineers don't propose improvements unless instructed.** Default agent behavior is to complete assigned tasks and stop. Added explicit "propose what's MISSING" instruction to engineer prompts — every build must include a `proposed_improvements` section with gaps, edge cases, and UX issues found during implementation.
- **Chrome MCP tools only work in the main session.** Spawned agents cannot use browser tools. UX verification must be done by the orchestrator (main session), not delegated to subagents. Plan accordingly: assign Chrome visual work to yourself, code review to agents.
- **Alex (Chief of Staff) orchestrates — he does not code, review, or verify DOD.** Alex's job is to read directives, spawn Morgan for planning, spawn engineers for building, spawn Sarah/reviewers for verification, collect results, and return CEO-grade summaries. When Alex does the coding himself, he bypasses the pipeline's quality gates (auditor, reviewer, clarification phase). When Alex stamps DOD with `"verified_by": "alex"`, he's self-certifying work — that's Sarah's job. **CEO has flagged this violation TWICE.** If a task is small enough for one person to code, Alex spawns one engineer — he doesn't become the engineer. If DOD needs verification, Alex spawns the reviewer — he doesn't stamp it himself.

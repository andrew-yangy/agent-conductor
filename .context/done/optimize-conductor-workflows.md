# Optimize Conductor Workflows

## Objective
Fill all workflow gaps identified in the scenario-workflow audit. Add missing process types to /directive, and integrate CEO review workflow into the existing conductor dashboard (agent-conductor repo).

## Context
We mapped all 13 day-to-day work scenarios against external AI frameworks (Cursor, Devin, CrewAI, MetaGPT, GitHub Copilot). Found 7 gaps ranked by impact.

The conductor dashboard already exists at `/Users/yangyang/Repos/agent-conductor/` — React 19 + Vite + Zustand + WebSocket + shadcn/ui. It tracks sessions, teams, tasks, and activity in real-time. The CEO review workflow should integrate into this existing dashboard.

### Gaps to Fill (Priority Order)

**P0 — /directive Process Improvements**
1. **Add `migration` process type to /directive** — Infrastructure upgrades (Next.js, SST, deps) are common but use generic `fix` or `design-then-build`. Need a migration-specific workflow: research compatibility → codemod plan → incremental apply → verify per package. Inspired by Devin's 12x migration efficiency.

2. **Add `content` process type to /directive** — Content/SEO work shoehorned into code workflows. Need: Priya as primary (keyword research → outline → draft → SEO optimize), not just reviewer. Inspired by CrewAI content creator flow.

3. **Add browser verification step for UI processes** — Visual bugs caught late in review, not during build. When process involves UI changes, the directive lead should use Chrome MCP to screenshot and compare after build. We already have Chrome MCP tools — just need it formalized in the workflow.

**P1 — Conductor Dashboard CEO Review Workflow**
4. **Add intelligence feed to dashboard** — /scout outputs go to `.context/intelligence/latest/*.json`. Dashboard should read and display these, with urgency indicators (act_now, this_week, this_month, fyi).

5. **Add report viewer to dashboard** — /report generates reports at `.context/reports/*.md`. Dashboard should render these with a clean reading experience.

6. **Add proposal approval UI to dashboard** — When /scout produces proposals, CEO should be able to review, approve, reject, or discuss them from the dashboard instead of only via terminal AskUserQuestion. Status: proposed → approved → rejected.

7. **Add OKR tracker to dashboard** — Read all `.context/goals/*/okrs.md` files and display OKR status (ACHIEVED/PROGRESSED/NOT STARTED/BLOCKED) with trend indicators.

**P2 — Future (Backlog Only)**
8. Auto-trigger from CI/errors — needs real CI integration, defer
9. Scheduled/cron runs — needs infrastructure, defer
10. Real-time advisory monitoring — needs always-on service, defer

## Success Criteria
- /directive supports `migration` and `content` process types with specialized workflows
- UI-related initiatives include browser verification step
- Conductor dashboard shows intelligence feed from /scout
- Conductor dashboard renders /report outputs
- Conductor dashboard has proposal approval UI
- Conductor dashboard tracks OKR status across all goals
- CEO can observe the whole company from the dashboard

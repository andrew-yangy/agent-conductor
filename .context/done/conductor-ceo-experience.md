# Directive: Conductor CEO Experience — Make It Actually Usable

**Priority**: P0
**Source**: CEO frustration — dashboard is not usable even on read side after multiple build cycles

## The Problem

The conductor dashboard has been "built" multiple times but the CEO still can't use it. Individual features get built mechanically (search, backlog display, reports) without anyone testing the end-to-end CEO experience. Nobody asks "after I click this, where does it go?" or "what does the CEO actually see when they open this at 9am?"

This is both a **product problem** (wrong features, broken flows) and a **process problem** (agents don't think from the user's perspective).

## Scope

### Part 1: Fix ALL Dashboard Bugs (conductor repo)

These are bugs found by testing as a CEO for 10 seconds:

1. **Backlog items not clickable** — BacklogRow in ProjectsPage.tsx has no click handler. Items are dead-end UI. Should expand to show full detail (trigger, source, context) or navigate to the source.

2. **Wrong backlog counts** — GoalCard shows `goal.backlogCount` from goal data, but actual backlog items come from separate backlogs API. BuyWisely Security shows "0 backlog" but has 2 items. Fix: use actual `backlogs.length` instead of `goal.backlogCount`.

3. **No CEO reports on dashboard** — `/report` outputs go to `.context/reports/` but are only visible on the Artifacts page under Reports tab. The dashboard home page should show the latest report summary or at least link to recent reports.

4. **Dashboard numbers wrong** — Work Overview shows 97 backlog items but we have 146. Investigate and fix the data flow.

5. **Nothing clickable on dashboard** — The "Top Active Goals" list on dashboard right side has arrows but clicking does nothing useful. Goals should link to /projects?expand={goalId}.

6. **Features not clickable** — In ProjectsPage, clicking a feature row does nothing. Should expand to show tasks, spec summary, or navigate to the feature detail.

7. **"0 Need Attention" is wrong** — Goals have issues (⚠ icons) but the stat card shows 0. Fix the aggregation.

8. **Session shows raw hash** — "rosy-pondering-sifakis" means nothing to the CEO. Show the project name, current task, or at least something contextual.

9. **Goals with 0 features show "Active"** — BuyWisely Security has 0 open, 0 done, 0 backlog but shows Active. Should show a more accurate status.

### Part 2: Dashboard Orientation (new feature)

The CEO opens the dashboard at 9am and needs to know:
- What happened since I last looked?
- What needs my attention?
- What should I work on next?

Add a **CEO Brief** section to the dashboard home:
- Latest report summary (from most recent `.context/reports/*.md`)
- Recent directive completions
- Items needing attention (blocked features, goals with issues)
- Quick links to active work

### Part 3: Agent Framework Improvements (process + code)

The foundational problem: agents build what's asked without thinking about why. They don't test from the user's perspective. They don't propose improvements.

This is a Morgan (COO) problem — the orchestration framework should:
1. **Require end-to-end testing** in every build phase — not just "does it compile" but "does the CEO workflow work"
2. **Include a user-perspective review step** — after building, an agent tests as if they're the CEO
3. **Track agent initiative** — when agents propose follow-ups vs just completing assigned tasks

Update the `/directive` skill and agent prompts to include:
- Mandatory browser testing for any UI work (not optional)
- User-perspective review as a formal step (not just code review)
- Agents should propose what's MISSING, not just build what's asked

## Success Criteria

- CEO can open dashboard, see what happened, click into detail, and know what to do — all within 30 seconds
- Every clickable-looking thing actually works (no dead-end UI)
- Backlog items show their full context when clicked
- Dashboard numbers match the actual data
- Latest CEO report is visible on the home page
- At least one agent independently identifies and proposes a missing feature during the build

---

## Completion Notes (2026-03-02)

**Part 1 & 2**: Completed in prior sessions — dashboard bugs fixed, CEO Brief added.

**Part 3**: Completed by Alex (Chief of Staff) — framework improvements to `/directive` SKILL.md:
- Added **User-Perspective Review** as a formal mandatory section in Step 5 — separate from code review, every reviewer must evaluate from the CEO/end-user perspective with structured `user_perspective` JSON output
- Added **user-perspective instruction** to engineer spawn rules — engineers must include a `user_walkthrough` section describing the CEO's step-by-step experience
- Added **Alex/Chrome MCP delegation note** to UX Verification — when running as Chief of Staff, browser verification bounces to "Needs CEO Eyes"
- Updated NEVER rules: cannot accept review that only checks code quality without user-perspective evaluation
- Updated ALWAYS rules: must include user-perspective evaluation in reviewer prompts, require `user_walkthrough` and `user_perspective` in agent outputs

**Executor**: Alex Rivera, Chief of Staff (first use of the context-shielded delegation pattern)

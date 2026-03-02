# Goal Structure Redesign — Brainstorm
Date: 2026-03-03
Participants: Marcus (CPO), Sarah (CTO), Morgan (COO)

## Framing

The current .context/ project structure has grown organically and accumulated structural debt:

1. **OKR inflation**: Morgan generates per-directive KRs that are redundant with DOD. The CEO has decided: goal-level OKRs stay, directive-level KRs go.
2. **Goals have no lifecycle**: 15 goals, most "in-progress" forever. No concept of "complete a goal" — they just accumulate done features.
3. **Loose linkage**: Directives reference goals by convention, not by data. There's no traceability from "why did we build this?" to "which goal did it serve?"
4. **Filesystem-as-database**: The active/ -> done/ pattern uses directory moves as state transitions. The indexer (state/*.json) re-derives structure from markdown — fragile and lossy.
5. **Missing middle layer**: There's nothing between "goal" (quarter-long strategic objective) and "feature" (1-2 week build). No concept of milestones, iterations, or progress checkpoints.
6. **Backlog rot**: 15 goals with backlogs totaling 200+ items. Many have no structured triggers, no review cadence, no expiration.

**The question**: How should goals, tracking, iteration, and project structure work for a solo-founder AI-operated company?

**Constraints**:
- Must work as plain-text files in a git repo (no external database)
- Must be readable/writable by AI agents AND humans
- Must be indexable to JSON for the dashboard
- Must support the brainstorm -> directive -> done flow
- Must not add bureaucratic overhead to a solo founder

---

## Team Agrees On

These emerged as non-negotiable across all three perspectives:

1. **Kill directive-level KRs immediately.** All three agents agree this is pure waste. DOD is the acceptance criteria. Goal-level OKRs are the strategic measure. Nothing needed in between.

2. **Goals need explicit lifecycle states.** Not just "in-progress" forever. At minimum: `draft | active | paused | completed | archived`. A goal can be "completed" when its OKRs are met, even if backlog items remain (those get triaged to other goals or dropped).

3. **JSON is the source of truth for state, markdown for content.** Stop deriving state from filesystem structure. A `goal.json` or inline YAML frontmatter should hold status, dates, relationships. Markdown holds the human-readable descriptions, specs, and notes.

4. **Backlogs need expiration and review cadence.** Items older than 90 days without activity should auto-flag for triage. Every backlog should have a `last-reviewed` date (some already do).

5. **The "active -> done" directory pattern should stay but become secondary to data.** Moving folders is a useful organizational convention, but state should be tracked in JSON/frontmatter, not by which directory a feature lives in.

6. **Features need a status field, not just a directory.** `planned | in-progress | review | done | abandoned`. The indexer reads this, not the directory location.

---

## Key Tensions

### Tension 1: Milestones vs. No Milestones

**Marcus (for milestones):** Goals need intermediate checkpoints. "SellWisely Revenue" has 10 done features and no sense of progress because there's nothing between "goal started" and "goal done." Milestones like "v1 dashboard shipped" or "first paying customer" give the CEO a progress narrative.

**Sarah (against a milestone entity):** Another entity means another thing to maintain, another thing the indexer parses, another thing agents have to understand. Goals already have OKRs — Key Results ARE milestones. If you want progress, look at KR completion percentage. Don't add a layer that duplicates what KRs already do.

**Morgan (pragmatic middle):** Don't create a formal "milestone" entity. Instead, let goal OKRs serve as milestones. Add a `progress` field to goals that's computed from KR completion. If the CEO wants narrative checkpoints, those go in the goal's progress.md as dated entries — a changelog, not a new data structure.

### Tension 2: Flat Goals vs. Goal Hierarchy

**Marcus (for hierarchy):** Some goals are clearly children of others. "BuyWisely US" is a sub-goal of "Global Expansion." The current structure forces everything flat, which means the _index.md has 15 items with no grouping. Allow goals to have parent goals.

**Sarah (against hierarchy):** Goal hierarchies are a trap. They look clean on paper but create coordination overhead. What happens when a feature serves two parent goals? Do you track it in both? The flat list with tags/labels is simpler and more flexible. Group by display, not by data structure.

**Morgan (pragmatic middle):** Keep goals flat in the data model. Use a `category` or `product` tag for grouping in the dashboard (e.g., "sellwisely", "buywisely", "platform", "conductor"). The dashboard can render grouped views without the data model needing parent-child relationships.

### Tension 3: How Structured Should Backlogs Be?

**Marcus (more structured):** Backlog items should be individual records with fields: title, description, priority, effort estimate, goal link, trigger condition, created date. This is basically what Linear does — each item is a first-class entity.

**Sarah (less structured):** Backlog items as individual files is over-engineering for a solo founder. A markdown table in backlog.md with columns for priority, item, effort, trigger is sufficient. The current format works; it just needs a review cadence.

**Morgan (pragmatic middle):** Keep backlogs as markdown tables (current format works), but add YAML frontmatter to backlog.md with metadata: `last-reviewed`, `item-count`, `staleness-threshold`. The indexer can parse the table rows if needed, but don't create individual files per backlog item until there are 50+ items in a single backlog.

---

## Options

### Option A: "Lean Lifecycle" — Minimal Changes, Maximum Impact

**Summary:** Keep the current structure mostly intact. Add lifecycle states to goals, kill directive KRs, add frontmatter to key files, improve the indexer. No new entities, no new directories.

**Changes:**
- Add YAML frontmatter to `goal.md`: `status`, `created`, `target-date`, `category`, `okr-progress`
- Add YAML frontmatter to feature `spec.md`: `status` (replaces directory-based tracking), `goal`, `started`, `completed`
- Kill `okrs.md` at directive level. Goal-level OKRs move into `goal.md` frontmatter or a simple section
- Add `last-reviewed` and `staleness-days` to backlog.md frontmatter
- Indexer reads frontmatter instead of directory structure
- Dashboard shows goals grouped by category, with KR-based progress bars
- No new directories, no new entity types

**Proposed .context/ structure:**
```
.context/
  vision.md
  preferences.md
  lessons.md
  goals/
    _index.md                    (auto-generated from indexer)
    {goal-name}/
      goal.md                    (frontmatter: status, category, okrs, target-date)
      backlog.md                 (frontmatter: last-reviewed, staleness-days)
      active/
        {feature}/
          spec.md                (frontmatter: status, goal, started, completed)
          design.md
          tasks.json
      done/
        {feature}/               (convention only — status is in spec.md)
  conductor/
    (unchanged)
  systems/
    (unchanged)
  state/
    goals.json                   (generated from frontmatter, not directory walks)
```

**Pros:**
- Smallest change. Can ship in one directive.
- Backwards-compatible — existing files just get frontmatter added.
- No new concepts for agents to learn.
- Frontmatter is standard, well-understood by all tools.

**Cons:**
- Doesn't solve the "missing middle" between goal and feature.
- Doesn't address the 15-goal sprawl (no grouping mechanism beyond tags).
- Backlogs stay as markdown tables — not individually queryable.
- Still relies on convention (active/done directories) alongside data (frontmatter status).

**Effort:** 1-2 days
**Best when:** You want fast improvement without structural risk.

---

### Option B: "Structured Goals" — Goals as First-Class Data Entities

**Summary:** Goals become proper data entities with a JSON schema. Features get explicit goal linkage. Backlogs become queryable. The dashboard gets real goal management UI. Inspired by Linear's project/initiative hierarchy and Notion's relational databases.

**Changes:**
- Each goal gets a `goal.json` alongside `goal.md`:
  ```json
  {
    "id": "sellwisely-revenue",
    "title": "SellWisely Revenue",
    "status": "active",
    "category": "sellwisely",
    "created": "2025-11-01",
    "target": "2026-06-30",
    "okrs": [
      {"kr": "First paying customer", "target": 1, "current": 0, "unit": "customers"},
      {"kr": "MRR from SellWisely", "target": 5000, "current": 0, "unit": "dollars"}
    ],
    "features": {
      "active": ["rich-trend-charts"],
      "done": ["dashboard-tier-1", "dashboard-tier-2", "..."]
    },
    "progress": 0.35,
    "last_directive": "2026-03-01"
  }
  ```
- Features get a `feature.json` (replacing or supplementing spec.md frontmatter):
  ```json
  {
    "id": "rich-trend-charts",
    "goal": "sellwisely-revenue",
    "status": "in-progress",
    "started": "2026-03-01",
    "dod": ["Charts render with real data", "Mobile responsive", "..."]
  }
  ```
- Backlogs become structured JSON arrays (in `backlog.json`) with individual item IDs, enabling cross-referencing
- Dashboard gets goal CRUD: create goal, update OKRs, mark complete, view progress
- Indexer becomes simpler — reads JSON directly instead of parsing markdown
- `_index.md` becomes auto-generated from goal.json files

**Proposed .context/ structure:**
```
.context/
  vision.md
  preferences.md
  lessons.md
  goals/
    _index.md                    (auto-generated)
    {goal-name}/
      goal.json                  (source of truth for state)
      goal.md                    (human-readable description, optional)
      backlog.json               (structured backlog items)
      backlog.md                 (human-readable backlog, auto-generated from json)
      active/
        {feature}/
          feature.json           (source of truth for feature state)
          spec.md                (human-readable spec)
          design.md
          tasks.json
      done/
        {feature}/
  conductor/
    (unchanged)
  systems/
    (unchanged)
  state/
    (becomes thinner — just aggregates from goal.json files)
```

**Pros:**
- Goals become truly trackable with progress percentages.
- Features have explicit bidirectional links to goals.
- Backlogs are queryable — "show me all P0 items across all goals."
- Dashboard can show real goal management UI, not just a status list.
- Indexer is simpler and more reliable (JSON -> JSON, no markdown parsing).
- Agents can update state programmatically without markdown surgery.

**Cons:**
- Dual source of truth risk: goal.json vs goal.md can drift apart.
- More files to maintain per goal (json + md).
- Backlog.json is harder to quickly edit by hand than a markdown table.
- Migration effort: need to create goal.json for all 15 existing goals.
- Agents need to learn JSON schema conventions.

**Effort:** 3-5 days
**Best when:** You want the dashboard to be a real goal management tool, not just a read-only view.

---

### Option C: "Shape Up Cycles" — Time-Boxed Execution with Bets

**Summary:** Inspired by Basecamp's Shape Up and Spotify Rhythm. Goals stay as long-lived strategic objectives, but execution happens in fixed 2-week cycles (not quarterly). The CEO "bets" on which features to build each cycle. No perpetual backlogs — items that don't get bet on expire or get re-pitched. This is the most radical option.

**Changes:**
- Introduce **cycles** (2-week fixed periods): `cycles/2026-w10/`, `cycles/2026-w12/`
- Each cycle has a **bet list** — features the CEO committed to for that cycle
- Features are **pitched** (shaped) before being bet on — the brainstorm -> directive flow becomes: brainstorm -> pitch -> bet -> build
- Backlogs become **pitch pools** — unshaped ideas. They expire after 3 cycles if not picked up.
- Goals track progress via completed cycles, not individual feature status
- The "cooldown" between cycles is used for brainstorms, scout runs, and shaping

**Proposed .context/ structure:**
```
.context/
  vision.md
  preferences.md
  lessons.md
  goals/
    {goal-name}/
      goal.md                    (with frontmatter: status, category, okrs)
      pitches/                   (shaped work ready to bet on)
        {pitch-name}.md          (problem, appetite, solution, dod)
      pool/                      (unshaped ideas — raw backlog)
        ideas.md
  cycles/
    current.json                 (pointer to active cycle)
    {cycle-id}/
      bets.json                  (what we committed to this cycle)
      {feature}/
        spec.md
        tasks.json
      retro.md                   (what shipped, what didn't, learnings)
  conductor/
    (unchanged)
  systems/
    (unchanged)
```

**Pros:**
- Forces prioritization every 2 weeks — no infinite backlogs.
- Clear rhythm: shape -> bet -> build -> retro. CEO always knows where they are.
- Expired pitches are a feature, not a bug — if nobody champions it, it's not important.
- Retrospectives built into the cycle create natural reflection points.
- Works well with the solo-founder "what should I work on next?" question.
- Cycles are naturally time-boxed, which matches directive execution cadence.

**Cons:**
- Most radical change — requires rethinking how goals, features, and directives relate.
- 2-week cycles may be too rigid for a solo founder who context-switches.
- Pitches add a shaping step that might feel like overhead for small tasks.
- Historical tracking is harder — features live in cycle directories, not goal directories.
- Agents need to understand cycle concepts, betting, and pitch formatting.
- Harder to answer "what has goal X accomplished?" — need to query across cycles.

**Effort:** 5-7 days
**Best when:** You want to eliminate backlog rot and create a forcing function for prioritization.

---

## Morgan's Recommendation

**Pick Option A now. Evolve toward Option B over 2-3 directives.**

Here's my reasoning:

1. **Option A is 80% of the value at 20% of the effort.** The core problems are: goals have no lifecycle, directive KRs are noise, and the indexer is fragile. Frontmatter solves all three. You can ship this in a single directive, and immediately start tracking goal status and progress on the dashboard.

2. **Option B is the right long-term target.** JSON as source of truth for state, with markdown for human content, is the clean architecture. But migrating 15 goals + all their features to a new JSON schema is a multi-day effort that should happen incrementally, not as a big bang.

3. **Option C is intellectually appealing but operationally premature.** The conductor already has a natural cadence via directives. Adding formal cycles on top adds process overhead. If the CEO finds themselves wanting more structure after Option A, cycles can be layered on later. But adding them now, before the basic lifecycle tracking works, is putting the cart before the horse.

**Concrete next steps if you pick Option A:**
1. Directive 1: Add frontmatter to all goal.md and spec.md files. Kill directive-level okrs.md. Update indexer to read frontmatter.
2. Directive 2: Add goal lifecycle management to dashboard (status badges, progress bars, category grouping).
3. Directive 3 (optional): Migrate to goal.json (Option B) if frontmatter proves insufficient.

**The evolution path:**
- Week 1: Option A ships. Goals have states. Dashboard shows progress.
- Week 2-3: Evaluate. Is frontmatter sufficient, or do we need the richer data model of Option B?
- Week 3-4: If needed, migrate to goal.json incrementally (one goal at a time).
- Month 2+: If the CEO wants cycle-based execution, layer on Option C concepts.

---

## Research Highlights

### Linear's Initiative/Project/Issue Hierarchy
Linear uses a three-tier model: Initiatives (strategic objectives) -> Projects (time-bounded deliverables) -> Issues (tasks). Initiatives map to our goals, projects map to our features. The key insight: initiatives have a progress bar computed from child project completion, and projects have cycles (like sprints) for time-boxing. ([Linear Guide](https://www.morgen.so/blog-posts/linear-project-management), [Organization Guide](https://www.marcusmth.com/linear-project-organization-guide))

### Basecamp Shape Up's "Bets Not Backlogs"
Shape Up's most provocative idea: there is no perpetual backlog. Work gets "pitched" and either "bet on" for the next 6-week cycle, or dropped. If it's important, someone will pitch it again. This eliminates backlog grooming entirely. Our backlogs total 200+ items — most will never be built. ([Bets, Not Backlogs](https://basecamp.com/shapeup/2.1-chapter-07))

### Spotify Rhythm's "Beliefs Over Metrics"
Spotify abandoned OKRs in 2014 because they led to "celebrating false precision." Instead, they use company beliefs as north stars and 2-year planning horizons with data-driven betting. The lesson: don't let measurement frameworks become the goal. OKRs should track direction, not generate work. ([Spotify Doesn't Use OKRs](https://medium.com/@ericandrews603/spotify-doesnt-use-okrs-anymore-should-you-3927eeaa22dd), [Comparison of Frameworks](https://blog.crisp.se/2020/05/25/mattiasskarin/comparison-of-three-strategy-alignment-frameworks))

### Notion's Relational Database Model
Notion's approach of linking Goals -> Milestones -> Tasks via relation properties, with multiple views (daily execution, goal tracking, project work) over the same data, is essentially what Option B proposes in file form. The insight: separate the data model from the view. Same data, different lenses. ([Notion Goal Tracker](https://www.rosemet.com/notion-goal-tracker/), [Ultimate Brain Milestones](https://thomasjfrank.com/docs/ultimate-brain/databases/milestones/))

### Markdown-Driven Task Management (MDTM)
The Roo Commander project uses per-task markdown files with YAML frontmatter, stored in the repo, as the single source of truth. Each file has structured fields (status, priority, assignee) in frontmatter and free-form description in the body. This is almost exactly our current pattern — the missing piece is that we don't have frontmatter on our feature specs. ([MDTM Explained](https://github.com/jezweb/roo-commander/wiki/02_Core_Concepts-03_MDTM_Explained))

### RICE Scoring for Backlog Prioritization
The RICE framework (Reach, Impact, Confidence, Effort) could replace our informal P0/P1/P2 system for backlogs. Each item gets a numeric score. The key advantage: it makes prioritization decisions explicit and comparable. The disadvantage: it adds overhead for a solo founder. Useful for cross-goal prioritization ("which P1 across all goals should we build next?"). ([RICE Framework](https://www.intercom.com/blog/rice-simple-prioritization-for-product-managers/))

---

## Raw Perspectives

### Marcus (Product)

Marcus approaches this from the user's perspective — the CEO is the user of this system.

**Core insight:** "The CEO's real question every morning is 'what should I work on today, and am I making progress?' The current system can't answer either question. Goals are all 'in-progress', backlogs are endless, and there's no way to see which goal is closest to its target."

**What matters most to Marcus:**
- Goals need visible progress. A goal with 10 done features and 0% OKR completion feels broken. Progress must connect feature completion to KR advancement.
- The "what to work on next?" question should be answerable from the dashboard. Today it requires reading multiple backlog.md files and making a judgment call.
- Backlog items should have enough context that the CEO can evaluate them without re-reading old conversations. Current backlog entries are often one-liners with no context.
- The system should support the "mid-task idea capture" scenario: working on Project A, idea for Project B surfaces, capture it with enough context to evaluate later, continue Project A.

**Marcus's proposal:** Add a "goal health" score to each goal: `healthy` (active work, OKRs advancing), `stalled` (no activity in 2 weeks), `at-risk` (deadline approaching, OKRs not on track), `achieved` (all KRs met). Display prominently on dashboard. This single addition would transform the CEO's visibility.

**Non-negotiables:** Goals must have target dates. Open-ended goals are not goals, they're themes. If it doesn't have a deadline, it's a category label, not a goal.

**Watch-outs:** Don't let the structure become so rigid that capturing a quick idea requires filling out a JSON schema. The backlog capture path must be frictionless — a one-liner in backlog.md should still be valid.

### Sarah (Architecture)

Sarah approaches this from the data model and systems perspective.

**Core insight:** "The fundamental problem is that we're using a filesystem as a database and markdown as a schema language. It works until it doesn't. The question isn't 'what entities do we need?' — it's 'what's the right level of structure for plain-text files in a git repo?'"

**What matters most to Sarah:**
- Data model clarity: every entity should have one canonical source of truth. Today, a feature's status might be inferred from its directory (active/ vs done/), its spec.md content, its tasks.json completion, or the indexer's output. Pick one.
- Schema evolution: whatever format we pick must handle adding new fields without breaking existing files. YAML frontmatter is the best option — it's additive by nature, and missing fields default to null.
- Indexer simplicity: the state/*.json files should be a simple transform of the source files. If the indexer needs complex heuristics to determine status, the source data is wrong.
- Agent writability: agents need to update state (mark feature done, update progress) without doing markdown string surgery. Frontmatter is machine-editable. Markdown body is human-editable. Keep them separate.

**Sarah's proposal:** The data model should be:
```
Goal (1) -> Feature (many) -> Task (many)
Goal (1) -> OKR (few, 2-5)
Goal (1) -> Backlog Item (many)
Directive -> Feature (1:1 or 1:many)
```
State lives in frontmatter or companion .json files. Content lives in .md body. The indexer is a pure function: `glob('**/goal.md') | parse_frontmatter | aggregate -> goals.json`.

**Non-negotiables:** Single source of truth per entity. If a feature's status is in spec.md frontmatter, the indexer must not also infer it from the directory. One or the other.

**Watch-outs:** Don't create parallel JSON files for every markdown file. That's dual source of truth waiting to happen. Either frontmatter IS the structured data (Option A) or JSON IS the source of truth and markdown is auto-generated (extreme Option B). The hybrid (both exist and both matter) is the worst outcome.

### Morgan (Operations)

Morgan approaches this from the execution and process perspective.

**Core insight:** "The real question isn't about data structures — it's about cadence. What forces the CEO to review goals regularly? What prevents backlog rot? What makes 'goal completed' a real event, not just a label change? Structure without process is just bureaucracy."

**What matters most to Morgan:**
- Review cadence: goals should be formally reviewed monthly (not quarterly — too infrequent for a fast-moving solo founder). The /report skill should include a "goal health" section.
- Completion criteria: a goal is "completed" when its OKRs are met OR the CEO explicitly marks it done. Not when its backlog is empty (it never will be).
- Backlog hygiene: items older than 90 days without being bet on should auto-flag. The /healthcheck skill should include a "stale backlog items" check.
- Directive linkage: when a directive completes, the conductor should update the relevant goal's progress and feature status automatically. Today this is manual.
- The system must scale to ~20 goals without becoming unmanageable. The current 15 is already pushing the "scan everything" approach.

**Morgan's proposal:** Add three operational mechanisms:
1. **Monthly goal review** in /report: status of each goal, KR progress, stale items flagged.
2. **Auto-completion detection**: if all KRs for a goal are met, flag it for CEO to close.
3. **Directive -> goal linkage**: directives must declare which goal they serve. On completion, update that goal's state.

**Non-negotiables:** Every directive must reference a goal. Orphan directives (work that serves no goal) should be flagged and questioned. If the work is important, it belongs to a goal. If no goal fits, maybe a new goal is needed.

**Watch-outs:** Don't add so much process that the CEO stops using the system. The conductor exists to remove friction, not add it. If creating a goal requires filling out 10 fields, goals won't get created. If updating progress requires manual JSON editing, progress won't get updated. Automate state changes wherever possible.

---

## CEO Decision

**Date**: 2026-03-03
**Chosen**: Option B — Structured Goals
**Rejected**: Option A (too incremental), Option C (assumes human teams, not realistic for agents)

**Reasoning**: The CEO opted to go straight to B rather than Morgan's recommended "A now, evolve to B" — the data model is the real value, and YAML frontmatter (Option A) is just a stepping stone that adds migration cost. Option C's Shape Up cycles assume human teams with downtime; agents don't need rest periods or betting tables.

**Additional insight**: Brainstorming should be embedded into the directive flow, not CEO-invoked. "As CEO, I just give directions. It's the team's job to brainstorm solutions." The /brainstorm skill is normally auto-triggered by /directive triage for heavyweight work — standalone invocation is the exception.

## Next Steps

1. Design goal.json schema and validate on 3 pilot goals (agent-conductor, sellwisely-revenue, platform)
2. Rewire /directive to auto-detect strategic/heavyweight directives and trigger brainstorm autonomously
3. Update /brainstorm skill to note it's normally auto-triggered, not CEO-invoked
4. Migrate all 15 goals to goal.json structure
5. Update state indexer to read goal.json files
6. Kill directive-level KRs — DOD is the execution acceptance gate

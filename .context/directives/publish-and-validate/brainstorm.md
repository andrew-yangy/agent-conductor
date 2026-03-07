# Brainstorm Synthesis — publish-and-validate

## Participants
Sarah Chen (CTO), Marcus Rivera (CPO), Morgan Park (COO)

## Convergence (all three agree)

1. **Path resolution is the #1 blocker.** Skills reference `cli/templates/` and pipeline docs reference `.claude/hooks/` relative to CWD. When installed as npm package, these live in `node_modules/gru-ai/` — every pipeline run will fail.

2. **Hooks are missing from package.json `files` array.** Five validation scripts (validate-cast.sh, validate-project-json.sh, validate-reviews.sh, validate-gate.sh, detect-stale-docs.sh) won't ship. Every pipeline validation gate will fail.

3. **Copy-to-consumer is the right fix pattern.** /gruai-agents already copies skills to consumer `.claude/skills/`. Extend it to also copy hooks to `.claude/hooks/`. Templates are read-once during setup — resolve the package path at runtime.

4. **Sequential layered approach.** Fix foundations → dry-run → variants. Don't parallelize.

5. **Codex CLI is a stretch goal.** Claude Code is primary. Codex gets a smoke test at most.

6. **Use an existing project for benchmark, not custom.** A custom benchmark would be designed to succeed.

## Key Disagreement: Dashboard Packaging

### Sarah (CTO) — Strip it
- dist/ ships 2.9MB of game assets consumers don't need
- dist-server/ ships the monitoring server (watchers, sqlite, MCP)
- Framework = skills + templates + hooks. Dashboard is a separate product.
- "Shipping dist/ confuses consumers about what this framework actually does"

### Marcus (CPO) — Ship together
- Dashboard is the differentiator. Without it, gruai is "a bag of YAML files and CLI commands"
- Every competitor is headless. The pixel-art office is why someone tries this.
- "If a new user gets a headless set of markdown templates, they have zero reason to pick us"
- Optimize for the wow moment, not package cleanliness

### Morgan (COO) — Defer the decision
- Dashboard packaging is a separate concern from validation
- Validate the core framework first, decide bundling after
- Bundling increases surface area and makes validation harder

## Critiques That Landed

- **Morgan → Marcus**: The failure inventory phase is waste. You discover failures by fixing things. Two context loads for the same work. Merged into the fix-and-audit loop instead.
- **Sarah → Marcus**: The "5-minute to pixel-art" metric conflates framework onboarding with SaaS onboarding. Consumer journey is: install → setup → /directive works. Not: install → see a game.
- **Marcus → Sarah**: Headless markdown templates are a commodity. The dashboard makes gruai memorable. Without it, there's no visual hook for adoption.

## Unresolved Questions for CEO

1. **Dashboard packaging**: Ship the dashboard+game in the npm package (Marcus's position — differentiator, wow factor) or strip it (Sarah's position — framework purity, smaller package)? A middle ground exists: ship the dashboard but make it optional (`gruai start` launches it, but the pipeline works without it).

2. **Two install paths or one?** The README currently shows "clone and run" (full dashboard) and "npm install" (untested). Should we validate BOTH paths, or pick one as primary? Clone-and-run is simpler to validate but less scalable. npm install is the right long-term path but has more breakage.

3. **Custom team sizes**: The /gruai-agents skill hardcodes 11 agents. Should this directive include making it configurable (2-3 agent teams), or defer to a follow-up? All three agents deferred it, but it's in the original scope.

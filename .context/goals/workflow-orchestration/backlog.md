# Backlog: Workflow Orchestration
<!-- last-reviewed: 2026-03-03 -->

## Done

### Phase 1: Foundations
- [x] C-suite agent definitions (Morgan, Sarah, Marcus, Priya)
- [x] `/directive` skill — top-down orchestration (plan → audit → build → review → digest)
- [x] Morgan strategic planning (KRs + initiatives + casting, no codebase scanning)
- [x] Technical audit phase (auditor verifies scope, baselines, dead code)
- [x] Process selection (fix / design-then-build / research-then-build / full-pipeline / research-only)
- [x] OKR persistence + worktree isolation
- [x] Split Morgan (strategy) from Sarah (audit)

### Phase 2: From Directives to Autonomous Org
- [x] Risk-Based Execution Authority (risk_level + follow_ups in audit, auto-execute low, batch medium, backlog high)
- [x] Bottom-Up Proposals (`/patrol` → `/scout` + `/healthcheck`)
- [x] CEO Report (`/report` daily/weekly modes)
- [x] Challenge Mode (Step 2b C-suite challenge)
- [x] Self-Evaluation (post-directive self-assessment, performance metrics in /report)

### Phase 3: From Code Scanner to Autonomous Company
- [x] `/scout` skill — external intelligence gathering
- [x] `/healthcheck` skill — internal maintenance
- [x] Technology/Market/Growth/Ecosystem Intelligence per agent
- [x] Intelligence/ and healthchecks/ directory structure

### Chief of Staff Agent Pattern (2026-03-02)
- [x] Alex Rivera (Chief of Staff) agent definition
- [x] CEO session delegates, Alex orchestrates, agents execute
- [x] Chrome MCP workaround: visual verification bounces to CEO

### Context Separation (2026-03-02)
- [x] Framework context in conductor repo, symlink from sw/
- [x] Consumer-owned state (inbox/, done/, logs) stays in sw/

### Phase 4: Workflow Optimization
- [x] Checkpoint-resume (Step 0 detection, 8+ transition points, artifact persistence)
- [x] Request-clarify loops (pre-build clarification for 4 complex process types)
- [x] Verbal self-reflection format for lessons (lightweight — failure-mode format hint)
- [x] Episodic memory consolidation (lightweight — lessons in all prompts, 10th-directive trigger)
- [x] Agent personality evolution (Learned Patterns sections, re-extraction on consolidation)
- [x] Auto-move directive from inbox/ to done/ (Step 6f)
- [x] Foreman skip-marker safety (all three code paths fixed)

### Review Quality (2026-03-02)
- [x] DOD in Planning (Morgan's initiative schema + reviewer verification)
- [x] CEO Corrections Cross-Reference (Standing Corrections in preferences.md)
- [x] Mandatory Visual Verification Gate (file-pattern detection, all 7 process types)
- [x] Concrete Adversarial Review Checklist (9-item mandatory checklist)
- [x] Multi-reviewer casting system (cast.reviewers array, role-specific guidance)
- [x] DOD in CEO plan approval (Step 4 shows DOD items)
- [x] Corrections-caught section in CEO report

## Active (trigger-gated)

### Manager re-planning mid-directive — DEFERRED
- **Priority**: P1
- **Trigger**: When an audit reveals Morgan's plan is fundamentally wrong (next occurrence where audit contradicts plan) — **NOT FIRED**
- **Challenge (2026-03-02)**: Both Sarah AND Morgan challenged — over-engineering a zero-frequency problem. Waiting for trigger.

### Async parallel initiatives
- **Priority**: P2
- **Trigger**: When sequential execution becomes bottleneck (directive takes >2 hours with 3+ independent initiatives) — **NOT FIRED**

### Tree search for strategy exploration
- **Priority**: P2
- **Trigger**: When Morgan's single-plan approach fails twice — **NOT FIRED**

### Dashboard checkpoint visibility
- **Priority**: P2
- **Trigger**: When checkpoint-resume is used 3+ times and CEO wants dashboard visibility — **NOT FIRED**

## Future Ideas
- A2A protocol support for cross-framework agent communication
- Community personality packs (different org styles)
- Automatic autonomy adjustment based on acceptance rates (deferred — needs more data)
- Engineer proposals (deferred — ephemeral agents lack persistent context)
- DOD amendments during clarification phase (when scope shifts)
- DOD effectiveness tracking (pass/fail rates over time in digest self-assessment)
- `/correction add` command for CEO to add new standing corrections from report workflow
- Elevate "never run Prisma migrations" to Standing Correction (Marcus suggestion)

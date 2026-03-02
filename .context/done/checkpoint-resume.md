# Directive: Checkpoint-Resume for Directives

**Source**: Agent Conductor Phase 4 backlog, P1
**Priority**: P1
**Risk**: medium
**Goal alignment**: agent-conductor

## Objective

Directives can't pause mid-initiative and resume after context exhaustion or crashes. State lives only in the context window — when it's lost, work restarts from scratch. This has already happened multiple times (the conductor-ceo-experience directive hit context limits and had to be manually continued).

Implement a progress journal that persists intermediate state to disk, enabling automatic resume after context exhaustion. Stolen from LangGraph's interrupt/resume pattern.

## Scope

1. **Progress journal format**: Define a JSON checkpoint file that tracks directive execution state — which initiatives are done, which is in-progress, current phase within the initiative, key outputs from completed phases (audit findings, design docs, build results).

2. **Write checkpoints during execution**: After each phase completion within `/directive`, write the checkpoint to `.context/checkpoints/{directive-name}.json`. This happens in the SKILL.md orchestration flow.

3. **Resume on startup**: When `/directive {name}` is invoked and a checkpoint file exists, detect it and resume from the last completed phase instead of starting from scratch. Present the CEO with: "Found checkpoint for {name} — {N}/{M} initiatives complete. Resume from initiative {current}?"

4. **Dashboard integration**: Show checkpoint status in the agent-conductor dashboard — which directives have active checkpoints, what phase they're at, when they were last updated.

5. **Cleanup**: Delete checkpoint files after directive completes successfully (digest written).

## Key Design Decisions

- Checkpoint file is the source of truth for resume — not the context window
- Checkpoint includes enough data to reconstruct agent prompts (audit findings, design outputs)
- Resume skips Morgan planning + audit for completed initiatives
- CEO gets choice to resume or restart fresh

## Success Criteria

- A directive that hits context limits can be resumed with `/directive {name}` and picks up where it left off
- No work is duplicated on resume — completed initiatives are skipped
- Dashboard shows active checkpoints with progress
- Checkpoint files are cleaned up after successful completion

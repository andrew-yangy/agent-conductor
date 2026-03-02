# Directive: Adopt Claude Code /batch and HTTP hooks for conductor

**Source**: Scout 2026-03-02, proposed by Morgan
**Priority**: P1
**Risk**: low
**Recommended process**: research-then-build
**Goal alignment**: agent-conductor

## Objective

Claude Code v2.1.50+ ships native orchestration primitives (/batch for parallel worktree-isolated tasks, HTTP hooks for external integration) that can replace custom conductor code. The hidden TeammateTool also signals native team orchestration is coming. Conductor should compose with these primitives rather than compete with them.

## Scope

1. Research: Evaluate /batch for parallel initiative execution within directives
2. Prototype: Replace manual worktree orchestration with /batch for independent tasks
3. Implement: Use HTTP hooks for dashboard state updates (cleaner than file-watcher)
4. Hook integration: Add WorktreeCreate/Remove hooks for conductor state lifecycle
5. Update conductor vision with strategy for composing with native Claude Code primitives

## Intelligence Context

- /batch enables parallel task execution with automatic worktree isolation
- HTTP hooks enable JSON-in/JSON-out external integration (replaces shell commands)
- WorktreeCreate/Remove hooks for custom VCS integration
- Memory leak fixes critical for long-running directive sessions
- TeammateTool (feature-flagged) has 13 operations for multi-agent orchestration

## Success Criteria

- /batch tested for parallel task execution in directives
- HTTP hooks prototype for dashboard integration
- Decision documented: which conductor features to keep vs delegate to native primitives

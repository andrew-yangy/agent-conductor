# Publish & Validate — End-to-End Publish-Readiness

## CEO Brief

gruai has the infrastructure (PlatformAdapter, SpawnAdapter, role-based pipeline, /gruai-agents + /gruai-config skills, npm build config) but has NEVER been tested end-to-end from a fresh consumer's perspective. We don't know if install -> setup -> first directive actually works.

This directive combines publish-readiness with validation. The testing IS the publish-readiness work: every failure found during testing becomes a fix task in the same directive.

## Scope

### 1. Fresh Repo Validation
- Create a new test repo (outside agent-conductor)
- Install gruai (npm install or local link)
- Run the setup flow: /gruai-agents to scaffold a team, /gruai-config to initialize context
- Run a first directive against a benchmark app
- Document every failure and fix it

### 2. Benchmark App
- Find or create a small benchmark project suitable for testing AI agent tooling
- Should be complex enough to exercise the pipeline (multi-file, needs planning) but small enough to complete quickly
- Could be an existing benchmark (SWE-bench style) or a custom todo app / API project

### 3. Multi-Platform Testing
- Test with Claude Code (primary, should work)
- Test with Codex CLI (adapter exists from multi-platform-wave2-spawn)
- Document gaps per platform, fix critical blockers

### 4. Custom Agent Team Testing
- Test with the default gruai team (our agents)
- Test with a minimal custom team (e.g., just 2-3 agents)
- Test with a domain-specific team (e.g., data engineering focused)
- Verify /gruai-agents scaffolding produces working agent files

### 5. Pipeline Integrity
- Verify every pipeline step executes correctly in the test repo
- Verify directive.json state management works
- Verify review-gate catches real issues
- Verify completion gate works

## What's Already Done
- PlatformAdapter + ClaudeCodeAdapter (multi-platform-support, completed)
- SpawnAdapter + CodexCLISpawnAdapter (multi-platform-wave2-spawn, completed)
- /gruai-agents and /gruai-config skills (game-productionize-and-publish, completed)
- Asset license compliance (game-open-source-prep, completed)
- Repo separation (repo-separation, completed)
- Dynamic agent registry (dynamic-agent-registry, completed)
- Role-based pipeline renames (game-productionize-and-publish, completed)

## Success Criteria
- A fresh test repo can install gruai, set up agents, and successfully run a directive end-to-end
- At least 2 different agent team configurations work
- Codex CLI adapter works for at least basic spawn operations
- All pipeline steps execute correctly in the consumer repo
- Zero manual intervention needed for the happy path

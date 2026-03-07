# Platform Spawn Adapters

This document describes the SpawnAdapter implementations available in Agent Conductor and their capability differences.

## Overview

Each adapter implements the `SpawnAdapter` interface (`spawn-adapter.ts`) which provides two operations:
- `spawnAgent(config, mode)` -- spawn an agent process in `tracked` or `detached` mode
- `killAgent(pid)` -- send SIGTERM to a previously spawned process

The `getSpawnAdapter(platform)` factory in `index.ts` returns the correct adapter by platform name.

## Adapter Comparison

| Capability | Claude Code | Codex CLI | Aider | Gemini CLI |
|---|---|---|---|---|
| **Binary** | `claude` | `codex` | `aider` | `gemini` |
| **Non-interactive flag** | `-p` | `-q` | `--yes-always --message` | `-p` |
| **Prompt delivery** | Positional arg | Positional arg | `--message <prompt>` | `-p <prompt>` |
| **Agent definitions** | `--agent <id>` | codex.md file (via personality compiler) | Not supported | Not supported (uses GEMINI.md) |
| **Model override** | `--model <model>` | config.toml only | `--model <model>` | `--model <model>` |
| **Skip permissions** | `--dangerously-skip-permissions` | Sandbox by default | `--yes-always` (always set) | `--yolo` |
| **Session persistence** | `--no-session-persistence` | Not controllable | Not controllable | Not controllable |
| **Output capture** | stdio redirect | stdio redirect | stdio redirect | stdio redirect |
| **Detached mode** | Yes | Yes | Yes | Yes |
| **Tracked mode** | Yes | Yes | Yes | Yes |

## Per-Adapter Details

### ClaudeCodeSpawnAdapter (`claude-code-spawn.ts`)

The reference implementation. Full feature mapping from SpawnConfig to CLI flags.

- **All SpawnConfig fields supported.**
- Binary: `claude`
- PATH augmentation ensures the binary is found in detached mode.

### CodexCLISpawnAdapter (`codex-cli-spawn.ts`)

Uses the personality compiler to translate agent definitions into codex.md before spawning.

- **Known limitations:**
  - `config.model` is silently ignored (Codex uses config.toml for model selection).
  - `config.skipPermissions` is ignored (Codex sandboxes by default).
  - `config.sessionPersistence` is ignored (no CLI control).
  - `writePersonality` overwrites codex.md in the working directory -- concurrent spawns with different agentIds in the same cwd will race.
  - If the agent file referenced by `agentId` does not exist, `compilePersonality` will throw.

### AiderSpawnAdapter (`aider-spawn.ts`)

Minimal adapter for Aider (https://aider.chat). Uses `--yes-always` for non-interactive mode and `--no-git` to prevent auto-commits.

- **Known limitations:**
  - `config.agentId` is not supported. Aider has no agent definition concept. Custom instructions could theoretically be passed via `--read <file>`, but this is not implemented.
  - `config.skipPermissions` is not mapped separately -- `--yes-always` is always set.
  - `config.sessionPersistence` is not controllable. Aider manages its own chat history files.
  - Aider is Python-based (installed via pip/pipx), so the binary may not be on the default PATH.

### GeminiCLISpawnAdapter (`gemini-cli-spawn.ts`)

Minimal adapter for Google's Gemini CLI (https://github.com/google/gemini-cli).

- **Known limitations:**
  - `config.agentId` is not supported. Gemini CLI uses a GEMINI.md file at the repo root for project-level instructions, but has no per-agent override mechanism.
  - `config.sessionPersistence` is not controllable via CLI flags.
  - `config.skipPermissions` maps to `--yolo` which auto-approves all tool calls. This is less granular than Claude Code's permission model.
  - Gemini CLI is relatively new and its flag interface may change. Verify flags against current docs before production use.

## Adding a New Adapter

1. Create `server/platform/{name}-spawn.ts` implementing `SpawnAdapter`.
2. Export the class from `server/platform/index.ts`.
3. Add the platform identifier to the `SpawnPlatform` type union.
4. Add a case to the `getSpawnAdapter()` switch statement.
5. Update this document with the new adapter's capabilities and limitations.
6. Run `npx tsc --noEmit` to verify type-checking passes.

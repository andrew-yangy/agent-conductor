/**
 * AiderSpawnAdapter -- SpawnAdapter implementation for Aider CLI.
 *
 * Encapsulates the `aider` CLI invocation with support for both
 * detached (fire-and-forget) and tracked (await completion) spawn modes.
 *
 * Aider (https://aider.chat) is a terminal-based AI pair-programming tool.
 * In non-interactive mode, it accepts a prompt via `--message` and runs
 * to completion without user input.
 *
 * Key differences from ClaudeCodeSpawnAdapter:
 * - Uses `--message` flag instead of positional prompt argument.
 * - Uses `--yes-always` for non-interactive mode (auto-confirm all edits).
 * - No --agent flag. Aider does not have a concept of agent definitions.
 * - No --dangerously-skip-permissions. Aider uses --yes-always instead.
 * - No session persistence control. Aider manages its own chat history.
 * - Model selection via `--model` flag (supported natively).
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';

import type {
  SpawnAdapter,
  SpawnConfig,
  SpawnHandle,
  SpawnMode,
} from './spawn-adapter.js';

// ---------------------------------------------------------------------------
// Default PATH augmentation
// ---------------------------------------------------------------------------

/**
 * Sensible PATH prefix ensuring common binary locations are available.
 * Aider is typically installed via pip/pipx, so we also include common
 * Python binary locations.
 */
const DEFAULT_PATH_PREFIX = [
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
].join(':');

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class AiderSpawnAdapter implements SpawnAdapter {
  /**
   * Spawn an Aider agent process.
   *
   * @param config - What to spawn (prompt, agent, working directory, etc.)
   * @param mode   - `'tracked'` to await completion, `'detached'` for fire-and-forget
   * @returns A handle with the process PID and optional completion promise.
   */
  spawnAgent(config: SpawnConfig, mode: SpawnMode): SpawnHandle {
    const args = this.buildArgs(config);
    const env = this.buildEnv(config);

    if (mode === 'detached') {
      return this.spawnDetached(args, config, env);
    }
    return this.spawnTracked(args, config, env);
  }

  /**
   * Kill a previously spawned agent process.
   *
   * Sends SIGTERM to the process. Errors (e.g. process already exited) are
   * silently ignored -- callers should treat kill failures as non-fatal.
   *
   * @param pid - The OS process ID returned in {@link SpawnHandle}.
   */
  killAgent(pid: number): void {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process already exited or PID invalid -- non-fatal.
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Build the CLI argument array from a SpawnConfig.
   *
   * Aider CLI flags used:
   * - `--yes-always`  : auto-confirm all edits (non-interactive mode)
   * - `--no-git`      : skip git operations (Aider auto-commits by default)
   * - `--message`     : the prompt/instruction to execute
   * - `--model`       : model override (e.g. "claude-3-5-sonnet-20241022")
   *
   * Unsupported SpawnConfig fields:
   * - `agentId`              : Aider has no agent definition concept.
   *                            Custom instructions can be passed via
   *                            --read flag with a markdown file, but this
   *                            adapter does not implement that mapping.
   * - `skipPermissions`      : Aider uses --yes-always instead (always set).
   * - `sessionPersistence`   : Aider manages its own chat history files.
   *                            No CLI flag to disable persistence.
   * - `outputPath`           : Handled at the spawn level via stdio redirect,
   *                            not via an Aider-specific flag.
   */
  private buildArgs(config: SpawnConfig): string[] {
    const args: string[] = [
      '--yes-always',  // Non-interactive: auto-confirm all changes
      '--no-git',      // Don't auto-commit -- let the caller manage git
    ];

    // Model override. Aider supports --model natively.
    if (config.model != null) {
      args.push('--model', config.model);
    }

    // agentId is not supported -- Aider has no agent definition system.
    // If needed, the caller could pre-create an .aider.conf.yml or pass
    // --read <file> to inject custom instructions.

    // skipPermissions is not mapped -- --yes-always covers this.

    // sessionPersistence is not mapped -- Aider always writes chat history.

    // Prompt via --message flag (must be last for clarity).
    args.push('--message', config.prompt);

    return args;
  }

  /**
   * Build the environment for the child process.
   *
   * Merges `process.env` with the PATH augmentation and any additional
   * env vars from the SpawnConfig. Config env values take highest precedence.
   */
  private buildEnv(config: SpawnConfig): NodeJS.ProcessEnv {
    const currentPath = process.env['PATH'] ?? '';
    const augmentedPath = `${DEFAULT_PATH_PREFIX}:${currentPath}`;

    return {
      ...process.env,
      PATH: augmentedPath,
      ...config.env,
    };
  }

  /**
   * Spawn in detached mode: stdio redirected to `outputPath`, process
   * detached and unref'd so the parent can exit independently.
   */
  private spawnDetached(
    args: string[],
    config: SpawnConfig,
    env: NodeJS.ProcessEnv,
  ): SpawnHandle {
    const stdio: [
      'ignore',
      number | 'ignore',
      number | 'ignore',
    ] = config.outputPath
      ? (() => {
          const fd = fs.openSync(config.outputPath, 'w');
          return ['ignore', fd, fd] as ['ignore', number, number];
        })()
      : ['ignore', 'ignore', 'ignore'];

    const child = spawn('aider', args, {
      cwd: config.cwd,
      stdio,
      detached: true,
      env,
    });

    child.unref();

    return { pid: child.pid! };
  }

  /**
   * Spawn in tracked mode: returns a promise that resolves with the exit
   * code when the process completes. If `outputPath` is set, stdio is
   * also redirected to that file.
   */
  private spawnTracked(
    args: string[],
    config: SpawnConfig,
    env: NodeJS.ProcessEnv,
  ): SpawnHandle {
    let outFd: number | undefined;

    const stdio: [
      'ignore',
      number | 'ignore',
      number | 'ignore',
    ] = config.outputPath
      ? (() => {
          outFd = fs.openSync(config.outputPath, 'w');
          return ['ignore', outFd, outFd] as ['ignore', number, number];
        })()
      : ['ignore', 'ignore', 'ignore'];

    const child = spawn('aider', args, {
      cwd: config.cwd,
      stdio,
      env,
    });

    const promise = new Promise<number>((resolve, reject) => {
      child.on('close', (code) => {
        if (outFd != null) {
          try {
            fs.closeSync(outFd);
          } catch {
            // Non-fatal -- fd may already be closed.
          }
        }
        resolve(code ?? 1);
      });

      child.on('error', (err) => {
        if (outFd != null) {
          try {
            fs.closeSync(outFd);
          } catch {
            // Non-fatal.
          }
        }
        reject(err);
      });
    });

    return { pid: child.pid!, promise };
  }
}

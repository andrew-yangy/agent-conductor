/**
 * GeminiCLISpawnAdapter -- SpawnAdapter implementation for Gemini CLI.
 *
 * Encapsulates the `gemini` CLI invocation with support for both
 * detached (fire-and-forget) and tracked (await completion) spawn modes.
 *
 * Gemini CLI (https://github.com/google/gemini-cli) is Google's terminal-
 * based AI coding assistant. In non-interactive mode, it accepts a prompt
 * via the `-p` flag and runs to completion.
 *
 * Key differences from ClaudeCodeSpawnAdapter:
 * - Uses `-p` flag for prompt (same flag name, similar semantics).
 * - No --agent flag. Gemini CLI uses GEMINI.md for project-level instructions.
 * - No --dangerously-skip-permissions. Gemini CLI uses `--sandbox` for
 *   sandboxed execution; default is to prompt for tool use confirmation.
 *   The `--yolo` flag auto-approves all tool calls (closest equivalent).
 * - No session persistence control via CLI flags.
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
 * Gemini CLI is typically installed via npm (`npm i -g @anthropic-ai/gemini-cli`
 * or `npm i -g @anthropic-ai/gemini`). The binary is `gemini`.
 */
const DEFAULT_PATH_PREFIX = [
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
].join(':');

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class GeminiCLISpawnAdapter implements SpawnAdapter {
  /**
   * Spawn a Gemini CLI agent process.
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
   * Gemini CLI flags used:
   * - `-p`       : non-interactive prompt mode (run prompt and exit)
   * - `--yolo`   : auto-approve all tool calls without confirmation
   * - `--model`  : model override (e.g. "gemini-2.5-pro")
   *
   * Unsupported SpawnConfig fields:
   * - `agentId`              : Gemini CLI has no agent definition concept.
   *                            Project instructions go in GEMINI.md at the
   *                            repo root, but there is no per-agent override.
   * - `sessionPersistence`   : Gemini CLI manages its own session history.
   *                            No CLI flag to control persistence.
   * - `outputPath`           : Handled at the spawn level via stdio redirect,
   *                            not via a Gemini-specific flag.
   */
  private buildArgs(config: SpawnConfig): string[] {
    const args: string[] = [];

    // Auto-approve tool calls when skipPermissions is requested.
    // Gemini CLI's --yolo flag is the closest equivalent to
    // Claude Code's --dangerously-skip-permissions.
    if (config.skipPermissions) {
      args.push('--yolo');
    }

    // Model override. Gemini CLI supports --model natively.
    if (config.model != null) {
      args.push('--model', config.model);
    }

    // agentId is not supported -- Gemini CLI uses GEMINI.md for instructions.
    // There is no per-agent or per-persona flag.

    // sessionPersistence is not mapped -- no CLI control available.

    // Prompt via -p flag (non-interactive mode).
    args.push('-p', config.prompt);

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

    const child = spawn('gemini', args, {
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

    const child = spawn('gemini', args, {
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

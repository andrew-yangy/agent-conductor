/**
 * CodexCLISpawnAdapter -- SpawnAdapter implementation for Codex CLI.
 *
 * Encapsulates the `codex -q` CLI invocation with support for both
 * detached (fire-and-forget) and tracked (await completion) spawn modes.
 *
 * Key differences from ClaudeCodeSpawnAdapter:
 * - No --agent flag. Codex uses a codex.md file for instructions, so before
 *   spawning we call the personality compiler to generate codex.md in cwd.
 * - No --dangerously-skip-permissions. Codex uses a sandbox by default.
 * - No --no-session-persistence. Codex manages its own sessions.
 * - Model selection is via config.toml, not a CLI flag.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
// TODO: compilePersonality is a synchronous file-system operation that reads
// from .claude/agents/{agentId}.md. If the agent file is missing, this will
// throw. Consider wrapping in try/catch with a descriptive error message.
import { compilePersonality } from '../../scripts/personality-compiler.js';
// ---------------------------------------------------------------------------
// Default PATH augmentation
// ---------------------------------------------------------------------------
/**
 * Sensible PATH prefix ensuring common binary locations are available.
 * Codex CLI may be installed via npm global or in `~/.local/bin`.
 * Without this, detached processes may fail to find it.
 */
const DEFAULT_PATH_PREFIX = [
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
].join(':');
// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------
export class CodexCLISpawnAdapter {
    /**
     * Spawn a Codex agent process.
     *
     * If `config.agentId` is set, compiles the agent personality to a codex.md
     * file in the working directory before spawning. This gives Codex its
     * instructions in the format it expects.
     *
     * @param config - What to spawn (prompt, agent, working directory, etc.)
     * @param mode   - `'tracked'` to await completion, `'detached'` for fire-and-forget
     * @returns A handle with the process PID and optional completion promise.
     */
    spawnAgent(config, mode) {
        // Write codex.md personality file before spawning if an agent is specified.
        if (config.agentId != null) {
            this.writePersonality(config.agentId, config.cwd);
        }
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
    killAgent(pid) {
        try {
            process.kill(pid, 'SIGTERM');
        }
        catch {
            // Process already exited or PID invalid -- non-fatal.
        }
    }
    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------
    /**
     * Compile and write the agent personality as codex.md in the working directory.
     *
     * Codex reads codex.md (analogous to AGENTS.md or system prompts) from
     * the current working directory. We use the personality compiler to
     * translate the Claude Code agent definition into Codex-compatible format.
     */
    // TODO: writePersonality overwrites any existing codex.md in the working
    // directory without backup. If multiple concurrent spawns target the same
    // cwd with different agentIds, they will race on this file. Consider using
    // a temp directory or unique filename to avoid conflicts.
    writePersonality(agentId, cwd) {
        const content = compilePersonality(agentId, 'codex');
        const codexMdPath = path.join(cwd, 'codex.md');
        fs.writeFileSync(codexMdPath, content, 'utf-8');
    }
    /**
     * Build the CLI argument array from a SpawnConfig.
     *
     * Codex CLI uses `-q` for quiet/non-interactive mode (equivalent to
     * Claude Code's `-p`). The prompt is the final positional argument.
     *
     * Unlike Claude Code, Codex does not support --agent, --model,
     * --dangerously-skip-permissions, or --no-session-persistence via CLI
     * flags. Agent instructions come from codex.md, model from config.toml,
     * and sandboxing is on by default.
     *
     * TODO: Codex CLI `-q` (quiet) flag verified against OpenAI Codex CLI docs.
     * If Codex CLI updates its flag interface, this needs re-verification.
     * The `config.model` field is silently ignored here -- Codex selects model
     * via config.toml (`model = "..."`) rather than CLI flags. If model override
     * support is added to Codex CLI in the future, map config.model here.
     */
    buildArgs(config) {
        const args = ['-q'];
        // config.model -- not supported via CLI flag; Codex uses config.toml
        // config.skipPermissions -- not needed; Codex sandboxes by default
        // config.sessionPersistence -- no CLI control available
        // Prompt is always the final positional argument.
        args.push(config.prompt);
        return args;
    }
    /**
     * Build the environment for the child process.
     *
     * Merges `process.env` with the PATH augmentation and any additional
     * env vars from the SpawnConfig. Config env values take highest precedence.
     */
    buildEnv(config) {
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
    spawnDetached(args, config, env) {
        // Open output file for stdio redirection. If no outputPath is provided,
        // discard all output (same as /dev/null).
        const stdio = config.outputPath
            ? (() => {
                const fd = fs.openSync(config.outputPath, 'w');
                return ['ignore', fd, fd];
            })()
            : ['ignore', 'ignore', 'ignore'];
        const child = spawn('codex', args, {
            cwd: config.cwd,
            stdio,
            detached: true,
            env,
        });
        child.unref();
        return { pid: child.pid };
    }
    /**
     * Spawn in tracked mode: returns a promise that resolves with the exit
     * code when the process completes. If `outputPath` is set, stdio is
     * also redirected to that file.
     */
    spawnTracked(args, config, env) {
        let outFd;
        const stdio = config.outputPath
            ? (() => {
                outFd = fs.openSync(config.outputPath, 'w');
                return ['ignore', outFd, outFd];
            })()
            : ['ignore', 'ignore', 'ignore'];
        const child = spawn('codex', args, {
            cwd: config.cwd,
            stdio,
            env,
        });
        const promise = new Promise((resolve, reject) => {
            child.on('close', (code) => {
                // Close the output file descriptor if we opened one.
                if (outFd != null) {
                    try {
                        fs.closeSync(outFd);
                    }
                    catch {
                        // Non-fatal -- fd may already be closed.
                    }
                }
                resolve(code ?? 1);
            });
            child.on('error', (err) => {
                if (outFd != null) {
                    try {
                        fs.closeSync(outFd);
                    }
                    catch {
                        // Non-fatal.
                    }
                }
                reject(err);
            });
        });
        return { pid: child.pid, promise };
    }
}

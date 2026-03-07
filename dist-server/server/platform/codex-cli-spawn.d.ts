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
import type { SpawnAdapter, SpawnConfig, SpawnHandle, SpawnMode } from './spawn-adapter.js';
export declare class CodexCLISpawnAdapter implements SpawnAdapter {
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
    spawnAgent(config: SpawnConfig, mode: SpawnMode): SpawnHandle;
    /**
     * Kill a previously spawned agent process.
     *
     * Sends SIGTERM to the process. Errors (e.g. process already exited) are
     * silently ignored -- callers should treat kill failures as non-fatal.
     *
     * @param pid - The OS process ID returned in {@link SpawnHandle}.
     */
    killAgent(pid: number): void;
    /**
     * Compile and write the agent personality as codex.md in the working directory.
     *
     * Codex reads codex.md (analogous to AGENTS.md or system prompts) from
     * the current working directory. We use the personality compiler to
     * translate the Claude Code agent definition into Codex-compatible format.
     */
    private writePersonality;
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
    private buildArgs;
    /**
     * Build the environment for the child process.
     *
     * Merges `process.env` with the PATH augmentation and any additional
     * env vars from the SpawnConfig. Config env values take highest precedence.
     */
    private buildEnv;
    /**
     * Spawn in detached mode: stdio redirected to `outputPath`, process
     * detached and unref'd so the parent can exit independently.
     */
    private spawnDetached;
    /**
     * Spawn in tracked mode: returns a promise that resolves with the exit
     * code when the process completes. If `outputPath` is set, stdio is
     * also redirected to that file.
     */
    private spawnTracked;
}

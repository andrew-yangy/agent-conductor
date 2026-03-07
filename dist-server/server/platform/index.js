export { ClaudeCodeAdapter } from './claude-code.js';
export { ClaudeCodeSpawnAdapter } from './claude-code-spawn.js';
export { CodexCLISpawnAdapter } from './codex-cli-spawn.js';
export { AiderSpawnAdapter } from './aider-spawn.js';
export { GeminiCLISpawnAdapter } from './gemini-cli-spawn.js';
import { ClaudeCodeSpawnAdapter } from './claude-code-spawn.js';
import { CodexCLISpawnAdapter } from './codex-cli-spawn.js';
import { AiderSpawnAdapter } from './aider-spawn.js';
import { GeminiCLISpawnAdapter } from './gemini-cli-spawn.js';
/**
 * Factory function that returns a SpawnAdapter instance for the given platform.
 *
 * @param platform - One of the supported platform identifiers.
 * @returns A SpawnAdapter instance for the requested platform.
 * @throws Error if the platform identifier is not recognized.
 *
 * @example
 * ```ts
 * const adapter = getSpawnAdapter('aider');
 * const handle = adapter.spawnAgent({ prompt: 'fix the bug', cwd: '.' }, 'tracked');
 * ```
 */
export function getSpawnAdapter(platform) {
    switch (platform) {
        case 'claude-code':
            return new ClaudeCodeSpawnAdapter();
        case 'codex-cli':
            return new CodexCLISpawnAdapter();
        case 'aider':
            return new AiderSpawnAdapter();
        case 'gemini-cli':
            return new GeminiCLISpawnAdapter();
        default: {
            const _exhaustive = platform;
            throw new Error(`Unknown spawn platform: ${_exhaustive}`);
        }
    }
}

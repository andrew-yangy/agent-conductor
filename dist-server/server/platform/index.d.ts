/**
 * Platform adapter module -- re-exports all types from the platform boundary
 * and provides a factory for resolving SpawnAdapter by platform name.
 */
export type { AggregatorHandle, AgentState, PlatformCapabilities, SessionWatcher, MetadataWatcher, PlatformAdapter, } from './types.js';
export type { SpawnMode, SpawnConfig, SpawnHandle, SpawnAdapter, } from './spawn-adapter.js';
export { ClaudeCodeAdapter } from './claude-code.js';
export { ClaudeCodeSpawnAdapter } from './claude-code-spawn.js';
export { CodexCLISpawnAdapter } from './codex-cli-spawn.js';
export { AiderSpawnAdapter } from './aider-spawn.js';
export { GeminiCLISpawnAdapter } from './gemini-cli-spawn.js';
import type { SpawnAdapter } from './spawn-adapter.js';
/**
 * Supported platform identifiers for {@link getSpawnAdapter}.
 */
export type SpawnPlatform = 'claude-code' | 'codex-cli' | 'aider' | 'gemini-cli';
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
export declare function getSpawnAdapter(platform: SpawnPlatform): SpawnAdapter;

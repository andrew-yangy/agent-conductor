/**
 * ClaudeCodeAdapter -- PlatformAdapter implementation for Claude Code.
 *
 * Wraps existing session-state and session-scanner logic behind the
 * PlatformAdapter interface (Strangler Fig pattern). Singleton state
 * (fileStates Map, parentAgentMapCache) is moved to instance properties.
 */
import type { PlatformAdapter, PlatformCapabilities, AggregatorHandle, AgentState, SessionWatcher as SessionWatcherInterface, MetadataWatcher as MetadataWatcherInterface } from './types.js';
import type { SessionActivity, ProjectConfig, ConductorConfig } from '../types.js';
import type { SessionFileState, DiscoveredFile } from '../parsers/session-state.js';
export declare class ClaudeCodeAdapter implements PlatformAdapter {
    /** Instance-level session file state map (replaces module-level singleton). */
    readonly fileStates: Map<string, SessionFileState>;
    /** Instance-level parent agent map cache (replaces module-level singleton). */
    readonly parentAgentMapCache: Map<string, {
        mtime: number;
        map: Map<string, string>;
    }>;
    private readonly claudeHome;
    constructor(claudeHome: string);
    discoverSessionFiles(projectFilter?: string): Map<string, DiscoveredFile>;
    initializeAllFileStates(projectFilter?: string): Map<string, DiscoveredFile>;
    processFileUpdate(filePath: string): SessionFileState | null;
    getOrBootstrap(filePath: string): SessionFileState | null;
    removeFileState(filePath: string): void;
    getAllFileStates(): Map<string, SessionFileState>;
    toSessionActivity(state: SessionFileState): SessionActivity | null;
    getAgentState(state: SessionFileState): AgentState;
    createSessionWatcher(aggregator: AggregatorHandle, projectFilter?: string): SessionWatcherInterface;
    createMetadataWatcher(_aggregator: AggregatorHandle): MetadataWatcherInterface | null;
    discoverProjects(): ProjectConfig[];
    loadConfig(): ConductorConfig;
    getPlatformCapabilities(): PlatformCapabilities;
}

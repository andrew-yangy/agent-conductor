/**
 * Platform adapter interface for multi-platform session monitoring.
 *
 * This module defines the contract between platform-specific implementations
 * (Claude Code, Codex CLI, Cline/Roo, Aider, etc.) and the rest of the
 * Agent Conductor system. All platform-specific logic lives behind this
 * interface; consumers interact only with these generic types.
 */
import type { SessionActivity, ProjectConfig, ConductorConfig } from '../types.js';
import type { SessionFileState, DiscoveredFile } from '../parsers/session-state.js';
/**
 * Minimal interface describing the aggregator methods that watchers need.
 * Using an interface here instead of importing the concrete Aggregator class
 * avoids circular dependencies between platform/ and state/.
 */
export interface AggregatorHandle {
    /** Refresh the full session list from discovered files. */
    refreshSessions(): void;
    /** Update a single session from its parsed file state. */
    updateSessionFromFileState(filePath: string, state: SessionFileState): void;
}
/**
 * Platform-agnostic agent activity state.
 *
 * - `working`      -- the agent is actively processing (tool calls, generation)
 * - `needs_input`  -- the agent is blocked waiting for user/human input
 * - `done`         -- the agent's turn is complete (idle, finished)
 * - `unknown`      -- state cannot be determined (e.g. proprietary platform)
 */
export type AgentState = 'working' | 'needs_input' | 'done' | 'unknown';
/**
 * Feature flags describing what a platform supports. Consumers can check
 * these at runtime to degrade gracefully for less-capable platforms.
 */
export interface PlatformCapabilities {
    /** Platform exposes file-based session logs that can be watched with chokidar. */
    supportsFileWatching: boolean;
    /** Session files are append-only (JSONL), enabling incremental byte-offset reads. */
    supportsIncrementalReads: boolean;
    /** Agent sessions can be spawned programmatically via CLI. */
    supportsCLISpawn: boolean;
    /** Platform has MCP client support. */
    supportsMCP: boolean;
    /** Platform tracks subagent/sub-task relationships. */
    supportsSubagents: boolean;
    /** Platform exposes token usage or cost data. */
    supportsTokenTracking: boolean;
}
/**
 * Interface for a session file watcher. Implementations watch for changes
 * to session log files and push updates through the aggregator.
 */
export interface SessionWatcher {
    /** Begin watching for session file changes. */
    start(): void;
    /** Stop watching and release all resources (timers, file handles). */
    stop(): Promise<void>;
    /** True once the watcher has completed its initial scan and is actively monitoring. */
    readonly ready: boolean;
}
/**
 * Interface for a metadata watcher. Watches platform-specific metadata
 * sources (e.g. teams, tasks) that live outside session log files.
 * Not all platforms have separate metadata -- those return null from
 * `createMetadataWatcher()`.
 */
export interface MetadataWatcher {
    /** Begin watching for metadata changes. */
    start(): void;
    /** Stop watching and release all resources. */
    stop(): Promise<void>;
    /** True once the watcher has completed its initial scan. */
    readonly ready: boolean;
}
/**
 * The platform adapter interface. Each supported coding-agent platform
 * (Claude Code, Codex CLI, Cline/Roo, Aider, etc.) provides an
 * implementation of this interface.
 *
 * Method contracts are platform-generic: no assumptions about JSONL,
 * specific directory layouts, or Claude-Code-specific concepts leak
 * through the interface boundary.
 */
export interface PlatformAdapter {
    /**
     * Discover all session files/records managed by this platform.
     *
     * Returns a map keyed by a unique file path (or record identifier) to
     * metadata about each discovered session. Platforms without file-based
     * sessions (e.g. Cursor) may return an empty map.
     *
     * @param projectFilter - Optional project identifier to scope discovery
     *   to a single project. When omitted, all projects are scanned.
     */
    discoverSessionFiles(projectFilter?: string): Map<string, DiscoveredFile>;
    /**
     * Bootstrap in-memory state for all discovered sessions. Called once at
     * server startup. Recent sessions get a full parse; older sessions get
     * lightweight stubs that are fully parsed on-demand.
     *
     * @param projectFilter - Optional project scope (same semantics as
     *   `discoverSessionFiles`).
     * @returns The discovered files map (same shape as `discoverSessionFiles`).
     */
    initializeAllFileStates(projectFilter?: string): Map<string, DiscoveredFile>;
    /**
     * Process an incremental update for a single session file/record.
     *
     * For append-only formats (JSONL), this reads new bytes from the last
     * known offset. For full-file formats (JSON), this re-parses the file.
     * Returns the updated state, or null if there is nothing new.
     *
     * @param filePath - The session file path or record identifier.
     */
    processFileUpdate(filePath: string): SessionFileState | null;
    /**
     * Get existing in-memory state for a session, or cold-start bootstrap
     * it from disk if not yet loaded.
     *
     * @param filePath - The session file path or record identifier.
     * @returns The session state, or null if the file cannot be read.
     */
    getOrBootstrap(filePath: string): SessionFileState | null;
    /**
     * Remove in-memory state for a session (e.g. when the file is deleted).
     *
     * @param filePath - The session file path or record identifier.
     */
    removeFileState(filePath: string): void;
    /**
     * Return all in-memory session states. Used by the aggregator to build
     * the full dashboard snapshot.
     */
    getAllFileStates(): Map<string, SessionFileState>;
    /**
     * Convert a platform-specific `SessionFileState` into the
     * platform-agnostic `SessionActivity` used by the dashboard.
     *
     * Returns null if the state lacks sufficient data (e.g. no session ID).
     *
     * @param state - The parsed session file state.
     */
    toSessionActivity(state: SessionFileState): SessionActivity | null;
    /**
     * Derive a platform-agnostic agent state from a parsed session state.
     *
     * This replaces the Claude-Code-specific `machineStateToLastEntryType`
     * with a generic enum that works across all platforms.
     *
     * @param state - The parsed session file state.
     */
    getAgentState(state: SessionFileState): AgentState;
    /**
     * Create a watcher that monitors session files/records for changes and
     * pushes updates through the aggregator.
     *
     * @param aggregator - Handle to the aggregator for pushing updates.
     * @param projectFilter - Optional project scope for the watcher.
     */
    createSessionWatcher(aggregator: AggregatorHandle, projectFilter?: string): SessionWatcher;
    /**
     * Create a watcher for platform metadata that lives outside session
     * files (e.g. Claude Code's teams/tasks JSON, Codex's session index).
     *
     * Returns null for platforms that do not have a separate metadata source
     * (the session watcher covers everything).
     *
     * @param aggregator - Handle to the aggregator for pushing updates.
     */
    createMetadataWatcher(aggregator: AggregatorHandle): MetadataWatcher | null;
    /**
     * Discover projects managed by this platform. Each platform has its own
     * concept of "projects" (directory-based, workspace-based, etc.).
     */
    discoverProjects(): ProjectConfig[];
    /**
     * Load the conductor configuration, merging platform-specific discovery
     * with any user-defined config.
     */
    loadConfig(): ConductorConfig;
    /**
     * Return feature flags describing what this platform supports.
     * Consumers use these to degrade gracefully for less-capable platforms.
     */
    getPlatformCapabilities(): PlatformCapabilities;
}

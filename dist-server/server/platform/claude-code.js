/**
 * ClaudeCodeAdapter -- PlatformAdapter implementation for Claude Code.
 *
 * Wraps existing session-state and session-scanner logic behind the
 * PlatformAdapter interface (Strangler Fig pattern). Singleton state
 * (fileStates Map, parentAgentMapCache) is moved to instance properties.
 */
import { initializeAllFileStates, discoverSessionFiles, getAllFileStates as getAllFileStatesRaw, getOrBootstrap as getOrBootstrapRaw, removeFileState as removeFileStateRaw, processFileUpdate as processFileUpdateRaw, toSessionActivity as toSessionActivityRaw, machineStateToLastEntryType, } from '../parsers/session-state.js';
import { discoverProjects, loadConfig } from '../config.js';
import { SessionWatcher } from '../watchers/session-watcher.js';
export class ClaudeCodeAdapter {
    /** Instance-level session file state map (replaces module-level singleton). */
    fileStates = new Map();
    /** Instance-level parent agent map cache (replaces module-level singleton). */
    parentAgentMapCache = new Map();
    claudeHome;
    constructor(claudeHome) {
        this.claudeHome = claudeHome;
    }
    // -------------------------------------------------------------------------
    // Core state methods
    // -------------------------------------------------------------------------
    discoverSessionFiles(projectFilter) {
        return discoverSessionFiles(this.claudeHome, projectFilter);
    }
    initializeAllFileStates(projectFilter) {
        return initializeAllFileStates(this.claudeHome, projectFilter, this.fileStates);
    }
    processFileUpdate(filePath) {
        return processFileUpdateRaw(filePath, this.fileStates);
    }
    getOrBootstrap(filePath) {
        return getOrBootstrapRaw(filePath, this.fileStates);
    }
    removeFileState(filePath) {
        removeFileStateRaw(filePath, this.fileStates);
    }
    getAllFileStates() {
        return getAllFileStatesRaw(this.fileStates);
    }
    // -------------------------------------------------------------------------
    // Conversion methods
    // -------------------------------------------------------------------------
    toSessionActivity(state) {
        return toSessionActivityRaw(state);
    }
    getAgentState(state) {
        const lastEntryType = machineStateToLastEntryType(state);
        switch (lastEntryType) {
            case 'assistant-tool':
                return 'working';
            case 'assistant-question':
                return 'needs_input';
            case 'assistant-text':
                return 'done';
            case 'user':
                return 'working';
            default:
                return 'unknown';
        }
    }
    // -------------------------------------------------------------------------
    // Factory methods
    // -------------------------------------------------------------------------
    createSessionWatcher(aggregator, projectFilter) {
        return new SessionWatcher(aggregator, this.claudeHome, projectFilter, this);
    }
    createMetadataWatcher(_aggregator) {
        return null;
    }
    // -------------------------------------------------------------------------
    // Config methods
    // -------------------------------------------------------------------------
    discoverProjects() {
        return discoverProjects(this.claudeHome);
    }
    loadConfig() {
        return loadConfig();
    }
    // -------------------------------------------------------------------------
    // Capability method
    // -------------------------------------------------------------------------
    getPlatformCapabilities() {
        return {
            supportsFileWatching: true,
            supportsIncrementalReads: true,
            supportsCLISpawn: true,
            supportsMCP: true,
            supportsSubagents: true,
            supportsTokenTracking: false,
        };
    }
}

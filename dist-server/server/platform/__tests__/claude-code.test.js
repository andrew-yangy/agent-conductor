import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ClaudeCodeAdapter } from '../claude-code.js';
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let tmpDir;
/** Write a JSONL file from an array of entry objects. */
function writeJsonl(filePath, entries) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
    fs.writeFileSync(filePath, content, 'utf-8');
}
const ts = (offset) => `2026-02-23T10:00:${String(offset).padStart(2, '0')}Z`;
function userPrompt(text, extra = {}) {
    return {
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text }] },
        timestamp: ts(0),
        ...extra,
    };
}
function assistantText(text, extra = {}) {
    return {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text }] },
        timestamp: ts(1),
        ...extra,
    };
}
function assistantToolUse(toolName, input = {}) {
    return {
        type: 'assistant',
        message: {
            role: 'assistant',
            content: [
                { type: 'text', text: 'Let me check.' },
                { type: 'tool_use', name: toolName, input },
            ],
        },
        timestamp: ts(2),
    };
}
function turnEnd() {
    return { type: 'system', subtype: 'turn_duration', timestamp: ts(4) };
}
/** Create a stub AggregatorHandle for factory method tests. */
function stubAggregator() {
    return {
        refreshSessions() { },
        updateSessionFromFileState() { },
    };
}
// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-code-adapter-test-'));
});
after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
// ===========================================================================
// 1. Constructor
// ===========================================================================
describe('ClaudeCodeAdapter constructor', () => {
    it('creates adapter with empty state maps', () => {
        const adapter = new ClaudeCodeAdapter(tmpDir);
        assert.equal(adapter.fileStates.size, 0, 'fileStates should be empty');
        assert.equal(adapter.parentAgentMapCache.size, 0, 'parentAgentMapCache should be empty');
    });
});
// ===========================================================================
// 2. getPlatformCapabilities
// ===========================================================================
describe('getPlatformCapabilities', () => {
    it('returns correct feature flags for Claude Code', () => {
        const adapter = new ClaudeCodeAdapter(tmpDir);
        const caps = adapter.getPlatformCapabilities();
        assert.equal(caps.supportsFileWatching, true);
        assert.equal(caps.supportsIncrementalReads, true);
        assert.equal(caps.supportsCLISpawn, true);
        assert.equal(caps.supportsMCP, true);
        assert.equal(caps.supportsSubagents, true);
        assert.equal(caps.supportsTokenTracking, false);
    });
});
// ===========================================================================
// 3. discoverSessionFiles
// ===========================================================================
describe('discoverSessionFiles', () => {
    it('discovers JSONL session files from a mock claudeHome', () => {
        const claudeHome = path.join(tmpDir, 'discover-test');
        const projectDir = path.join(claudeHome, 'projects', 'test-project');
        fs.mkdirSync(projectDir, { recursive: true });
        // Create a session JSONL file
        const sessionFile = path.join(projectDir, 'abc123.jsonl');
        writeJsonl(sessionFile, [
            userPrompt('Hello', { sessionId: 'abc123' }),
        ]);
        // Create a non-JSONL file that should be ignored
        fs.writeFileSync(path.join(projectDir, 'notes.txt'), 'not a session');
        const adapter = new ClaudeCodeAdapter(claudeHome);
        const discovered = adapter.discoverSessionFiles();
        assert.ok(discovered instanceof Map, 'should return a Map');
        assert.equal(discovered.size, 1, 'should find exactly 1 session file');
        const entry = discovered.get(sessionFile);
        assert.ok(entry, 'should contain the JSONL file path as key');
        assert.equal(entry.sessionId, 'abc123');
        assert.equal(entry.isSubagent, false);
    });
});
// ===========================================================================
// 4. getAllFileStates
// ===========================================================================
describe('getAllFileStates', () => {
    it('returns empty map initially (before any bootstrap)', () => {
        const adapter = new ClaudeCodeAdapter(path.join(tmpDir, 'empty-states'));
        const states = adapter.getAllFileStates();
        assert.ok(states instanceof Map, 'should return a Map');
        assert.equal(states.size, 0, 'should be empty before any initialization');
    });
});
// ===========================================================================
// 5. getAgentState
// ===========================================================================
describe('getAgentState', () => {
    it('maps machineState=working to "working"', () => {
        const claudeHome = path.join(tmpDir, 'agent-state-test');
        const projectDir = path.join(claudeHome, 'projects', 'test-project');
        fs.mkdirSync(projectDir, { recursive: true });
        const sessionFile = path.join(projectDir, 'sess-working.jsonl');
        writeJsonl(sessionFile, [
            userPrompt('Do something', { sessionId: 'sess-working' }),
            assistantToolUse('Read', { file_path: '/foo.ts' }),
        ]);
        const adapter = new ClaudeCodeAdapter(claudeHome);
        adapter.initializeAllFileStates();
        const state = adapter.getOrBootstrap(sessionFile);
        assert.ok(state, 'should bootstrap the session');
        assert.equal(state.machineState, 'working');
        assert.equal(adapter.getAgentState(state), 'working');
    });
    it('maps machineState=needs_input to "needs_input"', () => {
        const claudeHome = path.join(tmpDir, 'agent-state-test-2');
        const projectDir = path.join(claudeHome, 'projects', 'test-project');
        fs.mkdirSync(projectDir, { recursive: true });
        const sessionFile = path.join(projectDir, 'sess-input.jsonl');
        writeJsonl(sessionFile, [
            userPrompt('Help', { sessionId: 'sess-input' }),
            assistantText('Should I proceed?'),
        ]);
        const adapter = new ClaudeCodeAdapter(claudeHome);
        const state = adapter.getOrBootstrap(sessionFile);
        assert.ok(state);
        assert.equal(state.machineState, 'needs_input');
        assert.equal(adapter.getAgentState(state), 'needs_input');
    });
    it('maps machineState=done to "done"', () => {
        const claudeHome = path.join(tmpDir, 'agent-state-test-3');
        const projectDir = path.join(claudeHome, 'projects', 'test-project');
        fs.mkdirSync(projectDir, { recursive: true });
        const sessionFile = path.join(projectDir, 'sess-done.jsonl');
        writeJsonl(sessionFile, [
            userPrompt('Explain', { sessionId: 'sess-done' }),
            assistantText('Here is the answer.'),
            turnEnd(),
        ]);
        const adapter = new ClaudeCodeAdapter(claudeHome);
        const state = adapter.getOrBootstrap(sessionFile);
        assert.ok(state);
        assert.equal(state.machineState, 'done');
        assert.equal(adapter.getAgentState(state), 'done');
    });
});
// ===========================================================================
// 6. toSessionActivity
// ===========================================================================
describe('toSessionActivity', () => {
    it('returns null for states without sessionId', () => {
        const claudeHome = path.join(tmpDir, 'activity-null-test');
        const projectDir = path.join(claudeHome, 'projects', 'test-project');
        fs.mkdirSync(projectDir, { recursive: true });
        const sessionFile = path.join(projectDir, 'no-session-id.jsonl');
        writeJsonl(sessionFile, [
            // No sessionId in any entry
            { type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'Hi' }] }, timestamp: ts(0) },
        ]);
        const adapter = new ClaudeCodeAdapter(claudeHome);
        const state = adapter.getOrBootstrap(sessionFile);
        assert.ok(state);
        assert.equal(state.sessionId, undefined);
        const activity = adapter.toSessionActivity(state);
        assert.equal(activity, null);
    });
    it('returns activity object for states with sessionId', () => {
        const claudeHome = path.join(tmpDir, 'activity-valid-test');
        const projectDir = path.join(claudeHome, 'projects', 'test-project');
        fs.mkdirSync(projectDir, { recursive: true });
        const sessionFile = path.join(projectDir, 'has-session.jsonl');
        writeJsonl(sessionFile, [
            userPrompt('Check file', { sessionId: 'sess-activity' }),
            assistantToolUse('Read', { file_path: '/src/index.ts' }),
        ]);
        const adapter = new ClaudeCodeAdapter(claudeHome);
        const state = adapter.getOrBootstrap(sessionFile);
        assert.ok(state);
        // Make it look recent so active=true
        state.mtimeMs = Date.now();
        const activity = adapter.toSessionActivity(state);
        assert.ok(activity);
        assert.equal(activity.sessionId, 'sess-activity');
        assert.equal(activity.tool, 'Read');
        assert.equal(activity.active, true);
    });
});
// ===========================================================================
// 7. loadConfig
// ===========================================================================
describe('loadConfig', () => {
    it('returns a valid ConductorConfig', () => {
        const adapter = new ClaudeCodeAdapter(tmpDir);
        const config = adapter.loadConfig();
        assert.ok(config, 'config should not be null');
        assert.ok(Array.isArray(config.projects), 'projects should be an array');
        assert.ok(typeof config.claudeHome === 'string', 'claudeHome should be a string');
        assert.ok(config.server, 'server config should exist');
        assert.ok(typeof config.server.port === 'number', 'server.port should be a number');
    });
});
// ===========================================================================
// 8. createSessionWatcher
// ===========================================================================
describe('createSessionWatcher', () => {
    it('returns object with start/stop/ready', () => {
        const claudeHome = path.join(tmpDir, 'watcher-test');
        fs.mkdirSync(claudeHome, { recursive: true });
        const adapter = new ClaudeCodeAdapter(claudeHome);
        const agg = stubAggregator();
        const watcher = adapter.createSessionWatcher(agg);
        assert.ok(watcher, 'watcher should not be null');
        assert.equal(typeof watcher.start, 'function', 'should have start()');
        assert.equal(typeof watcher.stop, 'function', 'should have stop()');
        assert.equal(typeof watcher.ready, 'boolean', 'should have ready property');
        assert.equal(watcher.ready, false, 'should not be ready before start');
    });
});
// ===========================================================================
// 9. createMetadataWatcher
// ===========================================================================
describe('createMetadataWatcher', () => {
    it('returns a ClaudeWatcher instance (not null)', () => {
        const claudeHome = path.join(tmpDir, 'meta-watcher-test');
        fs.mkdirSync(claudeHome, { recursive: true });
        const adapter = new ClaudeCodeAdapter(claudeHome);
        const agg = stubAggregator();
        const watcher = adapter.createMetadataWatcher(agg);
        assert.ok(watcher !== null, 'Claude Code should always return a metadata watcher');
        assert.equal(typeof watcher.start, 'function');
        assert.equal(typeof watcher.stop, 'function');
    });
});
// ===========================================================================
// 10. processFileUpdate + removeFileState (instance isolation)
// ===========================================================================
describe('Instance isolation', () => {
    it('two adapters maintain separate fileStates', () => {
        const claudeHome1 = path.join(tmpDir, 'iso-test-1');
        const claudeHome2 = path.join(tmpDir, 'iso-test-2');
        const projectDir1 = path.join(claudeHome1, 'projects', 'proj');
        const projectDir2 = path.join(claudeHome2, 'projects', 'proj');
        fs.mkdirSync(projectDir1, { recursive: true });
        fs.mkdirSync(projectDir2, { recursive: true });
        const file1 = path.join(projectDir1, 's1.jsonl');
        const file2 = path.join(projectDir2, 's2.jsonl');
        writeJsonl(file1, [userPrompt('A', { sessionId: 'iso-1' })]);
        writeJsonl(file2, [userPrompt('B', { sessionId: 'iso-2' })]);
        const adapter1 = new ClaudeCodeAdapter(claudeHome1);
        const adapter2 = new ClaudeCodeAdapter(claudeHome2);
        adapter1.initializeAllFileStates();
        adapter2.initializeAllFileStates();
        // Each adapter sees only its own sessions
        assert.equal(adapter1.getAllFileStates().size, 1);
        assert.equal(adapter2.getAllFileStates().size, 1);
        const state1 = adapter1.getOrBootstrap(file1);
        assert.ok(state1);
        assert.equal(state1.sessionId, 'iso-1');
        const state2 = adapter2.getOrBootstrap(file2);
        assert.ok(state2);
        assert.equal(state2.sessionId, 'iso-2');
        // Remove from adapter1 should not affect adapter2
        adapter1.removeFileState(file1);
        assert.equal(adapter1.getAllFileStates().size, 0);
        assert.equal(adapter2.getAllFileStates().size, 1);
    });
});
// ===========================================================================
// 11. discoverProjects
// ===========================================================================
describe('discoverProjects', () => {
    it('returns an array (possibly empty for temp dir)', () => {
        const adapter = new ClaudeCodeAdapter(tmpDir);
        const projects = adapter.discoverProjects();
        assert.ok(Array.isArray(projects), 'should return an array');
    });
});

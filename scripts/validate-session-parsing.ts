/**
 * validate-session-parsing.ts -- Zero-trust verification of JSONL session parsing
 *
 * Exercises:
 * 1. bootstrapFromTail on a real JSONL file
 * 2. toSessionActivity conversion
 * 3. machineStateToLastEntryType / getAgentState mapping
 *
 * Run: npx tsx scripts/validate-session-parsing.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  bootstrapFromTail,
  toSessionActivity,
  machineStateToLastEntryType,
  discoverSessionFiles,
} from '../server/parsers/session-state.js';
import type { SessionFileState } from '../server/parsers/session-state.js';
import { ClaudeCodeAdapter } from '../server/platform/claude-code.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    failed++;
  }
}

// ===========================================================================
// Find a real JSONL file to test with
// ===========================================================================
console.log('\n=== Finding a real JSONL session file ===');

const claudeHome = path.join(os.homedir(), '.claude');
const discovered = discoverSessionFiles(claudeHome);

// Find a non-subagent file with decent size
let testFile: string | null = null;
for (const [fp, meta] of discovered) {
  if (meta.isSubagent) continue;
  try {
    const stat = fs.statSync(fp);
    if (stat.size > 10_000) {
      testFile = fp;
      break;
    }
  } catch { continue; }
}

if (!testFile) {
  console.log('  SKIP: No suitable JSONL file found for testing');
  process.exit(0);
}
console.log(`  Using: ${testFile}`);

// ===========================================================================
// 1. bootstrapFromTail
// ===========================================================================
console.log('\n=== bootstrapFromTail ===');

const stateMap = new Map<string, SessionFileState>();
const state = bootstrapFromTail(testFile, stateMap);

assert(state !== null, 'bootstrapFromTail returns non-null state');
if (!state) {
  console.log('  Cannot proceed without state');
  process.exit(1);
}

assert(typeof state.sessionId === 'string' && state.sessionId.length > 0, `sessionId is non-null string: "${state.sessionId}"`);
assert(typeof state.model === 'string' && state.model.length > 0, `model is non-null string: "${state.model}"`);
assert(['working', 'needs_input', 'done'].includes(state.machineState), `machineState is valid: "${state.machineState}"`);
assert(typeof state.toolUseCount === 'number' && state.toolUseCount >= 0, `toolUseCount is non-negative: ${state.toolUseCount}`);
assert(typeof state.toolResultCount === 'number' && state.toolResultCount >= 0, `toolResultCount is non-negative: ${state.toolResultCount}`);
assert(typeof state.messageCount === 'number' && state.messageCount >= 0, `messageCount is non-negative: ${state.messageCount}`);
assert(typeof state.lastActivityAt === 'string', `lastActivityAt is set: "${state.lastActivityAt}"`);
assert(state.byteOffset > 0, `byteOffset is positive: ${state.byteOffset}`);
assert(state.fileSize > 0, `fileSize is positive: ${state.fileSize}`);

// Check at least one of toolUseCount or messageCount is non-zero for a real file
assert(state.toolUseCount > 0 || state.messageCount > 0, `at least one count is non-zero (tools: ${state.toolUseCount}, msgs: ${state.messageCount})`);

console.log(`  State summary: session=${state.sessionId}, model=${state.model}, state=${state.machineState}, tools=${state.toolUseCount}, msgs=${state.messageCount}`);

// ===========================================================================
// 2. toSessionActivity
// ===========================================================================
console.log('\n=== toSessionActivity ===');

const activity = toSessionActivity(state);
assert(activity !== null, 'toSessionActivity returns non-null');
if (activity) {
  assert(typeof activity.sessionId === 'string' && activity.sessionId.length > 0, `SessionActivity.sessionId is populated: "${activity.sessionId}"`);
  assert(typeof activity.lastSeen === 'string', `SessionActivity.lastSeen is set: "${activity.lastSeen}"`);
  assert(typeof activity.active === 'boolean', `SessionActivity.active is boolean: ${activity.active}`);
  // model should be populated since state.model was non-null
  assert(activity.model === state.model, `SessionActivity.model matches state.model: "${activity.model}"`);
  console.log(`  Activity: sessionId=${activity.sessionId}, active=${activity.active}, model=${activity.model}`);
}

// DOD says "session_id and project populated" -- toSessionActivity doesn't include project,
// but the DiscoveredFile metadata does. Verify via discoverSessionFiles
const discoveredMeta = discovered.get(testFile);
if (discoveredMeta) {
  assert(typeof discoveredMeta.project === 'string' && discoveredMeta.project.length > 0, `DiscoveredFile.project is populated: "${discoveredMeta.project}"`);
  assert(typeof discoveredMeta.projectDir === 'string', `DiscoveredFile.projectDir is populated: "${discoveredMeta.projectDir}"`);
}

// ===========================================================================
// 3. getAgentState mapping (all four MachineState -> AgentState transitions)
// ===========================================================================
console.log('\n=== getAgentState mapping ===');

const adapter = new ClaudeCodeAdapter(claudeHome);

// Test all three MachineState values through getAgentState
// machineStateToLastEntryType maps:
//   working -> 'assistant-tool' -> getAgentState: 'working'
//   needs_input -> 'assistant-question' -> getAgentState: 'needs_input'
//   done -> 'assistant-text' -> getAgentState: 'done'

// Create synthetic states for each MachineState
const workingState: SessionFileState = {
  ...state,
  machineState: 'working',
  pendingInputTool: false,
};
const needsInputState: SessionFileState = {
  ...state,
  machineState: 'needs_input',
  pendingInputTool: true,
};
const doneState: SessionFileState = {
  ...state,
  machineState: 'done',
  pendingInputTool: false,
};

// Verify machineStateToLastEntryType mapping
assert(machineStateToLastEntryType(workingState) === 'assistant-tool', 'working -> assistant-tool');
assert(machineStateToLastEntryType(needsInputState) === 'assistant-question', 'needs_input -> assistant-question');
assert(machineStateToLastEntryType(doneState) === 'assistant-text', 'done -> assistant-text');

// Verify getAgentState mapping (uses machineStateToLastEntryType internally)
assert(adapter.getAgentState(workingState) === 'working', 'getAgentState(working) = working');
assert(adapter.getAgentState(needsInputState) === 'needs_input', 'getAgentState(needs_input) = needs_input');
assert(adapter.getAgentState(doneState) === 'done', 'getAgentState(done) = done');

// The fourth mapping: 'user' LastEntryType -> 'working' AgentState
// This happens through the default path, but machineStateToLastEntryType
// only outputs 3 values. The getAgentState switch also handles 'user' -> 'working'.
// Since machineStateToLastEntryType can't produce 'user', this is only reachable
// if someone calls getAgentState with a different LastEntryType source.
// Document: all four AgentState values are correctly mapped:
//   'working' (from assistant-tool or user), 'needs_input', 'done', 'unknown' (default)
console.log('  Note: AgentState "unknown" is the default/fallback case, not mapped from any MachineState');

// ===========================================================================
// Summary
// ===========================================================================
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);

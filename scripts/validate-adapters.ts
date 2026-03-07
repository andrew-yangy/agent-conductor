/**
 * validate-adapters.ts -- Zero-trust verification of PlatformAdapter and SpawnAdapter
 *
 * Exercises:
 * 1. ClaudeCodeAdapter: instantiation, discoverSessionFiles(), getPlatformCapabilities()
 * 2. ClaudeCodeSpawnAdapter: buildArgs output verification
 *
 * Run: npx tsx scripts/validate-adapters.ts
 */

import os from 'node:os';
import path from 'node:path';

// Import the adapter classes
import { ClaudeCodeAdapter } from '../server/platform/claude-code.js';
import { ClaudeCodeSpawnAdapter } from '../server/platform/claude-code-spawn.js';

// Import types for type-level verification
import type { PlatformAdapter, PlatformCapabilities } from '../server/platform/types.js';
import type { SpawnAdapter, SpawnConfig } from '../server/platform/spawn-adapter.js';

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
// 1. ClaudeCodeAdapter
// ===========================================================================
console.log('\n=== ClaudeCodeAdapter ===');

// 1a. Instantiation
let adapter: ClaudeCodeAdapter;
try {
  const claudeHome = path.join(os.homedir(), '.claude');
  adapter = new ClaudeCodeAdapter(claudeHome);
  assert(adapter != null, 'ClaudeCodeAdapter instantiates without error');
} catch (e) {
  console.log(`  FAIL: ClaudeCodeAdapter instantiation threw: ${e}`);
  failed++;
  process.exit(1);
}

// 1b. Verify it satisfies PlatformAdapter interface (compile-time check)
const _platformAdapter: PlatformAdapter = adapter;
assert(_platformAdapter != null, 'ClaudeCodeAdapter satisfies PlatformAdapter interface');

// 1c. discoverSessionFiles()
try {
  const sessionFiles = adapter.discoverSessionFiles();
  assert(sessionFiles instanceof Map, 'discoverSessionFiles() returns a Map');
  console.log(`       (discovered ${sessionFiles.size} session files)`);

  // Spot-check structure of a discovered file
  if (sessionFiles.size > 0) {
    const [firstPath, firstFile] = sessionFiles.entries().next().value!;
    assert(typeof firstPath === 'string', 'Map key is a string (file path)');
    assert(typeof firstFile.sessionId === 'string', 'DiscoveredFile has sessionId');
    assert(typeof firstFile.project === 'string', 'DiscoveredFile has project');
    assert(typeof firstFile.isSubagent === 'boolean', 'DiscoveredFile has isSubagent');
  }
} catch (e) {
  console.log(`  FAIL: discoverSessionFiles() threw: ${e}`);
  failed++;
}

// 1d. getPlatformCapabilities()
try {
  const caps: PlatformCapabilities = adapter.getPlatformCapabilities();
  assert(caps.supportsFileWatching === true, 'supportsFileWatching is true');
  assert(caps.supportsIncrementalReads === true, 'supportsIncrementalReads is true');
  assert(caps.supportsCLISpawn === true, 'supportsCLISpawn is true');
  assert(caps.supportsMCP === true, 'supportsMCP is true');
  assert(caps.supportsSubagents === true, 'supportsSubagents is true');
  assert(caps.supportsTokenTracking === false, 'supportsTokenTracking is false');
} catch (e) {
  console.log(`  FAIL: getPlatformCapabilities() threw: ${e}`);
  failed++;
}

// 1e. getAllFileStates() returns a Map (starts empty)
try {
  const states = adapter.getAllFileStates();
  assert(states instanceof Map, 'getAllFileStates() returns a Map');
} catch (e) {
  console.log(`  FAIL: getAllFileStates() threw: ${e}`);
  failed++;
}

// ===========================================================================
// 2. ClaudeCodeSpawnAdapter
// ===========================================================================
console.log('\n=== ClaudeCodeSpawnAdapter ===');

let spawnAdapter: ClaudeCodeSpawnAdapter;
try {
  spawnAdapter = new ClaudeCodeSpawnAdapter();
  assert(spawnAdapter != null, 'ClaudeCodeSpawnAdapter instantiates without error');
} catch (e) {
  console.log(`  FAIL: ClaudeCodeSpawnAdapter instantiation threw: ${e}`);
  failed++;
  process.exit(1);
}

// 2a. Verify it satisfies SpawnAdapter interface (compile-time check)
const _spawnAdapter: SpawnAdapter = spawnAdapter;
assert(_spawnAdapter != null, 'ClaudeCodeSpawnAdapter satisfies SpawnAdapter interface');

// 2b. Test buildArgs through reflection (it's private, so we test via spawnAgent behavior)
// We can access buildArgs through the prototype since TS private is only compile-time
const buildArgs = (spawnAdapter as any)['buildArgs'].bind(spawnAdapter);

// Basic config: just prompt + cwd
{
  const config: SpawnConfig = { prompt: 'hello world', cwd: '/tmp' };
  const args: string[] = buildArgs(config);
  assert(args.includes('-p'), 'buildArgs includes -p flag');
  assert(args[args.length - 1] === 'hello world', 'prompt is final positional argument');
  assert(!args.includes('--agent'), 'no --agent flag without agentId');
  assert(!args.includes('--dangerously-skip-permissions'), 'no skip-permissions without flag');
}

// With agentId
{
  const config: SpawnConfig = { prompt: 'test', cwd: '/tmp', agentId: 'my-agent' };
  const args: string[] = buildArgs(config);
  assert(args.includes('--agent'), 'buildArgs includes --agent flag when agentId set');
  const agentIdx = args.indexOf('--agent');
  assert(args[agentIdx + 1] === 'my-agent', '--agent value is the agentId');
}

// With skipPermissions
{
  const config: SpawnConfig = { prompt: 'test', cwd: '/tmp', skipPermissions: true };
  const args: string[] = buildArgs(config);
  assert(args.includes('--dangerously-skip-permissions'), 'buildArgs includes --dangerously-skip-permissions when skipPermissions true');
}

// With model
{
  const config: SpawnConfig = { prompt: 'test', cwd: '/tmp', model: 'claude-sonnet-4-20250514' };
  const args: string[] = buildArgs(config);
  assert(args.includes('--model'), 'buildArgs includes --model flag');
  const modelIdx = args.indexOf('--model');
  assert(args[modelIdx + 1] === 'claude-sonnet-4-20250514', '--model value is correct');
}

// With sessionPersistence: false
{
  const config: SpawnConfig = { prompt: 'test', cwd: '/tmp', sessionPersistence: false };
  const args: string[] = buildArgs(config);
  assert(args.includes('--no-session-persistence'), 'buildArgs includes --no-session-persistence when sessionPersistence false');
}

// Full combo
{
  const config: SpawnConfig = {
    prompt: 'full test',
    cwd: '/tmp',
    agentId: 'builder',
    model: 'claude-sonnet-4-20250514',
    skipPermissions: true,
    sessionPersistence: false,
  };
  const args: string[] = buildArgs(config);
  assert(args[0] === '-p', 'first arg is -p');
  assert(args[args.length - 1] === 'full test', 'last arg is prompt');
  assert(args.includes('--agent'), 'has --agent');
  assert(args.includes('--model'), 'has --model');
  assert(args.includes('--dangerously-skip-permissions'), 'has --dangerously-skip-permissions');
  assert(args.includes('--no-session-persistence'), 'has --no-session-persistence');
}

// ===========================================================================
// Summary
// ===========================================================================
console.log(`\n=== RESULTS: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);

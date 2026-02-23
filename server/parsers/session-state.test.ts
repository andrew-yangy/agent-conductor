import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  bootstrapFromTail,
  getFileState,
  getAllFileStates,
  removeFileState,
  getOrBootstrap,
  processFileUpdate,
  toSessionActivity,
  machineStateToLastEntryType,
  type SessionFileState,
} from './session-state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

function tmpFile(name: string): string {
  return path.join(tmpDir, name);
}

/** Write a JSONL file from an array of entry objects. */
function writeJsonl(filePath: string, entries: Record<string, unknown>[]): void {
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(filePath, content, 'utf-8');
}

/** Append JSONL entries to an existing file. */
function appendJsonl(filePath: string, entries: Record<string, unknown>[]): void {
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(filePath, content, 'utf-8');
}

// --- Entry factories ---

const ts = (offset: number) => `2026-02-23T10:00:${String(offset).padStart(2, '0')}Z`;

function userPrompt(text: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'user',
    message: { role: 'user', content: [{ type: 'text', text }] },
    timestamp: ts(0),
    ...extra,
  };
}

function toolResult(content = 'result', count = 1): Record<string, unknown> {
  const results = Array.from({ length: count }, () => ({ type: 'tool_result', content }));
  return {
    type: 'user',
    message: { role: 'user', content: results },
    timestamp: ts(3),
  };
}

function assistantText(text: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text }] },
    timestamp: ts(1),
    ...extra,
  };
}

function assistantToolUse(
  toolName: string,
  input: Record<string, unknown> = {},
  extraBlocks: Record<string, unknown>[] = [],
): Record<string, unknown> {
  return {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'text', text: 'Let me check.' },
        { type: 'tool_use', name: toolName, input },
        ...extraBlocks,
      ],
    },
    timestamp: ts(2),
  };
}

function assistantMultiToolUse(
  tools: Array<{ name: string; input?: Record<string, unknown> }>,
): Record<string, unknown> {
  const content: Record<string, unknown>[] = [{ type: 'text', text: 'Working on it.' }];
  for (const t of tools) {
    content.push({ type: 'tool_use', name: t.name, input: t.input ?? {} });
  }
  return {
    type: 'assistant',
    message: { role: 'assistant', content },
    timestamp: ts(2),
  };
}

function turnEnd(): Record<string, unknown> {
  return { type: 'system', subtype: 'turn_duration', timestamp: ts(4) };
}

function progressEntry(): Record<string, unknown> {
  return { type: 'progress' };
}

function queueOpEntry(): Record<string, unknown> {
  return { type: 'queue-operation' };
}

function fileHistoryEntry(): Record<string, unknown> {
  return { type: 'file-history-snapshot' };
}

/**
 * Bootstrap a temp JSONL file and return its state.
 * Clears any prior cached state for the file first.
 */
function bootstrapEntries(
  name: string,
  entries: Record<string, unknown>[],
): SessionFileState | null {
  const fp = tmpFile(name);
  writeJsonl(fp, entries);
  removeFileState(fp);
  return bootstrapFromTail(fp);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-state-test-'));
});

after(() => {
  // Clean up all cached states
  for (const [key] of getAllFileStates()) {
    removeFileState(key);
  }
  // Remove temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  // Clear cached file states between tests for isolation
  for (const [key] of getAllFileStates()) {
    if (key.startsWith(tmpDir)) {
      removeFileState(key);
    }
  }
});

// ===========================================================================
// State Machine Transitions
// ===========================================================================

describe('State machine transitions', () => {
  it('1. USER_PROMPT sets state=working, resets counts to 0/0', () => {
    const state = bootstrapEntries('t1.jsonl', [
      userPrompt('Hello', { sessionId: 'sess-1' }),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
    assert.equal(state.toolUseCount, 0);
    assert.equal(state.toolResultCount, 0);
  });

  it('2. ASSISTANT_TOOL_USE sets state=working, toolUseCount incremented', () => {
    const state = bootstrapEntries('t2.jsonl', [
      userPrompt('Do something'),
      assistantToolUse('Read', { file_path: '/foo/bar.ts' }),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
    assert.equal(state.toolUseCount, 1);
    assert.equal(state.lastToolName, 'Read');
  });

  it('3. TOOL_RESULT with counts matching stays working (not done)', () => {
    const state = bootstrapEntries('t3.jsonl', [
      userPrompt('Check file'),
      assistantToolUse('Read', { file_path: '/foo.ts' }),
      toolResult('file contents'),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
    assert.equal(state.toolUseCount, 1);
    assert.equal(state.toolResultCount, 1);
  });

  it('4. TOOL_RESULT with counts not matching stays working', () => {
    const state = bootstrapEntries('t4.jsonl', [
      userPrompt('Check files'),
      assistantMultiToolUse([
        { name: 'Read', input: { file_path: '/a.ts' } },
        { name: 'Read', input: { file_path: '/b.ts' } },
      ]),
      toolResult('contents of a', 1), // only 1 of 2 resolved
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
    assert.equal(state.toolUseCount, 2);
    assert.equal(state.toolResultCount, 1);
  });

  it('5. ASSISTANT_TEXT (no question, tools resolved) sets state=done', () => {
    const state = bootstrapEntries('t5.jsonl', [
      userPrompt('Explain'),
      assistantText('Here is the explanation.'),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'done');
  });

  it('6. ASSISTANT_TEXT ending with ? sets state=needs_input', () => {
    const state = bootstrapEntries('t6.jsonl', [
      userPrompt('Do something'),
      assistantText('Would you like me to proceed?'),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'needs_input');
  });

  it('7. ASSISTANT_TEXT with pendingInputTool sets state=needs_input', () => {
    const state = bootstrapEntries('t7.jsonl', [
      userPrompt('Do something'),
      assistantToolUse('AskUserQuestion', { question: 'Which file?' }),
      toolResult('user answer'),
      // pendingInputTool was set by AskUserQuestion, but cleared when tool resolved
      // Let's test the case where tool is NOT yet resolved:
    ]);
    // Actually, to test pendingInputTool with ASSISTANT_TEXT, we need a sequence where
    // AskUserQuestion was issued, result came back (clearing pendingInputTool),
    // but let me re-create: AskUserQuestion issued, NO result yet, then ASSISTANT_TEXT
    const state2 = bootstrapEntries('t7b.jsonl', [
      userPrompt('Do something'),
      assistantToolUse('AskUserQuestion', { question: 'Which file?' }),
      // No tool_result yet — pendingInputTool still true
      assistantText('I need more info.'),
    ]);
    assert.ok(state2);
    assert.equal(state2.machineState, 'needs_input');
    assert.equal(state2.pendingInputTool, true);
  });

  it('8. ASSISTANT_TOOL_USE with AskUserQuestion sets state=needs_input with pendingInputTool', () => {
    const state = bootstrapEntries('t8.jsonl', [
      userPrompt('Help me'),
      assistantToolUse('AskUserQuestion', { question: 'What do you need?' }),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'needs_input');
    assert.equal(state.pendingInputTool, true);
    assert.equal(state.lastToolName, 'AskUserQuestion');
    assert.equal(state.lastToolDetail, 'Waiting for answer');
  });

  it('9. ASSISTANT_TOOL_USE with ExitPlanMode sets state=needs_input', () => {
    const state = bootstrapEntries('t9.jsonl', [
      userPrompt('Plan something'),
      assistantToolUse('ExitPlanMode', {}),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'needs_input');
    assert.equal(state.pendingInputTool, true);
    assert.equal(state.lastToolDetail, 'Plan ready for review');
  });

  it('10. TURN_END sets state=done', () => {
    const state = bootstrapEntries('t10.jsonl', [
      userPrompt('Do it'),
      assistantText('Done.'),
      turnEnd(),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'done');
  });

  it('11. TURN_END with pendingInputTool sets state=needs_input', () => {
    const state = bootstrapEntries('t11.jsonl', [
      userPrompt('Help'),
      assistantToolUse('AskUserQuestion', { question: 'Which?' }),
      // No tool result — pendingInputTool stays true
      turnEnd(),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'needs_input');
    assert.equal(state.pendingInputTool, true);
  });

  it('12. Multiple tool calls: TOOL_USE(2) -> RESULT(1) -> stays working -> RESULT(1) -> stays working', () => {
    const state1 = bootstrapEntries('t12a.jsonl', [
      userPrompt('Read two files'),
      assistantMultiToolUse([
        { name: 'Read', input: { file_path: '/a.ts' } },
        { name: 'Read', input: { file_path: '/b.ts' } },
      ]),
      toolResult('contents a', 1),
    ]);
    assert.ok(state1);
    assert.equal(state1.machineState, 'working');
    assert.equal(state1.toolUseCount, 2);
    assert.equal(state1.toolResultCount, 1);

    const state2 = bootstrapEntries('t12b.jsonl', [
      userPrompt('Read two files'),
      assistantMultiToolUse([
        { name: 'Read', input: { file_path: '/a.ts' } },
        { name: 'Read', input: { file_path: '/b.ts' } },
      ]),
      toolResult('contents a', 1),
      toolResult('contents b', 1),
    ]);
    assert.ok(state2);
    assert.equal(state2.machineState, 'working');
    assert.equal(state2.toolUseCount, 2);
    assert.equal(state2.toolResultCount, 2);
  });

  it('13. Full turn: USER -> TOOL_USE -> RESULT -> TEXT -> done', () => {
    const state = bootstrapEntries('t13.jsonl', [
      userPrompt('Read and summarize'),
      assistantToolUse('Read', { file_path: '/foo.ts' }),
      toolResult('file contents'),
      assistantText('The file contains a function.'),
      turnEnd(),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'done');
  });

  it('14. Full turn with question: USER -> TEXT ending with ? -> needs_input', () => {
    const state = bootstrapEntries('t14.jsonl', [
      userPrompt('Do something'),
      assistantText('Would you like me to continue with the refactor?'),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'needs_input');
  });

  it('15. Skip entries (progress, queue-operation, file-history-snapshot) cause no state change', () => {
    const state = bootstrapEntries('t15.jsonl', [
      userPrompt('Start'),
      assistantToolUse('Read', { file_path: '/x.ts' }),
      progressEntry(),
      queueOpEntry(),
      fileHistoryEntry(),
    ]);
    assert.ok(state);
    // State should still be working from the tool_use, skip entries don't change it
    assert.equal(state.machineState, 'working');
    assert.equal(state.toolUseCount, 1);
    // messageCount should NOT include skip entries
    assert.equal(state.messageCount, 2); // user + assistant_tool_use
  });

  it('16. Session exit: USER with no response stays working', () => {
    const state = bootstrapEntries('t16.jsonl', [
      userPrompt('Bye!', { sessionId: 'sess-exit' }),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
  });
});

// ===========================================================================
// Metadata Accumulation
// ===========================================================================

describe('Metadata accumulation', () => {
  it('17. sessionId captured from first entry that has it', () => {
    const state = bootstrapEntries('t17.jsonl', [
      userPrompt('Hi', { sessionId: 'first-session-id' }),
      assistantText('Hello.', { sessionId: 'second-session-id' }),
    ]);
    assert.ok(state);
    assert.equal(state.sessionId, 'first-session-id');
  });

  it('18. model, cwd, gitBranch, version, slug accumulated (newest wins)', () => {
    const state = bootstrapEntries('t18.jsonl', [
      userPrompt('Hi', {
        sessionId: 'sess-18',
        cwd: '/old/path',
        version: '1.0.0',
        gitBranch: 'main',
      }),
      {
        type: 'assistant',
        message: { role: 'assistant', model: 'claude-opus-4-6', content: [{ type: 'text', text: 'Hi!' }] },
        timestamp: ts(1),
        cwd: '/new/path',
        version: '1.1.0',
        gitBranch: 'feature',
        slug: 'my-slug',
      },
    ]);
    assert.ok(state);
    assert.equal(state.model, 'claude-opus-4-6');
    assert.equal(state.cwd, '/new/path');
    assert.equal(state.version, '1.1.0');
    assert.equal(state.gitBranch, 'feature');
    assert.equal(state.slug, 'my-slug');
  });

  it('19. tasksId extracted from entries referencing tasks directories', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const state = bootstrapEntries('t19.jsonl', [
      userPrompt('Check tasks'),
      assistantToolUse('Read', { file_path: `/home/user/.claude/tasks/${uuid}/task-list.json` }),
    ]);
    assert.ok(state);
    assert.equal(state.tasksId, uuid);
  });
});

// ===========================================================================
// machineStateToLastEntryType mapping
// ===========================================================================

describe('machineStateToLastEntryType', () => {
  it('20. working maps to assistant-tool', () => {
    const state = bootstrapEntries('t20.jsonl', [
      userPrompt('Do it'),
      assistantToolUse('Bash', { command: 'ls' }),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
    assert.equal(machineStateToLastEntryType(state), 'assistant-tool');
  });

  it('21. needs_input maps to assistant-question', () => {
    const state = bootstrapEntries('t21.jsonl', [
      userPrompt('Do something'),
      assistantText('Should I proceed?'),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'needs_input');
    assert.equal(machineStateToLastEntryType(state), 'assistant-question');
  });

  it('22. done maps to assistant-text', () => {
    const state = bootstrapEntries('t22.jsonl', [
      userPrompt('Explain'),
      assistantText('Here is the answer.'),
      turnEnd(),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'done');
    assert.equal(machineStateToLastEntryType(state), 'assistant-text');
  });
});

// ===========================================================================
// toSessionActivity
// ===========================================================================

describe('toSessionActivity', () => {
  it('23. Returns null if no sessionId', () => {
    const state = bootstrapEntries('t23.jsonl', [
      // No sessionId in any entry
      { type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'Hi' }] }, timestamp: ts(0) },
    ]);
    assert.ok(state);
    assert.equal(state.sessionId, undefined);
    const activity = toSessionActivity(state);
    assert.equal(activity, null);
  });

  it('24. Returns activity with tool info when working', () => {
    const state = bootstrapEntries('t24.jsonl', [
      userPrompt('Check file', { sessionId: 'sess-24' }),
      assistantToolUse('Read', { file_path: '/src/index.ts' }),
    ]);
    assert.ok(state);
    // Override mtimeMs to make it "active" (recent)
    state.mtimeMs = Date.now();
    const activity = toSessionActivity(state);
    assert.ok(activity);
    assert.equal(activity.sessionId, 'sess-24');
    assert.equal(activity.tool, 'Read');
    assert.equal(activity.detail, 'index.ts');
    assert.equal(activity.active, true);
    assert.equal(activity.thinking, false);
  });

  it('25. thinking=true when working with no tool and counts match', () => {
    const state = bootstrapEntries('t25.jsonl', [
      userPrompt('Think about it', { sessionId: 'sess-25' }),
    ]);
    assert.ok(state);
    // working, no lastToolName, toolUseCount === toolResultCount (both 0)
    state.mtimeMs = Date.now();
    const activity = toSessionActivity(state);
    assert.ok(activity);
    assert.equal(activity.thinking, true);
    assert.equal(activity.tool, undefined);
  });

  it('25b. active=false when mtime is old', () => {
    const state = bootstrapEntries('t25b.jsonl', [
      userPrompt('Old session', { sessionId: 'sess-25b' }),
      assistantText('Done.'),
      turnEnd(),
    ]);
    assert.ok(state);
    // Make mtime old (> 5 minutes ago)
    state.mtimeMs = Date.now() - 600_000;
    const activity = toSessionActivity(state);
    assert.ok(activity);
    assert.equal(activity.active, false);
  });
});

// ===========================================================================
// Incremental reading (processFileUpdate)
// ===========================================================================

describe('processFileUpdate (incremental reading)', () => {
  it('26. New bytes appended reads only new entries', () => {
    const fp = tmpFile('t26.jsonl');
    writeJsonl(fp, [
      userPrompt('Start', { sessionId: 'sess-26' }),
      assistantText('OK.'),
      turnEnd(),
    ]);
    removeFileState(fp);
    const initial = bootstrapFromTail(fp);
    assert.ok(initial);
    assert.equal(initial.machineState, 'done');
    assert.equal(initial.messageCount, 3);

    // Append new entries
    appendJsonl(fp, [
      userPrompt('Next question'),
      assistantToolUse('Bash', { command: 'echo hello' }),
    ]);

    const updated = processFileUpdate(fp);
    assert.ok(updated);
    assert.equal(updated.machineState, 'working');
    assert.equal(updated.messageCount, 5); // 3 original + 2 new
    assert.equal(updated.lastToolName, 'Bash');
    assert.equal(updated.toolUseCount, 1); // reset by USER_PROMPT then +1
  });

  it('27. File truncated triggers re-bootstrap', () => {
    const fp = tmpFile('t27.jsonl');
    writeJsonl(fp, [
      userPrompt('Start', { sessionId: 'sess-27' }),
      assistantText('Long response with lots of content.'),
      turnEnd(),
    ]);
    removeFileState(fp);
    const initial = bootstrapFromTail(fp);
    assert.ok(initial);
    const originalSize = initial.byteOffset;

    // Truncate the file (simulate recreation with smaller content)
    writeJsonl(fp, [
      userPrompt('Fresh start', { sessionId: 'sess-27-new' }),
    ]);

    const stat = fs.statSync(fp);
    assert.ok(stat.size < originalSize, 'File should be smaller after truncation');

    const updated = processFileUpdate(fp);
    assert.ok(updated);
    assert.equal(updated.sessionId, 'sess-27-new');
    assert.equal(updated.machineState, 'working');
  });

  it('28. No new data returns null', () => {
    const fp = tmpFile('t28.jsonl');
    writeJsonl(fp, [
      userPrompt('Start', { sessionId: 'sess-28' }),
      assistantText('Done.'),
    ]);
    removeFileState(fp);
    bootstrapFromTail(fp);

    // Call processFileUpdate without changing the file
    const result = processFileUpdate(fp);
    assert.equal(result, null);
  });
});

// ===========================================================================
// extractDetail (tested through tool use entries)
// ===========================================================================

describe('extractDetail (via tool use entries)', () => {
  it('29. Read/Edit/Write extracts file basename', () => {
    const stateRead = bootstrapEntries('t29a.jsonl', [
      userPrompt('Read file'),
      assistantToolUse('Read', { file_path: '/home/user/project/src/components/Button.tsx' }),
    ]);
    assert.ok(stateRead);
    assert.equal(stateRead.lastToolDetail, 'Button.tsx');

    const stateEdit = bootstrapEntries('t29b.jsonl', [
      userPrompt('Edit file'),
      assistantToolUse('Edit', { file_path: '/home/user/server/index.ts' }),
    ]);
    assert.ok(stateEdit);
    assert.equal(stateEdit.lastToolDetail, 'index.ts');

    const stateWrite = bootstrapEntries('t29c.jsonl', [
      userPrompt('Write file'),
      assistantToolUse('Write', { file_path: '/tmp/output.json' }),
    ]);
    assert.ok(stateWrite);
    assert.equal(stateWrite.lastToolDetail, 'output.json');
  });

  it('30. Bash extracts first 40 chars of command', () => {
    const shortCmd = 'ls -la';
    const state1 = bootstrapEntries('t30a.jsonl', [
      userPrompt('Run command'),
      assistantToolUse('Bash', { command: shortCmd }),
    ]);
    assert.ok(state1);
    assert.equal(state1.lastToolDetail, shortCmd);

    const longCmd = 'find /usr/local/lib -name "*.so" -type f -exec ls -la {} \\; | sort -k5 -n -r';
    const state2 = bootstrapEntries('t30b.jsonl', [
      userPrompt('Run long command'),
      assistantToolUse('Bash', { command: longCmd }),
    ]);
    assert.ok(state2);
    assert.equal(state2.lastToolDetail, longCmd.slice(0, 40));
  });

  it('31. Grep extracts pattern', () => {
    const state = bootstrapEntries('t31.jsonl', [
      userPrompt('Search'),
      assistantToolUse('Grep', { pattern: 'export function' }),
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'export function');
  });

  it('32. AskUserQuestion detail is "Waiting for answer"', () => {
    const state = bootstrapEntries('t32.jsonl', [
      userPrompt('Help'),
      assistantToolUse('AskUserQuestion', { question: 'What file?' }),
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'Waiting for answer');
  });

  it('33. ExitPlanMode detail is "Plan ready for review"', () => {
    const state = bootstrapEntries('t33.jsonl', [
      userPrompt('Plan'),
      assistantToolUse('ExitPlanMode', {}),
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'Plan ready for review');
  });

  it('33b. EnterPlanMode detail is "Requesting plan mode"', () => {
    const state = bootstrapEntries('t33b.jsonl', [
      userPrompt('Plan'),
      assistantToolUse('EnterPlanMode', {}),
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'Requesting plan mode');
    assert.equal(state.pendingInputTool, true);
    assert.equal(state.machineState, 'needs_input');
  });

  it('33c. Task tool detail is "Spawned agent"', () => {
    const state = bootstrapEntries('t33c.jsonl', [
      userPrompt('Spawn'),
      assistantToolUse('Task', { prompt: 'Do something' }),
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'Spawned agent');
  });

  it('33d. Unknown tool returns tool name as detail', () => {
    const state = bootstrapEntries('t33d.jsonl', [
      userPrompt('Custom'),
      assistantToolUse('SomeCustomTool', { data: 'x' }),
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'SomeCustomTool');
  });

  it('33e. Tool with no input returns tool name', () => {
    const state = bootstrapEntries('t33e.jsonl', [
      userPrompt('Check'),
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', name: 'Read' }], // no input field
        },
        timestamp: ts(2),
      },
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'Read');
  });
});

// ===========================================================================
// Edge cases and complex scenarios
// ===========================================================================

describe('Edge cases', () => {
  it('Empty file returns null', () => {
    const fp = tmpFile('empty.jsonl');
    fs.writeFileSync(fp, '', 'utf-8');
    removeFileState(fp);
    const state = bootstrapFromTail(fp);
    assert.equal(state, null);
  });

  it('Malformed JSON lines are skipped gracefully', () => {
    const fp = tmpFile('malformed.jsonl');
    fs.writeFileSync(
      fp,
      [
        JSON.stringify(userPrompt('Hi', { sessionId: 'sess-mal' })),
        'this is not json {{{',
        JSON.stringify(assistantText('Hello.')),
        '',
      ].join('\n'),
      'utf-8',
    );
    removeFileState(fp);
    const state = bootstrapFromTail(fp);
    assert.ok(state);
    assert.equal(state.sessionId, 'sess-mal');
    assert.equal(state.machineState, 'done');
    assert.equal(state.messageCount, 2); // user + assistant text (malformed skipped)
  });

  it('getOrBootstrap returns cached state on second call', () => {
    const fp = tmpFile('getorboot.jsonl');
    writeJsonl(fp, [userPrompt('Hi', { sessionId: 'sess-gob' })]);
    removeFileState(fp);

    const first = getOrBootstrap(fp);
    assert.ok(first);
    assert.equal(first.sessionId, 'sess-gob');

    // Modify file but don't clear cache — getOrBootstrap should return cached
    appendJsonl(fp, [assistantText('Bye.')]);
    const second = getOrBootstrap(fp);
    assert.ok(second);
    assert.strictEqual(first, second); // same object reference
    // machineState unchanged because we didn't processFileUpdate
    assert.equal(second.machineState, 'working');
  });

  it('removeFileState clears cached state', () => {
    const fp = tmpFile('remove.jsonl');
    writeJsonl(fp, [userPrompt('Hi', { sessionId: 'sess-rm' })]);
    removeFileState(fp);
    bootstrapFromTail(fp);
    assert.ok(getFileState(fp));

    removeFileState(fp);
    assert.equal(getFileState(fp), undefined);
  });

  it('processFileUpdate on unknown file bootstraps it', () => {
    const fp = tmpFile('newfile.jsonl');
    writeJsonl(fp, [
      userPrompt('Brand new', { sessionId: 'sess-new' }),
      assistantText('Welcome.'),
    ]);
    removeFileState(fp);

    // processFileUpdate should bootstrap since no cached state
    const state = processFileUpdate(fp);
    assert.ok(state);
    assert.equal(state.sessionId, 'sess-new');
    assert.equal(state.machineState, 'done');
  });

  it('processFileUpdate on deleted file returns null and clears state', () => {
    const fp = tmpFile('todelete.jsonl');
    writeJsonl(fp, [userPrompt('Hi', { sessionId: 'sess-del' })]);
    removeFileState(fp);
    bootstrapFromTail(fp);
    assert.ok(getFileState(fp));

    // Delete the file
    fs.unlinkSync(fp);

    const result = processFileUpdate(fp);
    assert.equal(result, null);
    assert.equal(getFileState(fp), undefined);
  });

  it('USER_PROMPT resets tool counts and clears pendingInputTool', () => {
    const state = bootstrapEntries('treset.jsonl', [
      userPrompt('First question', { sessionId: 'sess-reset' }),
      assistantToolUse('AskUserQuestion', { question: 'Which?' }),
      // pendingInputTool = true, toolUseCount = 1
      // Now a new user prompt should reset everything
      userPrompt('Second question'),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
    assert.equal(state.toolUseCount, 0);
    assert.equal(state.toolResultCount, 0);
    assert.equal(state.pendingInputTool, false);
    assert.equal(state.lastToolName, undefined);
    assert.equal(state.lastToolDetail, undefined);
  });

  it('ASSISTANT_TEXT with tools still running stays working', () => {
    const state = bootstrapEntries('tstillrunning.jsonl', [
      userPrompt('Do two things'),
      assistantMultiToolUse([
        { name: 'Read', input: { file_path: '/a.ts' } },
        { name: 'Bash', input: { command: 'echo hi' } },
      ]),
      toolResult('contents', 1), // only 1 of 2 resolved
      assistantText('Partial update.'), // text while tools still pending
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
    assert.equal(state.toolUseCount, 2);
    assert.equal(state.toolResultCount, 1);
  });

  it('TOOL_RESULT clears pendingInputTool when all tools resolve', () => {
    const state = bootstrapEntries('tclear.jsonl', [
      userPrompt('Ask something'),
      assistantToolUse('AskUserQuestion', { question: 'What?' }),
      toolResult('user said yes'),
    ]);
    assert.ok(state);
    // pendingInputTool should be cleared because toolResultCount >= toolUseCount
    assert.equal(state.pendingInputTool, false);
    assert.equal(state.machineState, 'working');
  });

  it('Multiple tool use blocks in a single message are all counted', () => {
    const state = bootstrapEntries('tmulti.jsonl', [
      userPrompt('Do many things'),
      assistantMultiToolUse([
        { name: 'Read', input: { file_path: '/a.ts' } },
        { name: 'Read', input: { file_path: '/b.ts' } },
        { name: 'Grep', input: { pattern: 'foo' } },
      ]),
    ]);
    assert.ok(state);
    assert.equal(state.toolUseCount, 3);
    // lastToolName should be the LAST tool in the list
    assert.equal(state.lastToolName, 'Grep');
    assert.equal(state.lastToolDetail, 'foo');
  });

  it('System entry without turn_duration subtype is skipped', () => {
    const state = bootstrapEntries('tsysother.jsonl', [
      userPrompt('Hi', { sessionId: 'sess-sys' }),
      { type: 'system', subtype: 'something_else', timestamp: ts(4) },
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'working');
    assert.equal(state.messageCount, 1); // only the user prompt counts
  });

  it('ASSISTANT_TEXT question mark detection uses trimEnd', () => {
    // Question with trailing whitespace should still be detected
    const state = bootstrapEntries('ttrimq.jsonl', [
      userPrompt('Check'),
      assistantText('Do you want to continue?   '), // trailing spaces
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'needs_input');
  });

  it('ASSISTANT_TEXT uses LAST text block for question detection', () => {
    // First block ends with ?, but last block does not -> should be done
    const state = bootstrapEntries('tlastblock.jsonl', [
      userPrompt('Multi-block'),
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Is this good?' },
            { type: 'text', text: 'I went ahead and did it.' },
          ],
        },
        timestamp: ts(1),
      },
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'done');
  });

  it('ASSISTANT_TEXT with LAST text block ending in ? sets needs_input', () => {
    const state = bootstrapEntries('tlastblockq.jsonl', [
      userPrompt('Multi-block'),
      {
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I did some work.' },
            { type: 'text', text: 'Should I continue?' },
          ],
        },
        timestamp: ts(1),
      },
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'needs_input');
  });

  it('lastActivityAt updated from timestamps', () => {
    const state = bootstrapEntries('tactivity.jsonl', [
      userPrompt('First', { sessionId: 'sess-act' }),
      assistantText('Response.'),
      { type: 'system', subtype: 'turn_duration', timestamp: '2026-02-23T10:05:00Z' },
    ]);
    assert.ok(state);
    assert.equal(state.lastActivityAt, '2026-02-23T10:05:00Z');
  });

  it('messageCount increments only for non-SKIP events', () => {
    const state = bootstrapEntries('tcount.jsonl', [
      userPrompt('Start'),           // +1 USER_PROMPT
      progressEntry(),                // SKIP
      assistantToolUse('Read', { file_path: '/x.ts' }), // +1 ASSISTANT_TOOL_USE
      queueOpEntry(),                 // SKIP
      toolResult('contents'),         // +1 TOOL_RESULT
      fileHistoryEntry(),             // SKIP
      assistantText('Done.'),         // +1 ASSISTANT_TEXT
      turnEnd(),                      // +1 TURN_END
    ]);
    assert.ok(state);
    assert.equal(state.messageCount, 5);
  });
});

// ===========================================================================
// Complex multi-turn scenarios
// ===========================================================================

describe('Complex multi-turn scenarios', () => {
  it('Two complete turns with tool usage', () => {
    const state = bootstrapEntries('ttwoturns.jsonl', [
      // Turn 1
      userPrompt('Read a file', { sessionId: 'sess-2t' }),
      assistantToolUse('Read', { file_path: '/src/main.ts' }),
      toolResult('function main() {}'),
      assistantText('The file contains a main function.'),
      turnEnd(),
      // Turn 2
      userPrompt('Now edit it'),
      assistantToolUse('Edit', { file_path: '/src/main.ts' }),
      toolResult('file edited'),
      assistantText('I have edited the file.'),
      turnEnd(),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'done');
    assert.equal(state.lastToolName, 'Edit');
    // toolUseCount/toolResultCount reflect the latest turn (reset by USER_PROMPT)
    assert.equal(state.toolUseCount, 1);
    assert.equal(state.toolResultCount, 1);
  });

  it('Turn interrupted by new user prompt resets state', () => {
    const state = bootstrapEntries('tinterrupt.jsonl', [
      userPrompt('Start task A', { sessionId: 'sess-int' }),
      assistantToolUse('Bash', { command: 'npm test' }),
      // User interrupts before tool result
      userPrompt('Actually, do task B'),
      assistantText('OK, switching to task B.'),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'done');
    assert.equal(state.toolUseCount, 0); // reset by second USER_PROMPT
    assert.equal(state.toolResultCount, 0);
  });

  it('Incremental update across multiple calls', () => {
    const fp = tmpFile('tincremental.jsonl');

    // Phase 1: Initial content
    writeJsonl(fp, [
      userPrompt('Begin', { sessionId: 'sess-inc' }),
    ]);
    removeFileState(fp);
    const s1 = bootstrapFromTail(fp);
    assert.ok(s1);
    assert.equal(s1.machineState, 'working');

    // Phase 2: Assistant responds with tool use
    appendJsonl(fp, [
      assistantToolUse('Grep', { pattern: 'TODO' }),
    ]);
    const s2 = processFileUpdate(fp);
    assert.ok(s2);
    assert.equal(s2.machineState, 'working');
    assert.equal(s2.lastToolName, 'Grep');
    assert.equal(s2.toolUseCount, 1);

    // Phase 3: Tool result
    appendJsonl(fp, [
      toolResult('TODO: fix this'),
    ]);
    const s3 = processFileUpdate(fp);
    assert.ok(s3);
    assert.equal(s3.machineState, 'working');
    assert.equal(s3.toolResultCount, 1);

    // Phase 4: Final text + turn end
    appendJsonl(fp, [
      assistantText('Found one TODO.'),
      turnEnd(),
    ]);
    const s4 = processFileUpdate(fp);
    assert.ok(s4);
    assert.equal(s4.machineState, 'done');
    assert.equal(s4.messageCount, 5); // user + tool_use + tool_result + text + turn_end
  });

  it('AskUserQuestion -> result -> continue -> done flow', () => {
    const state = bootstrapEntries('taskflow.jsonl', [
      userPrompt('Help me', { sessionId: 'sess-ask' }),
      assistantToolUse('AskUserQuestion', { question: 'Which environment?' }),
      toolResult('production'), // user answered
      assistantToolUse('Bash', { command: 'deploy --env production' }),
      toolResult('deployed successfully'),
      assistantText('Deployed to production.'),
      turnEnd(),
    ]);
    assert.ok(state);
    assert.equal(state.machineState, 'done');
    assert.equal(state.pendingInputTool, false);
    assert.equal(state.lastToolName, 'Bash');
  });
});

// ===========================================================================
// Bash tool detail edge cases
// ===========================================================================

describe('Bash detail edge cases', () => {
  it('Bash with no command field returns "bash"', () => {
    const state = bootstrapEntries('tbashno.jsonl', [
      userPrompt('Run'),
      assistantToolUse('Bash', {}), // no command field
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'bash');
  });

  it('Grep with no pattern field returns "grep"', () => {
    const state = bootstrapEntries('tgrepno.jsonl', [
      userPrompt('Search'),
      assistantToolUse('Grep', {}), // no pattern field
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'grep');
  });

  it('Read with no file_path returns "Read"', () => {
    const state = bootstrapEntries('treadnofp.jsonl', [
      userPrompt('Read'),
      assistantToolUse('Read', {}), // no file_path
    ]);
    assert.ok(state);
    assert.equal(state.lastToolDetail, 'Read');
  });
});

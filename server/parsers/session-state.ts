import fs from 'node:fs';
import path from 'node:path';
import type { SessionActivity } from '../types.js';
import { projectLabel, extractInitialPrompt, extractLatestPrompt, cleanPromptText, isSystemContent } from './session-scanner.js';
import type { LastEntryType } from './session-scanner.js';

// --- Constants ---

const TAIL_SIZE = 65536;
const ACTIVE_WINDOW_MS = 300_000;
const TASKS_UUID_RE = /\.claude\/tasks\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

// Tools that always require user action regardless of permission mode
const INPUT_REQUIRING_TOOLS = new Set(['AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode']);

// --- Types ---

type MachineState = 'working' | 'needs_input' | 'done';

type EventType =
  | 'USER_PROMPT'
  | 'TOOL_RESULT'
  | 'ASSISTANT_TEXT'
  | 'ASSISTANT_TOOL_USE'
  | 'TURN_END'
  | 'SKIP';

interface RawContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | Array<{ type?: string; text?: string; content?: string }>;
}

interface RawMessage {
  role?: string;
  model?: string;
  content?: RawContentBlock[];
}

interface RawEntry {
  type?: string;
  subtype?: string;
  sessionId?: string;
  agentId?: string;
  timestamp?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  slug?: string;
  message?: RawMessage;
}

export interface SessionFileState {
  // File tracking
  byteOffset: number;
  mtimeMs: number;
  fileSize: number;

  // Machine state
  machineState: MachineState;
  toolUseCount: number;
  toolResultCount: number;
  pendingInputTool: boolean;
  lastActivityAt: string;
  messageCount: number;

  // Metadata (accumulated, newest wins)
  sessionId?: string;
  model?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  slug?: string;
  tasksId?: string;
  initialPrompt?: string;
  latestPrompt?: string;

  // Activity info
  lastToolName?: string;
  lastToolDetail?: string;
}

export interface DiscoveredFile {
  filePath: string;
  sessionId: string;
  project: string;
  projectDir: string;
  isSubagent: boolean;
  parentSessionId?: string;
  agentId?: string;
}

// --- In-memory state ---

const fileStates = new Map<string, SessionFileState>();

// --- Public API ---

export function getFileState(filePath: string): SessionFileState | undefined {
  return fileStates.get(filePath);
}

export function getAllFileStates(): Map<string, SessionFileState> {
  return fileStates;
}

export function removeFileState(filePath: string): void {
  fileStates.delete(filePath);
}

/**
 * Get or bootstrap state for a file. If not in the map, does a cold-start bootstrap.
 */
export function getOrBootstrap(filePath: string): SessionFileState | null {
  const existing = fileStates.get(filePath);
  if (existing) return existing;
  return bootstrapFromTail(filePath);
}

/**
 * Cold start: read last 64KB, feed through state machine, set byteOffset = fileSize.
 */
export function bootstrapFromTail(filePath: string): SessionFileState | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    if (stat.size === 0) {
      fs.closeSync(fd);
      return null;
    }

    const readSize = Math.min(TAIL_SIZE, stat.size);
    const buffer = Buffer.allocUnsafe(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    fd = null;

    const content = buffer.toString('utf-8');
    const lines = content.split('\n');
    // Discard first line (likely partial from mid-file read) unless we read the whole file
    const startIdx = stat.size > TAIL_SIZE ? 1 : 0;

    const state: SessionFileState = {
      byteOffset: stat.size,
      mtimeMs: stat.mtimeMs,
      fileSize: stat.size,
      machineState: 'done',
      toolUseCount: 0,
      toolResultCount: 0,
      pendingInputTool: false,
      lastActivityAt: new Date(stat.mtimeMs).toISOString(),
      messageCount: 0,
    };

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as RawEntry;
        processEntry(state, entry);
      } catch {
        // skip malformed
      }
    }

    // Extract prompts (separate I/O reads for head + expanded tail)
    state.initialPrompt = extractInitialPrompt(filePath);
    state.latestPrompt = extractLatestPrompt(filePath);

    fileStates.set(filePath, state);
    return state;
  } catch {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    return null;
  }
}

/**
 * Main entry: read new bytes from file, feed through state machine, return updated state.
 * Returns null if no new data.
 */
export function processFileUpdate(filePath: string): SessionFileState | null {
  const state = fileStates.get(filePath);

  // New file — bootstrap
  if (!state) {
    return bootstrapFromTail(filePath);
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    // File gone
    fileStates.delete(filePath);
    return null;
  }

  // File truncated (e.g., recreated) — re-bootstrap
  if (stat.size < state.byteOffset) {
    fileStates.delete(filePath);
    return bootstrapFromTail(filePath);
  }

  // No new data
  if (stat.size === state.byteOffset) {
    // Update mtime even if no new bytes (touch)
    state.mtimeMs = stat.mtimeMs;
    return null;
  }

  // Read new bytes
  const entries = readNewEntries(filePath, state.byteOffset, stat.size);
  if (!entries) return null;

  // Feed through state machine
  for (const entry of entries.parsed) {
    processEntry(state, entry);
  }

  state.byteOffset = entries.newOffset;
  state.mtimeMs = stat.mtimeMs;
  state.fileSize = stat.size;

  // Re-extract latestPrompt on change (might have new user message)
  state.latestPrompt = extractLatestPrompt(filePath);

  return state;
}

/**
 * Initialize all file states from disk. Called once at startup.
 */
export function initializeAllFileStates(claudeHome: string): Map<string, DiscoveredFile> {
  const discovered = discoverSessionFiles(claudeHome);

  for (const [filePath] of discovered) {
    bootstrapFromTail(filePath);
  }

  return discovered;
}

/**
 * Discover all .jsonl session files under ~/.claude/projects/.
 */
export function discoverSessionFiles(claudeHome: string): Map<string, DiscoveredFile> {
  const projectsDir = path.join(claudeHome, 'projects');
  const result = new Map<string, DiscoveredFile>();

  let projectDirs: string[];
  try {
    projectDirs = fs.readdirSync(projectsDir).filter((d) => {
      try {
        return fs.statSync(path.join(projectsDir, d)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return result;
  }

  for (const projectDir of projectDirs) {
    const projectPath = path.join(projectsDir, projectDir);
    const label = projectLabel(projectDir);

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(projectPath, { withFileTypes: true });
    } catch {
      continue;
    }

    // Top-level .jsonl files (parent sessions)
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      const sessionId = entry.name.replace('.jsonl', '');
      const filePath = path.join(projectPath, entry.name);
      result.set(filePath, {
        filePath,
        sessionId,
        project: label,
        projectDir,
        isSubagent: false,
      });
    }

    // Subagent .jsonl files under {uuid}/subagents/
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const subagentsDir = path.join(projectPath, entry.name, 'subagents');
      let subEntries: fs.Dirent[];
      try {
        subEntries = fs.readdirSync(subagentsDir, { withFileTypes: true });
      } catch {
        continue;
      }

      const parentSessionId = entry.name;

      for (const sub of subEntries) {
        if (!sub.isFile() || !sub.name.endsWith('.jsonl') || !sub.name.startsWith('agent-')) continue;
        if (sub.name.startsWith('agent-acompact-')) continue;

        const agentId = sub.name.replace(/^agent-/, '').replace(/\.jsonl$/, '');
        const filePath = path.join(subagentsDir, sub.name);
        result.set(filePath, {
          filePath,
          sessionId: `${parentSessionId}:${agentId}`,
          project: label,
          projectDir,
          isSubagent: true,
          parentSessionId,
          agentId,
        });
      }
    }
  }

  return result;
}

/**
 * Map machine state to SessionActivity for backward compatibility.
 */
export function toSessionActivity(state: SessionFileState): SessionActivity | null {
  const sessionId = state.sessionId;
  if (!sessionId) return null;

  const ageMs = Date.now() - state.mtimeMs;
  const active = ageMs < ACTIVE_WINDOW_MS;

  const thinking = state.machineState === 'working' &&
    !state.lastToolName &&
    state.toolUseCount === state.toolResultCount;

  return {
    sessionId,
    tool: state.lastToolName,
    detail: state.lastToolDetail,
    thinking,
    model: state.model,
    lastSeen: state.lastActivityAt,
    active,
  };
}

/**
 * Map machine state to LastEntryType for backward compatibility with deriveSessionStatus.
 */
export function machineStateToLastEntryType(state: SessionFileState): LastEntryType {
  switch (state.machineState) {
    case 'working':
      return 'assistant-tool'; // always → 'working' status (no more 'thinking')
    case 'needs_input':
      return 'assistant-question';
    case 'done':
      return 'assistant-text';
  }
}

// --- Internal helpers ---

/**
 * Classify a JSONL entry into an event type.
 */
function classifyEntry(entry: RawEntry): EventType {
  if (!entry.type) return 'SKIP';

  // Skip noise entries
  if (entry.type === 'progress' || entry.type === 'queue-operation' ||
      entry.type === 'file-history-snapshot') {
    return 'SKIP';
  }

  // System entry with turn_duration → turn end
  if (entry.type === 'system') {
    if (entry.subtype === 'turn_duration') return 'TURN_END';
    return 'SKIP';
  }

  if (entry.type === 'user') {
    const content = entry.message?.content;
    if (Array.isArray(content) && content.some((c) => c.type === 'tool_result')) {
      return 'TOOL_RESULT';
    }
    return 'USER_PROMPT';
  }

  if (entry.type === 'assistant') {
    const content = entry.message?.content;
    if (Array.isArray(content) && content.some((c) => c.type === 'tool_use')) {
      return 'ASSISTANT_TOOL_USE';
    }
    return 'ASSISTANT_TEXT';
  }

  return 'SKIP';
}

/**
 * Process a single entry through the state machine (mutates state in place).
 */
function processEntry(state: SessionFileState, entry: RawEntry): void {
  // Accumulate metadata from every entry
  if (entry.sessionId && !state.sessionId) state.sessionId = entry.sessionId;
  if (entry.message?.model) state.model = entry.message.model;
  if (entry.cwd) state.cwd = entry.cwd;
  if (entry.gitBranch) state.gitBranch = entry.gitBranch;
  if (entry.version) state.version = entry.version;
  if (entry.slug) state.slug = entry.slug;
  if (entry.timestamp) state.lastActivityAt = entry.timestamp;

  // Extract tasksId from entries that reference tasks directories
  const entryStr = JSON.stringify(entry);
  const tasksMatch = TASKS_UUID_RE.exec(entryStr);
  if (tasksMatch) state.tasksId = tasksMatch[1];

  const event = classifyEntry(entry);
  if (event === 'SKIP') return;

  state.messageCount++;

  switch (event) {
    case 'USER_PROMPT': {
      // Extract prompt text from user message
      const promptContent = entry.message?.content;
      let promptText: string | undefined;
      if (Array.isArray(promptContent)) {
        for (const block of promptContent) {
          if (block.type === 'tool_result') continue;
          const text = block.text ?? (typeof block.content === 'string' ? block.content : undefined);
          if (typeof text === 'string' && text.trim() && !isSystemContent(text)) {
            promptText = text;
            break;
          }
        }
      }
      if (promptText) {
        const cleaned = cleanPromptText(promptText);
        if (cleaned) {
          state.latestPrompt = cleaned;
          if (!state.initialPrompt) state.initialPrompt = cleaned;
        }
      }

      // New user turn — reset tool counts
      state.toolUseCount = 0;
      state.toolResultCount = 0;
      state.pendingInputTool = false;
      state.lastToolName = undefined;
      state.lastToolDetail = undefined;
      state.machineState = 'working';
      break;
    }

    case 'ASSISTANT_TOOL_USE': {
      const content = entry.message?.content;
      if (Array.isArray(content)) {
        const toolBlocks = content.filter((c) => c.type === 'tool_use');
        state.toolUseCount += toolBlocks.length;

        // Track the last tool and check for input-requiring tools
        for (const block of toolBlocks) {
          if (block.name) {
            state.lastToolName = block.name;
            state.lastToolDetail = extractDetail(block.name, block.input);
            if (INPUT_REQUIRING_TOOLS.has(block.name)) {
              state.pendingInputTool = true;
            }
          }
        }
      }
      // Input-requiring tools (AskUserQuestion, ExitPlanMode) → needs_input immediately
      state.machineState = state.pendingInputTool ? 'needs_input' : 'working';
      break;
    }

    case 'TOOL_RESULT': {
      const content = entry.message?.content;
      if (Array.isArray(content)) {
        state.toolResultCount += content.filter((c) => c.type === 'tool_result').length;
      }

      // If all tools resolved, clear pending input tool flag
      if (state.toolUseCount <= state.toolResultCount) {
        state.pendingInputTool = false;
      }

      // Always stay working — turn isn't done until TURN_END
      state.machineState = 'working';
      break;
    }

    case 'ASSISTANT_TEXT': {
      // Input-requiring tool still pending → needs_input
      if (state.pendingInputTool) {
        state.machineState = 'needs_input';
        break;
      }

      // Check if last text ends with question mark
      const content = entry.message?.content;
      if (Array.isArray(content)) {
        const lastText = [...content].reverse().find((c) => c.type === 'text' && c.text);
        if (lastText?.text?.trimEnd().endsWith('?')) {
          state.machineState = 'needs_input';
          break;
        }
      }

      // If tools are still running, stay working
      if (state.toolUseCount > state.toolResultCount) {
        state.machineState = 'working';
        break;
      }

      // All tools resolved and Claude sent text — turn is done
      state.machineState = 'done';
      break;
    }

    case 'TURN_END':
      // Turn is over — check for pending input tools (safety)
      if (state.pendingInputTool) {
        state.machineState = 'needs_input';
        break;
      }
      state.machineState = 'done';
      break;
  }
}

/**
 * Read new entries from a file starting at fromOffset.
 */
function readNewEntries(
  filePath: string,
  fromOffset: number,
  toSize: number,
): { parsed: RawEntry[]; newOffset: number } | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const readSize = toSize - fromOffset;
    const buffer = Buffer.allocUnsafe(readSize);
    fs.readSync(fd, buffer, 0, readSize, fromOffset);
    fs.closeSync(fd);
    fd = null;

    const content = buffer.toString('utf-8');
    const lines = content.split('\n');

    // If content doesn't end with \n, last line is partial — exclude it
    let newOffset: number;
    let linesToParse: string[];
    if (!content.endsWith('\n')) {
      linesToParse = lines.slice(0, -1);
      // Calculate offset: exclude the partial last line
      const partialLineLength = Buffer.byteLength(lines[lines.length - 1], 'utf-8');
      newOffset = toSize - partialLineLength;
    } else {
      linesToParse = lines;
      newOffset = toSize;
    }

    const parsed: RawEntry[] = [];
    for (const line of linesToParse) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        parsed.push(JSON.parse(trimmed) as RawEntry);
      } catch {
        // skip malformed
      }
    }

    return { parsed, newOffset };
  } catch {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    return null;
  }
}

/**
 * Extract human-readable detail from a tool invocation.
 */
function extractDetail(toolName: string, input: Record<string, unknown> | undefined): string {
  if (!input) return toolName;

  switch (toolName) {
    case 'Read':
    case 'Edit':
    case 'Write': {
      const filePath = input['file_path'];
      if (typeof filePath === 'string') return path.basename(filePath);
      return toolName;
    }
    case 'Bash': {
      const command = input['command'];
      if (typeof command === 'string') return command.slice(0, 40);
      return 'bash';
    }
    case 'Grep': {
      const pattern = input['pattern'];
      if (typeof pattern === 'string') return pattern;
      return 'grep';
    }
    case 'Task':
      return 'Spawned agent';
    case 'AskUserQuestion':
      return 'Waiting for answer';
    case 'ExitPlanMode':
      return 'Plan ready for review';
    case 'EnterPlanMode':
      return 'Requesting plan mode';
    default:
      return toolName;
  }
}

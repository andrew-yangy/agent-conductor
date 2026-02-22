import fs from 'node:fs';
import path from 'node:path';
import type { SessionActivity } from '../types.js';

const READ_SIZE = 8192;
const ACTIVE_WINDOW_MS = 30_000;

// Raw shapes — all fields optional since entries may be malformed
interface RawContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface RawMessage {
  role?: string;
  model?: string;
  content?: RawContentBlock[];
}

interface RawEntry {
  type?: string;
  sessionId?: string;
  timestamp?: string;
  message?: RawMessage;
}

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
    default:
      return toolName;
  }
}

/**
 * Read the last READ_SIZE bytes of a file synchronously.
 * Returns the raw buffer string, or null on error.
 */
function readTail(filepath: string): { content: string; stat: fs.Stats } | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filepath, 'r');
    const stat = fs.fstatSync(fd);
    const readSize = Math.min(READ_SIZE, stat.size);
    if (readSize === 0) {
      fs.closeSync(fd);
      return null;
    }
    const buffer = Buffer.allocUnsafe(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    fd = null;
    return { content: buffer.toString('utf-8'), stat };
  } catch {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    return null;
  }
}

export function parseSessionLog(filepath: string): SessionActivity | null {
  const tail = readTail(filepath);
  if (!tail) return null;

  const { content, stat } = tail;
  const active = Date.now() - stat.mtimeMs < ACTIVE_WINDOW_MS;

  // Split into lines; discard first (likely partial due to tail read)
  const lines = content.split('\n');
  const candidates = lines.slice(1);

  const entries: RawEntry[] = [];
  let sessionId: string | undefined;

  for (const line of candidates) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as RawEntry;
      entries.push(entry);
      // Capture sessionId from any entry
      if (!sessionId && entry.sessionId) {
        sessionId = entry.sessionId;
      }
    } catch {
      // Skip malformed JSON lines
    }
  }

  if (entries.length === 0) return null;

  // Find the last assistant entry that has tool_use content
  let toolEntry: RawEntry | null = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry?.type !== 'assistant') continue;
    const msgContent = entry.message?.content;
    if (!Array.isArray(msgContent)) continue;
    const hasToolUse = msgContent.some((c) => c?.type === 'tool_use');
    if (hasToolUse) {
      toolEntry = entry;
      break;
    }
  }

  // Detect "thinking": last assistant entry has ONLY text blocks (no tool_use)
  let thinking = false;
  const lastEntry = entries[entries.length - 1];
  if (lastEntry?.type === 'assistant') {
    const lastContent = lastEntry.message?.content;
    if (Array.isArray(lastContent) && lastContent.length > 0) {
      const hasToolUse = lastContent.some((c) => c?.type === 'tool_use');
      const hasText = lastContent.some((c) => c?.type === 'text');
      if (hasText && !hasToolUse) {
        thinking = true;
      }
    }
  }

  // If no tool entry found, return thinking state if applicable
  if (!toolEntry) {
    if (!sessionId) return null;
    if (thinking) {
      const ts = lastEntry?.timestamp ?? new Date().toISOString();
      return {
        sessionId,
        thinking: true,
        model: lastEntry?.message?.model,
        lastSeen: ts,
        active,
      };
    }
    return null;
  }

  // Extract tool info from the tool_use block
  const msgContent = toolEntry.message?.content ?? [];
  const toolBlock = msgContent.find((c) => c?.type === 'tool_use');
  const toolName = toolBlock?.name ?? '';
  const input = toolBlock?.input;
  const detail = extractDetail(toolName, input);
  const model = toolEntry.message?.model;
  const lastSeen = toolEntry.timestamp ?? new Date().toISOString();

  // Ensure we have a sessionId
  const resolvedSessionId = sessionId ?? toolEntry.sessionId;
  if (!resolvedSessionId) return null;

  return {
    sessionId: resolvedSessionId,
    tool: toolName || undefined,
    detail,
    thinking,
    model,
    lastSeen,
    active,
  };
}

export function parseAllSessionLogs(claudeHome: string): Record<string, SessionActivity> {
  const projectsDir = path.join(claudeHome, 'projects');
  const result: Record<string, SessionActivity> = {};

  let projectDirs: string[];
  try {
    projectDirs = fs.readdirSync(projectsDir);
  } catch {
    return result;
  }

  for (const projectDir of projectDirs) {
    const projectPath = path.join(projectsDir, projectDir);

    // Process top-level JSONL files in the project directory
    let projectEntries: fs.Dirent[];
    try {
      projectEntries = fs.readdirSync(projectPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of projectEntries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;

      const filepath = path.join(projectPath, entry.name);
      try {
        const activity = parseSessionLog(filepath);
        if (activity && activity.active) {
          result[activity.sessionId] = activity;
        }
      } catch {
        // Skip files that fail to parse
      }
    }

    // Also process subagents/ subdirectory if it exists
    const subagentsPath = path.join(projectPath, 'subagents');
    let subagentEntries: fs.Dirent[];
    try {
      subagentEntries = fs.readdirSync(subagentsPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of subagentEntries) {
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;

      const filepath = path.join(subagentsPath, entry.name);
      try {
        const activity = parseSessionLog(filepath);
        if (activity && activity.active) {
          result[activity.sessionId] = activity;
        }
      } catch {
        // Skip files that fail to parse
      }
    }
  }

  return result;
}

import fs from 'node:fs';
import path from 'node:path';

const ACTIVE_WINDOW_MS = 30_000;
const TAIL_SIZE = 8192;
const HEAD_SIZE = 16384;
const TASKS_UUID_RE = /\.claude\/tasks\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export interface ScannedSession {
  id: string;
  project: string;
  projectDir: string;
  model?: string;
  cwd?: string;
  gitBranch?: string;
  version?: string;
  slug?: string;
  initialPrompt?: string;
  tasksId?: string;
  lastActivity: string;
  active: boolean;
  isSubagent: boolean;
  parentSessionId?: string;
  agentId?: string;
  subagentIds: string[];
  filePath: string;
  fileSize: number;
}

interface RawEntry {
  sessionId?: string;
  agentId?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  slug?: string;
  type?: string;
  timestamp?: string;
  message?: { model?: string };
}

export function projectLabel(dirName: string): string {
  const decoded = dirName.replace(/^-/, '/').replace(/-/g, '/');
  const parts = decoded.split('/').filter(Boolean);
  return parts.slice(-3).join('/');
}

function tailRead(filepath: string): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filepath, 'r');
    const stat = fs.fstatSync(fd);
    const readSize = Math.min(TAIL_SIZE, stat.size);
    if (readSize === 0) {
      fs.closeSync(fd);
      return null;
    }
    const buffer = Buffer.allocUnsafe(readSize);
    fs.readSync(fd, buffer, 0, readSize, stat.size - readSize);
    fs.closeSync(fd);
    fd = null;
    return buffer.toString('utf-8');
  } catch {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    return null;
  }
}

function headRead(filepath: string): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filepath, 'r');
    const stat = fs.fstatSync(fd);
    const readSize = Math.min(HEAD_SIZE, stat.size);
    if (readSize === 0) {
      fs.closeSync(fd);
      return null;
    }
    const buffer = Buffer.allocUnsafe(readSize);
    fs.readSync(fd, buffer, 0, readSize, 0);
    fs.closeSync(fd);
    fd = null;
    return buffer.toString('utf-8');
  } catch {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    return null;
  }
}

interface HeadEntry {
  type?: string;
  message?: {
    role?: string;
    content?: string | Array<{ type?: string; content?: string; text?: string }>;
  };
}

function cleanPromptText(raw: string): string | undefined {
  const lines = raw.trim().split('\n');

  for (const rawLine of lines) {
    // Strip XML/HTML-like tags (e.g., <local-command-caveat>, <system-reminder>)
    let line = rawLine.replace(/<[^>]+>/g, '').trim();

    // Skip empty lines, generic prefixes, and plan boilerplate
    if (!line) continue;
    if (line === 'Implement the following plan:') continue;
    if (line.startsWith('Caveat:')) continue;
    if (line.startsWith('# Plan:') || line.startsWith('## ')) {
      // Use the plan title as the prompt (strip "# Plan: " prefix)
      line = line.replace(/^#+ (?:Plan:\s*)?/, '').trim();
      if (!line) continue;
    }

    return line.length > 80 ? line.slice(0, 80) + '...' : line;
  }
  return undefined;
}

function extractInitialPrompt(filepath: string): string | undefined {
  const content = headRead(filepath);
  if (!content) return undefined;

  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as HeadEntry;
      if (entry.type === 'user' || entry.message?.role === 'user') {
        const msgContent = entry.message?.content;

        // Content can be a plain string or an array of blocks
        if (typeof msgContent === 'string' && msgContent.length > 0) {
          return cleanPromptText(msgContent);
        }

        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            const text = block.content ?? block.text;
            if (typeof text === 'string' && text.length > 0) {
              return cleanPromptText(text);
            }
          }
        }
      }
    } catch {
      // Skip malformed lines (including truncated last line from head read)
    }
  }
  return undefined;
}

function extractTasksId(tailContent: string): string | undefined {
  const match = TASKS_UUID_RE.exec(tailContent);
  return match?.[1];
}

function extractMetadata(filepath: string): Partial<Pick<ScannedSession, 'model' | 'cwd' | 'gitBranch' | 'version' | 'slug' | 'initialPrompt' | 'tasksId'>> {
  const content = tailRead(filepath);
  if (!content) return {};

  const lines = content.split('\n');
  // Discard first line (likely partial)
  const candidates = lines.slice(1);

  const result: Partial<Pick<ScannedSession, 'model' | 'cwd' | 'gitBranch' | 'version' | 'slug' | 'initialPrompt' | 'tasksId'>> = {};

  // Extract tasksId from the raw tail content
  result.tasksId = extractTasksId(content);

  // Parse from newest to oldest, stop once we have all fields
  for (let i = candidates.length - 1; i >= 0; i--) {
    const line = candidates[i].trim();
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as RawEntry;
      if (!result.model && entry.message?.model) result.model = entry.message.model;
      if (!result.cwd && entry.cwd) result.cwd = entry.cwd;
      if (!result.gitBranch && entry.gitBranch) result.gitBranch = entry.gitBranch;
      if (!result.version && entry.version) result.version = entry.version;
      if (!result.slug && entry.slug) result.slug = entry.slug;

      if (result.model && result.cwd && result.gitBranch && result.version && result.slug) break;
    } catch {
      // Skip malformed lines
    }
  }

  // Extract initial prompt from head (separate read)
  result.initialPrompt = extractInitialPrompt(filepath);

  return result;
}

function scanProjectDir(projectsDir: string, projectDir: string): ScannedSession[] {
  const projectPath = path.join(projectsDir, projectDir);
  const label = projectLabel(projectDir);
  const sessions: ScannedSession[] = [];
  const parentSubagentMap = new Map<string, string[]>();

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(projectPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // First pass: find all top-level .jsonl files (parent sessions)
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;

    const sessionId = entry.name.replace('.jsonl', '');
    const filePath = path.join(projectPath, entry.name);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      continue;
    }

    const active = Date.now() - stat.mtimeMs < ACTIVE_WINDOW_MS;
    const metadata = active ? extractMetadata(filePath) : {};

    sessions.push({
      id: sessionId,
      project: label,
      projectDir,
      ...metadata,
      lastActivity: stat.mtime.toISOString(),
      active,
      isSubagent: false,
      subagentIds: [],
      filePath,
      fileSize: stat.size,
    });

    // Initialize subagent tracking for this parent
    parentSubagentMap.set(sessionId, []);
  }

  // Second pass: find subagent .jsonl files under {uuid}/subagents/
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

      const agentId = sub.name.replace(/^agent-/, '').replace(/\.jsonl$/, '');
      const filePath = path.join(subagentsDir, sub.name);

      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      const active = Date.now() - stat.mtimeMs < ACTIVE_WINDOW_MS;
      const metadata = active ? extractMetadata(filePath) : {};

      sessions.push({
        id: `${parentSessionId}:${agentId}`,
        project: label,
        projectDir,
        ...metadata,
        lastActivity: stat.mtime.toISOString(),
        active,
        isSubagent: true,
        parentSessionId,
        agentId,
        subagentIds: [],
        filePath,
        fileSize: stat.size,
      });

      // Link subagent to parent
      const existing = parentSubagentMap.get(parentSessionId);
      if (existing) {
        existing.push(agentId);
      }
    }
  }

  // Third pass: populate subagentIds on parent sessions
  for (const session of sessions) {
    if (!session.isSubagent) {
      session.subagentIds = parentSubagentMap.get(session.id) ?? [];
    }
  }

  return sessions;
}

export function scanAllSessions(claudeHome: string): ScannedSession[] {
  const projectsDir = path.join(claudeHome, 'projects');

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
    return [];
  }

  const allSessions: ScannedSession[] = [];
  for (const dir of projectDirs) {
    allSessions.push(...scanProjectDir(projectsDir, dir));
  }

  return allSessions;
}

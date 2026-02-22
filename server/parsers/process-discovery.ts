import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ClaudePaneMapping {
  /** Map of tasks dir name (UUID or named) → tmux pane ID */
  byTasksDir: Map<string, string>;
  /** Map of claude PID → tmux pane ID */
  byPid: Map<number, string>;
  /** Map of session UUID → tmux pane ID (from project dir paths in lsof) */
  bySessionId: Map<string, string>;
  /** Map of normalized pane title → pane ID (for fuzzy matching with initialPrompt) */
  byPaneTitle: Map<string, string>;
}

/**
 * Discover all running claude processes and map them to tmux panes.
 *
 * Strategy:
 * 1. Get all tmux pane PIDs
 * 2. Find all `claude` processes via `pgrep`
 * 3. Walk each claude process's parent chain to find its tmux pane
 * 4. Extract tasks dir + session IDs from lsof (open files under ~/.claude/)
 */
export async function discoverClaudePanes(): Promise<ClaudePaneMapping> {
  const result: ClaudePaneMapping = {
    byTasksDir: new Map(),
    byPid: new Map(),
    bySessionId: new Map(),
    byPaneTitle: new Map(),
  };

  try {
    // Step 1: Get all tmux pane PIDs and titles
    const { paneMap, titleMap } = await getTmuxPanes();
    if (paneMap.size === 0) return result;

    // Step 2: Find all claude processes
    const claudePids = await findClaudePids();
    if (claudePids.length === 0) return result;

    // Build set of pane PIDs for fast lookup
    const panePidSet = new Set(paneMap.keys());

    // Step 3: For each claude PID, walk parent chain to find tmux pane
    const pidToPaneId = new Map<number, string>();
    for (const claudePid of claudePids) {
      const panePid = await walkParentChain(claudePid, panePidSet);
      if (panePid !== null) {
        const paneId = paneMap.get(panePid);
        if (paneId) {
          pidToPaneId.set(claudePid, paneId);
          result.byPid.set(claudePid, paneId);
        }
      }
    }

    // Step 4: Extract tasks dirs + session IDs from lsof for mapped claude PIDs
    if (pidToPaneId.size > 0) {
      const lsofData = await extractFromLsof([...pidToPaneId.keys()]);

      for (const [pid, tasksDir] of lsofData.tasksDirs) {
        const paneId = pidToPaneId.get(pid);
        if (paneId) {
          result.byTasksDir.set(tasksDir, paneId);
        }
      }

      for (const [pid, sessionId] of lsofData.sessionIds) {
        const paneId = pidToPaneId.get(pid);
        if (paneId) {
          result.bySessionId.set(sessionId, paneId);
        }
      }

    }

    // Step 5: Build pane title map for fuzzy matching
    // Only include panes that have a mapped claude process
    const claudePaneIds = new Set(pidToPaneId.values());
    for (const [paneId, rawTitle] of titleMap) {
      if (!claudePaneIds.has(paneId)) continue;
      const title = normalizeTitle(rawTitle);
      if (title && title !== 'claude code') {
        result.byPaneTitle.set(title, paneId);
      }
    }
  } catch {
    // Discovery is best-effort — failures shouldn't crash the server
  }

  return result;
}

/**
 * Normalize a pane title for matching: remove leading emoji/symbols, lowercase, trim.
 */
function normalizeTitle(raw: string): string {
  return raw
    .replace(/^[\s✳⠐⠂⠈⠄✻✶·•]+/, '')
    .trim()
    .toLowerCase();
}

interface TmuxPaneData {
  paneMap: Map<number, string>;   // panePid → paneId
  titleMap: Map<string, string>;  // paneId → pane title
}

/**
 * Get all tmux panes with PIDs and titles.
 */
async function getTmuxPanes(): Promise<TmuxPaneData> {
  const paneMap = new Map<number, string>();
  const titleMap = new Map<string, string>();
  try {
    // Use TAB as separator since titles can contain spaces
    const { stdout } = await execFileAsync('tmux', [
      'list-panes', '-a', '-F', '#{pane_id}\t#{pane_pid}\t#{pane_title}',
    ]);
    for (const line of stdout.trim().split('\n')) {
      if (!line) continue;
      const parts = line.split('\t');
      const paneId = parts[0];
      const pid = parseInt(parts[1], 10);
      const title = parts.slice(2).join('\t');
      if (paneId && !isNaN(pid)) {
        paneMap.set(pid, paneId);
        if (title) titleMap.set(paneId, title);
      }
    }
  } catch {
    // tmux not running
  }
  return { paneMap, titleMap };
}

/**
 * Find all PIDs of processes named 'claude'.
 * Uses `ps` instead of `pgrep` because macOS pgrep can miss processes.
 */
async function findClaudePids(): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync('ps', ['-eo', 'pid,comm']);
    const pids: number[] = [];
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const match = /^(\d+)\s+claude$/.exec(trimmed);
      if (match) pids.push(parseInt(match[1], 10));
    }
    return pids;
  } catch {
    return [];
  }
}

/**
 * Walk the parent chain of a PID to find a tmux pane PID.
 * Returns the pane PID if found, null otherwise.
 */
async function walkParentChain(pid: number, panePids: Set<number>): Promise<number | null> {
  let current = pid;
  const visited = new Set<number>();

  // Walk up to 20 levels (safety limit)
  for (let i = 0; i < 20; i++) {
    if (panePids.has(current)) return current;
    if (visited.has(current)) return null;
    visited.add(current);

    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'ppid=', '-p', String(current)]);
      const ppid = parseInt(stdout.trim(), 10);
      if (isNaN(ppid) || ppid <= 1) return null;
      current = ppid;
    } catch {
      return null;
    }
  }
  return null;
}

interface LsofData {
  tasksDirs: Map<number, string>;   // PID → tasks dir name
  sessionIds: Map<number, string>;  // PID → session UUID (from project dir paths)
}

/**
 * Extract tasks dirs and session IDs from lsof output for given claude PIDs.
 *
 * Matches:
 * - ~/.claude/tasks/{name}/  → tasks dir name (for team builds)
 * - ~/.claude/projects/{dir}/{uuid}[/...]  → session UUID (parent sessions with subagent dirs)
 * - ~/.claude/projects/{dir}/{uuid}.jsonl  → session UUID (if caught during write)
 */
async function extractFromLsof(pids: number[]): Promise<LsofData> {
  const result: LsofData = {
    tasksDirs: new Map(),
    sessionIds: new Map(),
  };

  const tasksRe = /\.claude\/tasks\/([^\s/]+)/;
  // Match a UUID after the project dir name in .claude/projects/ paths
  const sessionRe = /\.claude\/projects\/[^\s/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;

  const parseLine = (line: string) => {
    const parts = line.trim().split(/\s+/);
    const linePid = parseInt(parts[1], 10);
    if (isNaN(linePid)) return;

    if (!result.tasksDirs.has(linePid)) {
      const taskMatch = tasksRe.exec(line);
      if (taskMatch) result.tasksDirs.set(linePid, taskMatch[1]);
    }

    if (!result.sessionIds.has(linePid)) {
      const sessionMatch = sessionRe.exec(line);
      if (sessionMatch) result.sessionIds.set(linePid, sessionMatch[1]);
    }
  };

  try {
    const pidArgs = pids.join(',');
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', pidArgs], {
      maxBuffer: 2 * 1024 * 1024,
    });
    for (const line of stdout.split('\n')) {
      parseLine(line);
    }
  } catch {
    // Fallback: try individual PIDs
    for (const pid of pids) {
      if (result.tasksDirs.has(pid) && result.sessionIds.has(pid)) continue;
      try {
        const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(pid)], {
          maxBuffer: 512 * 1024,
        });
        for (const line of stdout.split('\n')) {
          parseLine(line);
        }
      } catch {
        // Skip this PID
      }
    }
  }

  return result;
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ClaudePaneMapping {
  /** Map of tasks dir name (UUID or named) → tmux pane ID */
  byTasksDir: Map<string, string>;
  /** Map of claude PID → tmux pane ID */
  byPid: Map<number, string>;
}

/**
 * Discover all running claude processes and map them to tmux panes.
 *
 * Strategy:
 * 1. Get all tmux pane PIDs
 * 2. Find all `claude` processes via `pgrep`
 * 3. Walk each claude process's parent chain to find its tmux pane
 * 4. Extract tasks dir from lsof (open dirs under ~/.claude/tasks/{name}/)
 */
export async function discoverClaudePanes(): Promise<ClaudePaneMapping> {
  const result: ClaudePaneMapping = {
    byTasksDir: new Map(),
    byPid: new Map(),
  };

  try {
    // Step 1: Get all tmux pane PIDs
    const paneMap = await getTmuxPanes();
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

    // Step 4: Extract tasks dir names from lsof for mapped claude PIDs
    if (pidToPaneId.size > 0) {
      const tasksMap = await extractTasksDirs([...pidToPaneId.keys()]);
      for (const [pid, tasksDir] of tasksMap) {
        const paneId = pidToPaneId.get(pid);
        if (paneId) {
          result.byTasksDir.set(tasksDir, paneId);
        }
      }
    }
  } catch {
    // Discovery is best-effort — failures shouldn't crash the server
  }

  return result;
}

/**
 * Get all tmux panes: returns Map<panePid, paneId>
 */
async function getTmuxPanes(): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const { stdout } = await execFileAsync('tmux', [
      'list-panes', '-a', '-F', '#{pane_id} #{pane_pid}',
    ]);
    for (const line of stdout.trim().split('\n')) {
      if (!line) continue;
      const [paneId, pidStr] = line.split(' ');
      const pid = parseInt(pidStr, 10);
      if (paneId && !isNaN(pid)) {
        map.set(pid, paneId);
      }
    }
  } catch {
    // tmux not running
  }
  return map;
}

/**
 * Find all PIDs of processes named 'claude'
 */
async function findClaudePids(): Promise<number[]> {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-x', 'claude']);
    return stdout.trim().split('\n')
      .map((s) => parseInt(s, 10))
      .filter((n) => !isNaN(n));
  } catch {
    // No claude processes found (pgrep returns exit code 1)
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

/**
 * Extract tasks directory names from lsof output for given claude PIDs.
 * Matches both UUID-style and named task directories under ~/.claude/tasks/
 * Returns Map<pid, tasksDirName>
 */
async function extractTasksDirs(pids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const tasksRe = /\.claude\/tasks\/([^\s/]+)/;

  // Run lsof for all PIDs at once
  try {
    const pidArgs = pids.join(',');
    const { stdout } = await execFileAsync('lsof', ['-a', '-p', pidArgs], {
      maxBuffer: 2 * 1024 * 1024,
    });

    for (const line of stdout.split('\n')) {
      const match = tasksRe.exec(line);
      if (!match) continue;

      // Extract PID from the lsof line (format: COMMAND PID USER ...)
      const parts = line.trim().split(/\s+/);
      const linePid = parseInt(parts[1], 10);
      if (!isNaN(linePid) && !map.has(linePid)) {
        map.set(linePid, match[1]);
      }
    }
  } catch {
    // Fallback: try individual PIDs
    for (const pid of pids) {
      if (map.has(pid)) continue;
      try {
        const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(pid)], {
          maxBuffer: 512 * 1024,
        });
        const match = tasksRe.exec(stdout);
        if (match) {
          map.set(pid, match[1]);
        }
      } catch {
        // Skip this PID
      }
    }
  }

  return map;
}

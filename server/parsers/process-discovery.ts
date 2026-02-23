import { exec, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

export interface ItermSessionInfo {
  itermId: string;
  tty: string;
  name: string;
  cwd?: string;
  sessionId?: string;
}

export interface ClaudePaneMapping {
  /** Map of tasks dir name (UUID or named) → pane ID (tmux "%N" or "iterm:{uniqueId}") */
  byTasksDir: Map<string, string>;
  /** Map of claude PID → tmux pane ID */
  byPid: Map<number, string>;
  /** Map of session UUID → pane ID (from project dir paths in lsof) */
  bySessionId: Map<string, string>;
  /** Map of normalized pane title → pane ID (for fuzzy matching with initialPrompt) */
  byPaneTitle: Map<string, string>;
  /** Map of pane ID → array of user prompt strings captured from scrollback */
  panePrompts: Map<string, string[]>;
  /** Map of claude PID → iTerm2 session info (non-tmux sessions) */
  byItermSession: Map<number, ItermSessionInfo>;
  /** iTerm sessions with no matching claude process (for CWD-based matching) */
  orphanItermSessions: Array<{ itermId: string; tty: string; name: string; cwd?: string }>;
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
    panePrompts: new Map(),
    byItermSession: new Map(),
    orphanItermSessions: [],
  };

  try {
    // Step 1: Get all tmux pane PIDs and titles
    const { paneMap, titleMap } = await getTmuxPanes();

    // Step 2: Find all claude processes
    const claudePids = await findClaudePids();

    // Build set of pane PIDs for fast lookup
    const panePidSet = new Set(paneMap.keys());

    // Step 3: For each claude PID, walk parent chain to find tmux pane
    const pidToPaneId = new Map<number, string>();
    if (paneMap.size > 0) {
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
    }

    // Step 3b: For unmapped PIDs, try iTerm2 native session matching
    const unmappedPids = claudePids.filter(pid => !pidToPaneId.has(pid));
    const itermSessions = await getItermSessions();
    if (unmappedPids.length > 0 && itermSessions.length > 0) {
      console.log(`[discovery] Step 3b: ${unmappedPids.length} unmapped PIDs: ${unmappedPids.join(', ')}`);
      console.log(`[discovery] Step 3b: got ${itermSessions.length} iTerm2 sessions`);
      const ttyMap = await getProcessTtys(unmappedPids);
      console.log(`[discovery] Step 3b: TTY map: ${[...ttyMap.entries()].map(([p,t]) => `${p}→${t}`).join(', ')}`);
      for (const [pid, tty] of ttyMap) {
        const match = matchTtyToIterm(tty, itermSessions);
        if (match) {
          result.byItermSession.set(pid, {
            itermId: match.uniqueId,
            tty: match.tty,
            name: match.name,
          });
        }
      }
    }

    // Step 3c: Extract cwd for iTerm-matched PIDs (for cwd-based session matching)
    for (const [pid, info] of result.byItermSession) {
      try {
        const { stdout } = await execFileAsync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { timeout: 3000 });
        const cwdLine = stdout.split('\n').find(l => l.startsWith('n/'));
        if (cwdLine) {
          info.cwd = cwdLine.slice(1);
        }
      } catch {
        // Best effort
      }
    }

    // Step 3d: Derive session ID for iTerm PIDs by matching file creation/modification times.
    // Claude doesn't keep JSONL files open, so lsof won't find them. Strategy:
    // 1. Filter to files created AFTER the PID started (within the PID's lifetime)
    // 2. Among those, pick the one with the most recent mtime (the currently active file)
    // This handles context compaction where claude creates a new JSONL mid-session.
    const claudeHome = path.join(os.homedir(), '.claude');
    const pidStartTimes = await getPidStartTimes([...result.byItermSession.keys()]);
    for (const [pid, info] of result.byItermSession) {
      if (!info.cwd || info.sessionId) continue;
      const pidStart = pidStartTimes.get(pid);
      if (!pidStart) continue;
      try {
        const projectDir = info.cwd.replace(/\//g, '-');
        const sessionsDir = path.join(claudeHome, 'projects', projectDir);
        const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl') && !f.includes(':'));
        if (files.length === 0) continue;

        // Filter to files created after PID started, then pick most recently modified
        let bestFile = '';
        let bestMtime = 0;
        const now = Date.now();
        for (const f of files) {
          try {
            const stat = fs.statSync(path.join(sessionsDir, f));
            // File must be created after PID started (with 60s tolerance)
            // and modified recently (within 5 minutes)
            const createdAfterPid = stat.birthtimeMs >= pidStart - 60_000;
            const recentlyModified = now - stat.mtimeMs < 5 * 60 * 1000;
            if (createdAfterPid && recentlyModified && stat.mtimeMs > bestMtime) {
              bestMtime = stat.mtimeMs;
              bestFile = f;
            }
          } catch {
            // Skip
          }
        }

        if (bestFile) {
          info.sessionId = bestFile.replace('.jsonl', '');
        }
      } catch {
        // Best effort
      }
    }

    // Step 4: Extract tasks dirs + session IDs from lsof for ALL matched PIDs (tmux + iTerm)
    const allMappedPids = [...pidToPaneId.keys(), ...result.byItermSession.keys()];
    if (allMappedPids.length > 0) {
      const lsofData = await extractFromLsof(allMappedPids);

      for (const [pid, tasksDir] of lsofData.tasksDirs) {
        const tmuxPaneId = pidToPaneId.get(pid);
        if (tmuxPaneId) {
          result.byTasksDir.set(tasksDir, tmuxPaneId);
        }
        const itermInfo = result.byItermSession.get(pid);
        if (itermInfo) {
          result.byTasksDir.set(tasksDir, `iterm:${itermInfo.itermId}`);
        }
      }

      for (const [pid, sessionId] of lsofData.sessionIds) {
        const tmuxPaneId = pidToPaneId.get(pid);
        if (tmuxPaneId) {
          result.bySessionId.set(sessionId, tmuxPaneId);
        }
        const itermInfo = result.byItermSession.get(pid);
        if (itermInfo) {
          result.bySessionId.set(sessionId, `iterm:${itermInfo.itermId}`);
        }
      }
    }

    // Step 4b: Register iTerm session IDs derived from JSONL files (step 3d) into bySessionId
    for (const [, info] of result.byItermSession) {
      if (info.sessionId) {
        result.bySessionId.set(info.sessionId, `iterm:${info.itermId}`);
      }
    }

    // Step 5: Build pane title map for fuzzy matching (tmux only)
    const claudePaneIds = new Set(pidToPaneId.values());
    for (const [paneId, rawTitle] of titleMap) {
      if (!claudePaneIds.has(paneId)) continue;
      const title = normalizeTitle(rawTitle);
      if (title && title !== 'claude code') {
        result.byPaneTitle.set(title, paneId);
      }
    }

    // Step 6: Capture user prompts from pane scrollback for content-based matching (tmux only)
    if (claudePaneIds.size > 0) {
      await capturePanePrompts([...claudePaneIds], result.panePrompts);
    }

    // Step 7: Collect orphan iTerm sessions (sessions with no matching claude process)
    if (itermSessions.length > 0) {
      const matchedItermIds = new Set(
        [...result.byItermSession.values()].map(info => info.itermId)
      );
      for (const session of itermSessions) {
        if (matchedItermIds.has(session.uniqueId)) continue;
        // Skip tmux client tabs — those are tmux connections, not direct sessions
        if (session.name.toLowerCase() === 'tmux') continue;

        const ttyNum = parseTtyNumber(session.tty);
        if (ttyNum === null) continue;

        let cwd: string | undefined;
        // Check TTY and TTY+1 (figterm allocates child PTY)
        for (const offset of [0, 1]) {
          const checkTty = `ttys${String(ttyNum + offset).padStart(3, '0')}`;
          try {
            const { stdout } = await execFileAsync('ps', ['-t', checkTty, '-o', 'pid=,comm='], { timeout: 3000 });
            for (const line of stdout.trim().split('\n')) {
              if (!line.trim()) continue;
              const parts = line.trim().split(/\s+/);
              const shellPid = parseInt(parts[0], 10);
              const comm = parts.slice(1).join(' ');
              if (isNaN(shellPid)) continue;
              if (/^-?(zsh|bash|fish)$/.test(comm)) {
                try {
                  const { stdout: lsofOut } = await execFileAsync('lsof', ['-a', '-p', String(shellPid), '-d', 'cwd', '-Fn'], { timeout: 3000 });
                  const cwdLine = lsofOut.split('\n').find(l => l.startsWith('n/'));
                  if (cwdLine) {
                    cwd = cwdLine.slice(1);
                  }
                } catch { /* best effort */ }
              }
              if (cwd) break;
            }
            if (cwd) break;
          } catch { /* TTY may not exist */ }
        }

        result.orphanItermSessions.push({
          itermId: session.uniqueId,
          tty: session.tty,
          name: session.name,
          cwd,
        });
      }
    }

    const itermCount = result.byItermSession.size;
    console.log(`[discovery] Found ${claudePids.length} claude PIDs → ${pidToPaneId.size} tmux panes, ${itermCount} iTerm2 sessions, ${result.orphanItermSessions.length} orphan iTerm, ${result.panePrompts.size} with prompts`);

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

// --- iTerm2 native session discovery ---

interface ItermSessionRaw {
  tty: string;
  uniqueId: string;
  name: string;
}

/** Persistent path for the iTerm2 query script */
const ITERM_SCRIPT_PATH = path.join(os.tmpdir(), 'conductor-iterm-query.applescript');

/** Cached iTerm sessions (refreshed on successful query, used as fallback on failure) */
let cachedItermSessions: ItermSessionRaw[] = [];

/**
 * Get all iTerm2 sessions via AppleScript.
 * Writes the script to a temp file and runs osascript on it.
 * Caches the result so flaky failures still return the last known state.
 */
async function getItermSessions(): Promise<ItermSessionRaw[]> {
  // Ensure the script file exists
  if (!fs.existsSync(ITERM_SCRIPT_PATH)) {
    fs.writeFileSync(ITERM_SCRIPT_PATH, [
      'tell application "iTerm2"',
      '  set tb to character id 9',
      '  set lf to character id 10',
      '  set output to ""',
      '  repeat with w in windows',
      '    repeat with t in tabs of w',
      '      repeat with s in sessions of t',
      '        set output to output & (tty of s) & tb & (unique ID of s) & tb & (name of s) & lf',
      '      end repeat',
      '    end repeat',
      '  end repeat',
      '  return output',
      'end tell',
    ].join('\n'));
  }

  try {
    // Try execFile first (direct, no shell), fall back to exec through shell
    let stdout: string;
    try {
      const result = await execFileAsync('osascript', [ITERM_SCRIPT_PATH], { timeout: 10000 });
      stdout = result.stdout;
    } catch {
      const result = await execAsync(`osascript '${ITERM_SCRIPT_PATH}'`, { timeout: 10000 });
      stdout = result.stdout;
    }
    const sessions: ItermSessionRaw[] = [];
    for (const line of stdout.trim().split(/[\r\n]+/)) {
      if (!line.trim()) continue;
      const parts = line.split('\t');
      if (parts.length >= 2) {
        sessions.push({
          tty: parts[0].trim(),
          uniqueId: parts[1].trim(),
          name: (parts.slice(2).join('\t') || '').trim(),
        });
      }
    }
    cachedItermSessions = sessions;
    return sessions;
  } catch {
    // Return cached sessions on failure (flaky AppleScript)
    if (cachedItermSessions.length > 0) {
      console.log(`[discovery] getItermSessions failed, using ${cachedItermSessions.length} cached sessions`);
    }
    return cachedItermSessions;
  }
}

/**
 * Get TTY for each PID via ps.
 */
async function getProcessTtys(pids: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'pid=,tty=', '-p', pids.join(',')]);
    for (const line of stdout.trim().split('\n')) {
      if (!line.trim()) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parseInt(parts[0], 10);
      const tty = parts[1];
      if (!isNaN(pid) && tty && tty !== '??') {
        map.set(pid, tty);
      }
    }
  } catch {
    for (const pid of pids) {
      try {
        const { stdout } = await execFileAsync('ps', ['-o', 'tty=', '-p', String(pid)]);
        const tty = stdout.trim();
        if (tty && tty !== '??') {
          map.set(pid, tty);
        }
      } catch {
        // Skip
      }
    }
  }
  return map;
}

/**
 * Parse TTY number from strings like "ttys013" or "/dev/ttys013".
 */
function parseTtyNumber(tty: string): number | null {
  const m = tty.match(/ttys(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Match a claude process TTY to an iTerm2 session.
 * Tries exact match first, then off-by-1 (figterm allocates child PTY).
 */
function matchTtyToIterm(claudeTty: string, itermSessions: ItermSessionRaw[]): ItermSessionRaw | null {
  const claudeNum = parseTtyNumber(claudeTty);
  if (claudeNum === null) return null;

  // Exact match (no figterm)
  for (const session of itermSessions) {
    const itermNum = parseTtyNumber(session.tty);
    if (itermNum !== null && claudeNum === itermNum) {
      return session;
    }
  }

  // Off-by-1 (figterm child PTY)
  for (const session of itermSessions) {
    const itermNum = parseTtyNumber(session.tty);
    if (itermNum !== null && claudeNum === itermNum + 1) {
      return session;
    }
  }

  return null;
}

/**
 * Get the start times (in epoch ms) for given PIDs using `ps -o lstart=`.
 */
async function getPidStartTimes(pids: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  for (const pid of pids) {
    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'lstart=', '-p', String(pid)]);
      const startTime = new Date(stdout.trim()).getTime();
      if (!isNaN(startTime)) {
        result.set(pid, startTime);
      }
    } catch {
      // Process may have exited
    }
  }
  return result;
}

/**
 * Capture user prompts from tmux pane scrollback for content-based matching.
 * Extracts lines starting with ❯ (the Claude Code input prompt marker).
 */
async function capturePanePrompts(paneIds: string[], out: Map<string, string[]>): Promise<void> {
  for (const paneId of paneIds) {
    try {
      const { stdout } = await execFileAsync('tmux', [
        'capture-pane', '-t', paneId, '-p', '-S', '-200',
      ], { maxBuffer: 512 * 1024 });

      const prompts: string[] = [];
      for (const line of stdout.split('\n')) {
        // Match lines starting with ❯ (the input prompt marker)
        const match = /^❯\s*(.+)/.exec(line);
        if (match) {
          const text = match[1].trim();
          // Skip very short/generic prompts that won't uniquely identify a session
          if (text.length > 3) {
            prompts.push(text);
          }
        }
      }

      if (prompts.length > 0) {
        out.set(paneId, prompts);
      } else {
        // Count total lines and ❯ occurrences for debugging
        const totalLines = stdout.split('\n').length;
        const rawMarkers = stdout.split('\n').filter((l) => l.includes('❯')).length;
        console.log(`[discovery] Pane ${paneId}: 0 prompts extracted (${totalLines} lines, ${rawMarkers} ❯ markers)`);
      }
    } catch (err) {
      console.log(`[discovery] Pane ${paneId}: capture error: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }
}

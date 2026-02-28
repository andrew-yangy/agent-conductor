import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PANE_ID_REGEX = /^%\d+$/;
const TTY_REGEX = /^\/dev\/ttys\d+$/;

/**
 * Validate that a TTY path matches the expected format.
 * Prevents injection via malicious tty values in AppleScript strings.
 */
function isValidTty(tty: string): boolean {
  return TTY_REGEX.test(tty);
}

/**
 * Extract the numeric suffix from a tty path like "/dev/ttys060" → 60.
 */
function ttyNumber(tty: string): number | null {
  const m = tty.match(/ttys(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Detect which terminal application hosts a given tty by walking the process tree.
 */
async function detectTerminalForTty(tty: string): Promise<'iterm2' | 'warp' | 'terminal' | 'unknown'> {
  try {
    // Get the full process tree in one call
    const { stdout: allProcs } = await execFileAsync('ps', ['-axo', 'pid=,ppid=,comm=']);
    const procs = new Map<number, { ppid: number; comm: string }>();
    for (const line of allProcs.trim().split('\n')) {
      const match = line.trim().match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
      if (match) {
        procs.set(parseInt(match[1]), { ppid: parseInt(match[2]), comm: match[3].trim() });
      }
    }

    // Find processes on this tty
    const ttyShort = tty.replace('/dev/', '');
    const { stdout: ttyOutput } = await execFileAsync('ps', ['-t', ttyShort, '-o', 'pid=']);
    const ttyPids = ttyOutput.trim().split('\n')
      .map(s => parseInt(s.trim()))
      .filter(n => !isNaN(n));

    // Walk up the process tree from each tty process
    for (const startPid of ttyPids) {
      let current = startPid;
      const visited = new Set<number>();
      while (current > 1 && !visited.has(current)) {
        visited.add(current);
        const proc = procs.get(current);
        if (!proc) break;

        const comm = proc.comm;
        if (/iTerm/i.test(comm)) return 'iterm2';
        if (/[Ww]arp/.test(comm)) return 'warp';
        if (/^Terminal$/.test(comm)) return 'terminal';

        current = proc.ppid;
      }
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Bring iTerm2 to foreground, bypassing macOS focus-stealing prevention.
 */
async function bringITermToFront(): Promise<void> {
  try {
    await execFileAsync('osascript', ['-l', 'JavaScript', '-e', `
      ObjC.import('AppKit');
      var apps = $.NSRunningApplication.runningApplicationsWithBundleIdentifier('com.googlecode.iterm2');
      if (apps.count > 0) {
        apps.objectAtIndex(0).activateWithOptions(3);
        'ok';
      }
    `]);
  } catch {
    // Best effort
  }
}

/**
 * Activate iTerm2 and focus the specific tab containing a tmux client tty.
 *
 * iTerm2 tab ttys differ from tmux client ttys by 1 (the tmux client is a
 * child process of the shell in the iTerm2 tab). So we enumerate all iTerm2
 * tabs, find the one whose tty number is 1 less than the tmux client tty,
 * and select that tab.
 */
async function activateITermTab(tmuxClientTty: string): Promise<void> {
  // Validate TTY format to prevent AppleScript injection
  if (!isValidTty(tmuxClientTty)) {
    return;
  }

  const targetNum = ttyNumber(tmuxClientTty);

  if (targetNum !== null) {
    // Enumerate iTerm2 windows/tabs/ttys and select the matching one
    const script = `
      tell application "iTerm2"
        repeat with w in windows
          set tabIdx to 0
          repeat with t in tabs of w
            set tabIdx to tabIdx + 1
            repeat with s in sessions of t
              set sessionTty to tty of s
              if sessionTty contains "ttys" then
                set ttyNum to text ((offset of "ttys" in sessionTty) + 4) thru -1 of sessionTty
                try
                  set ttyNum to ttyNum as integer
                  if ttyNum = ${targetNum - 1} then
                    select t
                    set index of w to 1
                    return "found"
                  end if
                end try
              end if
            end repeat
          end repeat
        end repeat
        return "not_found"
      end tell
    `;
    try {
      const { stdout } = await execFileAsync('osascript', ['-e', script]);
      if (stdout.trim() === 'found') {
        await bringITermToFront();
        return;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: try exact tty match (in case the off-by-1 assumption doesn't hold)
  const fallbackScript = `
    tell application "iTerm2"
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if tty of s = "${tmuxClientTty}" then
              select t
              set index of w to 1
              return "found"
            end if
          end repeat
        end repeat
      end repeat
    end tell
  `;
  try {
    await execFileAsync('osascript', ['-e', fallbackScript]);
  } catch {
    // Best effort
  }

  await bringITermToFront();
}

/**
 * Bring Warp to foreground and optionally switch to a specific tab.
 *
 * Warp has no AppleScript dictionary, so we use CGEvents to send Cmd+N keystrokes.
 * Tab order is determined by sorting each tab's login shell PID start time.
 */
async function activateWarp(tabIndex?: number): Promise<void> {
  // macOS keycodes for digits 1-9
  const DIGIT_KEYCODES: Record<number, number> = {
    1: 18, 2: 19, 3: 20, 4: 21, 5: 23, 6: 22, 7: 26, 8: 28, 9: 25,
  };

  const keycode = tabIndex ? DIGIT_KEYCODES[tabIndex] : undefined;

  try {
    if (keycode) {
      // Activate Warp + send Cmd+N keystroke to switch tab
      await execFileAsync('osascript', ['-l', 'JavaScript', '-e', `
        ObjC.import('AppKit');
        ObjC.import('CoreGraphics');
        var apps = $.NSRunningApplication.runningApplicationsWithBundleIdentifier('dev.warp.Warp-Stable');
        if (apps.count > 0) {
          apps.objectAtIndex(0).activateWithOptions(3);
        }
        delay(0.3);
        var src = $.CGEventSourceCreate($.kCGEventSourceStateHIDSystemState);
        var keyDown = $.CGEventCreateKeyboardEvent(src, ${keycode}, true);
        $.CGEventSetFlags(keyDown, $.kCGEventFlagMaskCommand);
        var keyUp = $.CGEventCreateKeyboardEvent(src, ${keycode}, false);
        $.CGEventSetFlags(keyUp, $.kCGEventFlagMaskCommand);
        $.CGEventPost($.kCGHIDEventTap, keyDown);
        $.CGEventPost($.kCGHIDEventTap, keyUp);
        'ok';
      `], { timeout: 5000 });
    } else {
      // Just bring Warp to front without tab switching
      await execFileAsync('osascript', ['-l', 'JavaScript', '-e', `
        ObjC.import('AppKit');
        var apps = $.NSRunningApplication.runningApplicationsWithBundleIdentifier('dev.warp.Warp-Stable');
        if (apps.count > 0) {
          apps.objectAtIndex(0).activateWithOptions(3);
          'ok';
        }
      `]);
    }
  } catch {
    // Best effort
  }
}

/**
 * Find which Warp tab a given PID belongs to by mapping TTYs to tab order.
 *
 * Returns a 1-based tab index (1-9), or undefined if we can't determine it.
 */
async function findWarpTabIndex(targetPid: number): Promise<number | undefined> {
  try {
    // 1. Get the target process's TTY
    const { stdout: ttyOut } = await execFileAsync('ps', ['-o', 'tty=', '-p', String(targetPid)]);
    const targetTty = ttyOut.trim();
    if (!targetTty || targetTty === '??') return undefined;

    // 2. Build process tree to find all TTYs owned by Warp
    const { stdout: allProcs } = await execFileAsync('ps', ['-axo', 'pid=,ppid=,tty=,lstart=,comm=']);
    const procs = new Map<number, { ppid: number; tty: string; lstart: string; comm: string }>();
    for (const line of allProcs.trim().split('\n')) {
      // Format: PID PPID TTY LSTART(5 fields) COMM
      const m = line.trim().match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s+(\w+\s+\d+\s+\w+\s+[\d:]+\s+\d+)\s+(.+)$/);
      if (m) {
        procs.set(parseInt(m[1]), {
          ppid: parseInt(m[2]),
          tty: m[3],
          lstart: m[4],
          comm: m[5].trim(),
        });
      }
    }

    // 3. Find Warp's main PID (the process named "stable" under Warp.app)
    let warpPid: number | undefined;
    for (const [pid, info] of procs) {
      if (info.comm.includes('Warp.app') && info.comm.includes('/stable')) {
        // Pick the one whose parent is NOT another Warp process
        const parent = procs.get(info.ppid);
        if (!parent || !parent.comm.includes('Warp.app')) {
          warpPid = pid;
          break;
        }
      }
    }
    if (!warpPid) return undefined;

    // 4. Find all login shells descended from Warp — these are one per tab
    //    Walk ancestors of each process with a real TTY to check if Warp is in the chain
    const ttyToStartTime = new Map<string, number>();
    for (const [pid, info] of procs) {
      if (info.tty === '??' || ttyToStartTime.has(info.tty)) continue;
      // Only consider login shells (the first process in each tab)
      if (!(info.comm === '-zsh' || info.comm === '-bash' || info.comm === '-fish' || info.comm === 'login')) continue;

      // Check if this process descends from Warp
      let current = info.ppid;
      const visited = new Set<number>();
      let isWarpChild = false;
      while (current > 1 && !visited.has(current)) {
        visited.add(current);
        if (current === warpPid) { isWarpChild = true; break; }
        const p = procs.get(current);
        if (!p) break;
        current = p.ppid;
      }

      if (isWarpChild) {
        ttyToStartTime.set(info.tty, pid); // Use PID as proxy for creation order (lower PID = earlier)
      }
    }

    if (!ttyToStartTime.has(targetTty)) return undefined;

    // 5. Sort TTYs by their login shell PID (ascending = creation order = tab order)
    const sortedTtys = [...ttyToStartTime.entries()]
      .sort((a, b) => a[1] - b[1])
      .map(e => e[0]);

    const tabIndex = sortedTtys.indexOf(targetTty) + 1; // 1-based
    return (tabIndex >= 1 && tabIndex <= 9) ? tabIndex : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Bring Terminal.app to foreground.
 */
async function activateTerminalApp(): Promise<void> {
  try {
    await execFileAsync('osascript', ['-l', 'JavaScript', '-e', `
      ObjC.import('AppKit');
      var apps = $.NSRunningApplication.runningApplicationsWithBundleIdentifier('com.apple.Terminal');
      if (apps.count > 0) {
        apps.objectAtIndex(0).activateWithOptions(3);
        'ok';
      }
    `]);
  } catch {
    // Best effort
  }
}

/**
 * Focus an iTerm2 session directly by its unique ID (non-tmux).
 */
async function focusItermSession(itermId: string): Promise<{ ok: boolean; error?: string }> {
  // Sanitize: iTerm2 unique IDs are alphanumeric with hyphens/dots
  const safeId = itermId.replace(/[^a-zA-Z0-9\-_.]/g, '');
  if (!safeId || safeId !== itermId) {
    return { ok: false, error: `Invalid iTerm session ID: ${itermId}` };
  }

  const script = `
    tell application "iTerm2"
      repeat with w in windows
        repeat with t in tabs of w
          repeat with s in sessions of t
            if unique ID of s is "${safeId}" then
              select t
              set index of w to 1
              return "found"
            end if
          end repeat
        end repeat
      end repeat
      return "not_found"
    end tell
  `;

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 5000 });
    if (stdout.trim() === 'found') {
      await bringITermToFront();
      return { ok: true };
    }
    return { ok: false, error: 'iTerm2 session not found' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

export async function focusPane(paneId: string): Promise<{ ok: boolean; error?: string }> {
  // Route iTerm2 native sessions (non-tmux)
  if (paneId.startsWith('iterm:')) {
    const itermId = paneId.slice('iterm:'.length);
    return focusItermSession(itermId);
  }

  // Route Warp native sessions — activate and switch to the correct tab
  if (paneId.startsWith('warp:')) {
    const pid = parseInt(paneId.slice('warp:'.length), 10);
    const tabIndex = isNaN(pid) ? undefined : await findWarpTabIndex(pid);
    await activateWarp(tabIndex);
    return { ok: true };
  }

  // Route Terminal.app native sessions — best-effort bring to front
  if (paneId.startsWith('terminal:')) {
    await activateTerminalApp();
    return { ok: true };
  }

  if (!PANE_ID_REGEX.test(paneId)) {
    return { ok: false, error: `Invalid pane ID format: ${paneId}` };
  }

  try {
    // Check that the pane exists and get its session + window info
    const { stdout: paneInfo } = await execFileAsync('tmux', [
      'display-message', '-p', '-t', paneId,
      '#{session_name}:#{window_id}\t#{pane_id}',
    ]);

    if (!paneInfo.trim().includes(paneId)) {
      return { ok: false, error: `Pane ${paneId} not found` };
    }

    // Get the window ID for tmux switching
    const { stdout: windowId } = await execFileAsync('tmux', [
      'display-message', '-p', '-t', paneId, '#{window_id}',
    ]);
    const trimmedWindowId = windowId.trim();

    // Get the tmux session name
    const { stdout: sessionName } = await execFileAsync('tmux', [
      'display-message', '-p', '-t', paneId, '#{session_name}',
    ]);

    // Find the client tty attached to this tmux session
    const { stdout: clients } = await execFileAsync('tmux', [
      'list-clients', '-F', '#{client_tty}\t#{client_session}',
    ]);
    let clientTty: string | undefined;
    for (const line of clients.trim().split('\n')) {
      const [tty, sess] = line.split('\t');
      if (sess === sessionName.trim()) {
        clientTty = tty;
        break;
      }
    }

    // Select the tmux window and pane
    await execFileAsync('tmux', ['select-window', '-t', trimmedWindowId]);
    await execFileAsync('tmux', ['select-pane', '-t', paneId]);

    // Detect which terminal hosts the tmux client and activate it
    if (clientTty) {
      const terminal = await detectTerminalForTty(clientTty);
      switch (terminal) {
        case 'iterm2':
          await activateITermTab(clientTty);
          break;
        case 'warp': {
          // For tmux+Warp, find the tab by looking up processes on the client TTY
          const { stdout: clientPidOut } = await execFileAsync('ps', ['-t', clientTty.replace('/dev/', ''), '-o', 'pid=']);
          const clientPids = clientPidOut.trim().split('\n').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
          let warpTabIdx: number | undefined;
          for (const cp of clientPids) {
            warpTabIdx = await findWarpTabIndex(cp);
            if (warpTabIdx) break;
          }
          await activateWarp(warpTabIdx);
          break;
        }
        case 'terminal':
          await activateTerminalApp();
          break;
        default:
          // Detection failed — try iTerm2 tab matching first (most common), then generic
          await activateITermTab(clientTty);
          break;
      }
    } else {
      // No attached client — best-effort bring any terminal to front
      await bringITermToFront();
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PANE_ID_REGEX = /^%\d+$/;

/**
 * Detect and activate the terminal app running tmux.
 */
async function activateTerminal(): Promise<void> {
  // Use osascript to activate (focus) the existing terminal window without opening a new one
  const terminals = ['iTerm2', 'iTerm', 'Warp', 'Terminal'];
  for (const app of terminals) {
    try {
      await execFileAsync('osascript', ['-e', `tell application "${app}" to activate`]);
      return;
    } catch {
      // App not running, try next
    }
  }
}

export async function focusPane(paneId: string): Promise<{ ok: boolean; error?: string }> {
  // Validate paneId format
  if (!PANE_ID_REGEX.test(paneId)) {
    return { ok: false, error: `Invalid pane ID format: ${paneId}` };
  }

  try {
    // Check that the pane exists
    const { stdout: allPanes } = await execFileAsync('tmux', [
      'list-panes', '-a', '-F', '#{pane_id}',
    ]);

    const paneIds = allPanes.trim().split('\n');
    if (!paneIds.includes(paneId)) {
      return { ok: false, error: `Pane ${paneId} not found` };
    }

    // Get parent window
    const { stdout: windowId } = await execFileAsync('tmux', [
      'display-message', '-p', '-t', paneId, '#{window_id}',
    ]);

    const trimmedWindowId = windowId.trim();

    // Focus the window, then the pane
    await execFileAsync('tmux', ['select-window', '-t', trimmedWindowId]);
    await execFileAsync('tmux', ['select-pane', '-t', paneId]);

    // Bring the terminal app to the foreground
    await activateTerminal();

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

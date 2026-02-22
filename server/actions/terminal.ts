import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PANE_ID_REGEX = /^%\d+$/;

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

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SendInputRequest } from '../types.js';
import type { Aggregator } from '../state/aggregator.js';

const execFileAsync = promisify(execFile);

const PANE_ID_REGEX = /^%\d+$/;

export async function sendInput(
  request: SendInputRequest,
  aggregator: Aggregator,
): Promise<{ ok: boolean; error?: string }> {
  const { paneId, input, type } = request;

  // (a) Validate pane ID format
  if (!PANE_ID_REGEX.test(paneId)) {
    return { ok: false, error: 'Invalid pane ID format' };
  }

  // (b) Validate pane belongs to a known team member
  const state = aggregator.getState();
  const ownedByMember = state.teams.some((team) =>
    team.members.some((member) => member.tmuxPaneId === paneId)
  );
  if (!ownedByMember) {
    return { ok: false, error: 'Pane not owned by team member' };
  }

  // (c) Validate text input length
  if (type === 'text' && input.length > 500) {
    return { ok: false, error: 'Input too long' };
  }

  // (d) Verify pane exists in tmux
  try {
    const { stdout: allPanes } = await execFileAsync('tmux', [
      'list-panes', '-a', '-F', '#{pane_id}',
    ]);
    const paneIds = allPanes.trim().split('\n');
    if (!paneIds.includes(paneId)) {
      return { ok: false, error: 'Pane not found' };
    }
  } catch {
    return { ok: false, error: 'Pane not found' };
  }

  // Execute the appropriate tmux command
  try {
    switch (type) {
      case 'approve':
        await execFileAsync('tmux', ['send-keys', '-t', paneId, '-l', 'y']);
        await execFileAsync('tmux', ['send-keys', '-t', paneId, 'Enter']);
        break;
      case 'reject':
        await execFileAsync('tmux', ['send-keys', '-t', paneId, '-l', 'n']);
        await execFileAsync('tmux', ['send-keys', '-t', paneId, 'Enter']);
        break;
      case 'abort':
        await execFileAsync('tmux', ['send-keys', '-t', paneId, 'C-c']);
        break;
      case 'text':
        await execFileAsync('tmux', ['send-keys', '-t', paneId, '-l', input]);
        await execFileAsync('tmux', ['send-keys', '-t', paneId, 'Enter']);
        break;
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

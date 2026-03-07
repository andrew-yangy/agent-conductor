import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
const TMUX_PANE_ID_REGEX = /^%\d+$/;
function escapeAppleScript(str) {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function validateOwnership(paneId, aggregator) {
    const state = aggregator.getState();
    return state.sessions.some((s) => s.paneId === paneId);
}
async function sendInputTmux(paneId, input, type) {
    // Verify pane exists in tmux
    try {
        const { stdout: allPanes } = await execFileAsync('tmux', [
            'list-panes', '-a', '-F', '#{pane_id}',
        ]);
        const paneIds = allPanes.trim().split('\n');
        if (!paneIds.includes(paneId)) {
            return { ok: false, error: 'Pane not found' };
        }
    }
    catch {
        return { ok: false, error: 'Pane not found' };
    }
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
    }
}
async function sendInputIterm(paneId, input, type) {
    const itermId = paneId.slice('iterm:'.length);
    // Sanitize: iTerm2 unique IDs are alphanumeric with hyphens/dots
    const safeId = itermId.replace(/[^a-zA-Z0-9\-_.]/g, '');
    if (!safeId || safeId !== itermId) {
        return { ok: false, error: `Invalid iTerm session ID: ${itermId}` };
    }
    try {
        if (type === 'abort') {
            // Send Ctrl-C (ASCII character 3) without newline
            const script = `
        tell application "iTerm2"
          repeat with w in windows
            repeat with t in tabs of w
              repeat with s in sessions of t
                if unique ID of s is "${safeId}" then
                  tell s to write text (ASCII character 3) without newline
                  return "ok"
                end if
              end repeat
            end repeat
          end repeat
          return "not_found"
        end tell
      `;
            const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 5000 });
            if (stdout.trim() === 'not_found') {
                return { ok: false, error: 'iTerm2 session not found' };
            }
            return { ok: true };
        }
        // For approve/reject/text: write text sends with newline by default
        let textToSend;
        switch (type) {
            case 'approve':
                textToSend = 'y';
                break;
            case 'reject':
                textToSend = 'n';
                break;
            case 'text':
                textToSend = input;
                break;
            default:
                return { ok: false, error: `Unknown input type: ${type}` };
        }
        const escaped = escapeAppleScript(textToSend);
        const script = `
      tell application "iTerm2"
        repeat with w in windows
          repeat with t in tabs of w
            repeat with s in sessions of t
              if unique ID of s is "${safeId}" then
                tell s to write text "${escaped}"
                return "ok"
              end if
            end repeat
          end repeat
        end repeat
        return "not_found"
      end tell
    `;
        const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 5000 });
        if (stdout.trim() === 'not_found') {
            return { ok: false, error: 'iTerm2 session not found' };
        }
        return { ok: true };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
    }
}
export async function sendInput(request, aggregator) {
    const { paneId, input, type } = request;
    // Validate ownership
    if (!validateOwnership(paneId, aggregator)) {
        return { ok: false, error: 'Pane not owned by any known session' };
    }
    // Validate text input length
    if (type === 'text' && input.length > 500) {
        return { ok: false, error: 'Input too long' };
    }
    // Route to the appropriate handler
    if (paneId.startsWith('iterm:')) {
        return sendInputIterm(paneId, input, type);
    }
    if (TMUX_PANE_ID_REGEX.test(paneId)) {
        return sendInputTmux(paneId, input, type);
    }
    if (paneId.startsWith('warp:') || paneId.startsWith('terminal:')) {
        return { ok: false, error: 'Send-input not supported for this terminal (use tmux for full support)' };
    }
    return { ok: false, error: 'Invalid pane ID format' };
}

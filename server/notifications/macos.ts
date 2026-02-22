import { execFile } from 'node:child_process';

/**
 * Escape a string for use inside an AppleScript double-quoted string.
 * Backslashes must be escaped first, then double quotes.
 */
function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Send a macOS notification via osascript.
 * Fire-and-forget: does not await, logs errors silently.
 */
export function sendMacNotification(title: string, body: string): void {
  const escapedTitle = escapeAppleScript(title);
  const escapedBody = escapeAppleScript(body);
  const script = `display notification "${escapedBody}" with title "${escapedTitle}"`;

  execFile('osascript', ['-e', script], (err) => {
    if (err) {
      console.error('[notifications] osascript error:', err.message);
    }
  });
}

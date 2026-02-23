import fs from 'node:fs';

const PROMPT_TAIL_SIZE = 65536;
const HEAD_SIZE = 16384;

export type LastEntryType = 'user' | 'assistant-tool' | 'assistant-text' | 'assistant-question' | 'unknown';

export function projectLabel(dirName: string): string {
  const decoded = dirName.replace(/^-/, '/').replace(/-/g, '/');
  const parts = decoded.split('/').filter(Boolean);
  return parts.slice(-3).join('/');
}

function headRead(filepath: string, size = HEAD_SIZE): string | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filepath, 'r');
    const stat = fs.fstatSync(fd);
    const readSize = Math.min(size, stat.size);
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

export function cleanPromptText(raw: string): string | undefined {
  const lines = raw.trim().split('\n');

  for (const rawLine of lines) {
    let line = rawLine.replace(/<[^>]+>/g, '').trim();

    if (!line) continue;
    if (line === 'Implement the following plan:') continue;
    if (line.startsWith('Caveat:')) continue;
    if (line.startsWith('# Plan:') || line.startsWith('## ')) {
      line = line.replace(/^#+ (?:Plan:\s*)?/, '').trim();
      if (!line) continue;
    }

    return line.length > 80 ? line.slice(0, 80) + '...' : line;
  }
  return undefined;
}

export function extractInitialPrompt(filepath: string): string | undefined {
  // Try progressively larger reads to handle compacted/continued sessions
  // where the first user entry can exceed 16KB
  for (const size of [HEAD_SIZE, HEAD_SIZE * 16]) {
    const content = headRead(filepath, size);
    if (!content) return undefined;

    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line) as HeadEntry;
        if (entry.type === 'user' || entry.message?.role === 'user') {
          const msgContent = entry.message?.content;

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
        // Partial line at buffer boundary — try larger read
      }
    }
  }
  return undefined;
}

export function isSystemContent(text: string): boolean {
  const trimmed = text.trim();
  if (/^<system-reminder>[\s\S]*<\/system-reminder>$/.test(trimmed)) return true;
  if (/^<task-notification>[\s\S]*<\/task-notification>$/.test(trimmed)) return true;
  if (trimmed.startsWith('Shell cwd was reset to')) return true;
  if (trimmed.startsWith('Called the ') && trimmed.includes(' tool with')) return true;
  if (trimmed.startsWith('Result of calling the ')) return true;
  if (trimmed.startsWith('This session is being continued from a previous conversation')) return true;
  if (trimmed.startsWith('[Request interrupted by user')) return true;
  return false;
}

export function extractLatestPrompt(filepath: string): string | undefined {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filepath, 'r');
    const stat = fs.fstatSync(fd);
    if (stat.size === 0) {
      fs.closeSync(fd);
      return undefined;
    }

    const chunkSize = PROMPT_TAIL_SIZE;
    const maxRead = Math.min(stat.size, chunkSize * 8);
    let offset = stat.size;

    while (offset > stat.size - maxRead && offset > 0) {
      const readSize = Math.min(chunkSize, offset);
      offset -= readSize;
      const buffer = Buffer.allocUnsafe(readSize);
      fs.readSync(fd, buffer, 0, readSize, offset);
      const content = buffer.toString('utf-8');
      const lines = content.split('\n');
      const startIdx = offset > 0 ? 1 : 0;

      for (let i = lines.length - 1; i >= startIdx; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const entry = JSON.parse(line) as HeadEntry;
          if (entry.type !== 'user' && entry.message?.role !== 'user') continue;

          const msgContent = entry.message?.content;
          if (typeof msgContent === 'string' && msgContent.trim().length > 0) {
            if (isSystemContent(msgContent)) continue;
            fs.closeSync(fd);
            return cleanPromptText(msgContent);
          }
          if (Array.isArray(msgContent)) {
            for (const block of msgContent) {
              if (block.type === 'tool_result') continue;
              const text = block.content ?? block.text;
              if (typeof text === 'string' && text.trim().length > 0 && !isSystemContent(text)) {
                fs.closeSync(fd);
                return cleanPromptText(text);
              }
            }
          }
        } catch {
          // skip malformed
        }
      }
    }

    fs.closeSync(fd);
    fd = null;
  } catch {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
  return undefined;
}

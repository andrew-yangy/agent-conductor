import fs from 'node:fs';
import path from 'node:path';

const PROMPT_TAIL_SIZE = 65536;
const HEAD_SIZE = 16384;

export type LastEntryType = 'user' | 'assistant-tool' | 'assistant-text' | 'assistant-question' | 'unknown';

export function projectLabel(dirName: string): string {
  const decoded = dirName.replace(/^-/, '/').replace(/-/g, '/');
  const parts = decoded.split('/').filter(Boolean);
  return parts.slice(-3).join('/');
}

/**
 * Derive the Claude projects directory name from an absolute repo path.
 * Inverse of the encoding Claude Code uses: `/Users/foo/bar` → `-Users-foo-bar`
 */
export function projectDirFromPath(repoPath: string): string {
  return repoPath.replace(/\//g, '-');
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
    // Skip directive-style preambles
    if (/^(Execute|Complete|Implement|Perform|Run)\s+(all\s+)?\d*\s*(tasks?|items?|steps?)\s+(below|listed|described|following)/i.test(line)) continue;
    if (/^The CEO\s/i.test(line)) continue;
    if (/^You are being spawned/i.test(line)) continue;
    if (/^You have \d+\s*(sequential\s+)?tasks?/i.test(line)) continue;
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

// --- Named agent detection ---

/** Known named agents in the conductor system (loaded from agent-registry.json) */
import { loadAgentRegistry } from '../paths.js';
const registryData = loadAgentRegistry() as {
  agents: Array<{ id: string; name: string; role: string }>;
};

const KNOWN_AGENTS: Record<string, { name: string; role: string }> = {};
for (const agent of registryData.agents) {
  if (!agent.id || !agent.name || agent.id === 'ceo') continue;
  const firstName = typeof agent.name === 'string' ? agent.name.split(' ')[0] : String(agent.name);
  KNOWN_AGENTS[agent.id] = { name: firstName, role: agent.role ?? 'Agent' };
}
// Generic roles (from subagent_type, not personality-driven -- not in registry)
KNOWN_AGENTS['builder'] = { name: 'Builder', role: 'Engineer' };
KNOWN_AGENTS['reviewer'] = { name: 'Reviewer', role: 'Code Reviewer' };
KNOWN_AGENTS['auditor'] = { name: 'Auditor', role: 'Technical Auditor' };
KNOWN_AGENTS['investigator'] = { name: 'Investigator', role: 'Codebase Scanner' };

/**
 * Extract a named agent identity from the initial prompt of a subagent.
 * Detects patterns like "You are Alex Rivera, Chief of Staff" or "You are Sarah Chen, CTO"
 * Returns { name, role } if found, undefined otherwise.
 */
export function extractAgentIdentity(promptText: string): { name: string; role: string } | undefined {
  if (!promptText) return undefined;

  // Check first 2000 chars for agent identity patterns
  const head = promptText.slice(0, 2000);

  // Pattern 1: "You are {FirstName} {LastName}, {Role}"
  const youAreMatch = head.match(/You are (\w+)\s+\w+,\s*([^.\n]+)/);
  if (youAreMatch) {
    const firstName = youAreMatch[1].toLowerCase();
    const known = KNOWN_AGENTS[firstName];
    if (known) return known;
    // Unknown named agent — use what we found
    return { name: youAreMatch[1], role: youAreMatch[2].trim() };
  }

  // Pattern 2: "# {FirstName} {LastName} --- {Role}" (personality file header)
  const headerMatch = head.match(/^#\s+(\w+)\s+\w+\s*(?:---|—)\s*(.+)$/m);
  if (headerMatch) {
    const firstName = headerMatch[1].toLowerCase();
    const known = KNOWN_AGENTS[firstName];
    if (known) return known;
    return { name: headerMatch[1], role: headerMatch[2].trim() };
  }

  // Pattern 3: Check for known agent first names in the prompt
  for (const [key, agent] of Object.entries(KNOWN_AGENTS)) {
    // Look for "You are {Name}" or "as {Name}" in the prompt
    const nameRegex = new RegExp(`\\b(?:You are|as)\\s+${key}\\b`, 'i');
    if (nameRegex.test(head)) return agent;
  }

  return undefined;
}

/**
 * Extract agent identity from a JSONL file's first user message.
 * Reads the head of the file to find the initial prompt, then checks for agent identity patterns.
 */
export function extractAgentIdentityFromFile(filepath: string): { name: string; role: string } | undefined {
  const content = headRead(filepath, HEAD_SIZE);
  if (!content) return undefined;

  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as HeadEntry;
      if (entry.type === 'user' || entry.message?.role === 'user') {
        const msgContent = entry.message?.content;

        if (typeof msgContent === 'string' && msgContent.length > 0) {
          return extractAgentIdentity(msgContent);
        }

        if (Array.isArray(msgContent)) {
          for (const block of msgContent) {
            const text = block.content ?? block.text;
            if (typeof text === 'string' && text.length > 0) {
              const identity = extractAgentIdentity(text);
              if (identity) return identity;
            }
          }
        }
      }
    } catch {
      // skip malformed
    }
  }
  return undefined;
}

// --- Parent session cross-reference for subagent type detection ---

/** Cache of parent file → (agentId → subagent_type) mappings */
const parentAgentMapCache = new Map<string, { mtime: number; map: Map<string, string> }>();

/**
 * Scan a parent session JSONL for Agent tool_use/tool_result pairs.
 * Returns a map of agentId → subagent_type (e.g. "a4df5875a493548ce" → "alex").
 * Results are cached per parent file and invalidated on mtime change.
 */
export function extractSubagentTypesFromParent(
  parentFilePath: string,
  cache?: Map<string, { mtime: number; map: Map<string, string> }>,
): Map<string, string> {
  const cacheMap = cache ?? parentAgentMapCache;
  // Check cache
  let stat: fs.Stats;
  try {
    stat = fs.statSync(parentFilePath);
  } catch {
    return new Map();
  }

  const cached = cacheMap.get(parentFilePath);
  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.map;
  }

  const result = new Map<string, string>();

  // Scan the entire file for Agent tool calls — they can appear anywhere in a
  // long conversation. Previously limited to 2MB which missed late-session spawns.
  const MAX_SCAN = stat.size;
  let fd: number | null = null;
  try {
    fd = fs.openSync(parentFilePath, 'r');
    const scanSize = Math.min(MAX_SCAN, stat.size);
    let offset = 0;
    let partial = '';

    // Track pending Agent tool_use entries: tool_use_id → subagent_type
    const pendingToolCalls = new Map<string, string>();

    while (offset < scanSize) {
      const chunkSize = Math.min(65536, scanSize - offset);
      const buffer = Buffer.allocUnsafe(chunkSize);
      fs.readSync(fd, buffer, 0, chunkSize, offset);
      offset += chunkSize;

      const content = partial + buffer.toString('utf-8');
      const lines = content.split('\n');
      // Last line may be partial — save for next chunk
      partial = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Quick pre-filter to avoid parsing every line
        if (!trimmed.includes('"Agent"') && !trimmed.includes('agentId')) continue;

        try {
          const entry = JSON.parse(trimmed);
          const blocks = entry?.message?.content;
          if (!Array.isArray(blocks)) continue;

          for (const block of blocks) {
            // Agent tool_use → capture subagent_type keyed by tool_use id
            if (block.type === 'tool_use' && block.name === 'Agent' && block.input?.subagent_type) {
              pendingToolCalls.set(block.id, block.input.subagent_type);
            }

            // tool_result → match agentId to pending tool call
            if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
              const subagentType = pendingToolCalls.get(block.tool_use_id);
              if (!subagentType) continue;

              // Extract agentId from the result text
              const resultText = typeof block.content === 'string'
                ? block.content
                : Array.isArray(block.content)
                  ? block.content.map((b: { text?: string }) => b.text ?? '').join('')
                  : '';

              const match = resultText.match(/agentId:\s*(\w+)/);
              if (match) {
                result.set(match[1], subagentType);
                pendingToolCalls.delete(block.tool_use_id);
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

  cacheMap.set(parentFilePath, { mtime: stat.mtimeMs, map: result });
  return result;
}

/**
 * Look up agent identity for a subagent by checking the parent session's Agent tool calls.
 * Returns { name, role } if the subagent was spawned with a known subagent_type, undefined otherwise.
 */
export function resolveAgentFromParent(
  parentFilePath: string,
  childAgentId: string,
  cache?: Map<string, { mtime: number; map: Map<string, string> }>,
): { name: string; role: string } | undefined {
  const typeMap = extractSubagentTypesFromParent(parentFilePath, cache);
  const subagentType = typeMap.get(childAgentId);
  if (!subagentType) return undefined;

  // Check known agents (normalize: subagent_type may include suffix like "alex" from "alex-cos")
  const normalized = subagentType.toLowerCase().split('-')[0];
  return KNOWN_AGENTS[normalized] ?? KNOWN_AGENTS[subagentType.toLowerCase()];
}

/**
 * Look up a known agent by its CLI agent-setting name (e.g. "riley", "sarah").
 * Returns { name, role } if known, undefined otherwise.
 */
export function resolveAgentFromSetting(agentSetting: string): { name: string; role: string } | undefined {
  const normalized = agentSetting.toLowerCase().split('-')[0];
  return KNOWN_AGENTS[normalized] ?? KNOWN_AGENTS[agentSetting.toLowerCase()];
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

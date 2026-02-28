import crypto from 'node:crypto';
import { insertEvent } from '../db.js';
import type { HookEvent } from '../types.js';

interface RawEventBody {
  type?: string;
  sessionId?: string;
  timestamp?: string;
  message?: string;
  project?: string;
  metadata?: Record<string, unknown>;
}

const MAX_FIELD_LENGTH = 1024;
const MAX_METADATA_SIZE = 8192;

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) : str;
}

/**
 * Validate and sanitize event body fields without persisting.
 * Exported for testability.
 */
export function sanitizeEventBody(body: RawEventBody): Omit<HookEvent, 'id'> {
  const type = truncate(typeof body.type === 'string' ? body.type : 'unknown', 128);
  const sessionId = truncate(typeof body.sessionId === 'string' ? body.sessionId : 'unknown', 256);
  const message = truncate(
    typeof body.message === 'string' ? body.message : formatDefaultMessage(body.type),
    MAX_FIELD_LENGTH,
  );
  const project = typeof body.project === 'string' ? truncate(body.project, 256) : undefined;

  // Validate timestamp format (ISO 8601) or use current time
  let timestamp = new Date().toISOString();
  if (typeof body.timestamp === 'string' && !isNaN(Date.parse(body.timestamp))) {
    timestamp = body.timestamp;
  }

  // Limit metadata size
  let metadata = body.metadata;
  if (metadata && JSON.stringify(metadata).length > MAX_METADATA_SIZE) {
    metadata = undefined;
  }

  return { type, sessionId, timestamp, message, project, metadata };
}

export function processEvent(body: RawEventBody): HookEvent {
  const sanitized = sanitizeEventBody(body);
  const event: HookEvent = { id: crypto.randomUUID(), ...sanitized };

  // Persist to SQLite
  insertEvent(event);

  return event;
}

function formatDefaultMessage(type: string | undefined): string {
  switch (type) {
    case 'stop':
      return 'Agent session stopped';
    case 'task_completed':
      return 'Task completed';
    case 'teammate_idle':
      return 'Teammate is idle';
    case 'permission_prompt':
      return 'Agent needs permission';
    case 'idle_prompt':
      return 'Agent needs input';
    case 'elicitation_dialog':
      return 'Agent needs input';
    case 'error':
      return 'Agent encountered an error';
    default:
      return `Event: ${type ?? 'unknown'}`;
  }
}

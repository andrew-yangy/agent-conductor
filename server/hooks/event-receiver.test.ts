import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeEventBody } from './event-receiver.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sanitizeEventBody - normal input', () => {
  it('passes through valid fields', () => {
    const result = sanitizeEventBody({
      type: 'stop',
      sessionId: 'abc-123',
      timestamp: '2026-02-28T12:00:00Z',
      message: 'Session stopped',
      project: 'my-project',
    });
    assert.equal(result.type, 'stop');
    assert.equal(result.sessionId, 'abc-123');
    assert.equal(result.timestamp, '2026-02-28T12:00:00Z');
    assert.equal(result.message, 'Session stopped');
    assert.equal(result.project, 'my-project');
  });

  it('preserves valid metadata', () => {
    const metadata = { key: 'value', nested: { a: 1 } };
    const result = sanitizeEventBody({ metadata });
    assert.deepEqual(result.metadata, metadata);
  });
});

describe('sanitizeEventBody - missing fields', () => {
  it('defaults type to "unknown" when missing', () => {
    const result = sanitizeEventBody({});
    assert.equal(result.type, 'unknown');
  });

  it('defaults sessionId to "unknown" when missing', () => {
    const result = sanitizeEventBody({});
    assert.equal(result.sessionId, 'unknown');
  });

  it('uses current time when timestamp missing', () => {
    const before = Date.now();
    const result = sanitizeEventBody({});
    const after = Date.now();
    const ts = new Date(result.timestamp).getTime();
    assert.ok(ts >= before && ts <= after, 'Timestamp should be approximately now');
  });

  it('uses default message for known type when message missing', () => {
    const result = sanitizeEventBody({ type: 'stop' });
    assert.equal(result.message, 'Agent session stopped');
  });

  it('uses default message for error type', () => {
    const result = sanitizeEventBody({ type: 'error' });
    assert.equal(result.message, 'Agent encountered an error');
  });

  it('uses default message for permission_prompt type', () => {
    const result = sanitizeEventBody({ type: 'permission_prompt' });
    assert.equal(result.message, 'Agent needs permission');
  });

  it('uses generic default message for unknown type', () => {
    const result = sanitizeEventBody({ type: 'custom_type' });
    assert.equal(result.message, 'Event: custom_type');
  });

  it('uses generic default message when type is also missing', () => {
    const result = sanitizeEventBody({});
    assert.equal(result.message, 'Event: unknown');
  });

  it('sets project to undefined when missing', () => {
    const result = sanitizeEventBody({});
    assert.equal(result.project, undefined);
  });
});

describe('sanitizeEventBody - field truncation', () => {
  it('truncates type to 128 characters', () => {
    const longType = 'x'.repeat(200);
    const result = sanitizeEventBody({ type: longType });
    assert.equal(result.type.length, 128);
    assert.equal(result.type, 'x'.repeat(128));
  });

  it('truncates sessionId to 256 characters', () => {
    const longId = 's'.repeat(300);
    const result = sanitizeEventBody({ sessionId: longId });
    assert.equal(result.sessionId.length, 256);
  });

  it('truncates message to 1024 characters', () => {
    const longMsg = 'm'.repeat(2000);
    const result = sanitizeEventBody({ message: longMsg });
    assert.equal(result.message.length, 1024);
  });

  it('truncates project to 256 characters', () => {
    const longProject = 'p'.repeat(300);
    const result = sanitizeEventBody({ project: longProject });
    assert.equal(result.project!.length, 256);
  });

  it('does not truncate fields within limits', () => {
    const result = sanitizeEventBody({
      type: 'stop',
      sessionId: 'abc',
      message: 'hello',
      project: 'proj',
    });
    assert.equal(result.type, 'stop');
    assert.equal(result.sessionId, 'abc');
    assert.equal(result.message, 'hello');
    assert.equal(result.project, 'proj');
  });
});

describe('sanitizeEventBody - timestamp validation', () => {
  it('accepts valid ISO 8601 timestamp', () => {
    const result = sanitizeEventBody({ timestamp: '2026-01-15T08:30:00.000Z' });
    assert.equal(result.timestamp, '2026-01-15T08:30:00.000Z');
  });

  it('accepts valid date string', () => {
    const result = sanitizeEventBody({ timestamp: '2026-02-28' });
    assert.equal(result.timestamp, '2026-02-28');
  });

  it('rejects invalid timestamp and uses current time', () => {
    const before = Date.now();
    const result = sanitizeEventBody({ timestamp: 'not-a-date' });
    const after = Date.now();
    const ts = new Date(result.timestamp).getTime();
    assert.ok(ts >= before && ts <= after);
  });

  it('rejects empty string timestamp', () => {
    const before = Date.now();
    const result = sanitizeEventBody({ timestamp: '' });
    const after = Date.now();
    // Empty string parsed by Date is NaN
    const ts = new Date(result.timestamp).getTime();
    assert.ok(ts >= before && ts <= after);
  });

  it('rejects non-string timestamp (number)', () => {
    const before = Date.now();
    // @ts-expect-error Testing invalid input type
    const result = sanitizeEventBody({ timestamp: 12345 });
    const after = Date.now();
    const ts = new Date(result.timestamp).getTime();
    assert.ok(ts >= before && ts <= after);
  });
});

describe('sanitizeEventBody - metadata size limit', () => {
  it('preserves small metadata', () => {
    const metadata = { key: 'value' };
    const result = sanitizeEventBody({ metadata });
    assert.deepEqual(result.metadata, metadata);
  });

  it('drops metadata exceeding 8KB', () => {
    const metadata = { data: 'x'.repeat(9000) };
    const result = sanitizeEventBody({ metadata });
    assert.equal(result.metadata, undefined);
  });

  it('preserves metadata at exactly 8KB boundary', () => {
    // Create metadata that serializes to < 8192 bytes
    const metadata = { data: 'x'.repeat(8170) }; // ~8182 bytes JSON
    const result = sanitizeEventBody({ metadata });
    if (JSON.stringify(metadata).length <= 8192) {
      assert.deepEqual(result.metadata, metadata);
    } else {
      assert.equal(result.metadata, undefined);
    }
  });

  it('handles undefined metadata', () => {
    const result = sanitizeEventBody({});
    assert.equal(result.metadata, undefined);
  });
});

describe('sanitizeEventBody - type coercion', () => {
  it('defaults non-string type to "unknown"', () => {
    // @ts-expect-error Testing invalid input type
    const result = sanitizeEventBody({ type: 123 });
    assert.equal(result.type, 'unknown');
  });

  it('defaults non-string sessionId to "unknown"', () => {
    // @ts-expect-error Testing invalid input type
    const result = sanitizeEventBody({ sessionId: { id: 'abc' } });
    assert.equal(result.sessionId, 'unknown');
  });

  it('uses default message when message is non-string', () => {
    // @ts-expect-error Testing invalid input type
    const result = sanitizeEventBody({ type: 'stop', message: 42 });
    assert.equal(result.message, 'Agent session stopped');
  });

  it('ignores non-string project', () => {
    // @ts-expect-error Testing invalid input type
    const result = sanitizeEventBody({ project: ['array'] });
    assert.equal(result.project, undefined);
  });
});

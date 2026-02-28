import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Readable } from 'node:stream';

import {
  buildAllowedOrigins,
  setCorsHeaders,
  setSecurityHeaders,
  readBody,
  serveStatic,
} from './security.js';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockReq(origin?: string): http.IncomingMessage {
  return { headers: origin ? { origin } : {} } as unknown as http.IncomingMessage;
}

function mockRes(): { res: http.ServerResponse; headers: Map<string, string> } {
  const headers = new Map<string, string>();
  const res = {
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
  } as unknown as http.ServerResponse;
  return { res, headers };
}

function mockStreamReq(body: string, chunkSize = Infinity): http.IncomingMessage {
  const buf = Buffer.from(body);
  let offset = 0;
  return new Readable({
    read() {
      if (offset >= buf.length) {
        this.push(null);
        return;
      }
      const end = Math.min(offset + chunkSize, buf.length);
      this.push(buf.subarray(offset, end));
      offset = end;
    },
  }) as unknown as http.IncomingMessage;
}

interface StaticMockRes extends http.ServerResponse {
  statusCode: number;
  _headers: Record<string, string>;
  _body: string | Buffer;
}

function mockStaticRes(): StaticMockRes {
  const mock = {
    statusCode: 0,
    _headers: {} as Record<string, string>,
    _body: '' as string | Buffer,
    writeHead(code: number, headers?: Record<string, string>) {
      mock.statusCode = code;
      if (headers) Object.assign(mock._headers, headers);
    },
    end(data?: string | Buffer) {
      if (data !== undefined) mock._body = data;
    },
    setHeader(name: string, value: string) {
      mock._headers[name] = value;
    },
  };
  return mock as unknown as StaticMockRes;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildAllowedOrigins', () => {
  it('includes localhost variants for the given port', () => {
    const origins = buildAllowedOrigins(4444);
    assert.ok(origins.has('http://localhost:4444'));
    assert.ok(origins.has('http://127.0.0.1:4444'));
  });

  it('includes Vite dev server origin', () => {
    const origins = buildAllowedOrigins(4444);
    assert.ok(origins.has('http://localhost:5173'));
    assert.ok(origins.has('http://127.0.0.1:5173'));
  });

  it('does not include arbitrary origins', () => {
    const origins = buildAllowedOrigins(4444);
    assert.ok(!origins.has('http://evil.com'));
    assert.ok(!origins.has('http://localhost:3000'));
    assert.ok(!origins.has('https://localhost:4444'));
  });

  it('uses the provided port', () => {
    const origins = buildAllowedOrigins(9999);
    assert.ok(origins.has('http://localhost:9999'));
    assert.ok(!origins.has('http://localhost:4444'));
  });
});

describe('setCorsHeaders', () => {
  const allowed = buildAllowedOrigins(4444);

  it('sets Access-Control-Allow-Origin for allowed origin', () => {
    const req = mockReq('http://localhost:4444');
    const { res, headers } = mockRes();
    setCorsHeaders(req, res, allowed);
    assert.equal(headers.get('Access-Control-Allow-Origin'), 'http://localhost:4444');
    assert.equal(headers.get('Vary'), 'Origin');
  });

  it('sets CORS for Vite dev server origin', () => {
    const req = mockReq('http://localhost:5173');
    const { res, headers } = mockRes();
    setCorsHeaders(req, res, allowed);
    assert.equal(headers.get('Access-Control-Allow-Origin'), 'http://localhost:5173');
  });

  it('does NOT set Access-Control-Allow-Origin for disallowed origin', () => {
    const req = mockReq('http://evil.com');
    const { res, headers } = mockRes();
    setCorsHeaders(req, res, allowed);
    assert.ok(!headers.has('Access-Control-Allow-Origin'));
  });

  it('does NOT set Access-Control-Allow-Origin for HTTPS variant', () => {
    const req = mockReq('https://localhost:4444');
    const { res, headers } = mockRes();
    setCorsHeaders(req, res, allowed);
    assert.ok(!headers.has('Access-Control-Allow-Origin'));
  });

  it('does NOT set Access-Control-Allow-Origin when no origin header', () => {
    const req = mockReq();
    const { res, headers } = mockRes();
    setCorsHeaders(req, res, allowed);
    assert.ok(!headers.has('Access-Control-Allow-Origin'));
  });

  it('always sets allowed methods and headers regardless of origin', () => {
    const req = mockReq('http://evil.com');
    const { res, headers } = mockRes();
    setCorsHeaders(req, res, allowed);
    assert.ok(headers.has('Access-Control-Allow-Methods'));
    assert.ok(headers.has('Access-Control-Allow-Headers'));
  });
});

describe('setSecurityHeaders', () => {
  it('sets X-Content-Type-Options to nosniff', () => {
    const { res, headers } = mockRes();
    setSecurityHeaders(res);
    assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  });

  it('sets X-Frame-Options to DENY', () => {
    const { res, headers } = mockRes();
    setSecurityHeaders(res);
    assert.equal(headers.get('X-Frame-Options'), 'DENY');
  });

  it('sets Content-Security-Policy with self default', () => {
    const { res, headers } = mockRes();
    setSecurityHeaders(res);
    const csp = headers.get('Content-Security-Policy');
    assert.ok(csp);
    assert.ok(csp.includes("default-src 'self'"));
  });

  it('CSP allows WebSocket connections to localhost', () => {
    const { res, headers } = mockRes();
    setSecurityHeaders(res);
    const csp = headers.get('Content-Security-Policy')!;
    assert.ok(csp.includes('ws://localhost:*'));
    assert.ok(csp.includes('ws://127.0.0.1:*'));
  });
});

describe('readBody', () => {
  it('reads a normal body', async () => {
    const req = mockStreamReq('hello world');
    const body = await readBody(req);
    assert.equal(body, 'hello world');
  });

  it('reads body in small chunks', async () => {
    const req = mockStreamReq('hello world', 3);
    const body = await readBody(req);
    assert.equal(body, 'hello world');
  });

  it('reads empty body', async () => {
    const req = mockStreamReq('');
    const body = await readBody(req);
    assert.equal(body, '');
  });

  it('accepts body at exactly maxSize', async () => {
    const data = 'x'.repeat(100);
    const req = mockStreamReq(data);
    const body = await readBody(req, 100);
    assert.equal(body, data);
  });

  it('rejects body exceeding maxSize', async () => {
    const data = 'x'.repeat(2000);
    const req = mockStreamReq(data, 500);
    await assert.rejects(
      () => readBody(req, 1000),
      { message: 'Request body too large' },
    );
  });

  it('rejects body exceeding small custom maxSize', async () => {
    const req = mockStreamReq('too long for limit');
    await assert.rejects(
      () => readBody(req, 5),
      { message: 'Request body too large' },
    );
  });

  it('handles JSON body within limits', async () => {
    const json = JSON.stringify({ key: 'value', nested: { a: 1 } });
    const req = mockStreamReq(json);
    const body = await readBody(req);
    assert.deepEqual(JSON.parse(body), { key: 'value', nested: { a: 1 } });
  });
});

describe('serveStatic', () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-static-test-'));
    fs.writeFileSync(path.join(tmpDir, 'index.html'), '<html>hi</html>');
    fs.writeFileSync(path.join(tmpDir, 'app.js'), 'console.log("hi")');
    fs.mkdirSync(path.join(tmpDir, 'assets'));
    fs.writeFileSync(path.join(tmpDir, 'assets', 'style.css'), 'body{}');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves an existing file with correct MIME type', () => {
    const res = mockStaticRes();
    serveStatic('/app.js', tmpDir, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res._headers['Content-Type'], 'application/javascript');
    assert.equal(res._body.toString(), 'console.log("hi")');
  });

  it('serves nested files', () => {
    const res = mockStaticRes();
    serveStatic('/assets/style.css', tmpDir, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res._headers['Content-Type'], 'text/css');
    assert.equal(res._body.toString(), 'body{}');
  });

  it('falls back to index.html for unknown paths (SPA routing)', () => {
    const res = mockStaticRes();
    serveStatic('/some/route', tmpDir, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res._headers['Content-Type'], 'text/html');
    assert.equal(res._body.toString(), '<html>hi</html>');
  });

  it('blocks path traversal with ../', () => {
    const res = mockStaticRes();
    serveStatic('/../../../etc/passwd', tmpDir, res);
    assert.equal(res.statusCode, 403);
  });

  it('blocks path traversal with internal ..', () => {
    const res = mockStaticRes();
    serveStatic('/assets/../../etc/passwd', tmpDir, res);
    assert.equal(res.statusCode, 403);
  });

  it('blocks path traversal with absolute path attempt', () => {
    const res = mockStaticRes();
    serveStatic('/../../../tmp', tmpDir, res);
    assert.equal(res.statusCode, 403);
  });

  it('serves index.html for directory request', () => {
    const res = mockStaticRes();
    serveStatic('/', tmpDir, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res._headers['Content-Type'], 'text/html');
  });
});

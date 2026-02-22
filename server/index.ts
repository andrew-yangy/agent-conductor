import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, saveConfig } from './config.js';
import { getDb, closeDb } from './db.js';
import { Aggregator } from './state/aggregator.js';
import { ClaudeWatcher } from './watchers/claude-watcher.js';
import { SessionWatcher } from './watchers/session-watcher.js';
import { processEvent } from './hooks/event-receiver.js';
import { focusPane } from './actions/terminal.js';
import { sendInput } from './actions/send-input.js';
import { Notifier } from './notifications/notifier.js';
import type { WsMessage, WsMessageType, SendInputRequest } from './types.js';

// --- Load config and initialize ---
const config = loadConfig();
const PORT = config.server.port;

// Initialize DB (creates table if needed)
getDb();

// Create aggregator and parse initial state
const aggregator = new Aggregator(config);
aggregator.initialize();

// Create and start notifier
const notifier = new Notifier(aggregator, config.notifications ?? { macOS: true, browser: true });
notifier.start();

// Broadcast notification_fired events to all WebSocket clients
notifier.on('notification_fired', (payload: { sessionId: string; suppressBrowser: boolean }) => {
  const message: WsMessage = {
    version: 1,
    type: 'notification_fired',
    payload,
  };
  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
});

// Start file watchers
const claudeWatcher = new ClaudeWatcher(aggregator, config.claudeHome);
claudeWatcher.start();

const sessionWatcher = new SessionWatcher(aggregator, config.claudeHome);
sessionWatcher.start();

// Track last event timestamp for health endpoint
let lastEventTimestamp: string | null = null;
const serverStartTime = new Date().toISOString();

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  // CORS headers for dev mode
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // --- API Routes ---
  if (url.pathname === '/api/state' && req.method === 'GET') {
    handleGetState(res);
    return;
  }

  if (url.pathname === '/api/events' && req.method === 'POST') {
    handlePostEvent(req, res);
    return;
  }

  if (url.pathname === '/api/events' && req.method === 'GET') {
    handleGetEvents(res);
    return;
  }

  if (url.pathname === '/api/health' && req.method === 'GET') {
    handleHealth(res);
    return;
  }

  if (url.pathname === '/api/actions/focus-session' && req.method === 'POST') {
    handleFocusSession(req, res);
    return;
  }

  if (url.pathname === '/api/actions/send-input' && req.method === 'POST') {
    handleSendInput(req, res);
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'GET') {
    handleGetConfig(res);
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'PATCH') {
    handlePatchConfig(req, res);
    return;
  }

  // --- Static file serving for production ---
  const distDir = path.join(import.meta.dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    serveStatic(url.pathname, distDir, res);
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// --- WebSocket Server ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log(`[ws] Client connected (total: ${wss.clients.size})`);

  // Send full state snapshot on connect
  const message: WsMessage = {
    version: 1,
    type: 'full_state',
    payload: aggregator.getState(),
  };
  ws.send(JSON.stringify(message));

  ws.on('close', () => {
    console.log(`[ws] Client disconnected (total: ${wss.clients.size})`);
  });

  ws.on('error', (err) => {
    console.error(`[ws] Client error:`, err);
  });
});

// --- Broadcast state changes to all clients ---
aggregator.on('change', (type: WsMessageType) => {
  const state = aggregator.getState();

  let payload: unknown;
  switch (type) {
    case 'sessions_updated':
      payload = { sessions: state.sessions };
      break;
    case 'teams_updated':
      payload = { teams: state.teams };
      break;
    case 'tasks_updated':
      payload = { tasksByTeam: state.tasksByTeam };
      break;
    case 'event_added':
      payload = { events: state.events.slice(0, 1) }; // Just the newest event
      break;
    case 'events_updated':
      payload = { events: state.events };
      break;
    case 'session_activities_updated':
      payload = { sessionActivities: state.sessionActivities };
      break;
    default:
      payload = state;
  }

  const message: WsMessage = {
    version: 1,
    type,
    payload,
  };

  const data = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
});

// --- Route Handlers ---

function handleGetState(res: http.ServerResponse): void {
  const state = aggregator.getState();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(state));
}

function handlePostEvent(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      const event = processEvent(parsed);
      aggregator.addEvent(event);

      lastEventTimestamp = event.timestamp;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, eventId: event.id }));
    } catch (err) {
      console.error(`[api] Error processing event:`, err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid event data' }));
    }
  });
  req.on('error', (err) => {
    console.error(`[api] Request error:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal error' }));
  });
}

function handleGetEvents(res: http.ServerResponse): void {
  const state = aggregator.getState();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(state.events));
}

function handleHealth(res: http.ServerResponse): void {
  const health = {
    status: 'ok',
    uptime: process.uptime(),
    startedAt: serverStartTime,
    watchers: {
      claude: claudeWatcher.ready,
      session: sessionWatcher.ready,
    },
    connectedClients: wss.clients.size,
    lastEventTimestamp,
    projects: config.projects.map((p) => ({
      name: p.name,
      path: p.path,
    })),
  };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(health));
}

function handleFocusSession(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body) as { paneId?: string };
      if (!parsed.paneId || typeof parsed.paneId !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing paneId' }));
        return;
      }

      focusPane(parsed.paneId).then((result) => {
        const status = result.ok ? 200 : 400;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }).catch((err) => {
        console.error(`[api] Focus pane error:`, err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      });
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
  req.on('error', (err) => {
    console.error(`[api] Request error:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal error' }));
  });
}

function handleSendInput(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body) as Partial<SendInputRequest>;
      if (!parsed.paneId || typeof parsed.paneId !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing paneId' }));
        return;
      }
      if (!parsed.type || !['approve', 'reject', 'abort', 'text'].includes(parsed.type)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid type' }));
        return;
      }
      if (parsed.input === undefined || parsed.input === null || typeof parsed.input !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing input' }));
        return;
      }

      const request: SendInputRequest = {
        paneId: parsed.paneId,
        input: parsed.input,
        type: parsed.type,
      };

      sendInput(request, aggregator).then((result) => {
        const status = result.ok ? 200 : 400;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      }).catch((err) => {
        console.error(`[api] Send input error:`, err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal error' }));
      });
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
  req.on('error', (err) => {
    console.error(`[api] Request error:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal error' }));
  });
}

function handleGetConfig(res: http.ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ notifications: config.notifications }));
}

function handlePatchConfig(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;

      // Only allow patching 'notifications' field
      if (!parsed.notifications || typeof parsed.notifications !== 'object') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid notifications field' }));
        return;
      }

      const incoming = parsed.notifications as Record<string, unknown>;

      // Validate booleans if present
      if ('macOS' in incoming && typeof incoming.macOS !== 'boolean') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'notifications.macOS must be a boolean' }));
        return;
      }
      if ('browser' in incoming && typeof incoming.browser !== 'boolean') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'notifications.browser must be a boolean' }));
        return;
      }

      // Merge into config.notifications
      config.notifications = {
        ...config.notifications,
        ...('macOS' in incoming ? { macOS: incoming.macOS as boolean } : {}),
        ...('browser' in incoming ? { browser: incoming.browser as boolean } : {}),
      };

      // Persist to disk
      saveConfig(config);

      // Update notifier
      notifier.updateConfig(config.notifications);

      // Broadcast config_updated via WebSocket
      const message: WsMessage = {
        version: 1,
        type: 'config_updated',
        payload: { notifications: config.notifications },
      };
      const data = JSON.stringify(message);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, notifications: config.notifications }));
    } catch (err) {
      console.error(`[api] Error patching config:`, err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
  req.on('error', (err) => {
    console.error(`[api] Request error:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal error' }));
  });
}

// --- Static file serving ---

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function serveStatic(pathname: string, distDir: string, res: http.ServerResponse): void {
  let filePath = path.join(distDir, pathname);

  // Default to index.html for SPA routing
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`\n  Conductor server running at http://localhost:${PORT}`);
  console.log(`  WebSocket available at ws://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  console.log(`  Dashboard state: http://localhost:${PORT}/api/state\n`);
  if (config.projects.length > 0) {
    console.log(`  Watching ${config.projects.length} project(s):`);
    for (const p of config.projects) {
      console.log(`    - ${p.name}: ${p.path}`);
    }
  }
  console.log('');
});

// --- Graceful shutdown ---
function shutdown(): void {
  console.log('\n[shutdown] Shutting down...');

  // Stop notifier
  notifier.stop();

  // Close watchers
  claudeWatcher.stop().catch(console.error);
  sessionWatcher.stop().catch(console.error);

  // Destroy aggregator (cleans up timers)
  aggregator.destroy();

  // Close WebSocket connections
  for (const client of wss.clients) {
    client.close();
  }

  // Close HTTP server
  server.close(() => {
    closeDb();
    console.log('[shutdown] Server closed');
    process.exit(0);
  });

  // Force exit after 5s
  setTimeout(() => {
    console.error('[shutdown] Forced exit after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

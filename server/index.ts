import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig, saveConfig } from './config.js';
import { getDb, closeDb } from './db.js';
import { Aggregator } from './state/aggregator.js';
import { ClaudeWatcher } from './watchers/claude-watcher.js';
import { SessionWatcher } from './watchers/session-watcher.js';
import { DirectiveWatcher } from './watchers/directive-watcher.js';
import { GoalWatcher } from './watchers/goal-watcher.js';
import { StateWatcher } from './watchers/state-watcher.js';
import { ContextWatcher } from './watchers/context-watcher.js';
import { processEvent } from './hooks/event-receiver.js';
import { focusPane } from './actions/terminal.js';
import { sendInput } from './actions/send-input.js';
import { deleteTeam } from './actions/cleanup.js';
import { Notifier } from './notifications/notifier.js';
import { analyzeIntelligence } from '../scripts/intelligence-trends.js';
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

const directiveWatcher = new DirectiveWatcher(aggregator, config.claudeHome);
directiveWatcher.start();

const goalWatcher = new GoalWatcher(aggregator, config);
goalWatcher.start();

const stateWatcher = new StateWatcher(aggregator, config);
stateWatcher.start();

// Watch .context/ source files and auto-run indexer on changes
const contextWatcher = new ContextWatcher(config);
contextWatcher.start();

// Track last event timestamp for health endpoint
let lastEventTimestamp: string | null = null;
const serverStartTime = new Date().toISOString();

// --- HTTP Server ---
const server = http.createServer((req, res) => {
  // CORS headers for dev mode
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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

  if (url.pathname === '/api/directive' && req.method === 'GET') {
    handleGetDirective(res);
    return;
  }

  if (url.pathname === '/api/goals' && req.method === 'GET') {
    handleGetGoals(res);
    return;
  }

  // --- Work state API routes ---
  if (url.pathname === '/api/state/goals' && req.method === 'GET') {
    handleStateGoals(res);
    return;
  }

  if (url.pathname === '/api/state/features' && req.method === 'GET') {
    handleStateFeatures(url, res);
    return;
  }

  if (url.pathname === '/api/state/backlogs' && req.method === 'GET') {
    handleStateBacklogs(url, res);
    return;
  }

  if (url.pathname === '/api/state/conductor' && req.method === 'GET') {
    handleStateConductor(res);
    return;
  }

  if (url.pathname === '/api/state/search' && req.method === 'GET') {
    handleStateSearch(url, res);
    return;
  }

  if (url.pathname === '/api/state/artifact-content' && req.method === 'GET') {
    handleArtifactContent(url, res);
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

  // --- Insights API routes ---
  if (url.pathname === '/api/insights/stats' && req.method === 'GET') {
    handleInsightsStats(res);
    return;
  }

  if (url.pathname === '/api/insights/history' && req.method === 'GET') {
    handleInsightsHistory(res);
    return;
  }

  if (url.pathname === '/api/insights/plans' && req.method === 'GET') {
    handleInsightsPlans(res);
    return;
  }

  // DELETE /api/teams/:name
  if (url.pathname.startsWith('/api/teams/') && req.method === 'DELETE') {
    const teamName = decodeURIComponent(url.pathname.slice('/api/teams/'.length));
    handleDeleteTeam(teamName, res);
    return;
  }

  // --- Intelligence API route ---
  if (url.pathname === '/api/intelligence' && req.method === 'GET') {
    handleGetIntelligence(res);
    return;
  }

  // --- Scheduler API routes ---
  if (url.pathname === '/api/scheduler' && req.method === 'GET') {
    handleGetScheduler(res);
    return;
  }

  if (url.pathname === '/api/scheduler/toggle' && req.method === 'POST') {
    handleToggleScheduler(req, res);
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
    case 'projects_updated':
      payload = { projects: state.projects };
      break;
    case 'teams_updated':
      payload = { teams: state.teams };
      break;
    case 'tasks_updated':
      payload = { tasksByTeam: state.tasksByTeam, tasksBySession: state.tasksBySession };
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
    case 'directive_updated':
      payload = { directiveState: state.directiveState };
      break;
    case 'goals_updated':
      payload = { goalInventory: state.goalInventory };
      break;
    case 'state_updated':
      payload = { workState: aggregator.getWorkState() };
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
      directive: directiveWatcher.ready,
      goals: goalWatcher.ready,
      state: stateWatcher.ready,
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

function handleGetDirective(res: http.ServerResponse): void {
  const state = directiveWatcher.readCurrentState();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(state));
}

function handleGetGoals(res: http.ServerResponse): void {
  const state = goalWatcher.readCurrentState();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(state));
}

// --- Work State Handlers ---

function handleStateGoals(res: http.ServerResponse): void {
  const ws = aggregator.getWorkState();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(ws.goals));
}

function handleStateFeatures(url: URL, res: http.ServerResponse): void {
  const ws = aggregator.getWorkState();
  const goalId = url.searchParams.get('goalId');

  let features = ws.features?.features ?? [];
  if (goalId) {
    features = features.filter(f => f.goalId === goalId);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ generated: ws.features?.generated ?? null, features }));
}

function handleStateBacklogs(url: URL, res: http.ServerResponse): void {
  const ws = aggregator.getWorkState();
  const goalId = url.searchParams.get('goalId');

  let items = ws.backlogs?.items ?? [];
  if (goalId) {
    items = items.filter(b => b.goalId === goalId);
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ generated: ws.backlogs?.generated ?? null, items }));
}

function handleStateConductor(res: http.ServerResponse): void {
  const ws = aggregator.getWorkState();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(ws.conductor));
}

function handleStateSearch(url: URL, res: http.ServerResponse): void {
  const q = url.searchParams.get('q') ?? '';
  if (!q || q.length < 2) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Query must be at least 2 characters' }));
    return;
  }

  const results = aggregator.getWorkItems({ q });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ q, count: results.length, results: results.slice(0, 50) }));
}

function handleArtifactContent(url: URL, res: http.ServerResponse): void {
  const filePath = url.searchParams.get('path') ?? '';
  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing path parameter' }));
    return;
  }

  // Resolve relative path against project — try both direct and .context/ prefix
  for (const project of config.projects) {
    const candidates = [
      path.join(project.path, filePath),
      path.join(project.path, '.context', filePath),
    ];
    for (const fullPath of candidates) {
      const resolved = path.resolve(fullPath);
      // Security: ensure the resolved path is within the project
      if (!resolved.startsWith(path.resolve(project.path))) continue;
      try {
        const content = fs.readFileSync(resolved, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/markdown' });
        res.end(content);
        return;
      } catch {
        continue;
      }
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'File not found' }));
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

function handleDeleteTeam(teamName: string, res: http.ServerResponse): void {
  if (!teamName) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing team name' }));
    return;
  }

  const result = deleteTeam(config.claudeHome, teamName);
  if (result.success) {
    aggregator.refreshTeams();
    aggregator.refreshTasks();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } else {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: result.error }));
  }
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

// --- Insights Handlers ---

function handleInsightsStats(res: http.ServerResponse): void {
  const statsPath = path.join(config.claudeHome, 'stats-cache.json');
  try {
    const data = fs.readFileSync(statsPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(data);
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(null));
  }
}

function handleInsightsHistory(res: http.ServerResponse): void {
  const historyPath = path.join(config.claudeHome, 'history.jsonl');
  try {
    const raw = fs.readFileSync(historyPath, 'utf-8');
    const entries = raw
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const parsed = JSON.parse(line);
        return {
          display: parsed.display,
          timestamp: parsed.timestamp,
          project: parsed.project,
          sessionId: parsed.sessionId,
        };
      })
      .reverse(); // newest first
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(entries));
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
  }
}

function handleInsightsPlans(res: http.ServerResponse): void {
  const plansDir = path.join(config.claudeHome, 'plans');
  try {
    const files = fs.readdirSync(plansDir).filter((f) => f.endsWith('.md'));
    const plans = files.map((filename) => {
      const filePath = path.join(plansDir, filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      const stat = fs.statSync(filePath);
      const slug = filename.replace(/\.md$/, '');
      // Extract title from first heading or use slug
      const titleMatch = content.match(/^#\s+(.+)/m);
      const title = titleMatch ? titleMatch[1].trim() : slug;
      return { slug, title, content, modifiedAt: stat.mtime.toISOString() };
    });
    // Sort by most recently modified
    plans.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(plans));
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
  }
}

// --- Intelligence Handlers ---

function handleGetIntelligence(res: http.ServerResponse): void {
  try {
    const projectPaths = config.projects.map((p) => p.path);
    if (projectPaths.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(null));
      return;
    }
    const result = analyzeIntelligence(projectPaths);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error(`[api] Error analyzing intelligence:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to analyze intelligence' }));
  }
}

// --- Scheduler Handlers ---

const SCHEDULER_CONFIG_PATH = path.join(os.homedir(), '.conductor', 'scheduler.json');
const SCHEDULER_LOG_PATH = path.join(os.homedir(), '.conductor', 'scheduler.log');

function handleGetScheduler(res: http.ServerResponse): void {
  try {
    // Read config
    let config = null;
    if (fs.existsSync(SCHEDULER_CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(SCHEDULER_CONFIG_PATH, 'utf-8'));
    }

    // Read today's log entries
    const today = new Date().toISOString().slice(0, 10);
    const recentEntries: unknown[] = [];
    let todaySpend = 0;

    if (fs.existsSync(SCHEDULER_LOG_PATH)) {
      const raw = fs.readFileSync(SCHEDULER_LOG_PATH, 'utf-8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.timestamp?.startsWith(today)) {
            recentEntries.push(entry);
            if (entry.action === 'launch' && entry.estimated_cost_usd) {
              todaySpend += entry.estimated_cost_usd;
            }
          }
        } catch {
          // skip malformed
        }
      }
    }

    // Find last run time from log (most recent entry regardless of date)
    let lastRun: string | null = null;
    if (fs.existsSync(SCHEDULER_LOG_PATH)) {
      const raw = fs.readFileSync(SCHEDULER_LOG_PATH, 'utf-8');
      const lines = raw.trim().split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        try {
          const last = JSON.parse(lines[lines.length - 1]);
          lastRun = last.timestamp ?? null;
        } catch {
          // skip
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      config,
      todaySpend,
      lastRun,
      recentEntries: recentEntries.slice(-20), // last 20 entries today
    }));
  } catch (err) {
    console.error(`[api] Error reading scheduler state:`, err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read scheduler state' }));
  }
}

function handleToggleScheduler(req: http.IncomingMessage, res: http.ServerResponse): void {
  let body = '';
  req.on('data', (chunk: string) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body) as { enabled?: boolean };
      if (typeof parsed.enabled !== 'boolean') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing or invalid "enabled" boolean field' }));
        return;
      }

      // Read existing config or create defaults
      const conductorDir = path.join(os.homedir(), '.conductor');
      fs.mkdirSync(conductorDir, { recursive: true });

      let config: Record<string, unknown> = {
        enabled: true,
        check_interval_minutes: 15,
        daily_budget: { max_cost_usd: 50 },
        quiet_hours: { start: '23:00', end: '07:00' },
        project_path: '/Users/yangyang/Repos/sw',
      };

      if (fs.existsSync(SCHEDULER_CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(SCHEDULER_CONFIG_PATH, 'utf-8'));
      }

      config.enabled = parsed.enabled;
      fs.writeFileSync(SCHEDULER_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, enabled: parsed.enabled }));
    } catch (err) {
      console.error(`[api] Error toggling scheduler:`, err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
  req.on('error', (err: Error) => {
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

// --- Foreman (background work scheduler) ---
import { spawn } from 'node:child_process';

let foremanInterval: ReturnType<typeof setInterval> | null = null;

// Skip markers — directives containing these are skipped by the foreman
const SKIP_MARKERS = ['<!-- foreman:skip -->', '**Requires**: manual', 'DEFERRED', '**Status**: deferred', '**Status**: needs-human'];

// Priority goals — backlogs from these goals are boosted to match inbox priority
const PRIORITY_GOALS = ['agent-conductor'];

interface WorkItem {
  name: string;
  priority: string;
  source: 'inbox' | 'backlog';
  path: string;
  goal?: string;
  trigger?: string;
  sortOrder: number; // lower = higher priority
}

function foremanCheck(trigger?: string): void {
  try {
    const schedulerConfig = fs.existsSync(SCHEDULER_CONFIG_PATH)
      ? JSON.parse(fs.readFileSync(SCHEDULER_CONFIG_PATH, 'utf-8'))
      : null;

    if (!schedulerConfig?.enabled) return;

    const now = new Date();

    // Quiet hours check
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = (schedulerConfig.quiet_hours?.start ?? '23:00').split(':').map(Number);
    const [endH, endM] = (schedulerConfig.quiet_hours?.end ?? '07:00').split(':').map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;
    const inQuiet = startMin <= endMin
      ? (currentMinutes >= startMin && currentMinutes < endMin)
      : (currentMinutes >= startMin || currentMinutes < endMin);
    if (inQuiet) {
      foremanLog({ timestamp: now.toISOString(), action: 'skip', reason: 'quiet_hours', trigger });
      return;
    }

    // Active session check — two sessions editing the same working directory = git conflicts
    const activeSessions = aggregator.getActiveSessions().length;
    if (activeSessions > 0) {
      foremanLog({ timestamp: now.toISOString(), action: 'skip', reason: 'session_active', sessions: activeSessions, trigger });
      return;
    }

    // Budget check
    const maxBudget = schedulerConfig.daily_budget?.max_cost_usd ?? 50;
    const todaySpend = foremanTodaySpend();
    if (todaySpend >= maxBudget) {
      foremanLog({ timestamp: now.toISOString(), action: 'skip', reason: 'over_budget', spent: todaySpend, trigger });
      return;
    }

    // Find all ready work
    const projectPath = schedulerConfig.project_path ?? config.projects[0]?.path;
    if (!projectPath) return;

    const work: WorkItem[] = [
      ...findInboxWork(projectPath),
      ...findBacklogWork(projectPath),
    ].sort((a, b) => a.sortOrder - b.sortOrder);

    if (work.length === 0) {
      foremanLog({ timestamp: now.toISOString(), action: 'check', reason: 'no_ready_work', trigger });
      return;
    }

    const next = work[0];
    console.log(`[foreman] Launching: ${next.name} (${next.priority}, ${next.source}${next.goal ? `, ${next.goal}` : ''})`);

    foremanLaunch(next, projectPath, now);
  } catch (err) {
    console.error('[foreman] Error:', err);
  }
}

function findInboxWork(projectPath: string): WorkItem[] {
  const inboxDir = path.join(projectPath, '.context', 'conductor', 'inbox');
  if (!fs.existsSync(inboxDir)) return [];

  const items: WorkItem[] = [];
  for (const file of fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'))) {
    const filePath = path.join(inboxDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Skip items with manual/deferred markers
    if (SKIP_MARKERS.some(marker => content.includes(marker))) continue;

    const prioMatch = content.match(/\*?\*?Priority\*?\*?:\s*(P[0-2])/i);
    const priority = prioMatch ? prioMatch[1] : 'P2';

    items.push({
      name: file.replace(/\.md$/, ''),
      priority,
      source: 'inbox',
      path: filePath,
      sortOrder: priorityToOrder(priority),
    });
  }
  return items;
}

function findBacklogWork(projectPath: string): WorkItem[] {
  const goalsDir = path.join(projectPath, '.context', 'goals');
  if (!fs.existsSync(goalsDir)) return [];

  const items: WorkItem[] = [];
  const goalDirs = fs.readdirSync(goalsDir).filter(d => {
    try { return fs.statSync(path.join(goalsDir, d)).isDirectory() && !d.startsWith('_'); }
    catch { return false; }
  });

  for (const goalDir of goalDirs) {
    const backlogPath = path.join(goalsDir, goalDir, 'backlog.md');
    if (!fs.existsSync(backlogPath)) continue;

    const content = fs.readFileSync(backlogPath, 'utf-8');
    const isPriorityGoal = PRIORITY_GOALS.includes(goalDir);

    // Parse backlog items with triggers
    let currentTitle = '';
    let currentPriority = 'P2';
    let currentTrigger = '';
    let inItem = false;
    let isDone = false;

    for (const line of content.split('\n')) {
      if (line.match(/^###\s+/)) {
        if (inItem && currentTrigger && !isDone) {
          const triggerMet = checkTriggerFired(currentTrigger, projectPath);
          if (triggerMet) {
            const effectivePriority = isPriorityGoal && currentPriority === 'P2' ? 'P1' : currentPriority;
            items.push({
              name: currentTitle,
              priority: effectivePriority,
              source: 'backlog',
              path: backlogPath,
              goal: goalDir,
              trigger: currentTrigger,
              sortOrder: priorityToOrder(effectivePriority) + 0.5, // inbox wins ties
            });
          }
        }
        currentTitle = line.replace(/^###\s+/, '').replace(/~~(.+?)~~/g, '$1').trim();
        isDone = line.includes('~~') || line.includes('Done') || line.includes('DEFERRED');
        currentPriority = 'P2';
        currentTrigger = '';
        inItem = true;
      }
      if (inItem) {
        const pm = line.match(/\*?\*?Priority\*?\*?:\s*(P[0-2])/i);
        if (pm) currentPriority = pm[1];
        const tm = line.match(/\*?\*?Trigger\*?\*?:\s*(.+)/i);
        if (tm) currentTrigger = tm[1].trim();
      }
    }
    // Last item
    if (inItem && currentTrigger && !isDone) {
      const triggerMet = checkTriggerFired(currentTrigger, projectPath);
      if (triggerMet) {
        const effectivePriority = isPriorityGoal && currentPriority === 'P2' ? 'P1' : currentPriority;
        items.push({
          name: currentTitle,
          priority: effectivePriority,
          source: 'backlog',
          path: backlogPath,
          goal: goalDir,
          trigger: currentTrigger,
          sortOrder: priorityToOrder(effectivePriority) + 0.5,
        });
      }
    }
  }
  return items;
}

function checkTriggerFired(trigger: string, projectPath: string): boolean {
  const lower = trigger.toLowerCase();
  if (lower.includes('not fired')) return false;
  if (lower.includes('fired') && !lower.includes('not fired')) return true;

  // Check done-state markers
  if (lower.includes('done') || lower.includes('implemented') || lower.includes('complete')) {
    const doneDir = path.join(projectPath, '.context', 'conductor', 'done');
    if (fs.existsSync(doneDir)) {
      const doneFiles = fs.readdirSync(doneDir);
      const keywords = (lower.match(/\b\w{4,}\b/g) ?? []).filter(
        kw => !['when', 'after', 'once', 'done', 'implemented', 'complete', 'that', 'been', 'with', 'used', 'times'].includes(kw)
      );
      for (const kw of keywords) {
        if (doneFiles.some(f => f.toLowerCase().includes(kw))) return true;
      }
    }
  }
  return false;
}

function priorityToOrder(p: string): number {
  if (p === 'P0') return 0;
  if (p === 'P1') return 1;
  if (p === 'P2') return 2;
  return 3;
}

function foremanLaunch(work: WorkItem, projectPath: string, now: Date): void {
  const agentDef = '/Users/yangyang/Repos/agent-conductor/.claude/agents/alex-cos.md';
  const lessonsPath = '/Users/yangyang/Repos/agent-conductor/.context/lessons.md';

  let prompt: string;
  if (work.source === 'inbox') {
    prompt = `You are Alex Rivera, Chief of Staff. Read your agent definition at ${agentDef} first. Then execute the directive at ${work.path}. Also read ${lessonsPath} before starting.`;
  } else {
    prompt = `You are Alex Rivera, Chief of Staff. Read your agent definition at ${agentDef} first. Also read ${lessonsPath}. The backlog item "${work.name}" in goal "${work.goal}" has its trigger met (${work.trigger ?? 'unknown'}). Design and execute this item. Backlog file: ${work.path}`;
  }

  const logDir = path.join(import.meta.dirname, '..', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logDir, `foreman-${work.name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.log`);
  const outStream = fs.openSync(logFile, 'w');

  const child = spawn('claude', ['-p', '--dangerously-skip-permissions', prompt], {
    cwd: projectPath,
    stdio: ['ignore', outStream, outStream],
    detached: true,
    env: { ...process.env, PATH: `/Users/yangyang/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ''}` },
  });
  child.unref();

  foremanLog({
    timestamp: now.toISOString(),
    action: 'launch',
    directive: work.name,
    priority: work.priority,
    source: work.source,
    goal: work.goal,
    estimated_cost_usd: 5,
  });
  console.log(`[foreman] Launched ${work.name}, PID ${child.pid}, log: ${logFile}`);

  // Broadcast to dashboard
  const msg = JSON.stringify({ version: 1, type: 'scheduler_update', payload: { action: 'launch', directive: work.name } });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

function foremanLog(entry: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(SCHEDULER_LOG_PATH), { recursive: true });
  fs.appendFileSync(SCHEDULER_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8');
}

function foremanTodaySpend(): number {
  if (!fs.existsSync(SCHEDULER_LOG_PATH)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  let total = 0;
  for (const line of fs.readFileSync(SCHEDULER_LOG_PATH, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.timestamp?.startsWith(today) && entry.action === 'launch' && entry.estimated_cost_usd) {
        total += entry.estimated_cost_usd;
      }
    } catch { /* skip */ }
  }
  return total;
}

function startForeman(): void {
  const schedulerConfig = fs.existsSync(SCHEDULER_CONFIG_PATH)
    ? JSON.parse(fs.readFileSync(SCHEDULER_CONFIG_PATH, 'utf-8'))
    : null;
  const intervalMs = (schedulerConfig?.check_interval_minutes ?? 15) * 60 * 1000;

  // Pure interval-based: check every N minutes for available work
  foremanInterval = setInterval(() => foremanCheck('interval'), intervalMs);

  console.log(`  Foreman: checking every ${schedulerConfig?.check_interval_minutes ?? 15}m (${schedulerConfig?.enabled ? 'enabled' : 'disabled'})`);
}

function stopForeman(): void {
  if (foremanInterval) {
    clearInterval(foremanInterval);
    foremanInterval = null;
  }
}

// --- Start Server ---
server.listen(PORT, () => {
  console.log(`\n  Conductor server running at http://localhost:${PORT}`);
  console.log(`  WebSocket available at ws://localhost:${PORT}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health`);
  console.log(`  Dashboard state: http://localhost:${PORT}/api/state`);
  if (config.projects.length > 0) {
    console.log(`  Watching ${config.projects.length} project(s):`);
    for (const p of config.projects) {
      console.log(`    - ${p.name}: ${p.path}`);
    }
  }
  startForeman();
  console.log('');
});

// --- Graceful shutdown ---
function shutdown(): void {
  console.log('\n[shutdown] Shutting down...');

  // Stop foreman
  stopForeman();

  // Stop notifier
  notifier.stop();

  // Close watchers
  claudeWatcher.stop().catch(console.error);
  sessionWatcher.stop().catch(console.error);
  directiveWatcher.stop().catch(console.error);
  goalWatcher.stop().catch(console.error);
  stateWatcher.stop().catch(console.error);

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

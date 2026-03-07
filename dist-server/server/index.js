import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { loadConfig } from './config.js';
import { getDb, closeDb } from './db.js';
import { Aggregator } from './state/aggregator.js';
import { ClaudeCodeAdapter } from './platform/claude-code.js';
import { DirectiveWatcher } from './watchers/directive-watcher.js';
import { StateWatcher } from './watchers/state-watcher.js';
import { processEvent } from './hooks/event-receiver.js';
import { focusPane } from './actions/terminal.js';
import { sendInput } from './actions/send-input.js';
import { Notifier } from './notifications/notifier.js';
import { distDir, consumerRoot, loadAgentRegistry } from './paths.js';
// --- Load config and initialize ---
const config = loadConfig();
const PORT = config.server.port;
// Initialize DB (creates table if needed)
getDb();
// Create platform adapter and aggregator
const adapter = new ClaudeCodeAdapter(config.claudeHome);
const aggregator = new Aggregator(config, adapter);
aggregator.initialize();
// Create and start notifier
const notifier = new Notifier(aggregator, config.notifications ?? { macOS: true, browser: true });
notifier.start();
// Broadcast notification_fired events to all WebSocket clients
notifier.on('notification_fired', (payload) => {
    const message = {
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
// Start file watchers (created via adapter factory methods)
const sessionWatcher = adapter.createSessionWatcher(aggregator, aggregator.projectFilter);
sessionWatcher.start();
const directiveWatcher = new DirectiveWatcher(aggregator, config.claudeHome);
directiveWatcher.start();
const stateWatcher = new StateWatcher(aggregator, config);
stateWatcher.start();
// ContextWatcher removed — StateWatcher now reads .context/ directly
// Track last event timestamp for health endpoint
let lastEventTimestamp = null;
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
    // --- Work state API routes ---
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
    if (url.pathname === '/api/actions/directive-complete' && req.method === 'POST') {
        handleDirectiveComplete(req, res);
        return;
    }
    if (url.pathname === '/api/agent-registry' && req.method === 'GET') {
        handleGetAgentRegistry(res);
        return;
    }
    // --- Static file serving for production ---
    // Resolve dist/ from the package installation directory (not CWD)
    const resolvedDistDir = distDir();
    if (fs.existsSync(resolvedDistDir)) {
        serveStatic(url.pathname, resolvedDistDir, res);
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
    const message = {
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
aggregator.on('change', (type) => {
    const state = aggregator.getState();
    let payload;
    switch (type) {
        case 'sessions_updated':
            payload = { sessions: state.sessions };
            break;
        case 'projects_updated':
            payload = { projects: state.projects };
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
            payload = { directiveState: state.directiveState, directiveHistory: state.directiveHistory, activeDirectives: state.activeDirectives };
            break;
        case 'state_updated':
            payload = { workState: aggregator.getWorkState() };
            break;
        default:
            payload = state;
    }
    const message = {
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
function handleGetState(res) {
    const state = aggregator.getState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
}
function handlePostEvent(req, res) {
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
        }
        catch (err) {
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
function handleGetEvents(res) {
    const state = aggregator.getState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state.events));
}
function handleHealth(res) {
    const health = {
        status: 'ok',
        uptime: process.uptime(),
        startedAt: serverStartTime,
        watchers: {
            session: sessionWatcher.ready,
            directive: directiveWatcher.ready,
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
function handleGetDirective(res) {
    const state = directiveWatcher.readCurrentState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(state));
}
// --- Work State Handlers ---
function handleStateFeatures(url, res) {
    const ws = aggregator.getWorkState();
    const features = ws.features?.features ?? [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ generated: ws.features?.generated ?? null, features }));
}
function handleStateBacklogs(url, res) {
    const ws = aggregator.getWorkState();
    const items = ws.backlogs?.items ?? [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ generated: ws.backlogs?.generated ?? null, items }));
}
function handleStateConductor(res) {
    const ws = aggregator.getWorkState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ws.conductor));
}
function handleArtifactContent(url, res) {
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
            if (!resolved.startsWith(path.resolve(project.path)))
                continue;
            try {
                const content = fs.readFileSync(resolved, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/markdown' });
                res.end(content);
                return;
            }
            catch {
                continue;
            }
        }
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File not found' }));
}
function handleFocusSession(req, res) {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });
    req.on('end', () => {
        try {
            const parsed = JSON.parse(body);
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
        }
        catch {
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
function handleSendInput(req, res) {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });
    req.on('end', () => {
        try {
            const parsed = JSON.parse(body);
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
            const request = {
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
        }
        catch {
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
function handleDirectiveComplete(req, res) {
    let body = '';
    req.on('data', (chunk) => {
        body += chunk;
    });
    req.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            if (!parsed.action || !['approve', 'reject'].includes(parsed.action)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing or invalid action (approve|reject)' }));
                return;
            }
            // If directiveName is provided, use it directly; otherwise fall back to readCurrentState()
            let targetDirectiveName;
            if (parsed.directiveName) {
                // Sanitize: reject path traversal attempts
                if (parsed.directiveName.includes('/') || parsed.directiveName.includes('\\') || parsed.directiveName.includes('..')) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid directive name' }));
                    return;
                }
                targetDirectiveName = parsed.directiveName;
            }
            else {
                const state = directiveWatcher.readCurrentState();
                if (!state) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No active directive' }));
                    return;
                }
                targetDirectiveName = state.directiveName;
            }
            // Update the directive.json status
            const directiveJsonPath = path.join(consumerRoot, '.context', 'directives', targetDirectiveName, 'directive.json');
            try {
                const raw = fs.readFileSync(directiveJsonPath, 'utf-8');
                const directive = JSON.parse(raw);
                if (parsed.action === 'approve') {
                    directive.status = 'completed';
                    directive.completed = new Date().toISOString().split('T')[0];
                    if (directive.pipeline?.completion) {
                        directive.pipeline.completion.status = 'completed';
                    }
                }
                else {
                    // Reject: keep in_progress, add feedback
                    directive.status = 'in_progress';
                    if (directive.pipeline?.completion) {
                        directive.pipeline.completion.status = 'pending';
                    }
                    if (parsed.feedback) {
                        directive.pipeline = directive.pipeline ?? {};
                        directive.pipeline.completion = directive.pipeline.completion ?? {};
                        directive.pipeline.completion.feedback = parsed.feedback;
                    }
                }
                directive.updated_at = new Date().toISOString();
                fs.writeFileSync(directiveJsonPath, JSON.stringify(directive, null, 2) + '\n');
                // Watcher picks up directive.json change directly — no current.json needed
                console.log(`[api] Directive ${targetDirectiveName} ${parsed.action === 'approve' ? 'approved' : 'rejected'}${parsed.feedback ? ` (feedback: ${parsed.feedback})` : ''}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, action: parsed.action, directive: targetDirectiveName }));
            }
            catch (err) {
                console.error(`[api] Failed to update directive:`, err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to update directive file' }));
            }
        }
        catch {
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
function handleGetAgentRegistry(res) {
    const registry = loadAgentRegistry();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(registry));
}
// --- Static file serving ---
const MIME_TYPES = {
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
function serveStatic(pathname, distDir, res) {
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
    console.log(`  Dashboard state: http://localhost:${PORT}/api/state`);
    if (config.projects.length > 0) {
        console.log(`  Watching ${config.projects.length} project(s):`);
        for (const p of config.projects) {
            console.log(`    - ${p.name}: ${p.path}`);
        }
    }
    console.log('');
});
// --- Graceful shutdown ---
function shutdown() {
    console.log('\n[shutdown] Shutting down...');
    // Stop notifier
    notifier.stop();
    // Close watchers
    sessionWatcher.stop().catch(console.error);
    directiveWatcher.stop().catch(console.error);
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

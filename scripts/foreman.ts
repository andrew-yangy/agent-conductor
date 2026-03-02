#!/usr/bin/env tsx
/**
 * Foreman — Autonomous Work Scheduler
 *
 * Runs on a schedule (default every 15 minutes via launchd).
 * Checks capacity, budget, and ready work — launches Claude sessions
 * when conditions are met.
 *
 * Config:  ~/.conductor/scheduler.json
 * Log:     ~/.conductor/scheduler.log
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawn } from 'node:child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SchedulerConfig {
  enabled: boolean;
  check_interval_minutes: number;
  max_concurrent_sessions: number;
  daily_budget: {
    max_cost_usd: number;
  };
  quiet_hours: {
    start: string; // "HH:MM"
    end: string;   // "HH:MM"
  };
  project_path: string;
}

interface LogEntry {
  timestamp: string;
  action: 'launch' | 'skip' | 'error' | 'check';
  directive?: string;
  priority?: string;
  reason?: string;
  estimated_cost_usd?: number;
}

interface ReadyWork {
  path: string;
  name: string;
  priority: string; // "P0" | "P1" | "P2"
  source: 'inbox' | 'backlog';
  trigger?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONDUCTOR_DIR = path.join(os.homedir(), '.conductor');
const CONFIG_PATH = path.join(CONDUCTOR_DIR, 'scheduler.json');
const LOG_PATH = path.join(CONDUCTOR_DIR, 'scheduler.log');

// Skip markers — directives containing these are skipped by the foreman
const SKIP_MARKERS = ['<!-- foreman:skip -->', '**Requires**: manual', 'DEFERRED', '**Status**: deferred', '**Status**: needs-human'];

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function defaultConfig(): SchedulerConfig {
  return {
    enabled: true,
    check_interval_minutes: 15,
    max_concurrent_sessions: 1,
    daily_budget: {
      max_cost_usd: 50,
    },
    quiet_hours: { start: '23:00', end: '07:00' },
    project_path: '/Users/yangyang/Repos/sw',
  };
}

function loadConfig(): SchedulerConfig {
  fs.mkdirSync(CONDUCTOR_DIR, { recursive: true });

  if (!fs.existsSync(CONFIG_PATH)) {
    const defaults = defaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2), 'utf-8');
    console.log(`[foreman] Created default config at ${CONFIG_PATH}`);
    return defaults;
  }

  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SchedulerConfig>;
    const defaults = defaultConfig();
    return {
      enabled: parsed.enabled ?? defaults.enabled,
      check_interval_minutes: parsed.check_interval_minutes ?? defaults.check_interval_minutes,
      max_concurrent_sessions: parsed.max_concurrent_sessions ?? defaults.max_concurrent_sessions,
      daily_budget: {
        max_cost_usd: parsed.daily_budget?.max_cost_usd ?? defaults.daily_budget.max_cost_usd,
      },
      quiet_hours: {
        start: parsed.quiet_hours?.start ?? defaults.quiet_hours.start,
        end: parsed.quiet_hours?.end ?? defaults.quiet_hours.end,
      },
      project_path: parsed.project_path ?? defaults.project_path,
    };
  } catch (err) {
    console.error(`[foreman] Error loading config, using defaults:`, err);
    return defaultConfig();
  }
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

function appendLog(entry: LogEntry): void {
  fs.mkdirSync(CONDUCTOR_DIR, { recursive: true });
  const line = JSON.stringify(entry) + '\n';
  fs.appendFileSync(LOG_PATH, line, 'utf-8');
}

function readTodayLog(): LogEntry[] {
  if (!fs.existsSync(LOG_PATH)) return [];

  const today = new Date().toISOString().slice(0, 10);
  const raw = fs.readFileSync(LOG_PATH, 'utf-8');
  const entries: LogEntry[] = [];

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as LogEntry;
      if (entry.timestamp.startsWith(today)) {
        entries.push(entry);
      }
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Capacity Check
// ---------------------------------------------------------------------------

function countActiveClaudeSessions(): number {
  try {
    // Count claude processes that are likely interactive/batch sessions
    // Filter out this foreman process itself and grep processes
    const output = execSync(
      `ps aux | grep -i '[c]laude' | grep -v foreman | grep -v 'grep' | wc -l`,
      { encoding: 'utf-8', timeout: 5000 }
    ).trim();
    return parseInt(output, 10) || 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Budget Check
// ---------------------------------------------------------------------------

function getTodaySpend(): number {
  const entries = readTodayLog();
  let total = 0;
  for (const entry of entries) {
    if (entry.action === 'launch' && entry.estimated_cost_usd) {
      total += entry.estimated_cost_usd;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Quiet Hours Check
// ---------------------------------------------------------------------------

function isQuietHours(config: SchedulerConfig): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = config.quiet_hours.start.split(':').map(Number);
  const [endH, endM] = config.quiet_hours.end.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same day range (e.g., 09:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 23:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

// ---------------------------------------------------------------------------
// Work Discovery
// ---------------------------------------------------------------------------

function findReadyWork(projectPath: string): ReadyWork[] {
  const work: ReadyWork[] = [];

  // 1. Scan inbox directives
  const inboxDir = path.join(projectPath, '.context', 'conductor', 'inbox');
  if (fs.existsSync(inboxDir)) {
    const files = fs.readdirSync(inboxDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(inboxDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Skip items with manual/deferred markers
      if (SKIP_MARKERS.some(marker => content.includes(marker))) continue;

      const priority = extractPriority(content);
      work.push({
        path: filePath,
        name: file.replace(/\.md$/, ''),
        priority,
        source: 'inbox',
      });
    }
  }

  // 2. Scan backlog files for items with met triggers
  const goalsDir = path.join(projectPath, '.context', 'goals');
  if (fs.existsSync(goalsDir)) {
    const goalDirs = fs.readdirSync(goalsDir).filter(d => {
      const stat = fs.statSync(path.join(goalsDir, d));
      return stat.isDirectory() && !d.startsWith('_');
    });

    for (const goalDir of goalDirs) {
      const backlogPath = path.join(goalsDir, goalDir, 'backlog.md');
      if (!fs.existsSync(backlogPath)) continue;

      const content = fs.readFileSync(backlogPath, 'utf-8');
      const backlogItems = extractBacklogItems(content, projectPath);

      for (const item of backlogItems) {
        if (item.triggerMet) {
          work.push({
            path: backlogPath,
            name: item.title,
            priority: item.priority,
            source: 'backlog',
            trigger: item.trigger,
          });
        }
      }
    }
  }

  // Sort by priority: P0 > P1 > P2, then inbox before backlog
  work.sort((a, b) => {
    const pA = priorityOrder(a.priority);
    const pB = priorityOrder(b.priority);
    if (pA !== pB) return pA - pB;
    // Inbox before backlog at same priority
    if (a.source !== b.source) return a.source === 'inbox' ? -1 : 1;
    return 0;
  });

  return work;
}

function priorityOrder(p: string): number {
  if (p === 'P0') return 0;
  if (p === 'P1') return 1;
  if (p === 'P2') return 2;
  return 3;
}

function extractPriority(content: string): string {
  // Look for **Priority**: P1 or Priority: P0 patterns
  const match = content.match(/\*?\*?Priority\*?\*?:\s*(P[0-2])/i);
  return match ? match[1] : 'P2';
}

interface BacklogItem {
  title: string;
  priority: string;
  trigger: string;
  triggerMet: boolean;
}

function extractBacklogItems(content: string, projectPath: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  const lines = content.split('\n');

  let currentTitle = '';
  let currentPriority = 'P2';
  let currentTrigger = '';
  let inItem = false;
  let isDone = false;

  for (const line of lines) {
    // Section headers like ### Item Name or ### ~~Item Name~~ (done)
    if (line.match(/^###\s+/)) {
      // Save previous item if it had a trigger
      if (inItem && currentTrigger && !isDone) {
        items.push({
          title: currentTitle,
          priority: currentPriority,
          trigger: currentTrigger,
          triggerMet: checkTrigger(currentTrigger, projectPath),
        });
      }

      currentTitle = line.replace(/^###\s+/, '').replace(/~~(.+?)~~/g, '$1').trim();
      isDone = line.includes('~~') || line.includes('Done') || line.includes('DEFERRED');
      currentPriority = 'P2';
      currentTrigger = '';
      inItem = true;
    }

    if (inItem) {
      // Extract priority
      const prioMatch = line.match(/\*?\*?Priority\*?\*?:\s*(P[0-2])/i);
      if (prioMatch) currentPriority = prioMatch[1];

      // Extract trigger
      const triggerMatch = line.match(/\*?\*?Trigger\*?\*?:\s*(.+)/i);
      if (triggerMatch) currentTrigger = triggerMatch[1].trim();
    }
  }

  // Don't forget last item
  if (inItem && currentTrigger && !isDone) {
    items.push({
      title: currentTitle,
      priority: currentPriority,
      trigger: currentTrigger,
      triggerMet: checkTrigger(currentTrigger, projectPath),
    });
  }

  return items;
}

function checkTrigger(trigger: string, projectPath: string): boolean {
  const lower = trigger.toLowerCase();

  // Check for "NOT FIRED" marker — explicit signal that trigger hasn't fired
  if (lower.includes('not fired')) return false;

  // Check for "FIRED" marker — explicit signal
  if (lower.includes('fired') && !lower.includes('not fired')) return true;

  // Check for done-state markers
  if (lower.includes('done') || lower.includes('implemented') || lower.includes('complete')) {
    // Heuristic: if the trigger mentions something being done, check if done/ has it
    const doneDir = path.join(projectPath, '.context', 'conductor', 'done');
    if (fs.existsSync(doneDir)) {
      const doneFiles = fs.readdirSync(doneDir);
      // Try to match keywords from the trigger against done files
      const keywords = lower.match(/\b\w{4,}\b/g) ?? [];
      for (const kw of keywords) {
        if (['when', 'after', 'once', 'done', 'implemented', 'complete', 'that', 'been', 'with', 'used', 'times'].includes(kw)) continue;
        if (doneFiles.some(f => f.toLowerCase().includes(kw))) return true;
      }
    }
  }

  // Check for file existence triggers
  const fileMatch = trigger.match(/check (?:if|for) (.+?) exist/i);
  if (fileMatch) {
    const filePath = path.join(projectPath, fileMatch[1].trim());
    return fs.existsSync(filePath);
  }

  // Default: don't fire unknown triggers
  return false;
}

// ---------------------------------------------------------------------------
// Launch
// ---------------------------------------------------------------------------

function launchDirective(work: ReadyWork, projectPath: string): void {
  const agentDef = '/Users/yangyang/Repos/agent-conductor/.claude/agents/alex-cos.md';

  let prompt: string;
  if (work.source === 'inbox') {
    prompt = `You are Alex Rivera, Chief of Staff. Read your agent definition at ${agentDef} first. Then execute the directive at ${work.path}. Also read /Users/yangyang/Repos/agent-conductor/.context/lessons.md before starting.`;
  } else {
    prompt = `You are Alex Rivera, Chief of Staff. Read your agent definition at ${agentDef} first. Also read /Users/yangyang/Repos/agent-conductor/.context/lessons.md. The backlog item "${work.name}" has its trigger met (${work.trigger ?? 'unknown'}). Create a directive for it and execute. Backlog file: ${work.path}`;
  }

  console.log(`[foreman] Launching: ${work.name} (${work.priority}, ${work.source})`);

  const logDir = '/Users/yangyang/Repos/agent-conductor/logs';
  fs.mkdirSync(logDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logDir, `foreman-${work.name}-${timestamp}.log`);

  const outStream = fs.openSync(logFile, 'w');

  // Launch Claude in print mode with dangerously-skip-permissions for batch execution
  const child = spawn('claude', [
    '-p',
    '--dangerously-skip-permissions',
    prompt,
  ], {
    cwd: projectPath,
    stdio: ['ignore', outStream, outStream],
    detached: true,
    env: {
      ...process.env,
      PATH: `/Users/yangyang/.local/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ''}`,
    },
  });

  // Detach child so foreman can exit
  child.unref();

  appendLog({
    timestamp: new Date().toISOString(),
    action: 'launch',
    directive: work.name,
    priority: work.priority,
    estimated_cost_usd: 5, // rough estimate per directive
  });

  console.log(`[foreman] Launched ${work.name}, PID ${child.pid}, log: ${logFile}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log(`[foreman] ${new Date().toISOString()} — starting check`);

  const config = loadConfig();

  // 1. Enabled check
  if (!config.enabled) {
    console.log('[foreman] Scheduler disabled. Exiting.');
    appendLog({ timestamp: new Date().toISOString(), action: 'skip', reason: 'disabled' });
    return;
  }

  // 2. Quiet hours check
  if (isQuietHours(config)) {
    console.log('[foreman] Quiet hours. Exiting.');
    appendLog({ timestamp: new Date().toISOString(), action: 'skip', reason: 'quiet_hours' });
    return;
  }

  // 3. Capacity check
  const activeSessions = countActiveClaudeSessions();
  console.log(`[foreman] Active Claude sessions: ${activeSessions} / max ${config.max_concurrent_sessions}`);
  if (activeSessions >= config.max_concurrent_sessions) {
    console.log('[foreman] At capacity. Exiting.');
    appendLog({ timestamp: new Date().toISOString(), action: 'skip', reason: 'at_capacity' });
    return;
  }

  // 4. Budget check
  const todaySpend = getTodaySpend();
  console.log(`[foreman] Today's estimated spend: $${todaySpend.toFixed(2)} / $${config.daily_budget.max_cost_usd}`);
  if (todaySpend >= config.daily_budget.max_cost_usd) {
    console.log('[foreman] Over budget. Exiting.');
    appendLog({ timestamp: new Date().toISOString(), action: 'skip', reason: 'over_budget' });
    return;
  }

  // 5. Find ready work
  const work = findReadyWork(config.project_path);
  console.log(`[foreman] Ready work items: ${work.length}`);

  if (work.length === 0) {
    console.log('[foreman] No ready work. Exiting.');
    appendLog({ timestamp: new Date().toISOString(), action: 'check', reason: 'no_ready_work' });
    return;
  }

  // 6. Launch the highest priority item
  const next = work[0];
  console.log(`[foreman] Next up: ${next.name} (${next.priority}, ${next.source})`);

  try {
    launchDirective(next, config.project_path);
  } catch (err) {
    console.error(`[foreman] Launch failed:`, err);
    appendLog({
      timestamp: new Date().toISOString(),
      action: 'error',
      directive: next.name,
      reason: String(err),
    });
  }

  console.log('[foreman] Done.');
}

main();

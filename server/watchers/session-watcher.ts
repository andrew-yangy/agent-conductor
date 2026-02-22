import path from 'node:path';
import fs from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { Aggregator } from '../state/aggregator.js';
import { parseSessionLog } from '../parsers/session-log.js';

export class SessionWatcher {
  private watcher: FSWatcher | null = null;
  private aggregator: Aggregator;
  private claudeHome: string;
  private activityTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private sessionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private _ready = false;

  constructor(aggregator: Aggregator, claudeHome: string) {
    this.aggregator = aggregator;
    this.claudeHome = claudeHome;
  }

  start(): void {
    const projectsDir = path.join(this.claudeHome, 'projects');

    if (!fs.existsSync(projectsDir)) {
      console.log(`[session-watcher] Projects directory not found: ${projectsDir}, skipping watch`);
      this._ready = true;
      return;
    }

    console.log(`[session-watcher] Watching ${projectsDir}`);

    this.watcher = watch(projectsDir, {
      ignoreInitial: true,
      persistent: true,
    });

    this.watcher.on('all', (event: string, filePath: string) => {
      // Only care about JSONL files
      if (!filePath.endsWith('.jsonl')) return;

      if (event === 'add' || event === 'unlink') {
        // New or deleted session file — refresh session list (1s debounce)
        this.scheduleSessionRefresh();
      }

      if (event === 'change' || event === 'add') {
        // Activity update (500ms debounce per file)
        this.handleActivityChange(filePath);
      }
    });

    this.watcher.on('ready', () => {
      this._ready = true;
      console.log(`[session-watcher] Ready`);
    });

    this.watcher.on('error', (err: unknown) => {
      console.error(`[session-watcher] Error:`, err);
    });
  }

  get ready(): boolean {
    return this._ready;
  }

  async stop(): Promise<void> {
    for (const timer of this.activityTimers.values()) {
      clearTimeout(timer);
    }
    this.activityTimers.clear();
    if (this.sessionRefreshTimer) {
      clearTimeout(this.sessionRefreshTimer);
      this.sessionRefreshTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private scheduleSessionRefresh(): void {
    if (this.sessionRefreshTimer) {
      clearTimeout(this.sessionRefreshTimer);
    }
    this.sessionRefreshTimer = setTimeout(() => {
      this.sessionRefreshTimer = null;
      console.log('[session-watcher] Refreshing sessions (new/deleted file detected)');
      this.aggregator.refreshSessions();
    }, 1000);
  }

  private handleActivityChange(filePath: string): void {
    const existing = this.activityTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    this.activityTimers.set(filePath, setTimeout(() => {
      this.activityTimers.delete(filePath);

      const result = parseSessionLog(filePath);
      if (result && result.active) {
        console.log(`[session-watcher] Activity for session ${result.sessionId}: ${result.tool ?? (result.thinking ? 'thinking' : 'idle')}`);
        this.aggregator.updateSessionActivity(result.sessionId, result);
      } else {
        this.aggregator.refreshSessionActivities();
      }
    }, 500));
  }
}

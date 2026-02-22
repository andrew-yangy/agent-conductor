import path from 'node:path';
import fs from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { Aggregator } from '../state/aggregator.js';
import { parseSessionLog } from '../parsers/session-log.js';

export class SessionWatcher {
  private watcher: FSWatcher | null = null;
  private aggregator: Aggregator;
  private claudeHome: string;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
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

    this.watcher.on('all', (_event: string, filePath: string) => {
      // Only care about JSONL files
      if (!filePath.endsWith('.jsonl')) return;

      this.handleChange(filePath);
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
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private handleChange(filePath: string): void {
    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    this.debounceTimers.set(filePath, setTimeout(() => {
      this.debounceTimers.delete(filePath);

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

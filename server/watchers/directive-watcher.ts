import path from 'node:path';
import fs from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { Aggregator } from '../state/aggregator.js';
import type { DirectiveState } from '../types.js';

export class DirectiveWatcher {
  private watcher: FSWatcher | null = null;
  private aggregator: Aggregator;
  private claudeHome: string;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _ready = false;

  constructor(aggregator: Aggregator, claudeHome: string) {
    this.aggregator = aggregator;
    this.claudeHome = claudeHome;
  }

  start(): void {
    const directivesDir = path.join(this.claudeHome, 'directives');

    // Create the directory if it doesn't exist so chokidar can watch it
    if (!fs.existsSync(directivesDir)) {
      try {
        fs.mkdirSync(directivesDir, { recursive: true });
      } catch {
        console.log(`[directive-watcher] Could not create directives directory: ${directivesDir}, skipping watch`);
        this._ready = true;
        return;
      }
    }

    console.log(`[directive-watcher] Watching ${directivesDir}`);

    // Read initial state
    this.readAndUpdate();

    this.watcher = watch(directivesDir, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    this.watcher.on('all', (_event: string, filePath: string) => {
      if (!filePath.endsWith('current.json')) return;
      this.handleChange();
    });

    this.watcher.on('ready', () => {
      this._ready = true;
      console.log(`[directive-watcher] Ready`);
    });

    this.watcher.on('error', (err: unknown) => {
      console.error(`[directive-watcher] Error:`, err);
    });
  }

  get ready(): boolean {
    return this._ready;
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  readCurrentState(): DirectiveState | null {
    const filePath = path.join(this.claudeHome, 'directives', 'current.json');
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as DirectiveState;

      // Basic validation
      if (!parsed.directiveName || !parsed.status || !Array.isArray(parsed.initiatives)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private handleChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.readAndUpdate();
    }, 300);
  }

  private readAndUpdate(): void {
    const state = this.readCurrentState();
    console.log(`[directive-watcher] Directive state: ${state ? `${state.directiveName} (${state.status}, ${state.currentInitiative}/${state.totalInitiatives})` : 'none'}`);
    this.aggregator.updateDirectiveState(state);
  }
}

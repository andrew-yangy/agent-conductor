import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { watch, type FSWatcher } from 'chokidar';
import type { ConductorConfig } from '../types.js';

/**
 * Watches .context/ for changes to source files (md, json, tasks.json)
 * and automatically re-runs the state indexer to keep .context/state/ fresh.
 *
 * Pipeline: .context/*.md changes → ContextWatcher → runs index-state.ts →
 * outputs .context/state/*.json → StateWatcher picks up → dashboard updates
 */
export class ContextWatcher {
  private watchers: FSWatcher[] = [];
  private config: ConductorConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private indexing = false;
  private pendingReindex = false;
  private _ready = false;

  constructor(config: ConductorConfig) {
    this.config = config;
  }

  start(): void {
    if (this.config.projects.length === 0) {
      console.log('[context-watcher] No projects configured, skipping');
      this._ready = true;
      return;
    }

    for (const project of this.config.projects) {
      const contextDir = path.join(project.path, '.context');

      if (!fs.existsSync(contextDir)) {
        console.log(`[context-watcher] No .context/ dir for ${project.name}, skipping`);
        continue;
      }

      console.log(`[context-watcher] Watching ${contextDir} (${project.name})`);

      const watcher = watch(contextDir, {
        ignoreInitial: true,
        persistent: true,
        // Ignore state/ directory (that's our output, not input)
        ignored: [
          path.join(contextDir, 'state', '**'),
          '**/node_modules/**',
        ],
        awaitWriteFinish: {
          stabilityThreshold: 500,
          pollInterval: 100,
        },
        // Don't watch too deep to avoid performance issues
        depth: 6,
      });

      watcher.on('all', (_event: string, filePath: string) => {
        // Only care about relevant file types
        if (!filePath.endsWith('.md') && !filePath.endsWith('.json')) return;
        this.handleChange(project.path);
      });

      watcher.on('ready', () => {
        console.log(`[context-watcher] Ready for ${project.name}`);
      });

      watcher.on('error', (err: unknown) => {
        console.error(`[context-watcher] Error for ${project.name}:`, err);
      });

      this.watchers.push(watcher);
    }

    this._ready = true;
  }

  get ready(): boolean {
    return this._ready;
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    for (const watcher of this.watchers) {
      await watcher.close();
    }
    this.watchers = [];
  }

  private handleChange(projectPath: string): void {
    // Debounce: wait 2 seconds after last change before indexing
    // (multiple files often change together during a directive)
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.runIndexer(projectPath);
    }, 2000);
  }

  private runIndexer(projectPath: string): void {
    // If already indexing, queue a re-run
    if (this.indexing) {
      this.pendingReindex = true;
      return;
    }

    this.indexing = true;
    const conductorRoot = path.resolve(__dirname, '../..');
    const scriptPath = path.join(conductorRoot, 'scripts', 'index-state.ts');

    if (!fs.existsSync(scriptPath)) {
      console.log(`[context-watcher] No indexer script at ${scriptPath}, skipping`);
      this.indexing = false;
      return;
    }

    console.log('[context-watcher] Re-indexing .context/ ...');

    execFile('npx', ['tsx', scriptPath, '--context-path', path.join(projectPath, '.context')], {
      cwd: conductorRoot,
      timeout: 30000,
    }, (error, _stdout, stderr) => {
      this.indexing = false;

      if (error) {
        console.error('[context-watcher] Indexer failed:', stderr || error.message);
      } else {
        console.log('[context-watcher] Re-index complete');
      }

      // If changes came in while indexing, run again
      if (this.pendingReindex) {
        this.pendingReindex = false;
        this.runIndexer(projectPath);
      }
    });
  }
}

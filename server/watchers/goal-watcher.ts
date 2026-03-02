import path from 'node:path';
import fs from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { Aggregator } from '../state/aggregator.js';
import type { ConductorConfig, GoalInventory } from '../types.js';

export class GoalWatcher {
  private watchers: FSWatcher[] = [];
  private aggregator: Aggregator;
  private config: ConductorConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _ready = false;

  constructor(aggregator: Aggregator, config: ConductorConfig) {
    this.aggregator = aggregator;
    this.config = config;
  }

  start(): void {
    if (this.config.projects.length === 0) {
      console.log('[goal-watcher] No projects configured, skipping');
      this._ready = true;
      return;
    }

    // Read initial state
    this.readAndUpdate();

    for (const project of this.config.projects) {
      const goalsDir = path.join(project.path, '.context', 'goals');

      // Create the directory if it doesn't exist so chokidar can watch it
      if (!fs.existsSync(goalsDir)) {
        try {
          fs.mkdirSync(goalsDir, { recursive: true });
        } catch {
          console.log(`[goal-watcher] Could not create goals directory for ${project.name}: ${goalsDir}, skipping`);
          continue;
        }
      }

      console.log(`[goal-watcher] Watching ${goalsDir}/inventory.json (${project.name})`);

      const watcher = watch(goalsDir, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 50,
        },
      });

      watcher.on('all', (_event: string, filePath: string) => {
        if (!filePath.endsWith('inventory.json')) return;
        this.handleChange();
      });

      watcher.on('ready', () => {
        console.log(`[goal-watcher] Ready for ${project.name}`);
      });

      watcher.on('error', (err: unknown) => {
        console.error(`[goal-watcher] Error for ${project.name}:`, err);
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

  readCurrentState(): GoalInventory | null {
    // Read inventory.json from the first project that has one
    for (const project of this.config.projects) {
      const filePath = path.join(project.path, '.context', 'goals', 'inventory.json');
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as GoalInventory;

        // Basic validation
        if (!parsed.generated || !Array.isArray(parsed.goals)) {
          continue;
        }

        return parsed;
      } catch {
        // File doesn't exist or is invalid, continue to next project
        continue;
      }
    }
    return null;
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
    console.log(`[goal-watcher] Goal inventory: ${state ? `${state.goals.length} goals (generated ${state.generated})` : 'none'}`);
    this.aggregator.updateGoalInventory(state);
  }
}

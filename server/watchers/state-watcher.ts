import path from 'node:path';
import fs from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { Aggregator } from '../state/aggregator.js';
import type { ConductorConfig } from '../types.js';
import type {
  GoalsState,
  FeaturesState,
  BacklogsState,
  ConductorState,
  IndexState,
  FullWorkState,
} from '../state/work-item-types.js';

/**
 * Watches .context/state/*.json files produced by the indexer script.
 * On change, reads the updated file and pushes it into the aggregator.
 */
export class StateWatcher {
  private watchers: FSWatcher[] = [];
  private aggregator: Aggregator;
  private config: ConductorConfig;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _ready = false;
  private _state: FullWorkState = {
    goals: null,
    features: null,
    backlogs: null,
    conductor: null,
    index: null,
  };

  constructor(aggregator: Aggregator, config: ConductorConfig) {
    this.aggregator = aggregator;
    this.config = config;
  }

  start(): void {
    if (this.config.projects.length === 0) {
      console.log('[state-watcher] No projects configured, skipping');
      this._ready = true;
      return;
    }

    // Read initial state
    this.readAndUpdate();

    for (const project of this.config.projects) {
      const stateDir = path.join(project.path, '.context', 'state');

      // Create the directory if it doesn't exist so chokidar can watch it
      if (!fs.existsSync(stateDir)) {
        try {
          fs.mkdirSync(stateDir, { recursive: true });
        } catch {
          console.log(`[state-watcher] Could not create state directory for ${project.name}: ${stateDir}, skipping`);
          continue;
        }
      }

      console.log(`[state-watcher] Watching ${stateDir} (${project.name})`);

      const watcher = watch(stateDir, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 50,
        },
      });

      watcher.on('all', (_event: string, filePath: string) => {
        if (!filePath.endsWith('.json')) return;
        this.handleChange();
      });

      watcher.on('ready', () => {
        console.log(`[state-watcher] Ready for ${project.name}`);
      });

      watcher.on('error', (err: unknown) => {
        console.error(`[state-watcher] Error for ${project.name}:`, err);
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

  readCurrentState(): FullWorkState {
    return this._state;
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
    const state: FullWorkState = {
      goals: null,
      features: null,
      backlogs: null,
      conductor: null,
      index: null,
    };

    for (const project of this.config.projects) {
      const stateDir = path.join(project.path, '.context', 'state');

      // Only overwrite each field if we haven't found it yet, so the first
      // project that has a given file wins. Previously the loop always
      // overwrote every field, causing later projects (which may have empty
      // state dirs) to null-out data already found in an earlier project.
      if (!state.goals) {
        state.goals = this.readJsonFile<GoalsState>(path.join(stateDir, 'goals.json'));
      }
      if (!state.features) {
        state.features = this.readJsonFile<FeaturesState>(path.join(stateDir, 'features.json'));
      }
      if (!state.backlogs) {
        state.backlogs = this.readJsonFile<BacklogsState>(path.join(stateDir, 'backlogs.json'));
      }
      if (!state.conductor) {
        state.conductor = this.readJsonFile<ConductorState>(path.join(stateDir, 'conductor.json'));
      }
      if (!state.index) {
        state.index = this.readJsonFile<IndexState>(path.join(stateDir, 'index.json'));
      }

      // Stop early once all fields are populated
      if (state.goals && state.features && state.backlogs && state.conductor && state.index) break;
    }

    this._state = state;

    const goalCount = state.goals?.goals.length ?? 0;
    const featureCount = state.features?.features.length ?? 0;
    const backlogCount = state.backlogs?.items.length ?? 0;
    console.log(`[state-watcher] Work state: ${goalCount} goals, ${featureCount} features, ${backlogCount} backlog items`);

    this.aggregator.updateWorkState(state);
  }

  private readJsonFile<T>(filePath: string): T | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

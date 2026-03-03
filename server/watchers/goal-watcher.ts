import path from 'node:path';
import fs from 'node:fs';
import { watch, type FSWatcher } from 'chokidar';
import type { Aggregator } from '../state/aggregator.js';
import type { ConductorConfig, GoalInventory, GoalArea, ActiveFeature } from '../types.js';

/**
 * Watches .context/goals/ for goal.json and project.json changes.
 * Builds a GoalInventory from direct file reads (replaces inventory.json).
 */
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

      if (!fs.existsSync(goalsDir)) {
        try {
          fs.mkdirSync(goalsDir, { recursive: true });
        } catch {
          console.log(`[goal-watcher] Could not create goals directory for ${project.name}: ${goalsDir}, skipping`);
          continue;
        }
      }

      console.log(`[goal-watcher] Watching ${goalsDir} (${project.name})`);

      const watcher = watch(goalsDir, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 50,
        },
        depth: 4,
      });

      watcher.on('all', (_event: string, filePath: string) => {
        // React to goal.json, project.json, and backlog.json changes
        if (!filePath.endsWith('.json')) return;
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
    for (const project of this.config.projects) {
      const goalsDir = path.join(project.path, '.context', 'goals');
      if (!fs.existsSync(goalsDir)) continue;

      const goalAreas = this.buildGoalAreas(goalsDir);
      if (goalAreas.length > 0) {
        return {
          generated: new Date().toISOString(),
          goals: goalAreas,
        };
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
    console.log(`[goal-watcher] Goal inventory: ${state ? `${state.goals.length} goals` : 'none'}`);
    this.aggregator.updateGoalInventory(state);
  }

  private buildGoalAreas(goalsDir: string): GoalArea[] {
    const areas: GoalArea[] = [];

    let goalDirs: string[];
    try {
      goalDirs = fs.readdirSync(goalsDir).filter((name) => {
        if (name.startsWith('.') || name.startsWith('_')) return false;
        try {
          return fs.statSync(path.join(goalsDir, name)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
      return [];
    }

    for (const goalId of goalDirs) {
      const goalDir = path.join(goalsDir, goalId);
      const goalJsonPath = path.join(goalDir, 'goal.json');

      let goalJson: Record<string, unknown> | null;
      try {
        goalJson = JSON.parse(fs.readFileSync(goalJsonPath, 'utf-8')) as Record<string, unknown>;
      } catch {
        continue;
      }

      // Read projects
      const projectsDir = path.join(goalDir, 'projects');
      const activeFeatures: ActiveFeature[] = [];
      let doneCount = 0;

      if (fs.existsSync(projectsDir)) {
        let projDirs: string[];
        try {
          projDirs = fs.readdirSync(projectsDir).filter((name) => {
            if (name.startsWith('.')) return false;
            try {
              return fs.statSync(path.join(projectsDir, name)).isDirectory();
            } catch {
              return false;
            }
          });
        } catch {
          projDirs = [];
        }

        for (const projId of projDirs) {
          const projJsonPath = path.join(projectsDir, projId, 'project.json');
          let projJson: Record<string, unknown>;
          try {
            projJson = JSON.parse(fs.readFileSync(projJsonPath, 'utf-8')) as Record<string, unknown>;
          } catch {
            continue;
          }

          const tasks = Array.isArray(projJson.tasks) ? projJson.tasks as Array<Record<string, unknown>> : [];
          const tasksTotal = tasks.length;
          const tasksCompleted = tasks.filter(
            (t) => t.status === 'completed'
          ).length;
          const completionPct = tasksTotal > 0
            ? Math.round((tasksCompleted / tasksTotal) * 100)
            : 0;

          const projStatus = String(projJson.status ?? 'pending');
          const isCompleted = projStatus === 'completed';

          if (isCompleted) {
            doneCount++;
          }

          // Map to ActiveFeature shape (used by dashboard)
          const mappedStatus: ActiveFeature['status'] = isCompleted
            ? 'completed'
            : projStatus === 'in_progress' || projStatus === 'active'
              ? 'in_progress'
              : 'not_started';

          activeFeatures.push({
            name: String(projJson.title ?? projId),
            tasks_completed: tasksCompleted,
            tasks_total: tasksTotal,
            completion_pct: isCompleted ? 100 : completionPct,
            status: mappedStatus,
          });
        }
      }

      // Read backlog count
      const backlogJsonPath = path.join(goalDir, 'backlog.json');
      let backlogCount = 0;
      try {
        const backlogRaw = JSON.parse(fs.readFileSync(backlogJsonPath, 'utf-8'));
        if (Array.isArray(backlogRaw)) {
          backlogCount = backlogRaw.filter(
            (item: Record<string, unknown>) => item.status !== 'completed' && item.status !== 'promoted'
          ).length;
        }
      } catch {
        // No backlog file
      }

      // Map goal status
      const goalStatus = String(goalJson.status ?? 'in_progress');
      const mappedGoalStatus: GoalArea['status'] = goalStatus === 'completed'
        ? 'completed'
        : goalStatus === 'in_progress' || goalStatus === 'active'
          ? 'in_progress'
          : 'not_started';

      const okrs = goalJson.okrs;
      const hasOkrs = Array.isArray(okrs) && okrs.length > 0;

      areas.push({
        id: goalId,
        title: String(goalJson.title ?? goalId),
        status: mappedGoalStatus,
        has_goal_md: true, // We successfully read goal.json
        has_backlog: backlogCount > 0,
        has_okrs: hasOkrs,
        active_features: activeFeatures.filter((f) => f.status !== 'completed'),
        done_count: doneCount,
        backlog_count: backlogCount,
        issues: [],
      });
    }

    return areas;
  }
}

import os from 'node:os';
import path from 'node:path';
import { statePath, readJsonSafe } from './paths.js';

interface IndexState {
  generated: string;
  counts: {
    goals: number;
    activeFeatures: number;
    doneFeatures: number;
    pendingTasks: number;
    completedTasks: number;
    backlogItems: number;
    directives: number;
    reports: number;
    discussions: number;
  };
}

interface GoalEntry {
  id: string;
  title: string;
  status: string;
  activeFeatures: string[];
  doneFeatures: string[];
  backlogCount: number;
  hasOkrs: boolean;
  issues: string[];
}

interface GoalsState {
  generated: string;
  goals: GoalEntry[];
}

interface ConductorDirective {
  id: string;
  title: string;
  status: string;
}

interface ConductorState {
  generated: string;
  directives: ConductorDirective[];
}

interface FeatureEntry {
  id: string;
  title: string;
  status: string;
  goalId: string;
  taskCount: number;
  completedTaskCount: number;
}

interface FeaturesState {
  generated: string;
  features: FeatureEntry[];
}

export function conductorStatus(): string {
  const index = readJsonSafe<IndexState>(statePath('index.json'));
  const goals = readJsonSafe<GoalsState>(statePath('goals.json'));
  const conductor = readJsonSafe<ConductorState>(statePath('conductor.json'));
  const features = readJsonSafe<FeaturesState>(statePath('features.json'));

  if (!index) {
    return 'No state files found. Run the state indexer first: `npx tsx scripts/index-state.ts`';
  }

  const lines: string[] = [];
  lines.push(`## Conductor Status (as of ${index.generated})`);
  lines.push('');

  // Summary counts
  lines.push('### Summary');
  lines.push(`- Goals: ${index.counts.goals}`);
  lines.push(`- Active features: ${index.counts.activeFeatures}`);
  lines.push(`- Done features: ${index.counts.doneFeatures}`);
  lines.push(`- Pending tasks: ${index.counts.pendingTasks}`);
  lines.push(`- Completed tasks: ${index.counts.completedTasks}`);
  lines.push(`- Backlog items: ${index.counts.backlogItems}`);
  lines.push(`- Directives (total): ${index.counts.directives}`);
  lines.push(`- Reports: ${index.counts.reports}`);
  lines.push('');

  // Active goals with features
  if (goals) {
    const activeGoals = goals.goals.filter(
      (g) => g.status === 'in-progress' && g.activeFeatures.length > 0
    );
    if (activeGoals.length > 0) {
      lines.push('### Active Goals');
      for (const goal of activeGoals) {
        lines.push(`- **${goal.title}** (${goal.id})`);
        for (const fId of goal.activeFeatures) {
          const feature = features?.features.find((f) => f.id === fId);
          if (feature) {
            const pct =
              feature.taskCount > 0
                ? Math.round(
                    (feature.completedTaskCount / feature.taskCount) * 100
                  )
                : 0;
            lines.push(
              `  - ${feature.title}: ${pct}% (${feature.completedTaskCount}/${feature.taskCount} tasks)`
            );
          } else {
            lines.push(`  - ${fId}`);
          }
        }
      }
      lines.push('');
    }
  }

  // Pending directives
  if (conductor) {
    const pending = conductor.directives.filter((d) => d.status === 'pending');
    if (pending.length > 0) {
      lines.push('### Pending Directives (inbox)');
      for (const d of pending) {
        lines.push(`- ${d.title} (${d.id})`);
      }
      lines.push('');
    }

    const recent = conductor.directives
      .filter((d) => d.status === 'done')
      .slice(0, 5);
    if (recent.length > 0) {
      lines.push('### Recently Completed Directives');
      for (const d of recent) {
        lines.push(`- ${d.title}`);
      }
      lines.push('');
    }
  }

  // Scheduler status
  const schedulerConfigPath = path.join(os.homedir(), '.conductor', 'scheduler.json');
  const schedulerConfig = readJsonSafe<{ enabled?: boolean; daily_budget?: { max_cost_usd?: number }; quiet_hours?: { start?: string; end?: string } }>(schedulerConfigPath);
  if (schedulerConfig) {
    lines.push('### Autopilot');
    lines.push(`- **Status**: ${schedulerConfig.enabled ? 'enabled' : 'disabled'}`);
    if (schedulerConfig.daily_budget?.max_cost_usd) {
      lines.push(`- **Daily budget**: $${schedulerConfig.daily_budget.max_cost_usd}`);
    }
    if (schedulerConfig.quiet_hours) {
      lines.push(`- **Quiet hours**: ${schedulerConfig.quiet_hours.start ?? '23:00'} - ${schedulerConfig.quiet_hours.end ?? '07:00'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

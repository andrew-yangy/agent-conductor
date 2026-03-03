import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { getProjectPath, readJsonSafe } from './paths.js';

interface GoalJson {
  id: string;
  title: string;
  status: string;
  category?: string;
  description?: string;
  okrs?: unknown[];
}

interface ProjectJson {
  title: string;
  status: string;
  tasks?: Array<{ status?: string }>;
}

interface DirectiveJson {
  id: string;
  title: string;
  status: string;
}

interface BacklogItem {
  status?: string;
}

export function conductorStatus(): string {
  const projectPath = getProjectPath();
  const goalsDir = path.join(projectPath, '.context', 'goals');
  const directivesDir = path.join(projectPath, '.context', 'directives');
  const reportsDir = path.join(projectPath, '.context', 'reports');
  const lessonsDir = path.join(projectPath, '.context', 'lessons');

  const lines: string[] = [];
  const generated = new Date().toISOString();
  lines.push(`## Conductor Status (as of ${generated})`);
  lines.push('');

  // --- Count goals, projects, tasks, backlog ---
  let goalCount = 0;
  let activeFeatureCount = 0;
  let doneFeatureCount = 0;
  let pendingTaskCount = 0;
  let completedTaskCount = 0;
  let backlogItemCount = 0;

  interface GoalInfo {
    id: string;
    title: string;
    status: string;
    features: Array<{ id: string; title: string; status: string; tasksCompleted: number; tasksTotal: number }>;
  }
  const goalInfos: GoalInfo[] = [];

  if (fs.existsSync(goalsDir)) {
    const goalDirs = listDirs(goalsDir);
    for (const goalId of goalDirs) {
      const goalJsonPath = path.join(goalsDir, goalId, 'goal.json');
      const goalJson = readJsonSafe<GoalJson>(goalJsonPath);
      if (!goalJson) continue;

      goalCount++;
      const goalStatus = mapGoalStatus(goalJson.status ?? 'active');
      const goalInfo: GoalInfo = { id: goalId, title: goalJson.title ?? goalId, status: goalStatus, features: [] };

      // Read projects
      const projectsDir = path.join(goalsDir, goalId, 'projects');
      if (fs.existsSync(projectsDir)) {
        const projDirs = listDirs(projectsDir);
        for (const projId of projDirs) {
          const projJsonPath = path.join(projectsDir, projId, 'project.json');
          const projJson = readJsonSafe<ProjectJson>(projJsonPath);
          if (!projJson) continue;

          const tasks = projJson.tasks ?? [];
          const total = tasks.length;
          const completed = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
          pendingTaskCount += (total - completed);
          completedTaskCount += completed;

          const projStatus = projJson.status ?? 'pending';
          const isDone = projStatus === 'completed' || projStatus === 'done';
          if (isDone) {
            doneFeatureCount++;
          } else {
            activeFeatureCount++;
          }

          goalInfo.features.push({
            id: projId,
            title: projJson.title ?? projId,
            status: isDone ? 'done' : projStatus === 'active' ? 'in-progress' : 'pending',
            tasksCompleted: completed,
            tasksTotal: total,
          });
        }
      }

      // Read backlog
      const backlogPath = path.join(goalsDir, goalId, 'backlog.json');
      const backlogRaw = readJsonSafe<BacklogItem[]>(backlogPath);
      if (Array.isArray(backlogRaw)) {
        backlogItemCount += backlogRaw.filter(i => i.status !== 'done').length;
      }

      goalInfos.push(goalInfo);
    }
  }

  // --- Count directives ---
  let directiveCount = 0;
  const pendingDirectives: Array<{ id: string; title: string }> = [];
  const recentDone: Array<{ id: string; title: string }> = [];

  if (fs.existsSync(directivesDir)) {
    const files = fs.readdirSync(directivesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(directivesDir, file);
      try { if (fs.statSync(filePath).isDirectory()) continue; } catch { continue; }
      const dirJson = readJsonSafe<DirectiveJson>(filePath);
      if (!dirJson) continue;
      directiveCount++;
      if (dirJson.status === 'pending' || dirJson.status === 'triaged') {
        pendingDirectives.push({ id: dirJson.id ?? file.replace('.json', ''), title: dirJson.title ?? file });
      }
      if (dirJson.status === 'completed' || dirJson.status === 'done') {
        recentDone.push({ id: dirJson.id ?? file.replace('.json', ''), title: dirJson.title ?? file });
      }
    }
  }

  // --- Count reports ---
  let reportCount = 0;
  if (fs.existsSync(reportsDir)) {
    reportCount = fs.readdirSync(reportsDir).filter(f => f.endsWith('.md')).length;
  }

  // --- Summary counts ---
  lines.push('### Summary');
  lines.push(`- Goals: ${goalCount}`);
  lines.push(`- Active features: ${activeFeatureCount}`);
  lines.push(`- Done features: ${doneFeatureCount}`);
  lines.push(`- Pending tasks: ${pendingTaskCount}`);
  lines.push(`- Completed tasks: ${completedTaskCount}`);
  lines.push(`- Backlog items: ${backlogItemCount}`);
  lines.push(`- Directives (total): ${directiveCount}`);
  lines.push(`- Reports: ${reportCount}`);
  lines.push('');

  // Active goals with features
  const activeGoals = goalInfos.filter(
    g => g.status === 'in-progress' && g.features.some(f => f.status !== 'done')
  );
  if (activeGoals.length > 0) {
    lines.push('### Active Goals');
    for (const goal of activeGoals) {
      lines.push(`- **${goal.title}** (${goal.id})`);
      for (const feat of goal.features.filter(f => f.status !== 'done')) {
        const pct = feat.tasksTotal > 0
          ? Math.round((feat.tasksCompleted / feat.tasksTotal) * 100)
          : 0;
        lines.push(`  - ${feat.title}: ${pct}% (${feat.tasksCompleted}/${feat.tasksTotal} tasks)`);
      }
    }
    lines.push('');
  }

  // Pending directives
  if (pendingDirectives.length > 0) {
    lines.push('### Pending Directives (inbox)');
    for (const d of pendingDirectives) {
      lines.push(`- ${d.title} (${d.id})`);
    }
    lines.push('');
  }

  if (recentDone.length > 0) {
    lines.push('### Recently Completed Directives');
    for (const d of recentDone.slice(0, 5)) {
      lines.push(`- ${d.title}`);
    }
    lines.push('');
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

// --- Helpers ---

function listDirs(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath).filter(name => {
      if (name.startsWith('.') || name.startsWith('_')) return false;
      try { return fs.statSync(path.join(dirPath, name)).isDirectory(); } catch { return false; }
    });
  } catch {
    return [];
  }
}

function mapGoalStatus(status: string): string {
  switch (status) {
    case 'active': return 'in-progress';
    case 'exploring': return 'pending';
    case 'paused': return 'deferred';
    case 'done': return 'done';
    default: return 'pending';
  }
}

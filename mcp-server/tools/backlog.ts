import fs from 'node:fs';
import path from 'node:path';
import { getProjectPath, goalsPath, readJsonSafe } from './paths.js';

interface BacklogItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  trigger?: string;
  source_directive?: string;
  context?: string;
  description?: string;
  created?: string;
  updated?: string;
}

/**
 * List backlog items by reading backlog.json directly from each goal directory.
 * Optionally filtered by goal and/or priority.
 */
export function listBacklog(goalId?: string, priority?: string): string {
  const projectPath = getProjectPath();
  const goalsDir = path.join(projectPath, '.context', 'goals');

  if (!fs.existsSync(goalsDir)) {
    return 'No goals directory found. Ensure .context/goals/ exists.';
  }

  // Collect all backlog items across goals
  interface EnrichedItem {
    id: string;
    title: string;
    status: string;
    goalId: string;
    priority?: string;
    trigger?: string;
    sourceDirective?: string;
    sourceContext?: string;
  }

  const allItems: EnrichedItem[] = [];
  const goalDirs = listDirs(goalsDir);

  for (const gId of goalDirs) {
    if (goalId && gId !== goalId) continue;

    const backlogPath = path.join(goalsDir, gId, 'backlog.json');
    const raw = readJsonSafe<BacklogItem[]>(backlogPath);
    if (!Array.isArray(raw)) continue;

    for (const item of raw) {
      allItems.push({
        id: `${gId}/${item.id ?? 'unknown'}`,
        title: item.title ?? '',
        status: item.status ?? 'pending',
        goalId: gId,
        priority: item.priority,
        trigger: item.trigger,
        sourceDirective: item.source_directive,
        sourceContext: item.context ?? item.description,
      });
    }
  }

  if (goalId && allItems.length === 0) {
    return `No backlog items found for goal "${goalId}". Available goals: ${goalDirs.join(', ')}`;
  }

  let items = allItems;

  if (priority) {
    const normalizedPriority = priority.toUpperCase();
    items = items.filter(
      (i) => i.priority?.toUpperCase() === normalizedPriority
    );
  }

  // Exclude done items by default
  const pending = items.filter(
    (i) => i.status !== 'done' && !i.title.includes('Done')
  );
  const done = items.filter(
    (i) => i.status === 'done' || i.title.includes('Done')
  );

  const lines: string[] = [];
  lines.push(`## Backlog${goalId ? ` for ${goalId}` : ''}${priority ? ` (${priority})` : ''}`);
  lines.push(`${pending.length} pending, ${done.length} done`);
  lines.push('');

  if (pending.length > 0) {
    lines.push('### Pending');
    for (const item of pending) {
      const parts: string[] = [`- **${item.title}**`];
      if (item.priority) parts.push(`[${item.priority}]`);
      if (!goalId) parts.push(`(${item.goalId})`);
      lines.push(parts.join(' '));
      if (item.trigger) {
        lines.push(`  - Trigger: ${item.trigger}`);
      }
    }
    lines.push('');
  }

  if (done.length > 0) {
    lines.push(`### Done (${done.length} items)`);
    for (const item of done.slice(0, 10)) {
      lines.push(`- ~~${item.title}~~`);
    }
    if (done.length > 10) {
      lines.push(`- ...and ${done.length - 10} more`);
    }
  }

  return lines.join('\n');
}

/**
 * Add a new item to a goal's backlog.json file.
 */
export function addBacklogItem(
  goalId: string,
  title: string,
  priorityLevel: string,
  description: string,
  triggerCondition?: string
): string {
  const goalDir = goalsPath(goalId);

  if (!fs.existsSync(goalDir)) {
    return `Goal "${goalId}" not found. No directory at ${goalDir}`;
  }

  const backlogPath = path.join(goalDir, 'backlog.json');

  // Read existing backlog or create empty array
  let items: BacklogItem[] = [];
  if (fs.existsSync(backlogPath)) {
    const raw = readJsonSafe<BacklogItem[]>(backlogPath);
    if (Array.isArray(raw)) {
      items = raw;
    }
  }

  // Generate a simple ID from the title
  const id = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  const now = new Date().toISOString().split('T')[0];

  const newItem: BacklogItem = {
    id,
    title,
    status: 'pending',
    priority: priorityLevel.toUpperCase(),
    description,
    created: now,
    updated: now,
  };

  if (triggerCondition) {
    newItem.trigger = triggerCondition;
  }

  items.push(newItem);

  fs.writeFileSync(backlogPath, JSON.stringify(items, null, 2), 'utf-8');

  return `Added "${title}" (${priorityLevel}) to ${goalId}/backlog.json${triggerCondition ? ` with trigger: "${triggerCondition}"` : ''}`;
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

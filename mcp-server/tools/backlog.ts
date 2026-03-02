import fs from 'node:fs';
import { statePath, goalsPath, readJsonSafe, readTextSafe } from './paths.js';

interface BacklogItem {
  id: string;
  title: string;
  status: string;
  goalId: string;
  priority?: string;
  trigger?: string;
  sourceDirective?: string;
  sourceContext?: string;
}

interface BacklogsState {
  generated: string;
  items: BacklogItem[];
}

/**
 * List backlog items, optionally filtered by goal and/or priority.
 */
export function listBacklog(goalId?: string, priority?: string): string {
  const backlogs = readJsonSafe<BacklogsState>(statePath('backlogs.json'));

  if (!backlogs) {
    return 'No backlogs.json found. Run the state indexer first.';
  }

  let items = backlogs.items;

  if (goalId) {
    items = items.filter((i) => i.goalId === goalId);
    if (items.length === 0) {
      return `No backlog items found for goal "${goalId}". Available goals: ${[...new Set(backlogs.items.map((i) => i.goalId))].join(', ')}`;
    }
  }

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
 * Add a new item to a goal's backlog.md file.
 */
export function addBacklogItem(
  goalId: string,
  title: string,
  priorityLevel: string,
  description: string,
  triggerCondition?: string
): string {
  const backlogPath = goalsPath(goalId, 'backlog.md');

  if (!fs.existsSync(backlogPath)) {
    // Check if goal directory exists
    const goalDir = goalsPath(goalId);
    if (!fs.existsSync(goalDir)) {
      return `Goal "${goalId}" not found. No directory at ${goalDir}`;
    }
    // Create the backlog file
    fs.writeFileSync(backlogPath, `# Backlog: ${goalId}\n\n`, 'utf-8');
  }

  const existing = readTextSafe(backlogPath) ?? '';

  // Build the new item in the structured format used by the conductor
  const itemLines: string[] = [];
  itemLines.push('');
  itemLines.push(`### ${title}`);
  itemLines.push(`- **Priority**: ${priorityLevel}`);
  if (triggerCondition) {
    itemLines.push(`- **Trigger**: ${triggerCondition}`);
  }
  itemLines.push(`- **Description**: ${description}`);
  itemLines.push(`- **Added**: ${new Date().toISOString().split('T')[0]}`);
  itemLines.push('');

  // Append to the file
  const updatedContent = existing.trimEnd() + '\n' + itemLines.join('\n');
  fs.writeFileSync(backlogPath, updatedContent, 'utf-8');

  return `Added "${title}" (${priorityLevel}) to ${goalId}/backlog.md${triggerCondition ? ` with trigger: "${triggerCondition}"` : ''}`;
}

import fs from 'node:fs';
import path from 'node:path';
import { getProjectPath, readJsonSafe, readTextSafe } from './paths.js';

// Skip markers -- directives containing these should not be auto-launched
const SKIP_MARKERS = ['<!-- foreman:skip -->', '**Requires**: manual', 'DEFERRED', '**Status**: deferred', '**Status**: needs-human'];

interface DirectiveJson {
  id: string;
  title: string;
  status: string;
  created?: string;
  weight?: string;
}

function isSkipped(content: string | null | undefined): boolean {
  if (!content) return false;
  return SKIP_MARKERS.some(marker => content.includes(marker));
}

/**
 * List available directives from .context/directives/*.json.
 */
export function listDirectives(): string {
  const projectPath = getProjectPath();
  const directivesDir = path.join(projectPath, '.context', 'directives');

  if (!fs.existsSync(directivesDir)) {
    return 'No directives directory found at ' + directivesDir;
  }

  const jsonFiles = fs.readdirSync(directivesDir).filter(f => {
    if (!f.endsWith('.json')) return false;
    try { return fs.statSync(path.join(directivesDir, f)).isFile(); } catch { return false; }
  });

  if (jsonFiles.length === 0) {
    return 'No directives found. Directory is empty.';
  }

  const ready: string[] = [];
  const completed: string[] = [];
  const skipped: string[] = [];

  for (const file of jsonFiles) {
    const filePath = path.join(directivesDir, file);
    const dirJson = readJsonSafe<DirectiveJson>(filePath);
    if (!dirJson) continue;

    const name = file.replace('.json', '');
    const title = dirJson.title ?? name;
    const status = dirJson.status ?? 'pending';

    // Check the companion .md file for skip markers
    const mdPath = path.join(directivesDir, `${name}.md`);
    const mdContent = readTextSafe(mdPath);

    if (status === 'completed' || status === 'done') {
      completed.push(`- ~~${name}~~: ${title} *(completed)*`);
    } else if (isSkipped(mdContent)) {
      skipped.push(`- ~~${name}~~: ${title} *(deferred/manual)*`);
    } else if (status === 'pending' || status === 'triaged') {
      ready.push(`- **${name}**: ${title}`);
    } else {
      // executing or other active status
      ready.push(`- **${name}**: ${title} *(${status})*`);
    }
  }

  const lines: string[] = [];
  lines.push(`## Directives (${ready.length} active/ready, ${completed.length} completed, ${skipped.length} skipped)`);
  lines.push('');

  if (ready.length > 0) {
    lines.push('### Ready / Active');
    lines.push(...ready);
    lines.push('');
  }

  if (completed.length > 0) {
    lines.push(`### Completed (${completed.length})`);
    lines.push(...completed.slice(0, 10));
    if (completed.length > 10) {
      lines.push(`- ...and ${completed.length - 10} more`);
    }
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push('### Skipped (deferred/manual)');
    lines.push(...skipped);
  }

  return lines.join('\n');
}

/**
 * Launch a directive by name.
 * Returns the command to execute the directive via Claude CLI.
 * Does NOT actually spawn a process (that would require the Claude CLI installed).
 */
export function launchDirective(directiveName: string): string {
  const projectPath = getProjectPath();
  const directivesDir = path.join(projectPath, '.context', 'directives');

  const jsonPath = path.join(directivesDir, `${directiveName}.json`);
  const mdPath = path.join(directivesDir, `${directiveName}.md`);

  if (!fs.existsSync(jsonPath) && !fs.existsSync(mdPath)) {
    const available = fs.existsSync(directivesDir)
      ? fs.readdirSync(directivesDir)
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''))
      : [];
    return `Directive "${directiveName}" not found in .context/directives/. Available: ${available.join(', ') || 'none'}`;
  }

  const dirJson = readJsonSafe<DirectiveJson>(jsonPath);
  const mdContent = readTextSafe(mdPath);

  // Warn if this directive has skip markers
  if (isSkipped(mdContent)) {
    const reasons: string[] = [];
    if (mdContent?.includes('<!-- foreman:skip -->')) reasons.push('foreman:skip marker');
    if (mdContent?.includes('**Requires**: manual')) reasons.push('requires manual execution');
    if (mdContent?.includes('DEFERRED')) reasons.push('deferred');
    if (mdContent?.includes('**Status**: deferred')) reasons.push('status: deferred');
    if (mdContent?.includes('**Status**: needs-human')) reasons.push('needs human');
    return `**Warning**: Directive "${directiveName}" is marked as skipped (${reasons.join(', ')}). It should not be auto-launched. Review the directive and remove skip markers if you want to proceed.`;
  }

  const title = dirJson?.title ?? mdContent
    ?.split('\n')
    .find(l => l.startsWith('# '))
    ?.replace('# ', '') ?? directiveName;

  // Build the launch command
  const command = `cd ${projectPath} && claude -p "/directive ${directiveName}"`;

  const lines: string[] = [];
  lines.push(`## Ready to Launch: ${title}`);
  lines.push('');
  lines.push(`**Directive**: ${directiveName}`);
  if (dirJson) {
    lines.push(`**Status**: ${dirJson.status}`);
    if (dirJson.weight) lines.push(`**Weight**: ${dirJson.weight}`);
  }
  lines.push(`**JSON**: ${jsonPath}`);
  if (mdContent) lines.push(`**Brief**: ${mdPath}`);
  lines.push('');

  if (mdContent) {
    lines.push('### Preview');
    const preview = mdContent.split('\n').slice(0, 20).join('\n');
    lines.push('```');
    lines.push(preview);
    if ((mdContent.split('\n').length) > 20) {
      lines.push('... (truncated)');
    }
    lines.push('```');
    lines.push('');
  }

  lines.push('### Launch Command');
  lines.push('```bash');
  lines.push(command);
  lines.push('```');
  lines.push('');
  lines.push(
    'Run this command to execute the directive. Alex (Chief of Staff) will handle orchestration.'
  );

  return lines.join('\n');
}

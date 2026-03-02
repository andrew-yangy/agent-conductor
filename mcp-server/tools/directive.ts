import fs from 'node:fs';
import { conductorPath, readTextSafe, getProjectPath } from './paths.js';

// Skip markers — directives containing these should not be auto-launched
const SKIP_MARKERS = ['<!-- foreman:skip -->', '**Requires**: manual', 'DEFERRED', '**Status**: deferred', '**Status**: needs-human'];

function isSkipped(content: string | null | undefined): boolean {
  if (!content) return false;
  return SKIP_MARKERS.some(marker => content.includes(marker));
}

/**
 * List available directives in inbox/.
 */
export function listDirectives(): string {
  const inboxDir = conductorPath('inbox');
  if (!fs.existsSync(inboxDir)) {
    return 'No inbox directory found at ' + inboxDir;
  }

  const files = fs.readdirSync(inboxDir).filter((f) => f.endsWith('.md'));
  if (files.length === 0) {
    return 'Inbox is empty. No pending directives.';
  }

  const ready: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const name = file.replace('.md', '');
    const content = readTextSafe(conductorPath('inbox', file));
    const firstLine = content
      ?.split('\n')
      .find((l) => l.startsWith('# '))
      ?.replace('# ', '');

    if (isSkipped(content)) {
      skipped.push(`- ~~${name}~~: ${firstLine ?? '(no title)'} *(deferred/manual)*`);
    } else {
      ready.push(`- **${name}**: ${firstLine ?? '(no title)'}`);
    }
  }

  const lines: string[] = [];
  lines.push(`## Pending Directives (${ready.length} ready, ${skipped.length} skipped)`);
  lines.push('');

  if (ready.length > 0) {
    lines.push('### Ready to Launch');
    lines.push(...ready);
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
  const inboxDir = conductorPath('inbox');
  const fileName = directiveName.endsWith('.md')
    ? directiveName
    : directiveName + '.md';
  const filePath = conductorPath('inbox', fileName);

  if (!fs.existsSync(filePath)) {
    const available = fs.existsSync(inboxDir)
      ? fs
          .readdirSync(inboxDir)
          .filter((f) => f.endsWith('.md'))
          .map((f) => f.replace('.md', ''))
      : [];
    return `Directive "${directiveName}" not found in inbox. Available: ${available.join(', ') || 'none'}`;
  }

  const content = readTextSafe(filePath);

  // Warn if this directive has skip markers
  if (isSkipped(content)) {
    const reasons: string[] = [];
    if (content?.includes('<!-- foreman:skip -->')) reasons.push('foreman:skip marker');
    if (content?.includes('**Requires**: manual')) reasons.push('requires manual execution');
    if (content?.includes('DEFERRED')) reasons.push('deferred');
    if (content?.includes('**Status**: deferred')) reasons.push('status: deferred');
    if (content?.includes('**Status**: needs-human')) reasons.push('needs human');
    return `**Warning**: Directive "${directiveName}" is marked as skipped (${reasons.join(', ')}). It should not be auto-launched. Review the directive and remove skip markers if you want to proceed.`;
  }

  const title =
    content
      ?.split('\n')
      .find((l) => l.startsWith('# '))
      ?.replace('# ', '') ?? directiveName;

  const projectPath = getProjectPath();

  // Build the launch command
  const command = `cd ${projectPath} && claude -p "/directive ${directiveName}"`;

  const lines: string[] = [];
  lines.push(`## Ready to Launch: ${title}`);
  lines.push('');
  lines.push(`**Directive**: ${directiveName}`);
  lines.push(`**File**: ${filePath}`);
  lines.push('');
  lines.push('### Preview');
  // Show first 20 lines of the directive
  const preview = content?.split('\n').slice(0, 20).join('\n') ?? '';
  lines.push('```');
  lines.push(preview);
  if ((content?.split('\n').length ?? 0) > 20) {
    lines.push('... (truncated)');
  }
  lines.push('```');
  lines.push('');
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

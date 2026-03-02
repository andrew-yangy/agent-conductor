import fs from 'node:fs';
import path from 'node:path';
import { conductorPath, readTextSafe } from './paths.js';

/**
 * Read the latest CEO report from .context/reports/.
 * Optionally specify a report name to read a specific one.
 */
export function readReport(reportName?: string): string {
  const reportsDir = conductorPath('reports');

  if (!fs.existsSync(reportsDir)) {
    return 'No reports directory found at ' + reportsDir;
  }

  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  if (files.length === 0) {
    return 'No reports found.';
  }

  if (reportName) {
    // Find a matching report
    const match = files.find(
      (f) =>
        f.includes(reportName) ||
        f.replace('.md', '') === reportName
    );
    if (!match) {
      return `Report "${reportName}" not found. Available reports:\n${files.map((f) => `- ${f.replace('.md', '')}`).join('\n')}`;
    }
    const content = readTextSafe(path.join(reportsDir, match));
    return content ?? 'Report file is empty.';
  }

  // Return the most recent report (last alphabetically, since they're dated)
  const latest = files[files.length - 1]!;
  const content = readTextSafe(path.join(reportsDir, latest));

  const lines: string[] = [];
  lines.push(`## Latest Report: ${latest.replace('.md', '')}`);
  lines.push(`(${files.length} total reports available)`);
  lines.push('');
  lines.push(content ?? 'Report file is empty.');

  return lines.join('\n');
}

/**
 * List all available reports.
 */
export function listReports(): string {
  const reportsDir = conductorPath('reports');

  if (!fs.existsSync(reportsDir)) {
    return 'No reports directory found.';
  }

  const files = fs
    .readdirSync(reportsDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .reverse(); // Most recent first

  if (files.length === 0) {
    return 'No reports found.';
  }

  const lines: string[] = [];
  lines.push(`## Reports (${files.length})`);
  lines.push('');
  for (const file of files) {
    lines.push(`- ${file.replace('.md', '')}`);
  }

  return lines.join('\n');
}

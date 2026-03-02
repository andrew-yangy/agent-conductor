#!/usr/bin/env npx tsx
/**
 * migrate-cross-references.ts — One-time migration script for context system redesign.
 *
 * This script:
 * 1. Creates directive.json for all directives in inbox/ and done/
 * 2. Adds cross-reference fields to features in goal.json files
 * 3. Migrates backlog source fields from free-text to structured
 * 4. Backfills completed_date on features missing it
 *
 * IDEMPOTENT: Safe to run multiple times. Existing fields are preserved.
 *
 * Usage:
 *   npx tsx scripts/migrate-cross-references.ts
 *   npx tsx scripts/migrate-cross-references.ts --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const conductorContext = path.resolve(__dirname, '../.context');
const swContext = '/Users/yangyang/Repos/sw/.context';

const inboxDir = path.join(conductorContext, 'inbox');
const doneDir = path.join(conductorContext, 'done');
const reportsDir = path.join(conductorContext, 'reports');

// All goal directories (sw + agent-conductor native goals)
function getAllGoalDirs(): string[] {
  const dirs: string[] = [];

  // sw goals (14 native)
  const swGoals = path.join(swContext, 'goals');
  if (fs.existsSync(swGoals)) {
    for (const entry of fs.readdirSync(swGoals)) {
      const full = path.join(swGoals, entry);
      if (fs.statSync(full).isDirectory() && !entry.startsWith('.') && !entry.startsWith('_')) {
        // Skip symlinked goals (they live in agent-conductor)
        try {
          const realPath = fs.realpathSync(full);
          if (realPath.includes('agent-conductor')) continue;
        } catch { /* not a symlink */ }
        dirs.push(full);
      }
    }
  }

  // agent-conductor goals (3 native)
  const acGoals = path.join(conductorContext, 'goals');
  if (fs.existsSync(acGoals)) {
    for (const entry of fs.readdirSync(acGoals)) {
      const full = path.join(acGoals, entry);
      if (fs.statSync(full).isDirectory() && !entry.startsWith('.')) {
        dirs.push(full);
      }
    }
  }

  return dirs;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJson(filePath: string, data: unknown): void {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would write: ${filePath}`);
    return;
  }
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function fileMtime(filePath: string): string {
  try {
    return fs.statSync(filePath).mtime.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function extractFirstHeading(content: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : '';
}

function listMdFiles(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.md') && !f.startsWith('.'));
  } catch {
    return [];
  }
}

// Parse free-text source field into directive ID
function parseSourceToDirectiveId(source: string | undefined): string | null {
  if (!source) return null;
  // Pattern: "Directive conductor-brainstorm-goals, 2026-03-02"
  const match = source.match(/^Directive\s+([a-z0-9-]+)/i);
  if (match) return match[1];
  // Pattern: just a directive name slug
  if (/^[a-z0-9-]+$/.test(source.trim())) return source.trim();
  return null;
}

// ---------------------------------------------------------------------------
// Stats tracking
// ---------------------------------------------------------------------------

const stats = {
  directivesCreated: 0,
  directivesSkipped: 0,
  goalsUpdated: 0,
  featuresUpdated: 0,
  featuresBackfilled: 0,
  backlogsUpdated: 0,
  backlogSourcesMigrated: 0,
};

// ---------------------------------------------------------------------------
// 1. Create directive.json for all directives
// ---------------------------------------------------------------------------

function createDirectiveJsonFiles(): void {
  console.log('\n=== Creating directive.json files ===\n');

  // Collect report filenames for matching
  const reportFiles = listMdFiles(reportsDir);
  const reportMap = new Map<string, string>(); // directive-name -> report filename (without .md)
  for (const rf of reportFiles) {
    const match = rf.match(/^(.+?)-\d{4}-\d{2}-\d{2}\.md$/);
    if (match) {
      const directiveName = match[1];
      // Keep the latest (last in sorted order)
      reportMap.set(directiveName, rf.replace('.md', ''));
    }
  }

  // Process inbox directives
  for (const file of listMdFiles(inboxDir)) {
    const name = file.replace('.md', '');
    const jsonPath = path.join(inboxDir, `${name}.json`);

    if (fs.existsSync(jsonPath)) {
      console.log(`  SKIP: inbox/${name}.json already exists`);
      stats.directivesSkipped++;
      continue;
    }

    const mdPath = path.join(inboxDir, file);
    const content = fs.readFileSync(mdPath, 'utf-8');
    const title = extractFirstHeading(content) || name;

    // Try to extract goal alignment from the .md content
    const goalIds = extractGoalIds(content, name);

    const directive = {
      id: name,
      title,
      status: 'pending',
      created: fileMtime(mdPath),
      completed: null,
      weight: 'standard',
      goal_ids: goalIds,
      produced_features: [] as string[],
      report: reportMap.get(name) || null,
      backlog_sources: [] as string[],
    };

    writeJson(jsonPath, directive);
    console.log(`  CREATE: inbox/${name}.json (goal_ids: [${goalIds.join(', ')}])`);
    stats.directivesCreated++;
  }

  // Process done directives
  for (const file of listMdFiles(doneDir)) {
    const name = file.replace('.md', '');
    const jsonPath = path.join(doneDir, `${name}.json`);

    if (fs.existsSync(jsonPath)) {
      console.log(`  SKIP: done/${name}.json already exists`);
      stats.directivesSkipped++;
      continue;
    }

    const mdPath = path.join(doneDir, file);
    const content = fs.readFileSync(mdPath, 'utf-8');
    const title = extractFirstHeading(content) || name;

    const goalIds = extractGoalIds(content, name);

    const directive = {
      id: name,
      title,
      status: 'done',
      created: fileMtime(mdPath),
      completed: fileMtime(mdPath),
      weight: 'standard',
      goal_ids: goalIds,
      produced_features: [] as string[],
      report: reportMap.get(name) || null,
      backlog_sources: [] as string[],
    };

    writeJson(jsonPath, directive);
    console.log(`  CREATE: done/${name}.json (goal_ids: [${goalIds.join(', ')}], report: ${directive.report || 'none'})`);
    stats.directivesCreated++;
  }
}

// Extract goal IDs from directive markdown content
function extractGoalIds(content: string, directiveName: string): string[] {
  const ids: string[] = [];

  // Pattern: "Goal alignment: agent-conductor"
  const alignmentMatch = content.match(/\*\*Goal alignment\*\*:\s*(.+)/i)
    || content.match(/Goal alignment:\s*(.+)/i);
  if (alignmentMatch) {
    const goals = alignmentMatch[1].split(',').map(s => s.trim().toLowerCase());
    ids.push(...goals.filter(g => g.length > 0));
  }

  // Pattern: "goal_folder": "sellwisely-revenue" (from plan artifacts)
  const folderMatch = content.match(/"goal_folder":\s*"([^"]+)"/);
  if (folderMatch && !ids.includes(folderMatch[1])) {
    ids.push(folderMatch[1]);
  }

  // Heuristic: directive name contains a known goal prefix
  const knownGoalPrefixes: Record<string, string> = {
    'conductor-': 'agent-conductor',
    'sellwisely-': 'sellwisely-revenue',
    'buywisely-': 'buywisely-growth',
    'pricesapi-': 'pricesapi-launch',
    'elasticsearch-': 'buywisely-security',
    'improve-security': 'buywisely-security',
    'database-ops': 'database-ops',
    'geo-optimization': 'global-expansion',
    'lambda-cold-start': 'platform',
    'prisma7-migration': 'buywisely-modernize',
    'ceo-visibility': 'agent-conductor',
    'work-state-management': 'agent-conductor',
    'work-scheduler': 'agent-conductor',
    'checkpoint-resume': 'agent-conductor',
    'optimize-conductor': 'agent-conductor',
    'complete-option-b': 'agent-conductor',
    'reflexion-lessons': 'agent-conductor',
    'request-clarify': 'agent-conductor',
    'coderabbit-integration': 'developer-productivity',
    'episodic-memory': 'agent-conductor',
    'review-quality': 'conductor-review-quality',
    'context-system-redesign': 'agent-conductor',
    'improve-session-subagent': 'conductor-ux',
    'manager-replanning': 'agent-conductor',
    'specialist-agents': 'agent-conductor',
    'team-org-dashboard': 'conductor-ux',
    'third-party-review': 'sellwisely-revenue',
  };

  for (const [prefix, goalId] of Object.entries(knownGoalPrefixes)) {
    if (directiveName.startsWith(prefix) || directiveName === prefix) {
      if (!ids.includes(goalId)) {
        ids.push(goalId);
      }
      break;
    }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// 2. Update features in goal.json — add cross-reference fields
// ---------------------------------------------------------------------------

function updateGoalJsonFeatures(): void {
  console.log('\n=== Updating goal.json features with cross-reference fields ===\n');

  for (const goalDir of getAllGoalDirs()) {
    const goalJsonPath = path.join(goalDir, 'goal.json');
    const goalJson = readJson(goalJsonPath) as {
      id: string;
      features: Array<Record<string, unknown>>;
      last_activity: string;
      [key: string]: unknown;
    } | null;

    if (!goalJson || !goalJson.features) {
      continue;
    }

    let modified = false;
    const goalId = goalJson.id;

    for (const feature of goalJson.features) {
      // Add source_directive if missing
      if (!('source_directive' in feature)) {
        feature.source_directive = null;
        modified = true;
      }

      // Add source_backlog if missing
      if (!('source_backlog' in feature)) {
        feature.source_backlog = null;
        modified = true;
      }

      // Add dod if missing
      if (!('dod' in feature)) {
        feature.dod = null;
        modified = true;
      }

      // Add report if missing
      if (!('report' in feature)) {
        feature.report = null;
        modified = true;
      }

      // Add refs if missing
      if (!('refs' in feature)) {
        feature.refs = [];
        modified = true;
      }

      // Backfill completed_date for done features missing it
      if (feature.status === 'done' && !feature.completed_date) {
        // Use completed field if it exists (agent-conductor format)
        if (feature.completed) {
          feature.completed_date = feature.completed;
        } else {
          // Fallback to last_activity
          feature.completed_date = goalJson.last_activity;
        }
        stats.featuresBackfilled++;
        modified = true;
      }

      if (modified) stats.featuresUpdated++;
    }

    if (modified) {
      writeJson(goalJsonPath, goalJson);
      console.log(`  UPDATE: ${goalId}/goal.json (${goalJson.features.length} features)`);
      stats.goalsUpdated++;
    } else {
      console.log(`  SKIP: ${goalId}/goal.json (already up to date)`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Update backlog.json — migrate source to source_directive + add fields
// ---------------------------------------------------------------------------

function updateBacklogJson(): void {
  console.log('\n=== Updating backlog.json with structured references ===\n');

  for (const goalDir of getAllGoalDirs()) {
    const backlogPath = path.join(goalDir, 'backlog.json');
    const backlogJson = readJson(backlogPath) as {
      goal_id: string;
      items: Array<Record<string, unknown>>;
      [key: string]: unknown;
    } | null;

    if (!backlogJson || !backlogJson.items) continue;

    let modified = false;

    for (const item of backlogJson.items) {
      // Migrate source -> source_directive
      if ('source' in item && !('source_directive' in item)) {
        const directiveId = parseSourceToDirectiveId(item.source as string | undefined);
        item.source_directive = directiveId;
        // Keep original source field for backward compat but rename
        delete item.source;
        stats.backlogSourcesMigrated++;
        modified = true;
      } else if (!('source_directive' in item)) {
        item.source_directive = null;
        modified = true;
      }

      // Add promoted_to_feature if missing
      if (!('promoted_to_feature' in item)) {
        item.promoted_to_feature = null;
        modified = true;
      }

      // Add promoted_at if missing
      if (!('promoted_at' in item)) {
        item.promoted_at = null;
        modified = true;
      }
    }

    if (modified) {
      writeJson(backlogPath, backlogJson);
      console.log(`  UPDATE: ${backlogJson.goal_id}/backlog.json (${backlogJson.items.length} items)`);
      stats.backlogsUpdated++;
    } else {
      console.log(`  SKIP: ${backlogJson.goal_id}/backlog.json (already up to date)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log('Context System Redesign — Migration Script');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no files will be written)' : 'LIVE'}`);

  createDirectiveJsonFiles();
  updateGoalJsonFeatures();
  updateBacklogJson();

  console.log('\n=== Migration Summary ===\n');
  console.log(`  Directive.json files created: ${stats.directivesCreated}`);
  console.log(`  Directive.json files skipped (already exist): ${stats.directivesSkipped}`);
  console.log(`  Goal.json files updated: ${stats.goalsUpdated}`);
  console.log(`  Features updated with cross-ref fields: ${stats.featuresUpdated}`);
  console.log(`  Features backfilled with completed_date: ${stats.featuresBackfilled}`);
  console.log(`  Backlog.json files updated: ${stats.backlogsUpdated}`);
  console.log(`  Backlog source fields migrated: ${stats.backlogSourcesMigrated}`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No files were actually written.');
  }
}

main();

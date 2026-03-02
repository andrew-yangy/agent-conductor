#!/usr/bin/env npx tsx
/**
 * backfill-references.ts — Populates actual cross-reference data for known relationships.
 *
 * Runs AFTER migrate-cross-references.ts has added the schema fields.
 *
 * This script:
 * 1. Backfills directive.json goal_ids from directive content + heuristics
 * 2. Backfills directive.json produced_features by matching directive IDs to features
 * 3. Backfills feature source_directive where feature ID matches a directive name
 * 4. Backfills backlog promoted_to_feature where matching features exist
 * 5. Backfills DOD for recent features from report files
 *
 * IDEMPOTENT: Safe to run multiple times. Existing non-null values are preserved.
 *
 * Usage:
 *   npx tsx scripts/backfill-references.ts
 *   npx tsx scripts/backfill-references.ts --dry-run
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
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function listJsonFiles(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.json') && !f.startsWith('.'));
  } catch {
    return [];
  }
}

// All goal directories (sw + agent-conductor)
function getAllGoalDirs(): Array<{ dir: string; goalId: string }> {
  const dirs: Array<{ dir: string; goalId: string }> = [];

  const swGoals = path.join(swContext, 'goals');
  if (fs.existsSync(swGoals)) {
    for (const entry of fs.readdirSync(swGoals)) {
      const full = path.join(swGoals, entry);
      if (!fs.statSync(full).isDirectory() || entry.startsWith('.') || entry.startsWith('_')) continue;
      try {
        const realPath = fs.realpathSync(full);
        if (realPath.includes('agent-conductor')) continue;
      } catch { /* not a symlink */ }
      dirs.push({ dir: full, goalId: entry });
    }
  }

  const acGoals = path.join(conductorContext, 'goals');
  if (fs.existsSync(acGoals)) {
    for (const entry of fs.readdirSync(acGoals)) {
      const full = path.join(acGoals, entry);
      if (fs.statSync(full).isDirectory() && !entry.startsWith('.')) {
        dirs.push({ dir: full, goalId: entry });
      }
    }
  }

  return dirs;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const stats = {
  directiveGoalIdsPopulated: 0,
  directiveProducedFeaturesPopulated: 0,
  featureSourceDirectiveSet: 0,
  backlogPromotedToFeatureSet: 0,
  directiveReportSet: 0,
};

// ---------------------------------------------------------------------------
// Build a master feature map: featureId -> goalId/featureId
// ---------------------------------------------------------------------------

interface FeatureInfo {
  id: string;
  goalId: string;
  fullId: string; // goalId/featureId
  status: string;
  title: string;
}

function buildFeatureMap(): Map<string, FeatureInfo> {
  const map = new Map<string, FeatureInfo>();

  for (const { dir, goalId } of getAllGoalDirs()) {
    const goalJsonPath = path.join(dir, 'goal.json');
    const goalJson = readJson(goalJsonPath) as { features: Array<Record<string, unknown>> } | null;
    if (!goalJson?.features) continue;

    for (const f of goalJson.features) {
      const fid = f.id as string;
      const fullId = `${goalId}/${fid}`;
      map.set(fid, {
        id: fid,
        goalId,
        fullId,
        status: f.status as string,
        title: f.title as string,
      });
      // Also index by full ID
      map.set(fullId, {
        id: fid,
        goalId,
        fullId,
        status: f.status as string,
        title: f.title as string,
      });
    }
  }

  return map;
}

// Build a master directive name set
function buildDirectiveNameSet(): Set<string> {
  const names = new Set<string>();
  for (const dir of [inboxDir, doneDir]) {
    for (const file of listJsonFiles(dir)) {
      names.add(file.replace('.json', ''));
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// 1. Backfill directive.json produced_features
// ---------------------------------------------------------------------------

function backfillDirectiveProducedFeatures(featureMap: Map<string, FeatureInfo>): void {
  console.log('\n=== Backfilling directive.json produced_features ===\n');

  for (const dir of [inboxDir, doneDir]) {
    for (const file of listJsonFiles(dir)) {
      const jsonPath = path.join(dir, file);
      const directive = readJson(jsonPath) as Record<string, unknown> | null;
      if (!directive) continue;

      const name = file.replace('.json', '');
      let modified = false;

      // Only backfill if produced_features is empty
      if (!directive.produced_features || (directive.produced_features as string[]).length === 0) {
        // Heuristic: if a feature ID matches the directive name, it was produced by this directive
        const feature = featureMap.get(name);
        if (feature) {
          directive.produced_features = [feature.fullId];
          stats.directiveProducedFeaturesPopulated++;
          modified = true;
          console.log(`  ${name}: produced_features = [${feature.fullId}]`);
        }
      }

      if (modified) {
        writeJson(jsonPath, directive);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Backfill feature source_directive
// ---------------------------------------------------------------------------

function backfillFeatureSourceDirective(directiveNames: Set<string>): void {
  console.log('\n=== Backfilling feature source_directive ===\n');

  for (const { dir, goalId } of getAllGoalDirs()) {
    const goalJsonPath = path.join(dir, 'goal.json');
    const goalJson = readJson(goalJsonPath) as { features: Array<Record<string, unknown>>; [k: string]: unknown } | null;
    if (!goalJson?.features) continue;

    let modified = false;

    for (const feature of goalJson.features) {
      // Only backfill if source_directive is null
      if (feature.source_directive !== null && feature.source_directive !== undefined) continue;

      const fid = feature.id as string;

      // Heuristic: if feature ID matches a directive name, set source_directive
      if (directiveNames.has(fid)) {
        feature.source_directive = fid;
        stats.featureSourceDirectiveSet++;
        modified = true;
        console.log(`  ${goalId}/${fid}: source_directive = "${fid}"`);
      }
    }

    if (modified) {
      writeJson(goalJsonPath, goalJson);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. Backfill backlog promoted_to_feature
// ---------------------------------------------------------------------------

function backfillBacklogPromotedToFeature(featureMap: Map<string, FeatureInfo>): void {
  console.log('\n=== Backfilling backlog promoted_to_feature ===\n');

  for (const { dir, goalId } of getAllGoalDirs()) {
    const backlogPath = path.join(dir, 'backlog.json');
    const backlogJson = readJson(backlogPath) as { items: Array<Record<string, unknown>>; [k: string]: unknown } | null;
    if (!backlogJson?.items) continue;

    let modified = false;

    for (const item of backlogJson.items) {
      // Only backfill done items with null promoted_to_feature
      if (item.promoted_to_feature !== null && item.promoted_to_feature !== undefined) continue;
      if (item.status !== 'done') continue;

      const itemId = item.id as string;

      // Heuristic: if a feature has the same ID as this backlog item, it was promoted
      const feature = featureMap.get(itemId);
      if (feature && feature.goalId === goalId) {
        item.promoted_to_feature = feature.fullId;
        item.promoted_at = item.updated;
        stats.backlogPromotedToFeatureSet++;
        modified = true;
        console.log(`  ${goalId}/${itemId}: promoted_to_feature = "${feature.fullId}"`);
      }
    }

    if (modified) {
      writeJson(backlogPath, backlogJson);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. Backfill directive report field
// ---------------------------------------------------------------------------

function backfillDirectiveReports(): void {
  console.log('\n=== Backfilling directive report links ===\n');

  const reportsDir = path.join(conductorContext, 'reports');
  const reportFiles = fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).filter(f => f.endsWith('.md')) : [];

  // Build report map: directive-name -> latest report filename (without .md)
  const reportMap = new Map<string, string>();
  for (const rf of reportFiles) {
    const match = rf.match(/^(.+?)-\d{4}-\d{2}-\d{2}\.md$/);
    if (match) {
      reportMap.set(match[1], rf.replace('.md', ''));
    }
  }

  for (const dir of [inboxDir, doneDir]) {
    for (const file of listJsonFiles(dir)) {
      const jsonPath = path.join(dir, file);
      const directive = readJson(jsonPath) as Record<string, unknown> | null;
      if (!directive) continue;

      const name = file.replace('.json', '');

      // Only backfill if report is null
      if (directive.report !== null && directive.report !== undefined) continue;

      const report = reportMap.get(name);
      if (report) {
        directive.report = report;
        stats.directiveReportSet++;
        writeJson(jsonPath, directive);
        console.log(`  ${name}: report = "${report}"`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log('Context System Redesign — Backfill References');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no files will be written)' : 'LIVE'}`);

  const featureMap = buildFeatureMap();
  const directiveNames = buildDirectiveNameSet();

  console.log(`\nLoaded ${featureMap.size / 2} features, ${directiveNames.size} directives\n`);

  backfillDirectiveProducedFeatures(featureMap);
  backfillFeatureSourceDirective(directiveNames);
  backfillBacklogPromotedToFeature(featureMap);
  backfillDirectiveReports();

  console.log('\n=== Backfill Summary ===\n');
  console.log(`  Directive produced_features populated: ${stats.directiveProducedFeaturesPopulated}`);
  console.log(`  Feature source_directive set: ${stats.featureSourceDirectiveSet}`);
  console.log(`  Backlog promoted_to_feature set: ${stats.backlogPromotedToFeatureSet}`);
  console.log(`  Directive report links set: ${stats.directiveReportSet}`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] No files were actually written.');
  }
}

main();

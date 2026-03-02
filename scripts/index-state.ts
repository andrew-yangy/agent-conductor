#!/usr/bin/env npx tsx
/**
 * index-state.ts — Reads the .context/ tree and produces structured JSON
 * files in .context/state/. READ-ONLY — never modifies source files.
 *
 * Data sources (all JSON — zero markdown parsing for structured data):
 *   - goal.json      → goals + features (with cross-reference fields)
 *   - backlog.json   → backlog items (with source_directive, promoted_to_feature)
 *   - tasks.json     → tasks (feature-level and goal-level)
 *   - directive.json  → structured directive metadata (alongside .md files)
 *
 * Conductor artifacts (inbox, done, reports, discussions) remain markdown
 * because they are content, not structured data. directive.json provides
 * structured metadata alongside the markdown.
 *
 * Usage:
 *   npx tsx scripts/index-state.ts
 *   npx tsx scripts/index-state.ts --context-path /path/to/.context
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Types (mirror of agent-conductor/server/state/work-item-types.ts)
// Keep in sync but no import dependency — this script runs standalone.
// ---------------------------------------------------------------------------

type LifecycleState = 'pending' | 'in-progress' | 'blocked' | 'deferred' | 'done' | 'abandoned';
type Priority = 'P0' | 'P1' | 'P2';

interface DodCriterion {
  text: string;
  met: boolean;
  verified_by: string | null;
}

interface GoalRecord {
  id: string;
  type: 'goal';
  title: string;
  status: LifecycleState;
  parentId?: string;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  description?: string;
  category?: string;
  goalState?: 'exploring' | 'active' | 'paused' | 'done';
  activeFeatures: string[];
  doneFeatures: string[];
  backlogCount: number;
  hasOkrs: boolean;
  hasGoalMd: boolean;
  hasGoalJson: boolean;
  hasBacklog: boolean;
  issues?: string[];
}

interface FeatureRecord {
  id: string;
  type: 'feature';
  title: string;
  status: LifecycleState;
  parentId?: string;
  goalId: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  taskCount: number;
  completedTaskCount: number;
  hasSpec: boolean;
  hasDesign: boolean;
  specSummary?: string;
  // Cross-reference fields
  sourceDirective?: string | null;
  sourceBacklog?: string | null;
  dod?: { criteria: DodCriterion[] } | null;
  report?: string | null;
  refs?: string[];
}

interface TaskRecord {
  id: string;
  type: 'task';
  title: string;
  status: LifecycleState;
  parentId?: string;
  goalId?: string;
  featureId: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  deps: string[];
  files: string[];
  role?: string;
}

interface BacklogRecord {
  id: string;
  type: 'backlog-item';
  title: string;
  status: LifecycleState;
  parentId?: string;
  goalId: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  priority?: Priority;
  trigger?: string;
  sourceContext?: string;
  sourceDirective?: string | null;
  promotedToFeature?: string | null;
  promotedAt?: string | null;
}

interface DirectiveRecord {
  id: string;
  type: 'directive';
  title: string;
  status: LifecycleState;
  parentId?: string;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  initiatives: string[];
  checkpoint?: string;
  reportPath?: string;
  // Structured fields from directive.json
  weight?: string;
  goalIds?: string[];
  producedFeatures?: string[];
  report?: string | null;
  backlogSources?: string[];
  artifacts?: string[];
}

interface LessonRecord {
  id: string;
  title: string;
  filePath: string;
  contentSummary?: string;
  topics?: string[];
  updatedAt: string;
}

interface ArtifactRecord {
  id: string;
  type: 'report' | 'discussion' | 'research';
  title: string;
  status: LifecycleState;
  parentId?: string;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  participants?: string[];
  sourceDirective?: string;
  filePath: string;
  contentSummary?: string;
}

// Reverse reference maps
interface ReferenceMap {
  directiveToFeatures: Record<string, string[]>;   // directive-id -> [feature-id, ...]
  featureToDirective: Record<string, string>;       // feature-id -> directive-id
  directiveToGoals: Record<string, string[]>;       // directive-id -> [goal-id, ...]
  goalToDirectives: Record<string, string[]>;       // goal-id -> [directive-id, ...]
  backlogToFeature: Record<string, string>;         // backlog-item-id -> feature-id
  featureToBacklog: Record<string, string>;         // feature-id -> backlog-item-id
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date().toISOString().split('T')[0];

function fileMtime(filePath: string): string {
  try {
    return fs.statSync(filePath).mtime.toISOString().split('T')[0];
  } catch {
    return now;
  }
}

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function dirExists(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function listDirs(dirPath: string): string[] {
  try {
    return fs.readdirSync(dirPath).filter(name => {
      if (name.startsWith('.')) return false;
      return fs.statSync(path.join(dirPath, name)).isDirectory();
    });
  } catch {
    return [];
  }
}

function listFiles(dirPath: string, ext?: string): string[] {
  try {
    return fs.readdirSync(dirPath).filter(name => {
      if (name.startsWith('.')) return false;
      if (ext && !name.endsWith(ext)) return false;
      return fs.statSync(path.join(dirPath, name)).isFile();
    });
  } catch {
    return [];
  }
}

function extractFirstHeading(content: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : '';
}

function extractFirstParagraph(content: string): string {
  const lines = content.split('\n');
  let foundHeading = false;
  const paragraphLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      foundHeading = true;
      continue;
    }
    if (foundHeading) {
      if (line.trim() === '' && paragraphLines.length > 0) break;
      if (line.trim() === '') continue;
      if (line.startsWith('#')) break;
      paragraphLines.push(line.trim());
    }
  }

  return paragraphLines.join(' ').slice(0, 200);
}

// ---------------------------------------------------------------------------
// JSON Source Types
// ---------------------------------------------------------------------------

interface GoalJsonFile {
  id: string;
  title: string;
  state: 'exploring' | 'active' | 'paused' | 'done';
  category?: string;
  created: string;
  target_date?: string;
  description: string;
  okrs_file?: string;
  features: Array<{
    id: string;
    title: string;
    status: 'active' | 'done';
    tasks_total?: number;
    tasks_completed?: number;
    completed_date?: string;
    // Cross-reference fields (added by migration)
    source_directive?: string | null;
    source_backlog?: string | null;
    dod?: { criteria: DodCriterion[] } | null;
    report?: string | null;
    refs?: string[];
  }>;
  last_activity: string;
}

interface BacklogJsonFile {
  goal_id: string;
  last_reviewed: string;
  staleness_threshold_days: number;
  items: Array<{
    id: string;
    title: string;
    status: string;
    priority?: string;
    trigger?: string;
    source?: string;
    source_directive?: string | null;
    promoted_to_feature?: string | null;
    promoted_at?: string | null;
    context?: string;
    created: string;
    updated: string;
  }>;
}

interface RawTasksJson {
  scope?: 'goal' | 'feature';
  goal_id?: string;
  feature_id?: string;
  feature?: string;
  verify?: string;
  features?: Array<{
    id: string;
    title: string;
    tasks: Array<{
      id: string;
      title: string;
      status?: string;
      deps?: string[];
      files?: string[];
      role?: string;
    }>;
  }>;
  tasks?: Array<{
    id: string;
    title: string;
    status?: string;
    deps?: string[];
    files?: string[];
    role?: string;
  }>;
}

// Directive JSON companion file
interface DirectiveJsonFile {
  id: string;
  title: string;
  status: string;
  created: string;
  completed?: string | null;
  weight?: string;
  goal_ids?: string[];
  produced_features?: string[];
  report?: string | null;
  backlog_sources?: string[];
}

// ---------------------------------------------------------------------------
// Status Mappers
// ---------------------------------------------------------------------------

function mapGoalJsonState(state: string): LifecycleState {
  switch (state) {
    case 'active': return 'in-progress';
    case 'exploring': return 'pending';
    case 'paused': return 'deferred';
    case 'done': return 'done';
    default: return 'pending';
  }
}

function mapFeatureJsonStatus(status: string): LifecycleState {
  switch (status) {
    case 'active': return 'in-progress';
    case 'done': return 'done';
    default: return 'pending';
  }
}

function mapBacklogStatus(status: string): LifecycleState {
  switch (status) {
    case 'pending': return 'pending';
    case 'in-progress': return 'in-progress';
    case 'done': return 'done';
    case 'deferred': return 'deferred';
    case 'blocked': return 'blocked';
    default: return 'pending';
  }
}

function mapTaskStatus(status: string): LifecycleState {
  switch (status) {
    case 'completed': return 'done';
    case 'in_progress': return 'in-progress';
    case 'pending': return 'pending';
    case 'blocked': return 'blocked';
    default: return 'pending';
  }
}

function mapDirectiveStatus(status: string): LifecycleState {
  switch (status) {
    case 'pending': return 'pending';
    case 'executing': return 'in-progress';
    case 'done': return 'done';
    default: return 'pending';
  }
}

// ---------------------------------------------------------------------------
// Tasks Reader (from tasks.json files in feature directories + goal root)
// ---------------------------------------------------------------------------

function readTasks(filePath: string, goalId: string, featureName: string): TaskRecord[] {
  const raw = readJson(filePath) as RawTasksJson | null;
  if (!raw) return [];

  const records: TaskRecord[] = [];
  const updatedAt = fileMtime(filePath);
  const featureId = `${goalId}/${featureName}`;

  // Nested format: features[].tasks[]
  if (raw.features && Array.isArray(raw.features)) {
    for (const feature of raw.features) {
      if (!feature.tasks) continue;
      for (const task of feature.tasks) {
        records.push({
          id: `${featureId}/${task.id}`,
          type: 'task',
          title: task.title,
          status: mapTaskStatus(task.status ?? 'pending'),
          featureId,
          goalId,
          createdAt: updatedAt,
          updatedAt,
          deps: task.deps ?? [],
          files: task.files ?? [],
          role: task.role,
        });
      }
    }
  }

  // Flat format: tasks[]
  if (raw.tasks && Array.isArray(raw.tasks)) {
    for (const task of raw.tasks) {
      records.push({
        id: `${featureId}/${task.id}`,
        type: 'task',
        title: task.title,
        status: mapTaskStatus(task.status ?? 'pending'),
        featureId,
        goalId,
        createdAt: updatedAt,
        updatedAt,
        deps: task.deps ?? [],
        files: task.files ?? [],
        role: task.role,
      });
    }
  }

  return records;
}

// Read goal-level tasks.json (scope=goal)
function readGoalTasks(filePath: string, goalId: string): TaskRecord[] {
  const raw = readJson(filePath) as RawTasksJson | null;
  if (!raw || raw.scope !== 'goal') return [];
  if (!raw.tasks || !Array.isArray(raw.tasks)) return [];

  const updatedAt = fileMtime(filePath);
  return raw.tasks.map(task => ({
    id: `${goalId}/_goal/${task.id}`,
    type: 'task' as const,
    title: task.title,
    status: mapTaskStatus(task.status ?? 'pending'),
    featureId: `${goalId}/_goal`,
    goalId,
    createdAt: updatedAt,
    updatedAt,
    deps: task.deps ?? [],
    files: task.files ?? [],
    role: task.role,
  }));
}

// ---------------------------------------------------------------------------
// Features Reader (from goal.json + filesystem for spec/design/tasks)
// ---------------------------------------------------------------------------

function readFeatures(goalDir: string, goalId: string, goalJson: GoalJsonFile): FeatureRecord[] {
  const records: FeatureRecord[] = [];

  for (const feature of goalJson.features) {
    const featureId = `${goalId}/${feature.id}`;

    // Find the feature directory (check active/ then done/)
    let featDir: string | null = null;
    for (const subdir of ['active', 'done']) {
      const candidate = path.join(goalDir, subdir, feature.id);
      if (dirExists(candidate)) {
        featDir = candidate;
        break;
      }
    }

    // Check for spec.md and design.md in the feature directory
    const hasSpec = featDir ? fileExists(path.join(featDir, 'spec.md')) : false;
    const hasDesign = featDir ? fileExists(path.join(featDir, 'design.md')) : false;

    // Task counts from goal.json (already enriched)
    const taskCount = feature.tasks_total ?? 0;
    const completedTaskCount = feature.tasks_completed ?? 0;

    // Determine status from goal.json — the single source of truth
    let status: LifecycleState;
    if (feature.status === 'done') {
      status = 'done';
    } else if (taskCount > 0 && completedTaskCount === taskCount) {
      status = 'done';
    } else if (completedTaskCount > 0) {
      status = 'in-progress';
    } else if (taskCount > 0) {
      status = 'pending';
    } else {
      status = mapFeatureJsonStatus(feature.status);
    }

    // Try to extract spec summary
    let specSummary: string | undefined;
    if (hasSpec && featDir) {
      const specContent = readFile(path.join(featDir, 'spec.md'));
      specSummary = extractFirstParagraph(specContent) || undefined;
    }

    const updatedAt = featDir ? fileMtime(featDir) : goalJson.last_activity;

    records.push({
      id: featureId,
      type: 'feature',
      title: feature.title,
      status,
      goalId,
      createdAt: updatedAt,
      updatedAt,
      taskCount,
      completedTaskCount,
      hasSpec,
      hasDesign,
      specSummary,
      // Cross-reference fields
      sourceDirective: feature.source_directive ?? null,
      sourceBacklog: feature.source_backlog ?? null,
      dod: feature.dod ?? null,
      report: feature.report ?? null,
      refs: feature.refs ?? [],
    });
  }

  return records;
}

// ---------------------------------------------------------------------------
// Backlog Reader (from backlog.json — pure JSON, zero markdown parsing)
// ---------------------------------------------------------------------------

function readBacklog(goalDir: string, goalId: string): BacklogRecord[] {
  const backlogJsonPath = path.join(goalDir, 'backlog.json');
  const backlogJson = readJson(backlogJsonPath) as BacklogJsonFile | null;
  if (!backlogJson || !backlogJson.items) return [];

  return backlogJson.items.map(item => ({
    id: `${goalId}/${item.id}`,
    type: 'backlog-item' as const,
    title: item.title,
    status: mapBacklogStatus(item.status),
    goalId,
    createdAt: item.created,
    updatedAt: item.updated,
    priority: (item.priority === 'P0' || item.priority === 'P1' || item.priority === 'P2')
      ? item.priority as Priority : undefined,
    trigger: item.trigger,
    // Support both old (source) and new (source_directive) field names
    sourceDirective: item.source_directive ?? item.source ?? null,
    sourceContext: item.context,
    promotedToFeature: item.promoted_to_feature ?? null,
    promotedAt: item.promoted_at ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Lessons Reader (from .context/lessons.md + .context/lessons/*.md)
// ---------------------------------------------------------------------------

function parseLessons(conductorDir: string): LessonRecord[] {
  const lessons: LessonRecord[] = [];

  // Read the top-level lessons index
  const lessonsIndexPath = path.join(conductorDir, 'lessons.md');
  if (fileExists(lessonsIndexPath)) {
    const content = readFile(lessonsIndexPath);
    const title = extractFirstHeading(content) || 'Lessons Index';
    lessons.push({
      id: 'lessons-index',
      title,
      filePath: 'lessons.md',
      contentSummary: extractFirstParagraph(content) || undefined,
      topics: ['index'],
      updatedAt: fileMtime(lessonsIndexPath),
    });
  }

  // Read individual lesson topic files
  const lessonsDir = path.join(conductorDir, 'lessons');
  for (const file of listFiles(lessonsDir, '.md')) {
    const filePath = path.join(lessonsDir, file);
    const content = readFile(filePath);
    const title = extractFirstHeading(content) || file.replace('.md', '');
    const id = file.replace('.md', '');

    lessons.push({
      id,
      title,
      filePath: `lessons/${file}`,
      contentSummary: content.slice(0, 200).trim() || undefined,
      topics: [id],
      updatedAt: fileMtime(filePath),
    });
  }

  return lessons;
}

// ---------------------------------------------------------------------------
// Conductor Parser (reads directive.json + markdown for titles/summaries)
// ---------------------------------------------------------------------------

function parseConductorArtifacts(conductorDir: string): {
  directives: DirectiveRecord[];
  reports: ArtifactRecord[];
  discussions: ArtifactRecord[];
  research: ArtifactRecord[];
  lessons: LessonRecord[];
} {
  const directives: DirectiveRecord[] = [];
  const reports: ArtifactRecord[] = [];
  const discussions: ArtifactRecord[] = [];
  const research: ArtifactRecord[] = [];

  // Inbox directives
  const inboxDir = path.join(conductorDir, 'inbox');
  for (const file of listFiles(inboxDir, '.md')) {
    const name = file.replace('.md', '');
    const filePath = path.join(inboxDir, file);
    const jsonPath = path.join(inboxDir, `${name}.json`);
    const directiveJson = readJson(jsonPath) as DirectiveJsonFile | null;

    const content = readFile(filePath);
    const title = directiveJson?.title || extractFirstHeading(content) || name;
    const id = `directive/inbox/${name}`;

    const artifactsDir = path.join(path.dirname(conductorDir), 'artifacts', name);
    const artifactFiles = dirExists(artifactsDir)
      ? fs.readdirSync(artifactsDir).filter(f => !f.startsWith('.')).map(f => f.replace(/\.[^.]+$/, ''))
      : [];

    directives.push({
      id,
      type: 'directive',
      title,
      status: directiveJson ? mapDirectiveStatus(directiveJson.status) : 'pending',
      createdAt: directiveJson?.created || fileMtime(filePath),
      updatedAt: fileMtime(filePath),
      initiatives: [],
      // Structured fields from directive.json
      weight: directiveJson?.weight,
      goalIds: directiveJson?.goal_ids ?? [],
      producedFeatures: directiveJson?.produced_features ?? [],
      report: directiveJson?.report ?? null,
      backlogSources: directiveJson?.backlog_sources ?? [],
      artifacts: artifactFiles.length > 0 ? artifactFiles : undefined,
    });
  }

  // Done directives
  const doneDir = path.join(conductorDir, 'done');
  for (const file of listFiles(doneDir, '.md')) {
    const name = file.replace('.md', '');
    const filePath = path.join(doneDir, file);
    const jsonPath = path.join(doneDir, `${name}.json`);
    const directiveJson = readJson(jsonPath) as DirectiveJsonFile | null;

    const content = readFile(filePath);
    const title = directiveJson?.title || extractFirstHeading(content) || name;
    const id = `directive/done/${name}`;

    const artifactsDir = path.join(path.dirname(conductorDir), 'artifacts', name);
    const artifactFiles = dirExists(artifactsDir)
      ? fs.readdirSync(artifactsDir).filter(f => !f.startsWith('.')).map(f => f.replace(/\.[^.]+$/, ''))
      : [];

    directives.push({
      id,
      type: 'directive',
      title,
      status: directiveJson ? mapDirectiveStatus(directiveJson.status) : 'done',
      createdAt: directiveJson?.created || fileMtime(filePath),
      updatedAt: fileMtime(filePath),
      initiatives: [],
      weight: directiveJson?.weight,
      goalIds: directiveJson?.goal_ids ?? [],
      producedFeatures: directiveJson?.produced_features ?? [],
      report: directiveJson?.report ?? null,
      backlogSources: directiveJson?.backlog_sources ?? [],
      artifacts: artifactFiles.length > 0 ? artifactFiles : undefined,
    });
  }

  // Reports
  const reportsDir = path.join(conductorDir, 'reports');
  for (const file of listFiles(reportsDir, '.md')) {
    const filePath = path.join(reportsDir, file);
    const content = readFile(filePath);
    const title = extractFirstHeading(content) || file.replace('.md', '');
    const id = `report/${file.replace('.md', '')}`;

    const directiveMatch = file.match(/^(.+?)(?:-v\d+)?-\d{4}-\d{2}-\d{2}\.md$/);
    const sourceDirective = directiveMatch ? directiveMatch[1] : undefined;

    reports.push({
      id,
      type: 'report',
      title,
      status: 'done',
      filePath: path.relative(conductorDir, filePath),
      createdAt: fileMtime(filePath),
      updatedAt: fileMtime(filePath),
      sourceDirective,
      contentSummary: extractFirstParagraph(content) || undefined,
    });
  }

  // Discussions
  const discussionsDir = path.join(conductorDir, 'discussions');
  for (const file of listFiles(discussionsDir, '.md')) {
    const filePath = path.join(discussionsDir, file);
    const content = readFile(filePath);
    const title = extractFirstHeading(content) || file.replace('.md', '');
    const id = `discussion/${file.replace('.md', '')}`;

    discussions.push({
      id,
      type: 'discussion',
      title,
      status: 'done',
      filePath: path.relative(conductorDir, filePath),
      createdAt: fileMtime(filePath),
      updatedAt: fileMtime(filePath),
      contentSummary: extractFirstParagraph(content) || undefined,
    });
  }

  // Intelligence (research)
  const intelDir = path.join(conductorDir, 'intelligence');
  for (const file of listFiles(intelDir, '.md')) {
    const filePath = path.join(intelDir, file);
    const content = readFile(filePath);
    const title = extractFirstHeading(content) || file.replace('.md', '');
    const id = `research/${file.replace('.md', '')}`;

    research.push({
      id,
      type: 'research',
      title,
      status: 'done',
      filePath: path.relative(conductorDir, filePath),
      createdAt: fileMtime(filePath),
      updatedAt: fileMtime(filePath),
      contentSummary: extractFirstParagraph(content) || undefined,
    });
  }

  // Lessons
  const lessons = parseLessons(conductorDir);

  return { directives, reports, discussions, research, lessons };
}

// ---------------------------------------------------------------------------
// Reverse Reference Builder
// ---------------------------------------------------------------------------

function buildReferenceMap(
  directives: DirectiveRecord[],
  features: FeatureRecord[],
  backlogItems: BacklogRecord[],
): ReferenceMap {
  const refs: ReferenceMap = {
    directiveToFeatures: {},
    featureToDirective: {},
    directiveToGoals: {},
    goalToDirectives: {},
    backlogToFeature: {},
    featureToBacklog: {},
  };

  // From directive.json produced_features
  for (const d of directives) {
    const directiveName = d.id.split('/').pop() || '';
    if (d.producedFeatures && d.producedFeatures.length > 0) {
      refs.directiveToFeatures[directiveName] = d.producedFeatures;
      for (const fid of d.producedFeatures) {
        refs.featureToDirective[fid] = directiveName;
      }
    }
    if (d.goalIds && d.goalIds.length > 0) {
      refs.directiveToGoals[directiveName] = d.goalIds;
      for (const gid of d.goalIds) {
        if (!refs.goalToDirectives[gid]) refs.goalToDirectives[gid] = [];
        if (!refs.goalToDirectives[gid].includes(directiveName)) {
          refs.goalToDirectives[gid].push(directiveName);
        }
      }
    }
  }

  // From feature source_directive
  for (const f of features) {
    if (f.sourceDirective) {
      refs.featureToDirective[f.id] = f.sourceDirective;
      if (!refs.directiveToFeatures[f.sourceDirective]) {
        refs.directiveToFeatures[f.sourceDirective] = [];
      }
      if (!refs.directiveToFeatures[f.sourceDirective].includes(f.id)) {
        refs.directiveToFeatures[f.sourceDirective].push(f.id);
      }
    }
    if (f.sourceBacklog) {
      refs.featureToBacklog[f.id] = f.sourceBacklog;
      refs.backlogToFeature[f.sourceBacklog] = f.id;
    }
  }

  // From backlog promoted_to_feature
  for (const b of backlogItems) {
    if (b.promotedToFeature) {
      refs.backlogToFeature[b.id] = b.promotedToFeature;
      refs.featureToBacklog[b.promotedToFeature] = b.id;
    }
  }

  return refs;
}

// ---------------------------------------------------------------------------
// Validation Warnings
// ---------------------------------------------------------------------------

function printValidationWarnings(
  features: FeatureRecord[],
  directives: DirectiveRecord[],
): void {
  const warnings: string[] = [];

  // Orphan features (no source_directive and no source_backlog)
  const activeOrphanFeatures = features.filter(
    f => f.status !== 'done' && !f.sourceDirective && !f.sourceBacklog
  );
  if (activeOrphanFeatures.length > 0) {
    warnings.push(`  WARN: ${activeOrphanFeatures.length} active feature(s) with no source_directive or source_backlog:`);
    for (const f of activeOrphanFeatures) {
      warnings.push(`    - ${f.id}: "${f.title}"`);
    }
  }

  // Orphan directives (empty goal_ids)
  const orphanDirectives = directives.filter(
    d => (!d.goalIds || d.goalIds.length === 0)
  );
  if (orphanDirectives.length > 0) {
    warnings.push(`  WARN: ${orphanDirectives.length} directive(s) with no goal_ids:`);
    for (const d of orphanDirectives) {
      warnings.push(`    - ${d.id}: "${d.title}"`);
    }
  }

  // Active features missing DOD
  const activeFeaturesNoDod = features.filter(
    f => f.status !== 'done' && !f.dod
  );
  if (activeFeaturesNoDod.length > 0) {
    warnings.push(`  WARN: ${activeFeaturesNoDod.length} active feature(s) missing DOD:`);
    for (const f of activeFeaturesNoDod) {
      warnings.push(`    - ${f.id}: "${f.title}"`);
    }
  }

  if (warnings.length > 0) {
    console.log(`\nValidation Warnings:`);
    for (const w of warnings) {
      console.log(w);
    }
  }
}

// ---------------------------------------------------------------------------
// Main Indexer
// ---------------------------------------------------------------------------

function indexState(contextPath: string): void {
  const goalsDir = path.join(contextPath, 'goals');
  const conductorDir = path.resolve(__dirname, '../.context');
  const stateDir = path.join(contextPath, 'state');

  // Ensure state directory exists
  fs.mkdirSync(stateDir, { recursive: true });

  const generated = new Date().toISOString();

  // ---------------------------------------------------------------------------
  // Goals — read from goal.json (single source of truth)
  // ---------------------------------------------------------------------------
  const goalRecords: GoalRecord[] = [];
  const allFeatures: FeatureRecord[] = [];
  const allTasks: TaskRecord[] = [];
  const allBacklogItems: BacklogRecord[] = [];

  const goalDirs = listDirs(goalsDir);

  for (const goalId of goalDirs) {
    const goalDir = path.join(goalsDir, goalId);

    // Read goal.json — the single source of truth for goal metadata
    const goalJsonPath = path.join(goalDir, 'goal.json');
    const goalJson = readJson(goalJsonPath) as GoalJsonFile | null;

    if (!goalJson) {
      console.warn(`  WARN: ${goalId} has no goal.json — skipping`);
      continue;
    }

    // Features — from goal.json + filesystem enrichment (spec/design/tasks)
    const features = readFeatures(goalDir, goalId, goalJson);
    allFeatures.push(...features);

    // Tasks — from tasks.json in feature directories
    for (const subdir of ['active', 'done'] as const) {
      const dir = path.join(goalDir, subdir);
      for (const featureName of listDirs(dir)) {
        const tasksPath = path.join(dir, featureName, 'tasks.json');
        if (fileExists(tasksPath)) {
          allTasks.push(...readTasks(tasksPath, goalId, featureName));
        }
      }
    }

    // Goal-level tasks.json (scope=goal)
    const goalTasksPath = path.join(goalDir, 'tasks.json');
    if (fileExists(goalTasksPath)) {
      allTasks.push(...readGoalTasks(goalTasksPath, goalId));
    }

    // Backlog — from backlog.json (zero markdown parsing)
    const backlogItems = readBacklog(goalDir, goalId);
    allBacklogItems.push(...backlogItems);

    // Filesystem checks for goal-level files
    const goalMdPath = path.join(goalDir, 'goal.md');
    const backlogJsonPath = path.join(goalDir, 'backlog.json');

    goalRecords.push({
      id: goalId,
      type: 'goal',
      title: goalJson.title,
      status: mapGoalJsonState(goalJson.state),
      createdAt: goalJson.created,
      updatedAt: goalJson.last_activity,
      description: goalJson.description,
      category: goalJson.category,
      goalState: goalJson.state,
      activeFeatures: features.filter(f => f.status !== 'done').map(f => f.id),
      doneFeatures: features.filter(f => f.status === 'done').map(f => f.id),
      backlogCount: backlogItems.length,
      hasOkrs: !!goalJson.okrs_file || fileExists(path.join(goalDir, 'okrs.md')),
      hasGoalMd: fileExists(goalMdPath),
      hasGoalJson: true,
      hasBacklog: fileExists(backlogJsonPath) && backlogItems.length > 0,
    });
  }

  // ---------------------------------------------------------------------------
  // Conductor artifacts (directive.json + markdown content)
  // ---------------------------------------------------------------------------
  const conductor = dirExists(conductorDir)
    ? parseConductorArtifacts(conductorDir)
    : { directives: [], reports: [], discussions: [], research: [], lessons: [] };

  // ---------------------------------------------------------------------------
  // Build reverse reference maps
  // ---------------------------------------------------------------------------
  const references = buildReferenceMap(conductor.directives, allFeatures, allBacklogItems);

  // ---------------------------------------------------------------------------
  // Validation warnings
  // ---------------------------------------------------------------------------
  printValidationWarnings(allFeatures, conductor.directives);

  // ---------------------------------------------------------------------------
  // Write state files
  // ---------------------------------------------------------------------------

  const goalsState = {
    generated,
    goals: goalRecords,
  };

  const featuresState = {
    generated,
    features: allFeatures,
  };

  const backlogsState = {
    generated,
    items: allBacklogItems,
  };

  const conductorState = {
    generated,
    directives: conductor.directives,
    reports: conductor.reports,
    discussions: conductor.discussions,
    research: conductor.research,
    lessons: conductor.lessons,
  };

  const pendingTasks = allTasks.filter(t => t.status !== 'done').length;
  const completedTasks = allTasks.filter(t => t.status === 'done').length;

  const stateIndex = {
    generated,
    counts: {
      goals: goalRecords.length,
      goalsWithJson: goalRecords.length,
      activeFeatures: allFeatures.filter(f => f.status !== 'done').length,
      doneFeatures: allFeatures.filter(f => f.status === 'done').length,
      pendingTasks,
      completedTasks,
      backlogItems: allBacklogItems.filter(b => b.status !== 'done').length,
      directives: conductor.directives.length,
      reports: conductor.reports.length,
      discussions: conductor.discussions.length,
      lessons: conductor.lessons.length,
    },
  };

  // Write files
  const writeJson = (name: string, data: unknown) => {
    const filePath = path.join(stateDir, name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  ${name}: written`);
  };

  console.log(`\nIndexing .context/ → .context/state/`);
  console.log(`  Context path: ${contextPath}\n`);

  writeJson('goals.json', goalsState);
  writeJson('features.json', featuresState);
  writeJson('backlogs.json', backlogsState);
  writeJson('conductor.json', conductorState);
  writeJson('references.json', references);
  writeJson('index.json', stateIndex);

  // Summary
  console.log(`\nSummary:`);
  console.log(`  Goals:           ${goalRecords.length}`);
  console.log(`  Features:        ${allFeatures.length} (${allFeatures.filter(f => f.status !== 'done').length} active, ${allFeatures.filter(f => f.status === 'done').length} done)`);
  console.log(`  Tasks:           ${allTasks.length} (${pendingTasks} pending, ${completedTasks} done)`);
  console.log(`  Backlog items:   ${allBacklogItems.length} (${allBacklogItems.filter(b => b.status !== 'done').length} pending)`);
  console.log(`  Directives:      ${conductor.directives.length}`);
  console.log(`  Reports:         ${conductor.reports.length}`);
  console.log(`  Discussions:     ${conductor.discussions.length}`);
  console.log(`  Research:        ${conductor.research.length}`);
  console.log(`  Lessons:         ${conductor.lessons.length}`);
  console.log(`  References:      ${Object.keys(references.directiveToFeatures).length} directive→feature, ${Object.keys(references.goalToDirectives).length} goal→directive`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let contextPath: string;

const pathArgIdx = args.indexOf('--context-path');
if (pathArgIdx !== -1 && args[pathArgIdx + 1]) {
  contextPath = args[pathArgIdx + 1];
} else {
  // Default: .context/ in current working directory
  contextPath = path.join(process.cwd(), '.context');
}

if (!dirExists(contextPath)) {
  console.error(`Error: Context directory not found: ${contextPath}`);
  process.exit(1);
}

indexState(contextPath);

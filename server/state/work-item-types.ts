/**
 * Structured work item types for the conductor state system.
 *
 * These types replace free-form markdown as the queryable source of truth.
 * The indexer (scripts/index-state.ts) reads .context/ and produces JSON
 * arrays of these records. The dashboard watches and serves them.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const WorkItemType = z.enum([
  'goal',
  'feature',
  'task',
  'backlog-item',
  'directive',
  'report',
  'discussion',
  'research',
]);
export type WorkItemType = z.infer<typeof WorkItemType>;

export const LifecycleState = z.enum([
  'pending',
  'in_progress',
  'blocked',
  'deferred',
  'completed',
  'abandoned',
]);
export type LifecycleState = z.infer<typeof LifecycleState>;

export const Priority = z.enum(['P0', 'P1', 'P2']);
export type Priority = z.infer<typeof Priority>;

// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------

export const BaseWorkItem = z.object({
  id: z.string(),
  type: WorkItemType,
  title: z.string(),
  status: LifecycleState,
  parentId: z.string().optional(),
  goalId: z.string().optional(),
  createdAt: z.string(),   // ISO date
  updatedAt: z.string(),   // ISO date
  tags: z.array(z.string()).optional(),
});
export type BaseWorkItem = z.infer<typeof BaseWorkItem>;

// ---------------------------------------------------------------------------
// Extended types (discriminated on `type`)
// ---------------------------------------------------------------------------

export const GoalRecord = BaseWorkItem.extend({
  type: z.literal('goal'),
  description: z.string().optional(),
  category: z.string().optional(),
  activeFeatures: z.array(z.string()),      // project IDs (legacy name kept for compat)
  doneFeatures: z.array(z.string()),        // project IDs (legacy name kept for compat)
  backlogCount: z.number(),
  hasOkrs: z.boolean(),
  hasGoalMd: z.boolean(),
  hasGoalJson: z.boolean(),
  hasBacklog: z.boolean(),
  issues: z.array(z.string()).optional(),
  repoId: z.string().optional(),            // project/repo identifier (e.g. "wisely", "agent-conductor")
  repoName: z.string().optional(),          // display name (e.g. "Wisely", "Agent Conductor")
});
export type GoalRecord = z.infer<typeof GoalRecord>;

export const FeatureRecord = BaseWorkItem.extend({
  type: z.literal('feature'),
  goalId: z.string(),
  taskCount: z.number(),
  completedTaskCount: z.number(),
  hasSpec: z.boolean(),
  hasDesign: z.boolean(),
  specSummary: z.string().optional(),
  repoId: z.string().optional(),
  repoName: z.string().optional(),
});
export type FeatureRecord = z.infer<typeof FeatureRecord>;

export const TaskRecord = BaseWorkItem.extend({
  type: z.literal('task'),
  featureId: z.string(),
  deps: z.array(z.string()),
  files: z.array(z.string()),
  role: z.string().optional(),
});
export type TaskRecord = z.infer<typeof TaskRecord>;

export const BacklogRecord = BaseWorkItem.extend({
  type: z.literal('backlog-item'),
  goalId: z.string(),
  priority: Priority.optional(),
  description: z.string().optional(),
  trigger: z.string().optional(),
  sourceContext: z.string().optional(),
  sourceDirective: z.string().optional(),
  repoId: z.string().optional(),
  repoName: z.string().optional(),
});
export type BacklogRecord = z.infer<typeof BacklogRecord>;

export const DirectiveRecord = BaseWorkItem.extend({
  type: z.literal('directive'),
  initiatives: z.array(z.string()),
  checkpoint: z.string().optional(),
  reportPath: z.string().optional(),
  // Structured fields from directive.json
  weight: z.string().optional(),
  goalIds: z.array(z.string()).optional(),
  producedFeatures: z.array(z.string()).optional(),
  report: z.string().nullable().optional(),
  backlogSources: z.array(z.string()).optional(),
  artifacts: z.array(z.string()).optional(),
});
export type DirectiveRecord = z.infer<typeof DirectiveRecord>;

export const LessonRecord = z.object({
  id: z.string(),
  title: z.string(),
  filePath: z.string(),
  contentSummary: z.string().optional(),
  topics: z.array(z.string()).optional(),
  updatedAt: z.string(),
});
export type LessonRecord = z.infer<typeof LessonRecord>;

export const ArtifactRecord = BaseWorkItem.extend({
  type: z.literal('report').or(z.literal('discussion')).or(z.literal('research')),
  participants: z.array(z.string()).optional(),
  sourceDirective: z.string().optional(),
  filePath: z.string(),
  contentSummary: z.string().optional(),
});
export type ArtifactRecord = z.infer<typeof ArtifactRecord>;

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export const WorkItem = z.discriminatedUnion('type', [
  GoalRecord,
  FeatureRecord,
  TaskRecord,
  BacklogRecord,
  DirectiveRecord,
  // ArtifactRecord covers report, discussion, research — but discriminatedUnion
  // needs literal type values, so we split:
  BaseWorkItem.extend({
    type: z.literal('report'),
    participants: z.array(z.string()).optional(),
    sourceDirective: z.string().optional(),
    filePath: z.string(),
    contentSummary: z.string().optional(),
  }),
  BaseWorkItem.extend({
    type: z.literal('discussion'),
    participants: z.array(z.string()).optional(),
    sourceDirective: z.string().optional(),
    filePath: z.string(),
    contentSummary: z.string().optional(),
  }),
  BaseWorkItem.extend({
    type: z.literal('research'),
    participants: z.array(z.string()).optional(),
    sourceDirective: z.string().optional(),
    filePath: z.string(),
    contentSummary: z.string().optional(),
  }),
]);
export type WorkItem = z.infer<typeof WorkItem>;

// ---------------------------------------------------------------------------
// State file schemas (what the JSON files contain)
// ---------------------------------------------------------------------------

export const GoalsState = z.object({
  generated: z.string(),
  goals: z.array(GoalRecord),
});
export type GoalsState = z.infer<typeof GoalsState>;

export const FeaturesState = z.object({
  generated: z.string(),
  features: z.array(FeatureRecord),
});
export type FeaturesState = z.infer<typeof FeaturesState>;

export const BacklogsState = z.object({
  generated: z.string(),
  items: z.array(BacklogRecord),
});
export type BacklogsState = z.infer<typeof BacklogsState>;

export const ConductorState = z.object({
  generated: z.string(),
  directives: z.array(DirectiveRecord),
  reports: z.array(ArtifactRecord),
  discussions: z.array(ArtifactRecord),
  research: z.array(ArtifactRecord),
  lessons: z.array(LessonRecord).optional(),
});
export type ConductorState = z.infer<typeof ConductorState>;

export const IndexState = z.object({
  generated: z.string(),
  counts: z.object({
    goals: z.number(),
    activeFeatures: z.number(),
    doneFeatures: z.number(),
    pendingTasks: z.number(),
    completedTasks: z.number(),
    backlogItems: z.number(),
    directives: z.number(),
    reports: z.number(),
    discussions: z.number(),
    lessons: z.number().optional(),
  }),
});
export type IndexState = z.infer<typeof IndexState>;

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export interface WorkItemFilter {
  type?: WorkItemType;
  status?: LifecycleState;
  goalId?: string;
  q?: string;  // text search
}

/** All state loaded from .context/state/ */
export interface FullWorkState {
  goals: GoalsState | null;
  features: FeaturesState | null;
  backlogs: BacklogsState | null;
  conductor: ConductorState | null;
  index: IndexState | null;
}

/**
 * Structured work item types for the conductor state system.
 *
 * These types replace free-form markdown as the queryable source of truth.
 * The aggregator reads .context/ and produces typed records in memory.
 * The dashboard watches and serves them via WebSocket.
 */
import { z } from 'zod';
// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const WorkItemType = z.enum([
    'feature',
    'task',
    'backlog-item',
    'directive',
    'report',
    'discussion',
    'research',
]);
export const LifecycleState = z.enum([
    'pending',
    'in_progress',
    'blocked',
    'deferred',
    'completed',
    'abandoned',
]);
export const Priority = z.enum(['P0', 'P1', 'P2']);
// ---------------------------------------------------------------------------
// Base schema
// ---------------------------------------------------------------------------
export const BaseWorkItem = z.object({
    id: z.string(),
    type: WorkItemType,
    title: z.string(),
    status: LifecycleState,
    parentId: z.string().optional(),
    createdAt: z.string(), // ISO date
    updatedAt: z.string(), // ISO date
    tags: z.array(z.string()).optional(),
});
// ---------------------------------------------------------------------------
// Extended types (discriminated on `type`)
// ---------------------------------------------------------------------------
export const FeatureRecord = BaseWorkItem.extend({
    type: z.literal('feature'),
    taskCount: z.number(),
    completedTaskCount: z.number(),
    hasSpec: z.boolean(),
    hasDesign: z.boolean(),
    specSummary: z.string().optional(),
    repoId: z.string().optional(),
    repoName: z.string().optional(),
});
export const TaskRecord = BaseWorkItem.extend({
    type: z.literal('task'),
    featureId: z.string(),
    deps: z.array(z.string()),
    files: z.array(z.string()),
    role: z.string().optional(),
});
export const BacklogRecord = BaseWorkItem.extend({
    type: z.literal('backlog-item'),
    priority: Priority.optional(),
    description: z.string().optional(),
    trigger: z.string().optional(),
    sourceContext: z.string().optional(),
    sourceDirective: z.string().optional(),
    repoId: z.string().optional(),
    repoName: z.string().optional(),
});
export const DirectiveRecord = BaseWorkItem.extend({
    type: z.literal('directive'),
    projects: z.array(z.string()),
    checkpoint: z.string().optional(),
    reportPath: z.string().optional(),
    // Structured fields from directive.json
    weight: z.string().optional(),
    producedFeatures: z.array(z.string()).optional(),
    report: z.string().nullable().optional(),
    backlogSources: z.array(z.string()).optional(),
    artifacts: z.array(z.string()).optional(),
});
export const LessonRecord = z.object({
    id: z.string(),
    title: z.string(),
    filePath: z.string(),
    contentSummary: z.string().optional(),
    topics: z.array(z.string()).optional(),
    updatedAt: z.string(),
});
export const ArtifactRecord = BaseWorkItem.extend({
    type: z.literal('report').or(z.literal('discussion')).or(z.literal('research')),
    participants: z.array(z.string()).optional(),
    sourceDirective: z.string().optional(),
    filePath: z.string(),
    contentSummary: z.string().optional(),
});
// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------
export const WorkItem = z.discriminatedUnion('type', [
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
// ---------------------------------------------------------------------------
// State file schemas (what the JSON files contain)
// ---------------------------------------------------------------------------
export const FeaturesState = z.object({
    generated: z.string(),
    features: z.array(FeatureRecord),
});
export const BacklogsState = z.object({
    generated: z.string(),
    items: z.array(BacklogRecord),
});
export const ConductorState = z.object({
    generated: z.string(),
    directives: z.array(DirectiveRecord),
    reports: z.array(ArtifactRecord),
    discussions: z.array(ArtifactRecord),
    research: z.array(ArtifactRecord),
    lessons: z.array(LessonRecord).optional(),
});
export const IndexState = z.object({
    generated: z.string(),
    counts: z.object({
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

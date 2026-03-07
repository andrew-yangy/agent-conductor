/**
 * Structured work item types for the conductor state system.
 *
 * These types replace free-form markdown as the queryable source of truth.
 * The aggregator reads .context/ and produces typed records in memory.
 * The dashboard watches and serves them via WebSocket.
 */
import { z } from 'zod';
export declare const WorkItemType: z.ZodEnum<["feature", "task", "backlog-item", "directive", "report", "discussion", "research"]>;
export type WorkItemType = z.infer<typeof WorkItemType>;
export declare const LifecycleState: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
export type LifecycleState = z.infer<typeof LifecycleState>;
export declare const Priority: z.ZodEnum<["P0", "P1", "P2"]>;
export type Priority = z.infer<typeof Priority>;
export declare const BaseWorkItem: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["feature", "task", "backlog-item", "directive", "report", "discussion", "research"]>;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "feature" | "task" | "backlog-item" | "directive" | "report" | "discussion" | "research";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "feature" | "task" | "backlog-item" | "directive" | "report" | "discussion" | "research";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
}>;
export type BaseWorkItem = z.infer<typeof BaseWorkItem>;
export declare const FeatureRecord: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"feature">;
    taskCount: z.ZodNumber;
    completedTaskCount: z.ZodNumber;
    hasSpec: z.ZodBoolean;
    hasDesign: z.ZodBoolean;
    specSummary: z.ZodOptional<z.ZodString>;
    repoId: z.ZodOptional<z.ZodString>;
    repoName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "feature";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    taskCount: number;
    completedTaskCount: number;
    hasSpec: boolean;
    hasDesign: boolean;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    specSummary?: string | undefined;
    repoId?: string | undefined;
    repoName?: string | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "feature";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    taskCount: number;
    completedTaskCount: number;
    hasSpec: boolean;
    hasDesign: boolean;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    specSummary?: string | undefined;
    repoId?: string | undefined;
    repoName?: string | undefined;
}>;
export type FeatureRecord = z.infer<typeof FeatureRecord>;
export declare const TaskRecord: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"task">;
    featureId: z.ZodString;
    deps: z.ZodArray<z.ZodString, "many">;
    files: z.ZodArray<z.ZodString, "many">;
    role: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "task";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    featureId: string;
    deps: string[];
    files: string[];
    parentId?: string | undefined;
    tags?: string[] | undefined;
    role?: string | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "task";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    featureId: string;
    deps: string[];
    files: string[];
    parentId?: string | undefined;
    tags?: string[] | undefined;
    role?: string | undefined;
}>;
export type TaskRecord = z.infer<typeof TaskRecord>;
export declare const BacklogRecord: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"backlog-item">;
    priority: z.ZodOptional<z.ZodEnum<["P0", "P1", "P2"]>>;
    description: z.ZodOptional<z.ZodString>;
    trigger: z.ZodOptional<z.ZodString>;
    sourceContext: z.ZodOptional<z.ZodString>;
    sourceDirective: z.ZodOptional<z.ZodString>;
    repoId: z.ZodOptional<z.ZodString>;
    repoName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "backlog-item";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    repoId?: string | undefined;
    repoName?: string | undefined;
    priority?: "P0" | "P1" | "P2" | undefined;
    description?: string | undefined;
    trigger?: string | undefined;
    sourceContext?: string | undefined;
    sourceDirective?: string | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "backlog-item";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    repoId?: string | undefined;
    repoName?: string | undefined;
    priority?: "P0" | "P1" | "P2" | undefined;
    description?: string | undefined;
    trigger?: string | undefined;
    sourceContext?: string | undefined;
    sourceDirective?: string | undefined;
}>;
export type BacklogRecord = z.infer<typeof BacklogRecord>;
export declare const DirectiveRecord: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"directive">;
    projects: z.ZodArray<z.ZodString, "many">;
    checkpoint: z.ZodOptional<z.ZodString>;
    reportPath: z.ZodOptional<z.ZodString>;
    weight: z.ZodOptional<z.ZodString>;
    producedFeatures: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    report: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    backlogSources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    artifacts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    projects: string[];
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "directive";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    report?: string | null | undefined;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    checkpoint?: string | undefined;
    reportPath?: string | undefined;
    weight?: string | undefined;
    producedFeatures?: string[] | undefined;
    backlogSources?: string[] | undefined;
    artifacts?: string[] | undefined;
}, {
    projects: string[];
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "directive";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    report?: string | null | undefined;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    checkpoint?: string | undefined;
    reportPath?: string | undefined;
    weight?: string | undefined;
    producedFeatures?: string[] | undefined;
    backlogSources?: string[] | undefined;
    artifacts?: string[] | undefined;
}>;
export type DirectiveRecord = z.infer<typeof DirectiveRecord>;
export declare const LessonRecord: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    filePath: z.ZodString;
    contentSummary: z.ZodOptional<z.ZodString>;
    topics: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filePath: string;
    id: string;
    title: string;
    updatedAt: string;
    contentSummary?: string | undefined;
    topics?: string[] | undefined;
}, {
    filePath: string;
    id: string;
    title: string;
    updatedAt: string;
    contentSummary?: string | undefined;
    topics?: string[] | undefined;
}>;
export type LessonRecord = z.infer<typeof LessonRecord>;
export declare const ArtifactRecord: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"report">, z.ZodLiteral<"discussion">]>, z.ZodLiteral<"research">]>;
    participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sourceDirective: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    contentSummary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    filePath: string;
    type: "report" | "discussion" | "research";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    sourceDirective?: string | undefined;
    contentSummary?: string | undefined;
    participants?: string[] | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    filePath: string;
    type: "report" | "discussion" | "research";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    sourceDirective?: string | undefined;
    contentSummary?: string | undefined;
    participants?: string[] | undefined;
}>;
export type ArtifactRecord = z.infer<typeof ArtifactRecord>;
export declare const WorkItem: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"feature">;
    taskCount: z.ZodNumber;
    completedTaskCount: z.ZodNumber;
    hasSpec: z.ZodBoolean;
    hasDesign: z.ZodBoolean;
    specSummary: z.ZodOptional<z.ZodString>;
    repoId: z.ZodOptional<z.ZodString>;
    repoName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "feature";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    taskCount: number;
    completedTaskCount: number;
    hasSpec: boolean;
    hasDesign: boolean;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    specSummary?: string | undefined;
    repoId?: string | undefined;
    repoName?: string | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "feature";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    taskCount: number;
    completedTaskCount: number;
    hasSpec: boolean;
    hasDesign: boolean;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    specSummary?: string | undefined;
    repoId?: string | undefined;
    repoName?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"task">;
    featureId: z.ZodString;
    deps: z.ZodArray<z.ZodString, "many">;
    files: z.ZodArray<z.ZodString, "many">;
    role: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "task";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    featureId: string;
    deps: string[];
    files: string[];
    parentId?: string | undefined;
    tags?: string[] | undefined;
    role?: string | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "task";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    featureId: string;
    deps: string[];
    files: string[];
    parentId?: string | undefined;
    tags?: string[] | undefined;
    role?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"backlog-item">;
    priority: z.ZodOptional<z.ZodEnum<["P0", "P1", "P2"]>>;
    description: z.ZodOptional<z.ZodString>;
    trigger: z.ZodOptional<z.ZodString>;
    sourceContext: z.ZodOptional<z.ZodString>;
    sourceDirective: z.ZodOptional<z.ZodString>;
    repoId: z.ZodOptional<z.ZodString>;
    repoName: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "backlog-item";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    repoId?: string | undefined;
    repoName?: string | undefined;
    priority?: "P0" | "P1" | "P2" | undefined;
    description?: string | undefined;
    trigger?: string | undefined;
    sourceContext?: string | undefined;
    sourceDirective?: string | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "backlog-item";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    repoId?: string | undefined;
    repoName?: string | undefined;
    priority?: "P0" | "P1" | "P2" | undefined;
    description?: string | undefined;
    trigger?: string | undefined;
    sourceContext?: string | undefined;
    sourceDirective?: string | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"directive">;
    projects: z.ZodArray<z.ZodString, "many">;
    checkpoint: z.ZodOptional<z.ZodString>;
    reportPath: z.ZodOptional<z.ZodString>;
    weight: z.ZodOptional<z.ZodString>;
    producedFeatures: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    report: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    backlogSources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    artifacts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    projects: string[];
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "directive";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    report?: string | null | undefined;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    checkpoint?: string | undefined;
    reportPath?: string | undefined;
    weight?: string | undefined;
    producedFeatures?: string[] | undefined;
    backlogSources?: string[] | undefined;
    artifacts?: string[] | undefined;
}, {
    projects: string[];
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    type: "directive";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    report?: string | null | undefined;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    checkpoint?: string | undefined;
    reportPath?: string | undefined;
    weight?: string | undefined;
    producedFeatures?: string[] | undefined;
    backlogSources?: string[] | undefined;
    artifacts?: string[] | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"report">;
    participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sourceDirective: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    contentSummary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    filePath: string;
    type: "report";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    sourceDirective?: string | undefined;
    contentSummary?: string | undefined;
    participants?: string[] | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    filePath: string;
    type: "report";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    sourceDirective?: string | undefined;
    contentSummary?: string | undefined;
    participants?: string[] | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"discussion">;
    participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sourceDirective: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    contentSummary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    filePath: string;
    type: "discussion";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    sourceDirective?: string | undefined;
    contentSummary?: string | undefined;
    participants?: string[] | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    filePath: string;
    type: "discussion";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    sourceDirective?: string | undefined;
    contentSummary?: string | undefined;
    participants?: string[] | undefined;
}>, z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
    parentId: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
} & {
    type: z.ZodLiteral<"research">;
    participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    sourceDirective: z.ZodOptional<z.ZodString>;
    filePath: z.ZodString;
    contentSummary: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    filePath: string;
    type: "research";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    sourceDirective?: string | undefined;
    contentSummary?: string | undefined;
    participants?: string[] | undefined;
}, {
    status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
    filePath: string;
    type: "research";
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    parentId?: string | undefined;
    tags?: string[] | undefined;
    sourceDirective?: string | undefined;
    contentSummary?: string | undefined;
    participants?: string[] | undefined;
}>]>;
export type WorkItem = z.infer<typeof WorkItem>;
export declare const FeaturesState: z.ZodObject<{
    generated: z.ZodString;
    features: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
        parentId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodLiteral<"feature">;
        taskCount: z.ZodNumber;
        completedTaskCount: z.ZodNumber;
        hasSpec: z.ZodBoolean;
        hasDesign: z.ZodBoolean;
        specSummary: z.ZodOptional<z.ZodString>;
        repoId: z.ZodOptional<z.ZodString>;
        repoName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "feature";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        taskCount: number;
        completedTaskCount: number;
        hasSpec: boolean;
        hasDesign: boolean;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        specSummary?: string | undefined;
        repoId?: string | undefined;
        repoName?: string | undefined;
    }, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "feature";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        taskCount: number;
        completedTaskCount: number;
        hasSpec: boolean;
        hasDesign: boolean;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        specSummary?: string | undefined;
        repoId?: string | undefined;
        repoName?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    generated: string;
    features: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "feature";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        taskCount: number;
        completedTaskCount: number;
        hasSpec: boolean;
        hasDesign: boolean;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        specSummary?: string | undefined;
        repoId?: string | undefined;
        repoName?: string | undefined;
    }[];
}, {
    generated: string;
    features: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "feature";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        taskCount: number;
        completedTaskCount: number;
        hasSpec: boolean;
        hasDesign: boolean;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        specSummary?: string | undefined;
        repoId?: string | undefined;
        repoName?: string | undefined;
    }[];
}>;
export type FeaturesState = z.infer<typeof FeaturesState>;
export declare const BacklogsState: z.ZodObject<{
    generated: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
        parentId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodLiteral<"backlog-item">;
        priority: z.ZodOptional<z.ZodEnum<["P0", "P1", "P2"]>>;
        description: z.ZodOptional<z.ZodString>;
        trigger: z.ZodOptional<z.ZodString>;
        sourceContext: z.ZodOptional<z.ZodString>;
        sourceDirective: z.ZodOptional<z.ZodString>;
        repoId: z.ZodOptional<z.ZodString>;
        repoName: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "backlog-item";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        repoId?: string | undefined;
        repoName?: string | undefined;
        priority?: "P0" | "P1" | "P2" | undefined;
        description?: string | undefined;
        trigger?: string | undefined;
        sourceContext?: string | undefined;
        sourceDirective?: string | undefined;
    }, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "backlog-item";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        repoId?: string | undefined;
        repoName?: string | undefined;
        priority?: "P0" | "P1" | "P2" | undefined;
        description?: string | undefined;
        trigger?: string | undefined;
        sourceContext?: string | undefined;
        sourceDirective?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    generated: string;
    items: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "backlog-item";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        repoId?: string | undefined;
        repoName?: string | undefined;
        priority?: "P0" | "P1" | "P2" | undefined;
        description?: string | undefined;
        trigger?: string | undefined;
        sourceContext?: string | undefined;
        sourceDirective?: string | undefined;
    }[];
}, {
    generated: string;
    items: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "backlog-item";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        repoId?: string | undefined;
        repoName?: string | undefined;
        priority?: "P0" | "P1" | "P2" | undefined;
        description?: string | undefined;
        trigger?: string | undefined;
        sourceContext?: string | undefined;
        sourceDirective?: string | undefined;
    }[];
}>;
export type BacklogsState = z.infer<typeof BacklogsState>;
export declare const ConductorState: z.ZodObject<{
    generated: z.ZodString;
    directives: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
        parentId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodLiteral<"directive">;
        projects: z.ZodArray<z.ZodString, "many">;
        checkpoint: z.ZodOptional<z.ZodString>;
        reportPath: z.ZodOptional<z.ZodString>;
        weight: z.ZodOptional<z.ZodString>;
        producedFeatures: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        report: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        backlogSources: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        artifacts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        projects: string[];
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "directive";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        report?: string | null | undefined;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        checkpoint?: string | undefined;
        reportPath?: string | undefined;
        weight?: string | undefined;
        producedFeatures?: string[] | undefined;
        backlogSources?: string[] | undefined;
        artifacts?: string[] | undefined;
    }, {
        projects: string[];
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "directive";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        report?: string | null | undefined;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        checkpoint?: string | undefined;
        reportPath?: string | undefined;
        weight?: string | undefined;
        producedFeatures?: string[] | undefined;
        backlogSources?: string[] | undefined;
        artifacts?: string[] | undefined;
    }>, "many">;
    reports: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
        parentId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"report">, z.ZodLiteral<"discussion">]>, z.ZodLiteral<"research">]>;
        participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sourceDirective: z.ZodOptional<z.ZodString>;
        filePath: z.ZodString;
        contentSummary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }>, "many">;
    discussions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
        parentId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"report">, z.ZodLiteral<"discussion">]>, z.ZodLiteral<"research">]>;
        participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sourceDirective: z.ZodOptional<z.ZodString>;
        filePath: z.ZodString;
        contentSummary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }>, "many">;
    research: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<["pending", "in_progress", "blocked", "deferred", "completed", "abandoned"]>;
        parentId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    } & {
        type: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"report">, z.ZodLiteral<"discussion">]>, z.ZodLiteral<"research">]>;
        participants: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        sourceDirective: z.ZodOptional<z.ZodString>;
        filePath: z.ZodString;
        contentSummary: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }, {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }>, "many">;
    lessons: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        filePath: z.ZodString;
        contentSummary: z.ZodOptional<z.ZodString>;
        topics: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        filePath: string;
        id: string;
        title: string;
        updatedAt: string;
        contentSummary?: string | undefined;
        topics?: string[] | undefined;
    }, {
        filePath: string;
        id: string;
        title: string;
        updatedAt: string;
        contentSummary?: string | undefined;
        topics?: string[] | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    directives: {
        projects: string[];
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "directive";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        report?: string | null | undefined;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        checkpoint?: string | undefined;
        reportPath?: string | undefined;
        weight?: string | undefined;
        producedFeatures?: string[] | undefined;
        backlogSources?: string[] | undefined;
        artifacts?: string[] | undefined;
    }[];
    research: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }[];
    generated: string;
    reports: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }[];
    discussions: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }[];
    lessons?: {
        filePath: string;
        id: string;
        title: string;
        updatedAt: string;
        contentSummary?: string | undefined;
        topics?: string[] | undefined;
    }[] | undefined;
}, {
    directives: {
        projects: string[];
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        type: "directive";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        report?: string | null | undefined;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        checkpoint?: string | undefined;
        reportPath?: string | undefined;
        weight?: string | undefined;
        producedFeatures?: string[] | undefined;
        backlogSources?: string[] | undefined;
        artifacts?: string[] | undefined;
    }[];
    research: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }[];
    generated: string;
    reports: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }[];
    discussions: {
        status: "pending" | "in_progress" | "completed" | "blocked" | "deferred" | "abandoned";
        filePath: string;
        type: "report" | "discussion" | "research";
        id: string;
        title: string;
        createdAt: string;
        updatedAt: string;
        parentId?: string | undefined;
        tags?: string[] | undefined;
        sourceDirective?: string | undefined;
        contentSummary?: string | undefined;
        participants?: string[] | undefined;
    }[];
    lessons?: {
        filePath: string;
        id: string;
        title: string;
        updatedAt: string;
        contentSummary?: string | undefined;
        topics?: string[] | undefined;
    }[] | undefined;
}>;
export type ConductorState = z.infer<typeof ConductorState>;
export declare const IndexState: z.ZodObject<{
    generated: z.ZodString;
    counts: z.ZodObject<{
        activeFeatures: z.ZodNumber;
        doneFeatures: z.ZodNumber;
        pendingTasks: z.ZodNumber;
        completedTasks: z.ZodNumber;
        backlogItems: z.ZodNumber;
        directives: z.ZodNumber;
        reports: z.ZodNumber;
        discussions: z.ZodNumber;
        lessons: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        directives: number;
        reports: number;
        discussions: number;
        activeFeatures: number;
        doneFeatures: number;
        pendingTasks: number;
        completedTasks: number;
        backlogItems: number;
        lessons?: number | undefined;
    }, {
        directives: number;
        reports: number;
        discussions: number;
        activeFeatures: number;
        doneFeatures: number;
        pendingTasks: number;
        completedTasks: number;
        backlogItems: number;
        lessons?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    generated: string;
    counts: {
        directives: number;
        reports: number;
        discussions: number;
        activeFeatures: number;
        doneFeatures: number;
        pendingTasks: number;
        completedTasks: number;
        backlogItems: number;
        lessons?: number | undefined;
    };
}, {
    generated: string;
    counts: {
        directives: number;
        reports: number;
        discussions: number;
        activeFeatures: number;
        doneFeatures: number;
        pendingTasks: number;
        completedTasks: number;
        backlogItems: number;
        lessons?: number | undefined;
    };
}>;
export type IndexState = z.infer<typeof IndexState>;
export interface WorkItemFilter {
    type?: WorkItemType;
    status?: LifecycleState;
    q?: string;
}
/** All state loaded from .context/state/ */
export interface FullWorkState {
    features: FeaturesState | null;
    backlogs: BacklogsState | null;
    conductor: ConductorState | null;
    index: IndexState | null;
}

export interface TeamTask {
    id: string;
    subject: string;
    description: string;
    activeForm: string;
    status: 'pending' | 'in_progress' | 'completed';
    owner: string;
    blocks: string[];
    blockedBy: string[];
}
export interface Session {
    id: string;
    project: string;
    projectDir: string;
    status: 'working' | 'waiting-approval' | 'waiting-input' | 'done' | 'paused' | 'idle' | 'error';
    lastActivity: string;
    feature?: string;
    model?: string;
    cwd?: string;
    gitBranch?: string;
    version?: string;
    slug?: string;
    initialPrompt?: string;
    latestPrompt?: string;
    tasksId?: string;
    paneId?: string;
    terminalApp?: 'iterm2' | 'warp' | 'terminal' | 'tmux' | 'unknown';
    isSubagent: boolean;
    parentSessionId?: string;
    agentId?: string;
    agentName?: string;
    agentRole?: string;
    subagentIds: string[];
    fileSize: number;
    /** True when a subagent has error/waiting status that needs parent attention */
    subagentAttention?: boolean;
    /** Names of active subagents (propagated from working parent) */
    activeSubagentNames?: string[];
}
export interface ProjectGroup {
    name: string;
    dirName: string;
    sessions: Session[];
}
export interface HookEvent {
    id: string;
    type: string;
    sessionId: string;
    timestamp: string;
    message: string;
    project?: string;
    metadata?: Record<string, unknown>;
}
export interface DirectiveProjectTask {
    title: string;
    status: string;
    agent?: string;
    dod?: Array<{
        criterion: string;
        met: boolean;
    }>;
}
export interface DirectiveProject {
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
    phase: 'audit' | 'design' | 'build' | 'review' | null;
    totalTasks?: number;
    completedTasks?: number;
    agent?: string[];
    reviewers?: string[];
    tasks?: DirectiveProjectTask[];
}
export type PipelineStepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'failed';
export interface PipelineStep {
    id: string;
    label: string;
    status: PipelineStepStatus;
    artifacts?: Record<string, string>;
    needsAction?: boolean;
    startedAt?: string;
}
export interface DirectiveState {
    directiveName: string;
    /** Human-readable title (from directive .json or .md heading) */
    title?: string;
    status: 'pending' | 'in_progress' | 'awaiting_completion' | 'completed' | 'failed';
    totalProjects: number;
    currentProject: number;
    currentPhase: string;
    projects: DirectiveProject[];
    startedAt: string;
    lastUpdated: string;
    /** Pipeline step progress derived from checkpoint data */
    pipelineSteps?: PipelineStep[];
    /** Current pipeline step ID */
    currentStepId?: string;
    /** Directive weight class */
    weight?: string;
    /** Triage rationale — why this weight was assigned */
    triageRationale?: string;
    /** CEO approval status */
    approvalStatus?: string;
    /** Brainstorm summary from brainstorm step output */
    brainstormSummary?: string;
    /** Plan summary from plan step output */
    planSummary?: string;
    /** Full brainstorm markdown content */
    brainstormContent?: string;
    /** Full directive brief markdown content (often contains plan) */
    directiveBrief?: string;
}
export interface DashboardState {
    sessions: Session[];
    projects: ProjectGroup[];
    tasksBySession: Record<string, TeamTask[]>;
    events: HookEvent[];
    sessionActivities: Record<string, SessionActivity>;
    directiveState: DirectiveState | null;
    directiveHistory: DirectiveState[];
    activeDirectives: DirectiveState[];
    lastUpdated: string;
}
export interface ProjectConfig {
    name: string;
    path: string;
    /** Source of this project config: 'config' (from config.json) or 'discovered' (from ~/.claude/projects/) */
    source?: 'config' | 'discovered';
}
export interface NotificationConfig {
    macOS: boolean;
    browser: boolean;
}
export interface ConductorConfig {
    projects: ProjectConfig[];
    claudeHome: string;
    server: {
        port: number;
    };
    notifications: NotificationConfig;
}
export interface SendInputRequest {
    paneId: string;
    input: string;
    type: 'approve' | 'reject' | 'abort' | 'text';
}
export interface SessionActivity {
    sessionId: string;
    tool?: string;
    detail?: string;
    thinking?: boolean;
    model?: string;
    lastSeen: string;
    active: boolean;
}
export type WsMessageType = 'full_state' | 'sessions_updated' | 'projects_updated' | 'event_added' | 'events_updated' | 'session_activities_updated' | 'notification_fired' | 'directive_updated' | 'state_updated';
export interface WsMessage {
    version: 1;
    type: WsMessageType;
    payload: unknown;
}

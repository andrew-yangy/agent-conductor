export interface Team {
  name: string;
  description: string;
  members: TeamMember[];
  createdAt: string;
  leadAgentId: string;
  leadSessionId: string;
  stale: boolean;
}

export interface TeamMember {
  name: string;
  agentId: string;
  agentType: string;
  model: string;
  tmuxPaneId: string;
  cwd: string;
  color: string;
  isActive: boolean;
  backendType: string;
  joinedAt: string;
}

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

export interface DirectiveInitiative {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  phase: 'audit' | 'design' | 'build' | 'review' | null;
}

export interface DirectiveState {
  directiveName: string;
  status: 'executing' | 'completed' | 'failed';
  totalInitiatives: number;
  currentInitiative: number;
  currentPhase: string;
  initiatives: DirectiveInitiative[];
  startedAt: string;
  lastUpdated: string;
}

export interface GoalInventory {
  generated: string;
  goals: GoalArea[];
}

export interface GoalArea {
  id: string;
  title: string;
  status: 'in_progress' | 'not_started' | 'done';
  has_goal_md: boolean;
  has_backlog: boolean;
  has_okrs: boolean;
  active_features: ActiveFeature[];
  done_count: number;
  backlog_count: number;
  issues: string[];
}

export interface ActiveFeature {
  name: string;
  tasks_completed: number;
  tasks_total: number;
  completion_pct: number;
  status: 'in_progress' | 'completed' | 'not_started';
}

export interface DashboardState {
  teams: Team[];
  sessions: Session[];
  projects: ProjectGroup[];
  tasksByTeam: Record<string, TeamTask[]>;
  tasksBySession: Record<string, TeamTask[]>;
  events: HookEvent[];
  sessionActivities: Record<string, SessionActivity>;
  directiveState: DirectiveState | null;
  goalInventory: GoalInventory | null;
  lastUpdated: string;
}

export interface ProjectConfig {
  name: string;
  path: string;
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

export type WsMessageType =
  | 'full_state'
  | 'sessions_updated'
  | 'projects_updated'
  | 'teams_updated'
  | 'tasks_updated'
  | 'event_added'
  | 'events_updated'
  | 'session_activities_updated'
  | 'config_updated'
  | 'notification_fired'
  | 'directive_updated'
  | 'goals_updated'
  | 'state_updated';

export interface WsMessage {
  version: 1;
  type: WsMessageType;
  payload: unknown;
}

// --- Intelligence Trends types ---

export interface IntelligenceAgentStats {
  agent: string;
  domain: string;
  totalFindings: number;
  findingsByUrgency: Record<string, number>;
  findingsByType: Record<string, number>;
  proposalsSubmitted: number;
  proposalsAccepted: number;
  acceptanceRate: number;
  topProducts: string[];
}

export interface IntelligenceTopicCluster {
  topic: string;
  keywords: string[];
  mentionCount: number;
  agents: string[];
  urgencyMax: string;
  items: Array<{ id: string; title: string; agent: string; urgency: string }>;
}

export interface IntelligenceCrossScoutSignal {
  topic: string;
  agentCount: number;
  agents: string[];
  totalMentions: number;
  highestUrgency: string;
  items: Array<{ id: string; title: string; agent: string; urgency: string }>;
  strength: 'strong' | 'moderate' | 'weak';
  shouldPromote: boolean;
}

export interface IntelligenceTrendsResult {
  generated: string;
  scoutDate: string | null;
  totalFindings: number;
  totalProposals: number;
  totalAccepted: number;
  overallAcceptanceRate: number;
  agentStats: IntelligenceAgentStats[];
  topTopics: IntelligenceTopicCluster[];
  crossScoutSignals: IntelligenceCrossScoutSignal[];
  urgencyBreakdown: Record<string, number>;
  typeBreakdown: Record<string, number>;
  productHeatmap: Record<string, number>;
}

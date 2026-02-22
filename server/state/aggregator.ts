import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseAllTeams } from '../parsers/team-parser.js';
import { parseAllTeamTasks, parseAllTasks } from '../parsers/task-parser.js';
import { parseAllSessionLogs } from '../parsers/session-log.js';
import { scanAllSessions } from '../parsers/session-scanner.js';
import { discoverClaudePanes } from '../parsers/process-discovery.js';
import type { ClaudePaneMapping } from '../parsers/process-discovery.js';
import { getRecentEvents } from '../db.js';
import type {
  ConductorConfig,
  DashboardState,
  ProjectGroup,
  Session,
  SessionActivity,
  HookEvent,
  WsMessageType,
} from '../types.js';

const execFileAsync = promisify(execFile);

export class Aggregator extends EventEmitter {
  private state: DashboardState;
  private config: ConductorConfig;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;
  private paneMapping: ClaudePaneMapping = { byTasksDir: new Map(), byPid: new Map() };

  constructor(config: ConductorConfig) {
    super();
    this.config = config;
    this.state = {
      teams: [],
      sessions: [],
      projects: [],
      tasksByTeam: {},
      tasksBySession: {},
      events: [],
      sessionActivities: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  getState(): DashboardState {
    return this.state;
  }

  /**
   * Full parse of all data on startup.
   */
  initialize(): void {
    console.log('[aggregator] Initializing state from filesystem...');

    // Parse teams from ~/.claude/teams/
    const teams = parseAllTeams(this.config.claudeHome);

    // Parse all tasks (team-named + UUID-named)
    const teamNameSet = new Set(teams.map((t) => t.name));
    const { byTeam: tasksByTeam, bySession: tasksBySession } = parseAllTasks(this.config.claudeHome, teamNameSet);

    // Load events from SQLite
    const events = getRecentEvents(200);

    // Scan filesystem for sessions and merge with hook events
    const { sessions, projects } = this.mergeSessionSources(events);

    // Cross-reference: mark sessions that are team leads
    for (const team of teams) {
      if (team.leadSessionId) {
        const session = sessions.find((s) => s.id === team.leadSessionId);
        if (session) {
          session.feature = `lead:${team.name}`;
        }
      }
    }

    this.state = {
      teams,
      sessions,
      projects,
      tasksByTeam,
      tasksBySession,
      events,
      sessionActivities: {},
      lastUpdated: new Date().toISOString(),
    };

    const totalTasks = Object.values(tasksByTeam).reduce((sum, t) => sum + t.length, 0);
    const activeSessions = sessions.filter((s) => s.status === 'working').length;
    console.log(
      `[aggregator] Initialized: ${teams.length} teams, ${totalTasks} tasks, ${events.length} events, ${sessions.length} sessions (${activeSessions} active), ${projects.length} projects`
    );

    // Parse session activities from JSONL logs
    this.refreshSessionActivities();

    // Discover claude processes → tmux pane mappings
    this.refreshProcessDiscovery();
    this.discoveryTimer = setInterval(() => this.refreshProcessDiscovery(), 30_000);

    // Start stale detection
    this.detectStaleness();
    this.staleTimer = setInterval(() => this.detectStaleness(), 60_000);
  }

  /**
   * Refresh all teams from ~/.claude/teams/
   */
  refreshTeams(): void {
    this.state.teams = parseAllTeams(this.config.claudeHome);
    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('teams_updated');
  }

  /**
   * Re-parse tasks for a specific team, or all tasks if no name given.
   */
  refreshTasks(teamName?: string): void {
    if (teamName) {
      const tasks = parseAllTeamTasks(this.config.claudeHome, [teamName]);
      this.state.tasksByTeam[teamName] = tasks[teamName] ?? [];
    } else {
      const teamNameSet = new Set(this.state.teams.map((t) => t.name));
      const { byTeam, bySession } = parseAllTasks(this.config.claudeHome, teamNameSet);
      this.state.tasksByTeam = byTeam;
      this.state.tasksBySession = bySession;
    }
    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('tasks_updated');
  }

  /**
   * Convenience: refresh everything.
   */
  refreshAll(): void {
    this.refreshTeams();
    this.refreshTasks();
    this.refreshSessions();
  }

  /**
   * Re-scan filesystem for sessions and rebuild projects.
   */
  refreshSessions(): void {
    const { sessions, projects } = this.mergeSessionSources(this.state.events);

    // Preserve team lead markers
    for (const team of this.state.teams) {
      if (team.leadSessionId) {
        const session = sessions.find((s) => s.id === team.leadSessionId);
        if (session) {
          session.feature = `lead:${team.name}`;
        }
      }
    }

    this.state.sessions = sessions;
    this.state.projects = projects;
    this.state.lastUpdated = new Date().toISOString();

    // Re-apply pane mappings from process discovery
    this.applyPaneMappings();

    this.emitChange('sessions_updated');
    this.emitChange('projects_updated');
  }

  /**
   * Re-parse all session JSONL logs and update sessionActivities.
   */
  refreshSessionActivities(): void {
    this.state.sessionActivities = parseAllSessionLogs(this.config.claudeHome);
    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('session_activities_updated');
  }

  /**
   * Merge a single session activity update into state.
   */
  updateSessionActivity(sessionId: string, activity: SessionActivity): void {
    this.state.sessionActivities[sessionId] = activity;
    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('session_activities_updated');
  }

  /**
   * Add a new hook event and update session state.
   */
  addEvent(event: HookEvent): void {
    // Add to front (most recent first)
    this.state.events.unshift(event);

    // Keep max 200 events in memory
    if (this.state.events.length > 200) {
      this.state.events = this.state.events.slice(0, 200);
    }

    // Update session state from this event
    this.updateSessionFromEvent(event);

    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('event_added');
  }

  /**
   * Discover claude processes and map them to tmux panes via process tree walking.
   * Merges paneId into sessions that have a matching tasksId.
   */
  refreshProcessDiscovery(): void {
    discoverClaudePanes().then((mapping) => {
      this.paneMapping = mapping;
      this.applyPaneMappings();
    }).catch((err) => {
      console.error('[aggregator] Process discovery error:', err);
    });
  }

  /**
   * Apply pane mappings to sessions. Team member paneIds take priority.
   * Matches via: tasksId from JSONL → byTasksDir, or tasksBySession keys → byTasksDir.
   */
  private applyPaneMappings(): void {
    // Build set of session IDs that already have paneId from team members
    const teamPaneSessionIds = new Set<string>();
    for (const team of this.state.teams) {
      for (const member of team.members) {
        if (member.agentId && member.tmuxPaneId) {
          teamPaneSessionIds.add(member.agentId);
        }
      }
    }

    // Build reverse lookup: session ID → tasks dir name from tasksBySession
    const sessionToTasksDir = new Map<string, string>();
    for (const [dirName] of Object.entries(this.state.tasksBySession)) {
      // tasksBySession is keyed by session-like identifiers
      sessionToTasksDir.set(dirName, dirName);
    }

    let changed = false;
    for (const session of this.state.sessions) {
      // Team member mappings take priority
      if (teamPaneSessionIds.has(session.id)) continue;

      // Try matching: session.tasksId → byTasksDir
      let paneId = session.tasksId
        ? this.paneMapping.byTasksDir.get(session.tasksId)
        : undefined;

      // Try matching: session ID itself as tasks dir name
      if (!paneId) {
        paneId = this.paneMapping.byTasksDir.get(session.id);
      }

      if (paneId && session.paneId !== paneId) {
        session.paneId = paneId;
        changed = true;
      } else if (!paneId && session.paneId) {
        session.paneId = undefined;
        changed = true;
      }
    }

    if (changed) {
      this.state.lastUpdated = new Date().toISOString();
      this.emitChange('sessions_updated');
    }
  }

  /**
   * Detect stale teams: all members inactive, config.json old, no recent events,
   * and tmux panes gone.
   */
  detectStaleness(): void {
    // Get live tmux panes once for all teams
    this.getLivePaneIds().then((livePanes) => {
      let changed = false;

      for (const team of this.state.teams) {
        const allInactive = team.members.length > 0 && team.members.every((m) => !m.isActive);

        // Check config.json mtime > 2 hours
        const configPath = path.join(this.config.claudeHome, 'teams', team.name, 'config.json');
        let configStale = false;
        try {
          const stat = fs.statSync(configPath);
          configStale = Date.now() - stat.mtimeMs > 2 * 60 * 60 * 1000;
        } catch {
          configStale = true;
        }

        // Check for recent events tied to any team member session
        // Cross-reference with JSONL-discovered sessions via lead's subagentIds
        const memberSessionIds = new Set<string>();
        if (team.leadSessionId) {
          memberSessionIds.add(team.leadSessionId);
          const leadSession = this.state.sessions.find((s) => s.id === team.leadSessionId);
          if (leadSession) {
            for (const subId of leadSession.subagentIds) {
              memberSessionIds.add(subId);
            }
          }
        }

        const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
        const hasRecentEvents = this.state.events.some(
          (e) => memberSessionIds.has(e.sessionId) && new Date(e.timestamp).getTime() > twoHoursAgo
        );

        // Check if tmux panes still exist for members
        const allPanesGone = team.members.length > 0 && team.members.every(
          (m) => !m.tmuxPaneId || !livePanes.has(m.tmuxPaneId)
        );

        const stale = (allInactive || allPanesGone) && configStale && !hasRecentEvents;

        if (team.stale !== stale) {
          team.stale = stale;
          changed = true;
        }
      }

      if (changed) {
        this.emitChange('teams_updated');
      }
    }).catch((err) => {
      console.error('[aggregator] Error in stale detection:', err);
    });
  }

  /**
   * Clean up timers.
   */
  destroy(): void {
    if (this.staleTimer) {
      clearInterval(this.staleTimer);
      this.staleTimer = null;
    }
    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }
  }

  // --- Private helpers ---

  /**
   * Merge filesystem-scanned sessions with hook event status.
   * Filesystem is the primary source; events enrich status.
   */
  private mergeSessionSources(events: HookEvent[]): { sessions: Session[]; projects: ProjectGroup[] } {
    // 1. Scan filesystem for all sessions
    const scanned = scanAllSessions(this.config.claudeHome);

    // 2. Build event status map from hook events
    const eventStatusMap = new Map<string, { status: Session['status']; timestamp: string }>();
    for (const event of events) {
      const existing = eventStatusMap.get(event.sessionId);
      if (!existing || event.timestamp > existing.timestamp) {
        eventStatusMap.set(event.sessionId, {
          status: this.statusFromEventType(event.type),
          timestamp: event.timestamp,
        });
      }
    }

    // 3. Merge: filesystem provides base, events enrich status
    const sessions: Session[] = scanned.map((s) => {
      const eventInfo = eventStatusMap.get(s.id);
      let status: Session['status'] = s.active ? 'working' : 'idle';

      // Hook event overrides if recent (within 5 minutes)
      if (eventInfo) {
        const eventAge = Date.now() - new Date(eventInfo.timestamp).getTime();
        if (eventAge < 5 * 60 * 1000) {
          status = eventInfo.status;
        }
      }

      return {
        id: s.id,
        project: s.project,
        projectDir: s.projectDir,
        status,
        lastActivity: s.lastActivity,
        model: s.model,
        cwd: s.cwd,
        gitBranch: s.gitBranch,
        version: s.version,
        slug: s.slug,
        initialPrompt: s.initialPrompt,
        tasksId: s.tasksId,
        isSubagent: s.isSubagent,
        parentSessionId: s.parentSessionId,
        agentId: s.agentId,
        subagentIds: s.subagentIds,
        fileSize: s.fileSize,
      };
    });

    // 4. Build project groups from parent sessions
    const projectMap = new Map<string, ProjectGroup>();
    for (const session of sessions) {
      if (session.isSubagent) continue;
      let group = projectMap.get(session.projectDir);
      if (!group) {
        group = {
          name: session.project,
          dirName: session.projectDir,
          sessions: [],
        };
        projectMap.set(session.projectDir, group);
      }
      group.sessions.push(session);
    }

    const projects = Array.from(projectMap.values());

    return { sessions, projects };
  }

  private updateSessionFromEvent(event: HookEvent): void {
    const existing = this.state.sessions.find((s) => s.id === event.sessionId);

    if (existing) {
      existing.status = this.statusFromEventType(event.type);
      existing.lastActivity = event.timestamp;
      if (event.project) existing.project = event.project;
    } else {
      this.state.sessions.push({
        id: event.sessionId,
        project: event.project ?? 'unknown',
        projectDir: '',
        status: this.statusFromEventType(event.type),
        lastActivity: event.timestamp,
        isSubagent: false,
        subagentIds: [],
        fileSize: 0,
      });
    }

    this.emitChange('sessions_updated');
  }

  private statusFromEventType(type: string): Session['status'] {
    switch (type) {
      case 'stop':
      case 'teammate_idle':
        return 'idle';
      case 'permission_prompt':
        return 'waiting-approval';
      case 'idle_prompt':
        return 'waiting-input';
      case 'error':
        return 'error';
      default:
        return 'working';
    }
  }

  private async getLivePaneIds(): Promise<Set<string>> {
    try {
      const { stdout } = await execFileAsync('tmux', ['list-panes', '-a', '-F', '#{pane_id}']);
      return new Set(stdout.trim().split('\n').filter(Boolean));
    } catch {
      // tmux not running or not installed
      return new Set();
    }
  }

  private emitChange(type: WsMessageType): void {
    this.emit('change', type);
  }
}

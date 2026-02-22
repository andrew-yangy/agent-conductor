import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseAllTeams } from '../parsers/team-parser.js';
import { parseAllTeamTasks } from '../parsers/task-parser.js';
import { parseAllSessionLogs } from '../parsers/session-log.js';
import { getRecentEvents } from '../db.js';
import type {
  ConductorConfig,
  DashboardState,
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

  constructor(config: ConductorConfig) {
    super();
    this.config = config;
    this.state = {
      teams: [],
      sessions: [],
      tasksByTeam: {},
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

    // Parse tasks for each team
    const teamNames = teams.map((t) => t.name);
    const tasksByTeam = parseAllTeamTasks(this.config.claudeHome, teamNames);

    // Load events from SQLite
    const events = getRecentEvents(200);

    // Derive sessions from events
    const sessions = this.deriveSessions(events);

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
      tasksByTeam,
      events,
      lastUpdated: new Date().toISOString(),
    };

    const totalTasks = Object.values(tasksByTeam).reduce((sum, t) => sum + t.length, 0);
    console.log(
      `[aggregator] Initialized: ${teams.length} teams, ${totalTasks} tasks, ${events.length} events`
    );

    // Parse session activities from JSONL logs
    this.refreshSessionActivities();

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
   * Re-parse tasks for a specific team, or all teams if no name given.
   */
  refreshTasks(teamName?: string): void {
    if (teamName) {
      const tasks = parseAllTeamTasks(this.config.claudeHome, [teamName]);
      this.state.tasksByTeam[teamName] = tasks[teamName] ?? [];
    } else {
      const teamNames = this.state.teams.map((t) => t.name);
      this.state.tasksByTeam = parseAllTeamTasks(this.config.claudeHome, teamNames);
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
        const memberSessionIds = new Set<string>();
        if (team.leadSessionId) memberSessionIds.add(team.leadSessionId);
        for (const member of team.members) {
          if (member.agentId) memberSessionIds.add(member.agentId);
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
  }

  // --- Private helpers ---

  private deriveSessions(events: HookEvent[]): Session[] {
    const sessionMap = new Map<string, Session>();

    // Process events in chronological order (oldest first since events are DESC)
    const chronological = [...events].reverse();

    for (const event of chronological) {
      const existing = sessionMap.get(event.sessionId);
      const session: Session = existing ?? {
        id: event.sessionId,
        project: event.project ?? 'unknown',
        status: 'idle',
        lastActivity: event.timestamp,
      };

      session.status = this.statusFromEventType(event.type);
      session.lastActivity = event.timestamp;
      if (event.project) session.project = event.project;

      sessionMap.set(event.sessionId, session);
    }

    return Array.from(sessionMap.values());
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
        status: this.statusFromEventType(event.type),
        lastActivity: event.timestamp,
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

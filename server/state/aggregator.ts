import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseAllTeams } from '../parsers/team-parser.js';
import { parseAllTeamTasks, parseAllTasks } from '../parsers/task-parser.js';
import {
  initializeAllFileStates,
  discoverSessionFiles,
  getAllFileStates,
  getOrBootstrap,
  removeFileState,
  machineStateToLastEntryType,
  toSessionActivity,
  type SessionFileState,
  type DiscoveredFile,
} from '../parsers/session-state.js';
import type { LastEntryType } from '../parsers/session-scanner.js';
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

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function deriveSessionStatus(
  ageMs: number,
  lastEntryType: LastEntryType,
  eventInfo?: { status: Session['status']; timestamp: string }
): Session['status'] {
  // Hook events override if recent (<5min)
  if (eventInfo) {
    const eventAge = Date.now() - new Date(eventInfo.timestamp).getTime();
    if (eventAge < FIVE_MINUTES_MS) {
      return eventInfo.status;
    }
  }

  // Time tiers
  if (ageMs < FIVE_MINUTES_MS) {
    switch (lastEntryType) {
      case 'user': return 'working';
      case 'assistant-tool': return 'working';
      case 'assistant-question': return 'waiting-input';
      case 'assistant-text': return 'done';
      default: return 'idle';
    }
  }

  if (ageMs < ONE_HOUR_MS) {
    return 'paused';
  }

  return 'idle';
}

export class Aggregator extends EventEmitter {
  private state: DashboardState;
  private config: ConductorConfig;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;
  private paneMapping: ClaudePaneMapping = { byTasksDir: new Map(), byPid: new Map(), bySessionId: new Map(), byPaneTitle: new Map(), panePrompts: new Map(), byItermSession: new Map(), orphanItermSessions: [] };
  private discoveredFiles = new Map<string, DiscoveredFile>();

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

  initialize(): void {
    console.log('[aggregator] Initializing state from filesystem...');

    const teams = parseAllTeams(this.config.claudeHome);
    const teamNameSet = new Set(teams.map((t) => t.name));
    const { byTeam: tasksByTeam, bySession: tasksBySession } = parseAllTasks(this.config.claudeHome, teamNameSet);
    const events = getRecentEvents(200);

    // Bootstrap all session file states (incremental parser)
    this.discoveredFiles = initializeAllFileStates(this.config.claudeHome);

    // Build sessions from file states + hook events
    const { sessions, projects } = this.buildSessionsFromFileStates(events);

    for (const team of teams) {
      if (team.leadSessionId) {
        const session = sessions.find((s) => s.id === team.leadSessionId);
        if (session) {
          session.feature = `lead:${team.name}`;
        }
      }
    }

    const sessionActivities = this.buildSessionActivities();

    this.state = {
      teams,
      sessions,
      projects,
      tasksByTeam,
      tasksBySession,
      events,
      sessionActivities,
      lastUpdated: new Date().toISOString(),
    };

    const totalTasks = Object.values(tasksByTeam).reduce((sum, t) => sum + t.length, 0);
    const activeSessions = sessions.filter((s) => s.status === 'working').length;
    console.log(
      `[aggregator] Initialized: ${teams.length} teams, ${totalTasks} tasks, ${events.length} events, ${sessions.length} sessions (${activeSessions} active), ${projects.length} projects`
    );

    this.refreshProcessDiscovery();
    this.discoveryTimer = setInterval(() => this.refreshProcessDiscovery(), 30_000);

    this.detectStaleness();
    this.staleTimer = setInterval(() => this.detectStaleness(), 60_000);
  }

  refreshTeams(): void {
    this.state.teams = parseAllTeams(this.config.claudeHome);
    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('teams_updated');
  }

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

  refreshAll(): void {
    this.refreshTeams();
    this.refreshTasks();
    this.refreshSessions();
  }

  refreshSessions(): void {
    const newDiscovered = discoverSessionFiles(this.config.claudeHome);

    for (const [filePath] of newDiscovered) {
      if (!this.discoveredFiles.has(filePath)) {
        getOrBootstrap(filePath);
      }
    }
    for (const [filePath] of this.discoveredFiles) {
      if (!newDiscovered.has(filePath)) {
        removeFileState(filePath);
      }
    }
    this.discoveredFiles = newDiscovered;

    const { sessions, projects } = this.buildSessionsFromFileStates(this.state.events);

    for (const team of this.state.teams) {
      if (team.leadSessionId) {
        const session = sessions.find((s) => s.id === team.leadSessionId);
        if (session) {
          session.feature = `lead:${team.name}`;
        }
      }
    }

    // Carry over paneIds from previous sessions to preserve stable assignments
    const prevPaneIds = new Map<string, string>();
    for (const s of this.state.sessions) {
      if (s.paneId) prevPaneIds.set(s.id, s.paneId);
    }
    for (const s of sessions) {
      const prevPane = prevPaneIds.get(s.id);
      if (prevPane) s.paneId = prevPane;
    }

    this.state.sessions = sessions;
    this.state.projects = projects;
    this.state.lastUpdated = new Date().toISOString();

    this.applyPaneMappings();

    this.emitChange('sessions_updated');
    this.emitChange('projects_updated');
  }

  private rederiveSessionStatuses(): void {
    const fileStates = getAllFileStates();
    let statusChanged = false;
    let activityChanged = false;

    // Build sessionId → filePath lookup
    const sessionToFilePath = new Map<string, string>();
    for (const [fp, discovered] of this.discoveredFiles) {
      sessionToFilePath.set(discovered.sessionId, fp);
    }

    for (const session of this.state.sessions) {
      const fp = sessionToFilePath.get(session.id);
      const fileState = fp ? fileStates.get(fp) : undefined;

      // Re-derive status
      const lastEntryType: LastEntryType = fileState
        ? machineStateToLastEntryType(fileState)
        : 'unknown';
      const ageMs = fileState
        ? Date.now() - fileState.mtimeMs
        : Date.now() - new Date(session.lastActivity).getTime();
      const eventInfo = this.getLatestEventInfo(session.id);
      const newStatus = deriveSessionStatus(ageMs, lastEntryType, eventInfo);

      if (newStatus !== session.status) {
        session.status = newStatus;
        statusChanged = true;
      }

      // Re-derive activity (clear stale active flags)
      if (fileState) {
        const activity = toSessionActivity(fileState);
        if (activity) {
          const existing = this.state.sessionActivities[session.id];
          if (existing?.active !== activity.active) {
            this.state.sessionActivities[session.id] = activity;
            activityChanged = true;
          }
        }
      }
    }

    if (statusChanged) {
      this.state.lastUpdated = new Date().toISOString();
      this.emitChange('sessions_updated');
    }
    if (activityChanged) {
      this.emitChange('session_activities_updated');
    }
  }

  updateSessionFromFileState(filePath: string, fileState: SessionFileState): void {
    const discovered = this.discoveredFiles.get(filePath);
    if (!discovered) return;

    const sessionId = discovered.sessionId;

    const activity = toSessionActivity(fileState);
    if (activity) {
      this.state.sessionActivities[sessionId] = activity;
    }

    const existing = this.state.sessions.find((s) => s.id === sessionId);
    if (existing) {
      const lastEntryType = machineStateToLastEntryType(fileState);
      const ageMs = Date.now() - fileState.mtimeMs;
      const eventInfo = this.getLatestEventInfo(sessionId);
      existing.status = deriveSessionStatus(ageMs, lastEntryType, eventInfo);

      if (fileState.model) existing.model = fileState.model;
      if (fileState.cwd) existing.cwd = fileState.cwd;
      if (fileState.gitBranch) existing.gitBranch = fileState.gitBranch;
      if (fileState.version) existing.version = fileState.version;
      if (fileState.slug) existing.slug = fileState.slug;
      if (fileState.tasksId) existing.tasksId = fileState.tasksId;
      if (fileState.latestPrompt) existing.latestPrompt = fileState.latestPrompt;
      existing.lastActivity = new Date(fileState.mtimeMs).toISOString();
      existing.fileSize = fileState.fileSize;
    }

    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('sessions_updated');
    this.emitChange('session_activities_updated');
  }

  addEvent(event: HookEvent): void {
    this.state.events.unshift(event);

    if (this.state.events.length > 200) {
      this.state.events = this.state.events.slice(0, 200);
    }

    this.updateSessionFromEvent(event);

    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('event_added');
  }

  refreshProcessDiscovery(): void {
    discoverClaudePanes().then((mapping) => {
      this.paneMapping = mapping;

      if (mapping.byItermSession.size > 0) {
        console.log(`[aggregator] iTerm2 PIDs: ${[...mapping.byItermSession.entries()].map(([pid, info]) => `${pid}→${info.itermId.slice(0,8)}(${info.name.slice(0,30)})`).join(', ')}`);
        const itermTasksDirs = [...mapping.byTasksDir.entries()].filter(([, v]) => v.startsWith('iterm:'));
        const itermSessionIds = [...mapping.bySessionId.entries()].filter(([, v]) => v.startsWith('iterm:'));
        console.log(`[aggregator] iTerm2 in byTasksDir: ${itermTasksDirs.length}, bySessionId: ${itermSessionIds.length}`);
        if (itermSessionIds.length > 0) console.log(`[aggregator] iTerm2 bySessionId: ${itermSessionIds.map(([k,v]) => `${k.slice(0,12)}→${v}`).join(', ')}`);
      }

      this.applyPaneMappings();
    }).catch((err) => {
      console.error('[aggregator] Process discovery error:', err);
    });
  }

  private applyPaneMappings(): void {
    const teamPaneSessionIds = new Set<string>();
    for (const team of this.state.teams) {
      for (const member of team.members) {
        if (member.agentId && member.tmuxPaneId) {
          teamPaneSessionIds.add(member.agentId);
        }
      }
    }

    const sessionToTasksDir = new Map<string, string>();
    for (const [dirName] of Object.entries(this.state.tasksBySession)) {
      sessionToTasksDir.set(dirName, dirName);
    }

    const statusPriority: Record<string, number> = {
      'working': 0, 'waiting-approval': 0, 'waiting-input': 0, 'error': 0,
      'done': 1, 'paused': 1,
      'idle': 2,
    };
    const sortedSessions = [...this.state.sessions].sort((a, b) => {
      const pa = statusPriority[a.status] ?? 3;
      const pb = statusPriority[b.status] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });

    const assignedPaneIds = new Set<string>();

    const validItermIds = new Set(
      [...this.paneMapping.byItermSession.values()].map((info) => `iterm:${info.itermId}`)
    );
    for (const session of this.state.sessions) {
      if (session.paneId?.startsWith('iterm:') && validItermIds.has(session.paneId)) {
        assignedPaneIds.add(session.paneId);
      }
    }

    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const hasLikelyPane = (s: Session) => {
      if (s.status !== 'idle') return true;
      const age = Date.now() - new Date(s.lastActivity).getTime();
      return age < THIRTY_DAYS_MS;
    };

    let changed = false;
    for (const session of sortedSessions) {
      if (teamPaneSessionIds.has(session.id)) continue;
      if (session.isSubagent) continue;
      if (!hasLikelyPane(session)) {
        if (session.paneId) {
          session.paneId = undefined;
          changed = true;
        }
        continue;
      }

      let paneId = session.tasksId
        ? this.paneMapping.byTasksDir.get(session.tasksId)
        : undefined;

      if (!paneId) {
        paneId = this.paneMapping.byTasksDir.get(session.id);
      }

      if (!paneId) {
        const baseId = session.parentSessionId ?? session.id;
        paneId = this.paneMapping.bySessionId.get(baseId);
      }

      if (paneId && !assignedPaneIds.has(paneId)) {
        assignedPaneIds.add(paneId);
        if (session.paneId !== paneId) {
          session.paneId = paneId;
          changed = true;
        }
      } else if (session.paneId && !session.paneId.startsWith('iterm:')) {
        session.paneId = undefined;
        changed = true;
      }
    }

    // Second pass: fuzzy title matching
    if (this.paneMapping.byPaneTitle.size > 0) {
      for (const session of sortedSessions) {
        if (session.paneId || teamPaneSessionIds.has(session.id) || session.isSubagent) continue;
        if (!hasLikelyPane(session)) continue;

        const textParts: string[] = [];
        if (session.initialPrompt) textParts.push(session.initialPrompt);
        if (session.latestPrompt) textParts.push(session.latestPrompt);
        if (session.slug) textParts.push(session.slug.replace(/-/g, ' '));
        if (textParts.length === 0) continue;

        const promptLower = textParts.join(' ').toLowerCase();
        const promptWords = promptLower.split(/\s+/).filter((w) => w.length > 2);
        if (promptWords.length === 0) continue;

        let bestPaneId: string | undefined;
        let bestScore = 0;

        for (const [title, titlePaneId] of this.paneMapping.byPaneTitle) {
          if (assignedPaneIds.has(titlePaneId)) continue;
          const titleWords = title.split(/\s+/).filter((w) => w.length > 2);
          if (titleWords.length === 0) continue;

          const overlap = titleWords.filter((tw) => promptWords.some((pw) => pw.includes(tw) || tw.includes(pw))).length;
          const ratio = overlap / titleWords.length;

          if (promptLower.includes(title) || title.includes(promptLower)) {
            const score = title.length + 100;
            if (score > bestScore) {
              bestScore = score;
              bestPaneId = titlePaneId;
            }
          } else if (overlap >= 1 && ratio > 0.5 && overlap > bestScore) {
            bestScore = overlap;
            bestPaneId = titlePaneId;
          }
        }

        if (bestPaneId) {
          session.paneId = bestPaneId;
          assignedPaneIds.add(bestPaneId);
          changed = true;
        }
      }
    }

    // Third pass: content-based matching
    if (this.paneMapping.panePrompts.size > 0) {
      const candidates: Array<{ sessionId: string; paneId: string; score: number }> = [];

      for (const session of sortedSessions) {
        if (session.paneId || teamPaneSessionIds.has(session.id) || session.isSubagent) continue;
        if (!hasLikelyPane(session)) continue;

        const sessionTexts: string[] = [];
        if (session.latestPrompt) sessionTexts.push(session.latestPrompt.replace(/\.{3}$/, '').toLowerCase());
        if (session.initialPrompt) sessionTexts.push(session.initialPrompt.replace(/\.{3}$/, '').toLowerCase());
        if (sessionTexts.length === 0) continue;

        for (const [paneId, panePromptList] of this.paneMapping.panePrompts) {
          if (assignedPaneIds.has(paneId)) continue;

          let score = 0;
          for (const panePrompt of panePromptList) {
            const paneLower = panePrompt.toLowerCase();
            for (const sessionText of sessionTexts) {
              if (paneLower.includes(sessionText) || sessionText.includes(paneLower)) {
                const matchLen = Math.min(paneLower.length, sessionText.length);
                score = Math.max(score, matchLen + 100);
              } else {
                const paneWords = paneLower.split(/\s+/).filter((w) => w.length > 2);
                const sessWords = sessionText.split(/\s+/).filter((w) => w.length > 2);
                if (paneWords.length === 0 || sessWords.length === 0) continue;
                const overlap = paneWords.filter((pw) =>
                  sessWords.some((sw) => pw.includes(sw) || sw.includes(pw))
                ).length;
                const ratio = overlap / Math.max(paneWords.length, sessWords.length);
                if (overlap >= 2 && ratio > 0.4) {
                  score = Math.max(score, overlap);
                }
              }
            }
          }

          if (score > 0) {
            candidates.push({ sessionId: session.id, paneId, score });
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score);

      const assignedSessionIds = new Set<string>();
      for (const { sessionId, paneId } of candidates) {
        if (assignedSessionIds.has(sessionId) || assignedPaneIds.has(paneId)) continue;
        const session = this.state.sessions.find((s) => s.id === sessionId);
        if (!session) continue;

        session.paneId = paneId;
        assignedPaneIds.add(paneId);
        assignedSessionIds.add(sessionId);
        changed = true;
      }
    }

    // Pass 3.5: iTerm2 native session matching
    if (this.paneMapping.byItermSession.size > 0) {
      const itermEntries = [...this.paneMapping.byItermSession.entries()];
      const matchedItermPids = new Set<number>();

      for (const [pid, info] of itermEntries) {
        const itermPaneId = `iterm:${info.itermId}`;
        if (assignedPaneIds.has(itermPaneId)) {
          matchedItermPids.add(pid);
        }
      }

      const remainingIterm = itermEntries.filter(([pid]) => !matchedItermPids.has(pid));

      if (remainingIterm.length > 0) {
        // Strategy A1: Exact session ID match (from JSONL file modification in discovery)
        for (const [pid, info] of remainingIterm) {
          if (matchedItermPids.has(pid) || !info.sessionId) continue;
          const session = this.state.sessions.find(s =>
            s.id === info.sessionId && !s.paneId && !s.isSubagent
          );
          if (session) {
            const itermPaneId = `iterm:${info.itermId}`;
            session.paneId = itermPaneId;
            assignedPaneIds.add(itermPaneId);
            matchedItermPids.add(pid);
            changed = true;
          }
        }

        // Strategy A2: Fallback to cwd matching for remaining unmatched iTerm PIDs
        for (const [pid, info] of remainingIterm) {
          if (matchedItermPids.has(pid) || !info.cwd) continue;

          const cwdCandidates = sortedSessions.filter(s =>
            !s.paneId && !teamPaneSessionIds.has(s.id) && !s.isSubagent &&
            hasLikelyPane(s) && s.cwd === info.cwd
          );

          if (cwdCandidates.length > 0) {
            const session = cwdCandidates[0];
            const itermPaneId = `iterm:${info.itermId}`;
            session.paneId = itermPaneId;
            assignedPaneIds.add(itermPaneId);
            matchedItermPids.add(pid);
            changed = true;
          }
        }

        for (const session of sortedSessions) {
          if (session.paneId || teamPaneSessionIds.has(session.id) || session.isSubagent) continue;
          if (!hasLikelyPane(session)) continue;

          const textParts: string[] = [];
          if (session.initialPrompt) textParts.push(session.initialPrompt);
          if (session.latestPrompt) textParts.push(session.latestPrompt);
          if (session.slug) textParts.push(session.slug.replace(/-/g, ' '));
          if (textParts.length === 0) continue;

          const sessionText = textParts.join(' ').toLowerCase();
          const sessionWords = sessionText.split(/\s+/).filter((w) => w.length > 2);
          if (sessionWords.length === 0) continue;

          let bestPid: number | undefined;
          let bestScore = 0;

          for (const [pid, info] of remainingIterm) {
            if (matchedItermPids.has(pid)) continue;
            if (!info.name) continue;

            const nameLower = info.name.toLowerCase();
            const nameWords = nameLower.split(/\s+/).filter((w) => w.length > 2);

            if (sessionText.includes(nameLower) || nameLower.includes(sessionText)) {
              const score = nameLower.length + 100;
              if (score > bestScore) {
                bestScore = score;
                bestPid = pid;
              }
            } else if (nameWords.length > 0) {
              const overlap = nameWords.filter((nw) =>
                sessionWords.some((sw) => sw.includes(nw) || nw.includes(sw))
              ).length;
              const ratio = overlap / nameWords.length;
              if (overlap >= 1 && ratio > 0.5 && overlap > bestScore) {
                bestScore = overlap;
                bestPid = pid;
              }
            }
          }

          if (bestPid !== undefined) {
            const info = this.paneMapping.byItermSession.get(bestPid)!;
            const itermPaneId = `iterm:${info.itermId}`;
            session.paneId = itermPaneId;
            assignedPaneIds.add(itermPaneId);
            matchedItermPids.add(bestPid);
            changed = true;
          }
        }

        const unmatchedActiveSessions = sortedSessions.filter(
          (s) => !s.paneId && !teamPaneSessionIds.has(s.id) && !s.isSubagent &&
            hasLikelyPane(s)
        );
        const unmatchedIterm = remainingIterm.filter(([pid]) => !matchedItermPids.has(pid));

        if (unmatchedActiveSessions.length === 1 && unmatchedIterm.length === 1) {
          const [session] = unmatchedActiveSessions;
          const [[pid, info]] = unmatchedIterm;
          const itermPaneId = `iterm:${info.itermId}`;
          session.paneId = itermPaneId;
          assignedPaneIds.add(itermPaneId);
          matchedItermPids.add(pid);
          changed = true;
        }
      }
    }

    // Pass 3.6: Orphan iTerm CWD matching (sessions where claude has exited)
    if (this.paneMapping.orphanItermSessions.length > 0) {
      for (const orphan of this.paneMapping.orphanItermSessions) {
        if (!orphan.cwd) continue;
        const itermPaneId = `iterm:${orphan.itermId}`;
        if (assignedPaneIds.has(itermPaneId)) continue;

        const cwdCandidates = sortedSessions.filter(s =>
          !s.paneId && !teamPaneSessionIds.has(s.id) && !s.isSubagent &&
          hasLikelyPane(s) && s.cwd === orphan.cwd
        );

        if (cwdCandidates.length === 1) {
          const session = cwdCandidates[0];
          session.paneId = itermPaneId;
          assignedPaneIds.add(itermPaneId);
          changed = true;
        }
      }
    }

    // Fourth pass: propagate to subagents
    for (const session of this.state.sessions) {
      if (!session.isSubagent || !session.parentSessionId) continue;
      const parent = this.state.sessions.find((s) => s.id === session.parentSessionId);
      if (parent?.paneId && session.paneId !== parent.paneId) {
        session.paneId = parent.paneId;
        changed = true;
      }
    }

    if (changed) {
      this.state.lastUpdated = new Date().toISOString();
      this.emitChange('sessions_updated');
    }
  }

  detectStaleness(): void {
    // Re-derive session statuses based on current time tiers
    this.rederiveSessionStatuses();

    this.getLivePaneIds().then((livePanes) => {
      let changed = false;

      for (const team of this.state.teams) {
        const allInactive = team.members.length > 0 && team.members.every((m) => !m.isActive);

        const configPath = path.join(this.config.claudeHome, 'teams', team.name, 'config.json');
        let configStale = false;
        try {
          const stat = fs.statSync(configPath);
          configStale = Date.now() - stat.mtimeMs > 2 * 60 * 60 * 1000;
        } catch {
          configStale = true;
        }

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

  private buildSessionsFromFileStates(events: HookEvent[]): { sessions: Session[]; projects: ProjectGroup[] } {
    const fileStates = getAllFileStates();

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

    const parentSubagentMap = new Map<string, string[]>();
    const sessions: Session[] = [];

    for (const [filePath, discovered] of this.discoveredFiles) {
      const state = fileStates.get(filePath);

      let lastActivity: string;
      let fileSize: number;
      if (state) {
        lastActivity = new Date(state.mtimeMs).toISOString();
        fileSize = state.fileSize;
      } else {
        try {
          const stat = fs.statSync(filePath);
          lastActivity = stat.mtime.toISOString();
          fileSize = stat.size;
        } catch {
          continue;
        }
      }

      const lastEntryType: LastEntryType = state
        ? machineStateToLastEntryType(state)
        : 'unknown';
      const eventInfo = eventStatusMap.get(discovered.sessionId);
      const ageMs = Date.now() - new Date(lastActivity).getTime();
      const status = deriveSessionStatus(ageMs, lastEntryType, eventInfo);

      sessions.push({
        id: discovered.sessionId,
        project: discovered.project,
        projectDir: discovered.projectDir,
        status,
        lastActivity,
        model: state?.model,
        cwd: state?.cwd,
        gitBranch: state?.gitBranch,
        version: state?.version,
        slug: state?.slug,
        initialPrompt: state?.initialPrompt,
        latestPrompt: state?.latestPrompt,
        tasksId: state?.tasksId,
        isSubagent: discovered.isSubagent,
        parentSessionId: discovered.parentSessionId,
        agentId: discovered.agentId,
        subagentIds: [],
        fileSize,
      });

      if (discovered.isSubagent && discovered.parentSessionId && discovered.agentId) {
        const existing = parentSubagentMap.get(discovered.parentSessionId);
        if (existing) {
          existing.push(discovered.agentId);
        } else {
          parentSubagentMap.set(discovered.parentSessionId, [discovered.agentId]);
        }
      } else if (!discovered.isSubagent) {
        if (!parentSubagentMap.has(discovered.sessionId)) {
          parentSubagentMap.set(discovered.sessionId, []);
        }
      }
    }

    for (const session of sessions) {
      if (!session.isSubagent) {
        session.subagentIds = parentSubagentMap.get(session.id) ?? [];
      }
    }

    const projectMap = new Map<string, ProjectGroup>();
    for (const session of sessions) {
      if (session.isSubagent) continue;
      let group = projectMap.get(session.projectDir);
      if (!group) {
        group = { name: session.project, dirName: session.projectDir, sessions: [] };
        projectMap.set(session.projectDir, group);
      }
      group.sessions.push(session);
    }

    return { sessions, projects: Array.from(projectMap.values()) };
  }

  private buildSessionActivities(): Record<string, SessionActivity> {
    const result: Record<string, SessionActivity> = {};
    const fileStates = getAllFileStates();

    for (const [, state] of fileStates) {
      const activity = toSessionActivity(state);
      if (activity && activity.active) {
        result[activity.sessionId] = activity;
      }
    }

    return result;
  }

  private getLatestEventInfo(sessionId: string): { status: Session['status']; timestamp: string } | undefined {
    for (const event of this.state.events) {
      if (event.sessionId === sessionId) {
        return {
          status: this.statusFromEventType(event.type),
          timestamp: event.timestamp,
        };
      }
    }
    return undefined;
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
      case 'subagent_stop':
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
      return new Set();
    }
  }

  private emitChange(type: WsMessageType): void {
    this.emit('change', type);
  }
}

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { parseAllTasks } from '../parsers/task-parser.js';
import {
  initializeAllFileStates as initializeAllFileStatesRaw,
  discoverSessionFiles as discoverSessionFilesRaw,
  getAllFileStates as getAllFileStatesRaw,
  getOrBootstrap as getOrBootstrapRaw,
  removeFileState as removeFileStateRaw,
  machineStateToLastEntryType,
  toSessionActivity,
  type SessionFileState,
  type DiscoveredFile,
} from '../parsers/session-state.js';
import type { LastEntryType } from '../parsers/session-scanner.js';
import { projectDirFromPath } from '../parsers/session-scanner.js';
import type { PlatformAdapter } from '../platform/types.js';
import { discoverClaudePanes } from '../parsers/process-discovery.js';
import type { ClaudePaneMapping } from '../parsers/process-discovery.js';
import { getRecentEvents } from '../db.js';
import type {
  ConductorConfig,
  DashboardState,
  DirectiveState,
  ProjectGroup,
  Session,
  SessionActivity,
  HookEvent,
  WsMessageType,
} from '../types.js';
import type { FullWorkState, WorkItemFilter, WorkItem, FeatureRecord, BacklogRecord } from './work-item-types.js';
import { consumerRoot } from '../paths.js';

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

  // 5 min – 1 hour: agent was recently active but not right now
  if (ageMs < ONE_HOUR_MS) {
    return 'paused';
  }

  // > 1 hour: truly idle
  return 'idle';
}

/**
 * Bidirectional status propagation between parent and subagent sessions.
 * Runs AFTER normal status derivation — only upgrades statuses, never downgrades.
 *
 * 1. Parent → Subagent: If parent is "working", subagents with stale status
 *    (idle/paused) get upgraded to "working" (they're active inside the parent).
 * 2. Subagent → Parent: If any subagent has "error" or "waiting-input"/"waiting-approval",
 *    set subagentAttention on the parent. Also collect active subagent names.
 * 3. Reverse propagation: If parent is "idle" but has subagents with recent activity
 *    (< 5 min), upgrade the parent to "working".
 */
function propagateSubagentStatuses(sessions: Session[]): void {
  // Build parent → children lookup
  const childrenByParent = new Map<string, Session[]>();
  const sessionById = new Map<string, Session>();

  for (const s of sessions) {
    sessionById.set(s.id, s);
    if (s.isSubagent && s.parentSessionId) {
      const children = childrenByParent.get(s.parentSessionId);
      if (children) {
        children.push(s);
      } else {
        childrenByParent.set(s.parentSessionId, [s]);
      }
    }
  }

  for (const session of sessions) {
    if (session.isSubagent) continue; // Only process parent sessions
    const children = childrenByParent.get(session.id);
    if (!children || children.length === 0) continue;

    // --- Reverse propagation: subagent activity can upgrade parent ---
    if (session.status === 'idle' || session.status === 'paused') {
      const hasRecentSubagent = children.some(child => {
        const childAge = Date.now() - new Date(child.lastActivity).getTime();
        return childAge < FIVE_MINUTES_MS;
      });
      if (hasRecentSubagent) {
        session.status = 'working';
      }
    }

    // --- Forward propagation: parent working → subagents working ---
    const activeSubagentNames: string[] = [];
    let hasAttention = false;

    for (const child of children) {
      // If parent is working, upgrade RECENT subagents only (within 5 min)
      if (session.status === 'working') {
        const childAge = Date.now() - new Date(child.lastActivity).getTime();
        if ((child.status === 'idle' || child.status === 'paused') && childAge < FIVE_MINUTES_MS) {
          child.status = 'working';
        }
      }

      // Track which subagents are actively working
      if (child.status === 'working' && child.agentName) {
        activeSubagentNames.push(child.agentName);
      }

      // Surface subagent attention states on parent
      if (child.status === 'error' || child.status === 'waiting-input' || child.status === 'waiting-approval') {
        hasAttention = true;
      }
    }

    session.subagentAttention = hasAttention || undefined;
    session.activeSubagentNames = activeSubagentNames.length > 0 ? activeSubagentNames : undefined;
  }
}

export class Aggregator extends EventEmitter {
  private state: DashboardState;
  private config: ConductorConfig;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;
  private paneMapping: ClaudePaneMapping = { byTasksDir: new Map(), byPid: new Map(), bySessionId: new Map(), byPaneTitle: new Map(), panePrompts: new Map(), byItermSession: new Map(), orphanItermSessions: [] };
  private discoveredFiles = new Map<string, DiscoveredFile>();
  private workState: FullWorkState = { features: null, backlogs: null, conductor: null, index: null };
  readonly projectFilter: string;

  private adapter: PlatformAdapter | null;

  constructor(config: ConductorConfig, adapter?: PlatformAdapter) {
    super();
    this.config = config;
    this.adapter = adapter ?? null;
    this.projectFilter = projectDirFromPath(consumerRoot);
    this.state = {
      sessions: [],
      projects: [],
      tasksBySession: {},
      events: [],
      sessionActivities: {},
      directiveState: null,
      directiveHistory: [],
      activeDirectives: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  getState(): DashboardState {
    return this.state;
  }

  getActiveSessions() {
    // Any session that's not idle/done — includes working, paused, waiting-input, waiting-approval, error
    // "paused" means < 1hr old, user may still be thinking/reading
    // Only "idle" (> 1hr) is safe to assume abandoned
    return this.state.sessions.filter(s => s.status !== 'idle' && s.status !== 'done');
  }

  initialize(): void {
    console.log('[aggregator] Initializing state from filesystem...');

    const { bySession: tasksBySession } = parseAllTasks(this.config.claudeHome, new Set());
    const events = getRecentEvents(200);

    // Bootstrap all session file states (incremental parser) — scoped to this project
    console.log(`[aggregator] Session scope: ${this.projectFilter}`);
    this.discoveredFiles = this.adapter
      ? this.adapter.initializeAllFileStates(this.projectFilter)
      : initializeAllFileStatesRaw(this.config.claudeHome, this.projectFilter);

    // Build sessions from file states + hook events
    const { sessions, projects } = this.buildSessionsFromFileStates(events);

    const sessionActivities = this.buildSessionActivities();

    this.state = {
      sessions,
      projects,
      tasksBySession,
      events,
      sessionActivities,
      directiveState: null,
      directiveHistory: [],
      activeDirectives: [],
      lastUpdated: new Date().toISOString(),
    };

    const activeSessions = sessions.filter((s) => s.status === 'working').length;
    console.log(
      `[aggregator] Initialized: ${events.length} events, ${sessions.length} sessions (${activeSessions} active), ${projects.length} projects`
    );

    this.refreshProcessDiscovery();
    this.discoveryTimer = setInterval(() => this.refreshProcessDiscovery(), 30_000);

    this.detectStaleness();
    this.staleTimer = setInterval(() => this.detectStaleness(), 60_000);
  }

  refreshAll(): void {
    this.refreshSessions();
  }

  updateDirectiveState(directiveState: DirectiveState | null, directiveHistory?: DirectiveState[], activeDirectives?: DirectiveState[]): void {
    this.state.directiveState = directiveState;
    if (directiveHistory !== undefined) {
      this.state.directiveHistory = directiveHistory;
    }
    if (activeDirectives !== undefined) {
      this.state.activeDirectives = activeDirectives;
    }
    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('directive_updated');
  }

  updateWorkState(workState: FullWorkState): void {
    this.workState = workState;
    this.state.lastUpdated = new Date().toISOString();
    this.emitChange('state_updated');
  }

  getWorkState(): FullWorkState {
    return this.workState;
  }

  getWorkItems(filters?: WorkItemFilter): WorkItem[] {
    const items: WorkItem[] = [];

    // Collect all items
    if (this.workState.features) {
      items.push(...this.workState.features.features as unknown as WorkItem[]);
    }
    if (this.workState.backlogs) {
      items.push(...this.workState.backlogs.items as unknown as WorkItem[]);
    }
    if (this.workState.conductor) {
      // Guard each array with ?? [] — conductor.json is read via plain JSON.parse
      // cast, so individual fields may be missing/undefined if the file is partial.
      items.push(...(this.workState.conductor.directives ?? []) as unknown as WorkItem[]);
      items.push(...(this.workState.conductor.reports ?? []) as unknown as WorkItem[]);
      items.push(...(this.workState.conductor.discussions ?? []) as unknown as WorkItem[]);
      items.push(...(this.workState.conductor.research ?? []) as unknown as WorkItem[]);
    }

    if (!filters) return items;

    return items.filter(item => {
      if (filters.type && item.type !== filters.type) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.q) {
        const q = filters.q.toLowerCase();
        const searchable = `${item.title} ${item.id}`.toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }

  refreshSessions(): void {
    const newDiscovered = this.adapter
      ? this.adapter.discoverSessionFiles(this.projectFilter)
      : discoverSessionFilesRaw(this.config.claudeHome, this.projectFilter);

    for (const [filePath] of newDiscovered) {
      if (!this.discoveredFiles.has(filePath)) {
        if (this.adapter) {
          this.adapter.getOrBootstrap(filePath);
        } else {
          getOrBootstrapRaw(filePath);
        }
      }
    }
    for (const [filePath] of this.discoveredFiles) {
      if (!newDiscovered.has(filePath)) {
        if (this.adapter) {
          this.adapter.removeFileState(filePath);
        } else {
          removeFileStateRaw(filePath);
        }
      }
    }
    this.discoveredFiles = newDiscovered;

    const { sessions, projects } = this.buildSessionsFromFileStates(this.state.events);

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
    const fileStates = this.adapter ? this.adapter.getAllFileStates() : getAllFileStatesRaw();
    let statusChanged = false;
    let activityChanged = false;

    // Build sessionId → filePath lookup
    const sessionToFilePath = new Map<string, string>();
    for (const [fp, discovered] of this.discoveredFiles) {
      sessionToFilePath.set(discovered.sessionId, fp);
    }

    // Build set of session IDs with live processes (from pane mapping)
    const liveSessionIds = new Set<string>();
    for (const [sessionId] of this.paneMapping.bySessionId) {
      liveSessionIds.add(sessionId);
    }
    // Also check byTasksDir which maps tasksId → paneId
    for (const session of this.state.sessions) {
      if (session.tasksId && this.paneMapping.byTasksDir.has(session.tasksId)) {
        liveSessionIds.add(session.id);
      }
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
      let newStatus = deriveSessionStatus(ageMs, lastEntryType, eventInfo);

      // Process-aware override: if a live claude process exists for this session,
      // it shouldn't be idle — upgrade to at least 'paused' (running but quiet)
      if (liveSessionIds.has(session.id) && (newStatus === 'idle')) {
        newStatus = 'paused';
      }

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

    // Re-run propagation after individual status re-derivation
    propagateSubagentStatuses(this.state.sessions);

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
      if (fileState.agentName) existing.agentName = fileState.agentName;
      if (fileState.agentRole) existing.agentRole = fileState.agentRole;
      existing.lastActivity = new Date(fileState.mtimeMs).toISOString();
      existing.fileSize = fileState.fileSize;
    }

    // Re-run propagation since this session's status may affect parent/children
    propagateSubagentStatuses(this.state.sessions);

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
    // teamPaneSessionIds was removed with the teams subsystem — use empty set
    const teamPaneSessionIds = new Set<string>();
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

    // Pass 3.6: Orphan iTerm matching (sessions where claude has exited)
    if (this.paneMapping.orphanItermSessions.length > 0) {
      for (const orphan of this.paneMapping.orphanItermSessions) {
        const itermPaneId = `iterm:${orphan.itermId}`;
        if (assignedPaneIds.has(itermPaneId)) continue;

        // Strategy A: Try candidate session IDs in order (most recent first)
        if (orphan.candidateSessionIds.length > 0) {
          for (const candidateId of orphan.candidateSessionIds) {
            const session = sortedSessions.find(s =>
              s.id === candidateId && !s.paneId && !s.isSubagent
            );
            if (session) {
              session.paneId = itermPaneId;
              assignedPaneIds.add(itermPaneId);
              changed = true;
              break;
            }
          }
          if (assignedPaneIds.has(itermPaneId)) continue;
        }

        // Strategy B: CWD matching (only if exactly 1 candidate)
        if (orphan.cwd) {
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
    }

    // Pass 3.9: Active session reclamation — if an active session has no pane but
    // matches scrollback content in a pane currently assigned to an idle session,
    // the active session steals the pane. This handles the common case of resuming
    // a different session in the same tmux pane (stale title match).
    if (this.paneMapping.panePrompts.size > 0) {
      const activeSessions = sortedSessions.filter(
        (s) => !s.paneId && !teamPaneSessionIds.has(s.id) && !s.isSubagent &&
          hasLikelyPane(s) &&
          (s.status === 'working' || s.status === 'waiting-input' || s.status === 'waiting-approval' || s.status === 'error')
      );

      for (const session of activeSessions) {
        const sessionTexts: string[] = [];
        if (session.latestPrompt) sessionTexts.push(session.latestPrompt.replace(/\.{3}$/, '').toLowerCase());
        if (session.initialPrompt) sessionTexts.push(session.initialPrompt.replace(/\.{3}$/, '').toLowerCase());
        if (sessionTexts.length === 0) continue;

        let bestPaneId: string | undefined;
        let bestScore = 0;

        for (const [paneId, panePromptList] of this.paneMapping.panePrompts) {
          // Only consider panes assigned to idle sessions
          const currentOwner = this.state.sessions.find((s) => s.paneId === paneId && !s.isSubagent);
          if (!currentOwner || currentOwner.status !== 'idle') continue;

          for (const panePrompt of panePromptList) {
            const paneLower = panePrompt.toLowerCase();
            for (const sessionText of sessionTexts) {
              if (paneLower.includes(sessionText) || sessionText.includes(paneLower)) {
                const matchLen = Math.min(paneLower.length, sessionText.length);
                const score = matchLen + 100;
                if (score > bestScore) {
                  bestScore = score;
                  bestPaneId = paneId;
                }
              }
            }
          }
        }

        if (bestPaneId && bestScore > 100) {
          // Steal the pane from the idle session
          const oldOwner = this.state.sessions.find((s) => s.paneId === bestPaneId && !s.isSubagent);
          if (oldOwner) {
            oldOwner.paneId = undefined;
          }
          session.paneId = bestPaneId;
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

    // Fifth pass: derive terminalApp from paneId format
    for (const session of this.state.sessions) {
      let newTerminalApp: Session['terminalApp'];
      if (!session.paneId) {
        newTerminalApp = undefined;
      } else if (/^%\d+$/.test(session.paneId)) {
        newTerminalApp = 'tmux';
      } else if (session.paneId.startsWith('iterm:')) {
        newTerminalApp = 'iterm2';
      } else if (session.paneId.startsWith('warp:')) {
        newTerminalApp = 'warp';
      } else if (session.paneId.startsWith('terminal:')) {
        newTerminalApp = 'terminal';
      } else {
        newTerminalApp = 'unknown';
      }
      if (session.terminalApp !== newTerminalApp) {
        session.terminalApp = newTerminalApp;
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
    const fileStates = this.adapter ? this.adapter.getAllFileStates() : getAllFileStatesRaw();

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
        agentName: state?.agentName,
        agentRole: state?.agentRole,
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

    // Propagate statuses between parent and subagent sessions
    propagateSubagentStatuses(sessions);

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
    const fileStates = this.adapter ? this.adapter.getAllFileStates() : getAllFileStatesRaw();

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
      case 'elicitation_dialog':
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

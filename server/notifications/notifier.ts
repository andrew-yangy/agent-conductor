import { EventEmitter } from 'node:events';
import { sendMacNotification } from './macos.js';
import type { Aggregator } from '../state/aggregator.js';
import type { NotificationConfig, Session, WsMessageType } from '../types.js';

const DEDUP_WINDOW_MS = 30_000;
const CLEANUP_INTERVAL_MS = 60_000;

const NOTIFIABLE_STATUSES = new Set<Session['status']>([
  'waiting-input',
  'waiting-approval',
  'error',
]);

interface NotificationFiredPayload {
  sessionId: string;
  suppressBrowser: boolean;
}

export class Notifier extends EventEmitter {
  private dedup: Map<string, number>;
  private config: NotificationConfig;
  private aggregator: Aggregator;
  private prevSessions: Session[];
  private cleanupInterval: ReturnType<typeof setInterval> | null;

  constructor(aggregator: Aggregator, config: NotificationConfig) {
    super();
    this.aggregator = aggregator;
    this.config = config;
    this.dedup = new Map();
    this.prevSessions = [];
    this.cleanupInterval = null;
  }

  start(): void {
    this.aggregator.on('change', this.handleChange);

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, lastNotifiedMs] of this.dedup) {
        if (now - lastNotifiedMs > DEDUP_WINDOW_MS) {
          this.dedup.delete(sessionId);
        }
      }
    }, CLEANUP_INTERVAL_MS);
  }

  private handleChange = (type: WsMessageType): void => {
    if (type !== 'sessions_updated' && type !== 'event_added') return;

    const currentSessions = this.aggregator.getState().sessions;
    const staleTeamSessionIds = this.getStaleTeamSessionIds();

    for (const session of currentSessions) {
      if (!NOTIFIABLE_STATUSES.has(session.status)) continue;

      // Skip sessions belonging to stale teams
      if (staleTeamSessionIds.has(session.id)) continue;

      // Only notify on transitions INTO the notifiable status
      const prev = this.prevSessions.find((s) => s.id === session.id);
      if (prev?.status === session.status) continue;

      this.notify(session);
    }

    this.prevSessions = [...currentSessions];
  };

  private getStaleTeamSessionIds(): Set<string> {
    const staleIds = new Set<string>();
    const { teams } = this.aggregator.getState();

    for (const team of teams) {
      if (!team.stale) continue;

      if (team.leadSessionId) staleIds.add(team.leadSessionId);
      for (const member of team.members) {
        if (member.agentId) staleIds.add(member.agentId);
      }
    }

    return staleIds;
  }

  private notify(session: Session): void {
    const now = Date.now();

    // Dedup: skip if notified within the window
    const lastNotified = this.dedup.get(session.id);
    if (lastNotified !== undefined && now - lastNotified < DEDUP_WINDOW_MS) return;

    this.dedup.set(session.id, now);

    const statusLabel =
      session.status === 'waiting-input'
        ? 'Needs input'
        : session.status === 'waiting-approval'
          ? 'Needs approval'
          : 'Error';

    if (this.config.macOS) {
      sendMacNotification(
        `Conductor: ${statusLabel}`,
        `Session ${session.id.slice(0, 8)}… in ${session.project}`,
      );
    }

    const payload: NotificationFiredPayload = {
      sessionId: session.id,
      suppressBrowser: this.config.macOS,
    };
    this.emit('notification_fired', payload);
  }

  updateConfig(config: NotificationConfig): void {
    this.config = config;
  }

  stop(): void {
    this.aggregator.removeListener('change', this.handleChange);

    if (this.cleanupInterval !== null) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.dedup.clear();
  }
}

import { EventEmitter } from 'node:events';
import { sendMacNotification } from './macos.js';
const DEDUP_WINDOW_MS = 30_000;
const CLEANUP_INTERVAL_MS = 60_000;
const NOTIFIABLE_STATUSES = new Set([
    'done',
    'waiting-input',
    'waiting-approval',
    'error',
]);
export class Notifier extends EventEmitter {
    dedup;
    config;
    aggregator;
    prevSessions;
    cleanupInterval;
    constructor(aggregator, config) {
        super();
        this.aggregator = aggregator;
        this.config = config;
        this.dedup = new Map();
        this.prevSessions = [];
        this.cleanupInterval = null;
    }
    start() {
        // Snapshot current sessions so we only notify on NEW transitions, not existing state
        this.prevSessions = [...this.aggregator.getState().sessions];
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
    handleChange = (type) => {
        if (type !== 'sessions_updated' && type !== 'event_added')
            return;
        const currentSessions = this.aggregator.getState().sessions;
        const staleTeamSessionIds = this.getStaleTeamSessionIds();
        for (const session of currentSessions) {
            if (!NOTIFIABLE_STATUSES.has(session.status))
                continue;
            // Skip sessions belonging to stale teams
            if (staleTeamSessionIds.has(session.id))
                continue;
            // Only notify on transitions INTO the notifiable status
            const prev = this.prevSessions.find((s) => s.id === session.id);
            if (prev?.status === session.status)
                continue;
            console.log(`[notifier] Transition: ${session.id.slice(0, 8)}… ${prev?.status ?? 'new'} → ${session.status}`);
            this.notify(session);
        }
        this.prevSessions = [...currentSessions];
    };
    getStaleTeamSessionIds() {
        const staleIds = new Set();
        const state = this.aggregator.getState();
        const teams = state.teams ?? [];
        for (const team of teams) {
            if (!team.stale)
                continue;
            if (team.leadSessionId)
                staleIds.add(team.leadSessionId);
            for (const member of team.members ?? []) {
                if (member.agentId)
                    staleIds.add(member.agentId);
            }
        }
        return staleIds;
    }
    notify(session) {
        const now = Date.now();
        // Dedup: skip if notified within the window
        const lastNotified = this.dedup.get(session.id);
        if (lastNotified !== undefined && now - lastNotified < DEDUP_WINDOW_MS) {
            console.log(`[notifier] Dedup skip: ${session.id.slice(0, 8)}… (${session.status})`);
            return;
        }
        this.dedup.set(session.id, now);
        const statusLabel = session.status === 'done'
            ? 'Done'
            : session.status === 'waiting-input'
                ? 'Needs input'
                : session.status === 'waiting-approval'
                    ? 'Needs approval'
                    : 'Error';
        console.log(`[notifier] Sending: ${statusLabel} for ${session.id.slice(0, 8)}… (macOS: ${this.config.macOS}, browser: ${this.config.browser})`);
        if (this.config.macOS) {
            sendMacNotification(`Conductor: ${statusLabel}`, `Session ${session.id.slice(0, 8)}… in ${session.project}`);
        }
        const payload = {
            sessionId: session.id,
            suppressBrowser: this.config.macOS,
        };
        this.emit('notification_fired', payload);
    }
    updateConfig(config) {
        this.config = config;
    }
    stop() {
        this.aggregator.removeListener('change', this.handleChange);
        if (this.cleanupInterval !== null) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.dedup.clear();
    }
}

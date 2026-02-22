import { create } from 'zustand';
import type { DashboardState, Session, HookEvent, Team, TeamTask, SessionActivity, NotificationConfig } from './types';

interface DashboardStore extends DashboardState {
  connected: boolean;
  notificationConfig: NotificationConfig;
  notificationFired: Record<string, number>;
  setFullState: (state: DashboardState) => void;
  updateSessions: (sessions: Session[]) => void;
  updateTeams: (teams: Team[]) => void;
  updateTasks: (tasksByTeam: Record<string, TeamTask[]>) => void;
  addEvent: (event: HookEvent) => void;
  updateEvents: (events: HookEvent[]) => void;
  setConnected: (connected: boolean) => void;
  updateSessionActivities: (activities: Record<string, SessionActivity>) => void;
  updateNotificationConfig: (config: NotificationConfig) => void;
  addNotificationFired: (sessionId: string) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  teams: [],
  sessions: [],
  tasksByTeam: {},
  events: [],
  sessionActivities: {},
  lastUpdated: '',
  connected: false,
  notificationConfig: { macOS: false, browser: true },
  notificationFired: {},

  setFullState: (state) =>
    set({
      teams: state.teams ?? [],
      sessions: state.sessions ?? [],
      tasksByTeam: state.tasksByTeam ?? {},
      events: state.events ?? [],
      lastUpdated: state.lastUpdated || new Date().toISOString(),
    }),

  updateSessions: (sessions) =>
    set({ sessions, lastUpdated: new Date().toISOString() }),

  updateTeams: (teams) =>
    set({ teams, lastUpdated: new Date().toISOString() }),

  updateTasks: (tasksByTeam) =>
    set({ tasksByTeam, lastUpdated: new Date().toISOString() }),

  addEvent: (event) =>
    set((state) => ({
      events: [event, ...state.events].slice(0, 200),
      lastUpdated: new Date().toISOString(),
    })),

  updateEvents: (events) =>
    set({ events, lastUpdated: new Date().toISOString() }),

  setConnected: (connected) => set({ connected }),

  updateSessionActivities: (activities) =>
    set((state) => ({
      sessionActivities: { ...state.sessionActivities, ...activities },
    })),

  updateNotificationConfig: (config) =>
    set({ notificationConfig: config }),

  addNotificationFired: (sessionId) =>
    set((state) => ({
      notificationFired: { ...state.notificationFired, [sessionId]: Date.now() },
    })),
}));

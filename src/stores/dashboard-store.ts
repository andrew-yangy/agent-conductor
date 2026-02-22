import { create } from 'zustand';
import type { DashboardState, Session, HookEvent, Team, TeamTask, SessionActivity, NotificationConfig, ProjectGroup } from './types';

interface DashboardStore extends DashboardState {
  connected: boolean;
  notificationConfig: NotificationConfig;
  notificationFired: Record<string, number>;
  setFullState: (state: DashboardState) => void;
  updateSessions: (sessions: Session[]) => void;
  updateProjects: (projects: ProjectGroup[]) => void;
  updateTeams: (teams: Team[]) => void;
  updateTasks: (tasksByTeam: Record<string, TeamTask[]>, tasksBySession?: Record<string, TeamTask[]>) => void;
  addEvent: (event: HookEvent) => void;
  updateEvents: (events: HookEvent[]) => void;
  setConnected: (connected: boolean) => void;
  updateSessionActivities: (activities: Record<string, SessionActivity>) => void;
  updateNotificationConfig: (config: NotificationConfig) => void;
  addNotificationFired: (sessionId: string) => void;
  deleteTeam: (teamName: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  teams: [],
  sessions: [],
  projects: [],
  tasksByTeam: {},
  tasksBySession: {},
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
      projects: state.projects ?? [],
      tasksByTeam: state.tasksByTeam ?? {},
      tasksBySession: state.tasksBySession ?? {},
      events: state.events ?? [],
      lastUpdated: state.lastUpdated || new Date().toISOString(),
    }),

  updateSessions: (sessions) =>
    set({ sessions, lastUpdated: new Date().toISOString() }),

  updateProjects: (projects) =>
    set({ projects, lastUpdated: new Date().toISOString() }),

  updateTeams: (teams) =>
    set({ teams, lastUpdated: new Date().toISOString() }),

  updateTasks: (tasksByTeam, tasksBySession) =>
    set((state) => ({
      tasksByTeam,
      tasksBySession: tasksBySession ?? state.tasksBySession,
      lastUpdated: new Date().toISOString(),
    })),

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

  deleteTeam: async (teamName) => {
    try {
      const res = await fetch(`http://localhost:4444/api/teams/${encodeURIComponent(teamName)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('Failed to delete team:', data.error);
      }
    } catch (err) {
      console.error('Failed to delete team:', err);
    }
  },
}));

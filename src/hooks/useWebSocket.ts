import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import type { WsMessage, DashboardState, DirectiveState, GoalInventory, Session, HookEvent, Team, TeamTask, SessionActivity, NotificationConfig, ProjectGroup, FullWorkState } from '@/stores/types';

const WS_URL = 'ws://localhost:4444';
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    setFullState,
    updateSessions,
    updateProjects,
    updateTeams,
    updateTasks,
    addEvent,
    updateEvents,
    setConnected,
    updateSessionActivities,
    updateDirectiveState,
    updateGoalInventory,
    setWorkState,
    updateNotificationConfig,
    addNotificationFired,
  } = useDashboardStore();

  useEffect(() => {
    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        reconnectDelayRef.current = 1000;

        // Fetch notification config (not included in full_state)
        fetch('http://localhost:4444/api/config')
          .then((res) => res.json())
          .then((data: { notifications?: NotificationConfig }) => {
            if (data.notifications) updateNotificationConfig(data.notifications);
          })
          .catch(() => {});

        // Fetch initial work state
        fetch('http://localhost:4444/api/state/goals')
          .then((res) => res.json())
          .then((goals: FullWorkState['goals']) => {
            Promise.all([
              fetch('http://localhost:4444/api/state/features').then(r => r.json()),
              fetch('http://localhost:4444/api/state/backlogs').then(r => r.json()),
              fetch('http://localhost:4444/api/state/conductor').then(r => r.json()),
            ]).then(([features, backlogs, conductor]) => {
              setWorkState({ goals, features, backlogs, conductor, index: null });
            }).catch(() => {});
          })
          .catch(() => {});
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.version !== 1) return;

          const payload = msg.payload as Record<string, unknown>;

          switch (msg.type) {
            case 'full_state':
              setFullState(msg.payload as DashboardState);
              break;
            case 'sessions_updated':
              updateSessions(payload.sessions as Session[]);
              break;
            case 'projects_updated':
              updateProjects(payload.projects as ProjectGroup[]);
              break;
            case 'teams_updated':
              updateTeams(payload.teams as Team[]);
              break;
            case 'tasks_updated':
              updateTasks(
                payload.tasksByTeam as Record<string, TeamTask[]>,
                payload.tasksBySession as Record<string, TeamTask[]> | undefined
              );
              break;
            case 'event_added': {
              const events = payload.events as HookEvent[];
              if (events?.[0]) addEvent(events[0]);
              break;
            }
            case 'events_updated':
              updateEvents(payload.events as HookEvent[]);
              break;
            case 'session_activities_updated':
              updateSessionActivities(payload.sessionActivities as Record<string, SessionActivity>);
              break;
            case 'directive_updated':
              updateDirectiveState(payload.directiveState as DirectiveState | null);
              break;
            case 'goals_updated':
              updateGoalInventory(payload.goalInventory as GoalInventory | null);
              break;
            case 'state_updated':
              setWorkState(payload.workState as FullWorkState);
              break;
            case 'config_updated':
              updateNotificationConfig(payload.notifications as NotificationConfig);
              break;
            case 'notification_fired':
              addNotificationFired(payload.sessionId as string);
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current) return;

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          MAX_RECONNECT_DELAY
        );
        connect();
      }, reconnectDelayRef.current);
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [setFullState, updateSessions, updateProjects, updateTeams, updateTasks, addEvent, updateEvents, setConnected, updateSessionActivities, updateDirectiveState, updateGoalInventory, setWorkState, updateNotificationConfig, addNotificationFired]);
}

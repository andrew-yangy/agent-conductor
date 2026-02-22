import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import type { WsMessage, DashboardState, Session, HookEvent, Team, TeamTask, SessionActivity, NotificationConfig } from '@/stores/types';

const WS_URL = 'ws://localhost:4444';
const MAX_RECONNECT_DELAY = 30000;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    setFullState,
    updateSessions,
    updateTeams,
    updateTasks,
    addEvent,
    updateEvents,
    setConnected,
    updateSessionActivities,
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
            case 'teams_updated':
              updateTeams(payload.teams as Team[]);
              break;
            case 'tasks_updated':
              updateTasks(payload.tasksByTeam as Record<string, TeamTask[]>);
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
  }, [setFullState, updateSessions, updateTeams, updateTasks, addEvent, updateEvents, setConnected, updateSessionActivities, updateNotificationConfig, addNotificationFired]);
}

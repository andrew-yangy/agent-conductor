import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useDashboardStore } from '@/stores/dashboard-store';

const DEDUP_WINDOW_MS = 30_000;
const MACOS_SUPPRESS_WINDOW_MS = 5_000;
const NOTIFICATION_FIRED_CLEANUP_MS = 10_000;

const notifiedMap = new Map<string, number>();

function statusIcon(status: string): string {
  switch (status) {
    case 'done': return '\u2705';
    case 'waiting-input': return '\u2753';
    case 'waiting-approval': return '\u26a0\ufe0f';
    case 'error': return '\u274c';
    default: return '\u2022';
  }
}

function statusToastType(status: string): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'done': return 'success';
    case 'error': return 'error';
    case 'waiting-approval': return 'warning';
    default: return 'info';
  }
}

export function useNotifications() {
  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }, []);

  const notify = useCallback((title: string, body: string, onClick?: () => void) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: title, // Replaces existing notification with same tag
    });

    if (onClick) {
      notification.onclick = () => {
        window.focus();
        onClick();
        notification.close();
      };
    }
  }, []);

  // Subscribe to store: fire notifications when sessions need attention
  useEffect(() => {
    const unsubscribe = useDashboardStore.subscribe((state, prevState) => {
      const now = Date.now();

      for (const session of state.sessions) {
        if (session.status !== 'done' && session.status !== 'waiting-input' && session.status !== 'waiting-approval' && session.status !== 'error') continue;

        // Check if this session was already in this status
        const prev = prevState.sessions.find((s) => s.id === session.id);
        if (prev?.status === session.status) continue;

        // Deduplicate within 30 seconds
        const lastNotified = notifiedMap.get(session.id);
        if (lastNotified && now - lastNotified < DEDUP_WINDOW_MS) continue;

        // Skip if macOS already sent a notification for this session recently
        const macOSFiredAt = state.notificationFired[session.id];
        if (macOSFiredAt && now - macOSFiredAt < MACOS_SUPPRESS_WINDOW_MS) continue;

        notifiedMap.set(session.id, now);

        // Clean up old entries from notifiedMap
        for (const [key, time] of notifiedMap) {
          if (now - time > DEDUP_WINDOW_MS * 2) {
            notifiedMap.delete(key);
          }
        }

        // Clean up stale entries from notificationFired in the store
        const staleIds = Object.entries(state.notificationFired)
          .filter(([, time]) => now - time > NOTIFICATION_FIRED_CLEANUP_MS)
          .map(([id]) => id);

        if (staleIds.length > 0) {
          const cleaned = { ...state.notificationFired };
          for (const id of staleIds) {
            delete cleaned[id];
          }
          useDashboardStore.setState({ notificationFired: cleaned });
        }

        const statusLabel = session.status === 'error' ? 'Error' :
          session.status === 'done' ? 'Done' :
          session.status === 'waiting-input' ? 'Needs input' : 'Needs approval';

        const sessionLabel = session.initialPrompt
          ?? session.feature
          ?? (session.project !== 'unknown' ? session.project : null)
          ?? session.slug
          ?? session.id.slice(0, 12);
        const icon = statusIcon(session.status);

        // In-app toast (always shown)
        toast[statusToastType(session.status)](
          `${icon} ${statusLabel}: ${sessionLabel}`,
          { description: session.project, duration: 8000 },
        );

        // Browser notification (if enabled and permitted)
        if (state.notificationConfig.browser !== false) {
          notify(
            `Conductor: ${statusLabel}`,
            `${sessionLabel} — ${session.project}`,
          );
        }
      }
    });

    return unsubscribe;
  }, [notify]);

  return { requestPermission, notify };
}

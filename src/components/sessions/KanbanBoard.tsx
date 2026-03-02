import { useMemo } from 'react';
import KanbanColumn from './KanbanColumn';
import type { Session, SessionActivity, TeamTask } from '@/stores/types';

interface ColumnDef {
  key: string;
  title: string;
  color: string;
  statuses: Session['status'][];
  sort: (a: Session, b: Session) => number;
}

// Most recently active first
const byRecentFirst = (a: Session, b: Session) =>
  new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();

// Errors first, then oldest first (longest-waiting = most urgent)
const byUrgency = (a: Session, b: Session) => {
  if (a.status === 'error' && b.status !== 'error') return -1;
  if (b.status === 'error' && a.status !== 'error') return 1;
  return new Date(a.lastActivity).getTime() - new Date(b.lastActivity).getTime();
};

const COLUMNS: ColumnDef[] = [
  { key: 'working', title: 'Working', color: 'bg-status-green', statuses: ['working'], sort: byRecentFirst },
  { key: 'needs-you', title: 'Needs You', color: 'bg-status-yellow', statuses: ['waiting-approval', 'waiting-input', 'error'], sort: byUrgency },
  { key: 'done', title: 'Done', color: 'bg-status-gray', statuses: ['done', 'paused', 'idle'], sort: byRecentFirst },
];

interface KanbanBoardProps {
  sessions: Session[];
  sessionActivities: Record<string, SessionActivity>;
  sessionTeamMap: Map<string, { teamName: string; memberName: string }>;
  sessionPaneMap: Map<string, string>;
  tasksBySession: Record<string, TeamTask[]>;
}

export default function KanbanBoard({
  sessions,
  sessionActivities,
  sessionTeamMap,
  sessionPaneMap,
  tasksBySession,
}: KanbanBoardProps) {
  // Build parent info lookup: sessionId → parent display name
  // So subagent cards can show "spawned by {parent}"
  const sessionById = useMemo(() => {
    const map = new Map<string, Session>();
    for (const s of sessions) map.set(s.id, s);
    return map;
  }, [sessions]);

  const parentInfoMap = useMemo(() => {
    const map = new Map<string, { name: string; agentName?: string }>();
    for (const session of sessions) {
      if (!session.parentSessionId) continue;
      const parent = sessionById.get(session.parentSessionId);
      if (!parent) continue;
      const parentTeam = sessionTeamMap.get(parent.id);
      const name = parent.agentName
        ?? (parentTeam ? `${parentTeam.teamName}/${parentTeam.memberName}` : null)
        ?? parent.initialPrompt?.slice(0, 30)
        ?? parent.id.slice(0, 8);
      map.set(session.id, { name, agentName: parent.agentName });
    }
    return map;
  }, [sessions, sessionById, sessionTeamMap]);

  // All sessions are top-level cards — subagents get their own cards
  // Group by column based on status
  const columnData = useMemo(() => {
    const statusToColumn = new Map<string, string>();
    for (const col of COLUMNS) {
      for (const status of col.statuses) {
        statusToColumn.set(status, col.key);
      }
    }

    const grouped = new Map<string, Session[]>();
    for (const col of COLUMNS) {
      grouped.set(col.key, []);
    }

    for (const session of sessions) {
      const colKey = statusToColumn.get(session.status) ?? 'idle';
      grouped.get(colKey)!.push(session);
    }

    // Sort each column: parents before their children, then by column sort
    for (const col of COLUMNS) {
      const list = grouped.get(col.key)!;
      list.sort((a, b) => {
        // Group children right after their parent
        const aParent = a.parentSessionId ?? a.id;
        const bParent = b.parentSessionId ?? b.id;
        if (aParent !== bParent) {
          // Get the parent sessions for time-based sorting
          const aRoot = sessionById.get(aParent) ?? a;
          const bRoot = sessionById.get(bParent) ?? b;
          return col.sort(aRoot, bRoot);
        }
        // Same parent group: parent first, then children by activity
        if (!a.parentSessionId && b.parentSessionId) return -1;
        if (a.parentSessionId && !b.parentSessionId) return 1;
        return col.sort(a, b);
      });
    }

    return grouped;
  }, [sessions, sessionById]);

  return (
    <div className="flex gap-3 h-[calc(100vh-160px)] overflow-x-auto pb-2">
      {COLUMNS.map((col) => {
        const colSessions = columnData.get(col.key) ?? [];
        return (
          <KanbanColumn
            key={col.key}
            title={col.title}
            color={col.color}
            count={colSessions.length}
            sessions={colSessions}
            sessionActivities={sessionActivities}
            sessionTeamMap={sessionTeamMap}
            sessionPaneMap={sessionPaneMap}
            tasksBySession={tasksBySession}
            parentInfoMap={parentInfoMap}
          />
        );
      })}
    </div>
  );
}

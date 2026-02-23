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
  // Build subagent lookup: parentSessionId → subagent sessions
  const subagentMap = useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      if (session.isSubagent && session.parentSessionId) {
        const existing = map.get(session.parentSessionId) ?? [];
        existing.push(session);
        map.set(session.parentSessionId, existing);
      }
    }
    return map;
  }, [sessions]);

  // Build team member grouping: lead session → team member sessions
  // Team members spawned via Task tool are separate processes (not JSONL subagents),
  // so we need to group them under their team lead card.
  const { teamMemberMap, teamMemberIds } = useMemo(() => {
    const sessionIdSet = new Set(sessions.map((s) => s.id));

    // Find team leads from sessionTeamMap
    const leadByTeam = new Map<string, string>();
    for (const [sessionId, info] of sessionTeamMap) {
      if (info.memberName === 'lead' && sessionIdSet.has(sessionId)) {
        leadByTeam.set(info.teamName, sessionId);
      }
    }

    const memberMap = new Map<string, Session[]>();
    const memberIds = new Set<string>();

    for (const session of sessions) {
      if (session.isSubagent) continue;
      const info = sessionTeamMap.get(session.id);
      if (!info || info.memberName === 'lead') continue;

      const leadId = leadByTeam.get(info.teamName);
      if (!leadId) continue;

      memberIds.add(session.id);
      const existing = memberMap.get(leadId) ?? [];
      existing.push(session);
      memberMap.set(leadId, existing);
    }

    return { teamMemberMap: memberMap, teamMemberIds: memberIds };
  }, [sessions, sessionTeamMap]);

  // Merge JSONL subagents + team members into one map for card nesting
  const combinedSubagentMap = useMemo(() => {
    const map = new Map(subagentMap);
    for (const [leadId, members] of teamMemberMap) {
      const existing = map.get(leadId) ?? [];
      map.set(leadId, [...existing, ...members]);
    }
    return map;
  }, [subagentMap, teamMemberMap]);

  // Only parent sessions (not subagents, not team members) go into columns
  const parentSessions = useMemo(
    () => sessions.filter((s) => !s.isSubagent && !teamMemberIds.has(s.id)),
    [sessions, teamMemberIds]
  );

  // Group parent sessions by column
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

    for (const session of parentSessions) {
      const colKey = statusToColumn.get(session.status) ?? 'idle';
      grouped.get(colKey)!.push(session);
    }

    // Sort each column
    for (const col of COLUMNS) {
      const list = grouped.get(col.key)!;
      list.sort(col.sort);
    }

    return grouped;
  }, [parentSessions]);

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
            subagentMap={combinedSubagentMap}
          />
        );
      })}
    </div>
  );
}

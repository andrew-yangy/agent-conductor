import { useState, useMemo } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import SessionTree from './SessionTree';
import type { Session, ProjectGroup } from '@/stores/types';

const TIME_FILTERS = [
  { value: 'active', label: 'Active now' },
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24h' },
  { value: 'all', label: 'All' },
] as const;

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'working', label: 'Working' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'idle', label: 'Idle' },
  { value: 'error', label: 'Error' },
] as const;

type TimeFilter = typeof TIME_FILTERS[number]['value'];
type StatusFilter = typeof STATUS_FILTERS[number]['value'];

function passesTimeFilter(session: Session, filter: TimeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'active') return session.status === 'working' || session.status === 'waiting-approval' || session.status === 'waiting-input' || session.status === 'error';

  const cutoff = filter === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  return Date.now() - new Date(session.lastActivity).getTime() < cutoff;
}

function passesStatusFilter(session: Session, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'waiting') return session.status === 'waiting-input' || session.status === 'waiting-approval';
  return session.status === filter;
}

function emptyMessage(timeFilter: TimeFilter, statusFilter: StatusFilter): string {
  if (timeFilter === 'active') return 'No active sessions right now';
  if (timeFilter === '1h') return 'No sessions in the last hour';
  if (timeFilter === '24h') return 'No sessions in the last 24 hours';
  if (statusFilter !== 'all') return `No ${statusFilter} sessions`;
  return 'No sessions found';
}

export default function SessionsPage() {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('active');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { sessions, projects, teams, sessionActivities } = useDashboardStore();

  // Filter sessions
  const filteredSessions = useMemo(() =>
    sessions.filter((s) =>
      passesTimeFilter(s, timeFilter) && passesStatusFilter(s, statusFilter)
    ),
    [sessions, timeFilter, statusFilter]
  );

  // Build filtered projects (only include sessions that pass filters)
  const filteredProjects = useMemo(() => {
    const filteredIds = new Set(filteredSessions.filter((s) => !s.isSubagent).map((s) => s.id));

    return projects
      .map((p): ProjectGroup => ({
        ...p,
        sessions: p.sessions.filter((s) => filteredIds.has(s.id)),
      }))
      .filter((p) => p.sessions.length > 0);
  }, [projects, filteredSessions]);

  // Build session->team lookup
  const sessionTeamMap = useMemo(() => {
    const map = new Map<string, { teamName: string; memberName: string }>();
    for (const team of teams) {
      if (team.leadSessionId) {
        map.set(team.leadSessionId, { teamName: team.name, memberName: 'lead' });
      }
      for (const member of team.members) {
        if (member.agentId) {
          map.set(member.agentId, { teamName: team.name, memberName: member.name });
        }
      }
    }
    return map;
  }, [teams]);

  // Build session->paneId lookup (team members + process discovery)
  const sessionPaneMap = useMemo(() => {
    const map = new Map<string, string>();
    // From process discovery (on session objects)
    for (const session of sessions) {
      if (session.paneId) {
        map.set(session.id, session.paneId);
      }
    }
    // Team member mappings override (higher priority)
    for (const team of teams) {
      for (const member of team.members) {
        if (member.agentId && member.tmuxPaneId) {
          map.set(member.agentId, member.tmuxPaneId);
        }
      }
    }
    return map;
  }, [teams, sessions]);

  // Counts for filter badges
  const timeFilterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of TIME_FILTERS) {
      counts[f.value] = sessions.filter((s) => !s.isSubagent && passesTimeFilter(s, f.value)).length;
    }
    return counts;
  }, [sessions]);

  return (
    <div className="space-y-4">
      {/* Time filters */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Time:</span>
        {TIME_FILTERS.map((f) => (
          <Badge
            key={f.value}
            variant={timeFilter === f.value ? 'default' : 'secondary'}
            className={cn(
              'cursor-pointer transition-colors',
              timeFilter === f.value ? '' : 'hover:bg-secondary/80'
            )}
            onClick={() => setTimeFilter(f.value)}
          >
            {f.label} {timeFilterCounts[f.value] > 0 && `(${timeFilterCounts[f.value]})`}
          </Badge>
        ))}
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground mr-1">Status:</span>
        {STATUS_FILTERS.map((f) => {
          const count = filteredSessions.filter((s) => !s.isSubagent && passesStatusFilter(s, f.value)).length;
          return (
            <Badge
              key={f.value}
              variant={statusFilter === f.value ? 'default' : 'secondary'}
              className={cn(
                'cursor-pointer transition-colors',
                statusFilter === f.value ? '' : 'hover:bg-secondary/80'
              )}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label} {count > 0 && `(${count})`}
            </Badge>
          );
        })}
      </div>

      {/* Session Tree */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">{emptyMessage(timeFilter, statusFilter)}</p>
          {timeFilter === 'active' && (
            <p className="text-xs mt-1">Try expanding the time filter to see more sessions</p>
          )}
        </div>
      ) : (
        <SessionTree
          projects={filteredProjects}
          allSessions={filteredSessions}
          sessionActivities={sessionActivities}
          sessionTeamMap={sessionTeamMap}
          sessionPaneMap={sessionPaneMap}
        />
      )}
    </div>
  );
}

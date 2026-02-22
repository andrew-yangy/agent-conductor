import { useState } from 'react';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import SessionCard from './SessionCard';
import type { Session } from '@/stores/types';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'working', label: 'Working' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'idle', label: 'Idle' },
  { value: 'error', label: 'Error' },
] as const;

function statusPriority(status: Session['status']): number {
  switch (status) {
    case 'error': return 0;
    case 'waiting-input': return 1;
    case 'waiting-approval': return 2;
    case 'working': return 3;
    case 'idle': return 4;
    default: return 5;
  }
}

function matchesFilter(session: Session, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'waiting') return session.status === 'waiting-input' || session.status === 'waiting-approval';
  return session.status === filter;
}

export default function SessionsPage() {
  const [filter, setFilter] = useState('all');
  const { sessions, teams, sessionActivities } = useDashboardStore();

  const filtered = sessions
    .filter((s) => matchesFilter(s, filter))
    .sort((a, b) => statusPriority(a.status) - statusPriority(b.status));

  // Build session->team lookup
  const sessionTeamMap = new Map<string, { teamName: string; memberName: string }>();
  for (const team of teams) {
    if (team.leadSessionId) {
      sessionTeamMap.set(team.leadSessionId, { teamName: team.name, memberName: 'lead' });
    }
    for (const member of team.members) {
      if (member.agentId) {
        sessionTeamMap.set(member.agentId, { teamName: team.name, memberName: member.name });
      }
    }
  }

  // Also build session->paneId lookup
  const sessionPaneMap = new Map<string, string>();
  for (const team of teams) {
    for (const member of team.members) {
      if (member.agentId && member.tmuxPaneId) {
        sessionPaneMap.set(member.agentId, member.tmuxPaneId);
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        {STATUS_FILTERS.map((f) => {
          const count = f.value === 'all'
            ? sessions.length
            : sessions.filter((s) => matchesFilter(s, f.value)).length;
          return (
            <Badge
              key={f.value}
              variant={filter === f.value ? 'default' : 'secondary'}
              className={cn(
                'cursor-pointer transition-colors',
                filter === f.value ? '' : 'hover:bg-secondary/80'
              )}
              onClick={() => setFilter(f.value)}
            >
              {f.label} {count > 0 && `(${count})`}
            </Badge>
          );
        })}
      </div>

      {/* Session List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No sessions{filter !== 'all' ? ` matching "${filter}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              teamInfo={sessionTeamMap.get(session.id)}
              paneId={sessionPaneMap.get(session.id)}
              sessionActivity={sessionActivities[session.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

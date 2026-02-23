import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import ActivityLine from '@/components/shared/ActivityLine';
import type { Session, SessionActivity } from '@/stores/types';

interface ActiveSessionsProps {
  sessions: Session[];
  sessionActivities: Record<string, SessionActivity>;
}

function statusDotColor(status: Session['status']): string {
  switch (status) {
    case 'working': return 'bg-status-green';
    case 'waiting-input':
    case 'waiting-approval': return 'bg-status-yellow';
    case 'error': return 'bg-status-red';
    default: return 'bg-status-gray';
  }
}

export default function ActiveSessions({ sessions, sessionActivities }: ActiveSessionsProps) {
  // Show active (non-idle) parent sessions
  const activeSessions = sessions.filter(
    (s) => !s.isSubagent && s.status !== 'idle'
  );

  if (activeSessions.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Monitor className="h-4 w-4 text-muted-foreground" />
          Live Sessions ({activeSessions.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {activeSessions.map((session) => {
            const activity = sessionActivities[session.id];
            const title = session.initialPrompt ?? session.slug ?? session.id.slice(0, 12);

            return (
              <div key={session.id} className="flex items-center gap-2 py-1">
                <div
                  className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    statusDotColor(session.status),
                    session.status === 'working' && 'animate-pulse'
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{title}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(session.lastActivity)}
                    </span>
                  </div>
                  {activity?.active && (
                    <ActivityLine activity={activity} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

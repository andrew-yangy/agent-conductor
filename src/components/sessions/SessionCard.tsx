import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Terminal } from 'lucide-react';
import { cn, timeAgo, sessionStatusLabel } from '@/lib/utils';
import type { Session, SessionActivity } from '@/stores/types';
import QuickActions from '@/components/shared/QuickActions';
import ActivityLine from '@/components/shared/ActivityLine';

interface SessionCardProps {
  session: Session;
  teamInfo?: { teamName: string; memberName: string };
  paneId?: string;
  sessionActivity?: SessionActivity;
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

async function handleFocus(paneId: string) {
  try {
    await fetch('http://localhost:4444/api/actions/focus-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paneId }),
    });
  } catch {
    // Silent fail
  }
}

export default function SessionCard({ session, teamInfo, paneId, sessionActivity }: SessionCardProps) {
  const isActive = session.status === 'working';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full shrink-0',
                statusDotColor(session.status),
                isActive && 'animate-pulse'
              )}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono truncate">{session.id.slice(0, 12)}&hellip;</span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px]',
                    session.status === 'error' && 'text-status-red border-status-red/30',
                    (session.status === 'waiting-input' || session.status === 'waiting-approval') && 'text-status-yellow border-status-yellow/30',
                    session.status === 'working' && 'text-status-green border-status-green/30'
                  )}
                >
                  {sessionStatusLabel(session.status)}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                {teamInfo && (
                  <span>{teamInfo.teamName} / {teamInfo.memberName}</span>
                )}
                <span>{session.project}</span>
                <span>{timeAgo(session.lastActivity)}</span>
              </div>
            </div>
          </div>

          {paneId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs shrink-0"
              onClick={() => handleFocus(paneId)}
            >
              <Terminal className="h-3 w-3 mr-1" />
              Focus
            </Button>
          )}
        </div>

        {/* Activity line */}
        <ActivityLine activity={sessionActivity} />

        {/* Quick actions for waiting states */}
        {paneId && (
          <QuickActions paneId={paneId} sessionStatus={session.status} />
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn, timeAgo, sessionStatusLabel } from '@/lib/utils';
import type { Session, Team } from '@/stores/types';

interface AttentionRequiredProps {
  sessions: Session[];
  teams: Team[];
}

export default function AttentionRequired({ sessions, teams }: AttentionRequiredProps) {
  // Find team/member for each session
  function findTeamInfo(session: Session): string | null {
    for (const team of teams) {
      if (team.leadSessionId === session.id) return `${team.name} (lead)`;
      for (const member of team.members) {
        if (member.agentId === session.id) return `${team.name} / ${member.name}`;
      }
    }
    return null;
  }

  return (
    <Card className="border-status-yellow/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2 text-status-yellow">
          <AlertTriangle className="h-4 w-4" />
          Attention Required ({sessions.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sessions.map((session) => {
            const teamInfo = findTeamInfo(session);
            return (
              <div
                key={session.id}
                className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      session.status === 'error' ? 'bg-status-red' : 'bg-status-yellow'
                    )}
                  />
                  <span className="text-xs font-mono truncate">{session.id.slice(0, 8)}...</span>
                  {teamInfo && (
                    <span className="text-xs text-muted-foreground truncate">{teamInfo}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      session.status === 'error' ? 'text-status-red border-status-red/30' : 'text-status-yellow border-status-yellow/30'
                    )}
                  >
                    {sessionStatusLabel(session.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(session.lastActivity)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

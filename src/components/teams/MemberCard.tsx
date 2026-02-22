import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Terminal, ExternalLink } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import type { TeamMember, Session, TeamTask, SessionActivity } from '@/stores/types';
import QuickActions from '@/components/shared/QuickActions';
import SendInput from '@/components/shared/SendInput';
import ActivityLine from '@/components/shared/ActivityLine';

interface MemberCardProps {
  member: TeamMember;
  session?: Session;
  currentTask?: TeamTask;
  sessionActivity?: SessionActivity;
}

function memberStatusColor(member: TeamMember, session?: Session): string {
  if (session?.status === 'error') return 'bg-status-red';
  if (session?.status === 'waiting-input' || session?.status === 'waiting-approval') return 'bg-status-yellow';
  if (member.isActive) return 'bg-status-green';
  return 'bg-status-gray';
}

function memberStatusLabel(member: TeamMember, session?: Session): string {
  if (session?.status === 'error') return 'Error';
  if (session?.status === 'waiting-input') return 'Needs input';
  if (session?.status === 'waiting-approval') return 'Needs approval';
  if (session?.status === 'working') return 'Working';
  if (member.isActive) return 'Active';
  return 'Idle';
}

async function handleFocus(paneId: string) {
  try {
    await fetch('http://localhost:4444/api/actions/focus-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paneId }),
    });
  } catch {
    // Silent fail -- user can see if terminal didn't focus
  }
}

export default function MemberCard({ member, session, currentTask, sessionActivity }: MemberCardProps) {
  const statusColor = memberStatusColor(member, session);
  const statusLabel = memberStatusLabel(member, session);
  const isWorking = session?.status === 'working' || member.isActive;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full shrink-0',
                statusColor,
                isWorking && 'animate-pulse'
              )}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{member.name}</span>
                <span className="text-xs text-muted-foreground">{member.agentType}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{statusLabel}</span>
                {member.model && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {member.model.replace('claude-', '').replace('-4-6', '')}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {member.tmuxPaneId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => handleFocus(member.tmuxPaneId)}
            >
              <Terminal className="h-3 w-3 mr-1" />
              Focus
            </Button>
          )}
        </div>

        {/* Activity line */}
        <ActivityLine activity={sessionActivity} />

        {/* Current task */}
        {currentTask && (
          <div className="mt-3 p-2 rounded bg-secondary/50 text-xs">
            <span className="text-muted-foreground">Working on: </span>
            <span className="text-foreground">{currentTask.subject}</span>
          </div>
        )}

        {/* Quick actions for waiting states */}
        {session && member.tmuxPaneId && (
          <QuickActions
            paneId={member.tmuxPaneId}
            sessionStatus={session.status}
          />
        )}

        {/* Send free-text input */}
        {member.tmuxPaneId && session && (
          <SendInput paneId={member.tmuxPaneId} />
        )}

        {/* Pane ID */}
        {member.tmuxPaneId && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            <span className="font-mono">{member.tmuxPaneId}</span>
          </div>
        )}

        {/* Last activity */}
        {session?.lastActivity && (
          <div className="mt-1 text-xs text-muted-foreground">
            Last activity {timeAgo(session.lastActivity)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

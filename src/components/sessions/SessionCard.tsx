import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, GitBranch, HardDrive } from 'lucide-react';
import { cn, timeAgo, sessionStatusLabel } from '@/lib/utils';
import type { Session, SessionActivity } from '@/stores/types';
import QuickActions from '@/components/shared/QuickActions';
import ActivityLine from '@/components/shared/ActivityLine';

interface SessionCardProps {
  session: Session;
  teamInfo?: { teamName: string; memberName: string };
  paneId?: string;
  sessionActivity?: SessionActivity;
  compact?: boolean;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function shortModel(model?: string): string | null {
  if (!model) return null;
  return model
    .replace('claude-', '')
    .replace('-20251001', '')
    .replace('-20250514', '');
}

function shortCwd(cwd?: string): string | null {
  if (!cwd) return null;
  const parts = cwd.split('/').filter(Boolean);
  return parts.slice(-2).join('/');
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

export default function SessionCard({ session, teamInfo, paneId, sessionActivity, compact }: SessionCardProps) {
  const isActive = session.status === 'working';
  const model = shortModel(session.model ?? sessionActivity?.model);
  const cwd = shortCwd(session.cwd);

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-1 px-2 text-xs text-muted-foreground">
        <div
          className={cn(
            'h-1.5 w-1.5 rounded-full shrink-0',
            statusDotColor(session.status),
            isActive && 'animate-pulse'
          )}
        />
        <span className="font-mono truncate">
          {session.agentId ? session.agentId.slice(0, 8) : session.id.slice(0, 8)}
        </span>
        {model && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
            {model}
          </Badge>
        )}
        {sessionActivity?.active && sessionActivity.tool && (
          <span className="truncate">{sessionActivity.detail ?? sessionActivity.tool}</span>
        )}
        {!sessionActivity?.active && (
          <span>{timeAgo(session.lastActivity)}</span>
        )}
      </div>
    );
  }

  const title = session.initialPrompt ?? session.slug;
  const subtitle = session.initialPrompt ? session.slug : null;

  const cardContent = (
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
              {title ? (
                <span className="text-sm font-medium truncate">{title}</span>
              ) : (
                <span className="text-sm font-mono truncate">{session.id.slice(0, 12)}&hellip;</span>
              )}
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] shrink-0',
                  session.status === 'error' && 'text-status-red border-status-red/30',
                  (session.status === 'waiting-input' || session.status === 'waiting-approval') && 'text-status-yellow border-status-yellow/30',
                  session.status === 'working' && 'text-status-green border-status-green/30'
                )}
              >
                {sessionStatusLabel(session.status)}
              </Badge>
              {model && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 shrink-0">
                  {model}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              {subtitle && <span className="font-mono text-[10px]">{subtitle}</span>}
              {teamInfo && (
                <span>{teamInfo.teamName} / {teamInfo.memberName}</span>
              )}
              {session.gitBranch && session.gitBranch !== 'main' && (
                <span className="flex items-center gap-0.5">
                  <GitBranch className="h-3 w-3" />
                  {session.gitBranch}
                </span>
              )}
              {cwd && <span>{cwd}</span>}
              <span>{timeAgo(session.lastActivity)}</span>
              {session.fileSize > 0 && (
                <span className="flex items-center gap-0.5">
                  <HardDrive className="h-3 w-3" />
                  {formatFileSize(session.fileSize)}
                </span>
              )}
            </div>
          </div>
        </div>

        {paneId && (
          <div className="flex items-center gap-1 shrink-0">
            <Terminal className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Activity line */}
      <ActivityLine activity={sessionActivity} />

      {/* Quick actions for waiting states — stop propagation to prevent card click → focus */}
      {paneId && (
        <div onClick={(e) => e.stopPropagation()}>
          <QuickActions paneId={paneId} sessionStatus={session.status} />
        </div>
      )}
    </CardContent>
  );

  if (paneId) {
    return (
      <Card
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => handleFocus(paneId)}
      >
        {cardContent}
      </Card>
    );
  }

  return <Card>{cardContent}</Card>;
}

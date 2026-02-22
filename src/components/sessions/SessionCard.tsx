import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Terminal, GitBranch, HardDrive, ChevronDown, ChevronRight, Clock, MessageSquare, Users, Hash } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
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

  const latestPrompt = session.latestPrompt;
  const initialPrompt = session.initialPrompt;
  const title = latestPrompt ?? initialPrompt ?? session.slug;
  const hasSecondaryPrompt = latestPrompt && initialPrompt && latestPrompt !== initialPrompt;

  const cardContent = (
    <CardContent className="p-4">
      {/* Header row: status dot + title + badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full shrink-0',
              statusDotColor(session.status),
              isActive && 'animate-pulse'
            )}
          />
          <div className="min-w-0 flex-1">
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
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {paneId && <Terminal className="h-3 w-3 text-muted-foreground" />}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground"
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5" />
              : <ChevronRight className="h-3.5 w-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Metadata row: slug, team, branch, cwd, time, size */}
      <div className="flex items-center gap-2 mt-1 ml-[22px] text-xs text-muted-foreground flex-wrap">
        {session.slug && (
          <span className="font-mono text-[10px]">{session.slug}</span>
        )}
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
        <span className="flex items-center gap-0.5">
          <Clock className="h-3 w-3" />
          {timeAgo(session.lastActivity)}
        </span>
        {session.fileSize > 0 && (
          <span className="flex items-center gap-0.5">
            <HardDrive className="h-3 w-3" />
            {formatFileSize(session.fileSize)}
          </span>
        )}
        {session.subagentIds.length > 0 && (
          <span className="flex items-center gap-0.5">
            <Users className="h-3 w-3" />
            {session.subagentIds.length}
          </span>
        )}
      </div>

      {/* Initial prompt (when different from latest) */}
      {hasSecondaryPrompt && (
        <div className="mt-1.5 ml-[22px] flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="italic">{initialPrompt}</span>
        </div>
      )}

      {/* Activity line */}
      <div className="ml-[22px]">
        <ActivityLine activity={sessionActivity} />
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 ml-[22px] border-t border-border/50 pt-3 space-y-2 text-xs">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Session
            </span>
            <span className="font-mono text-foreground">{session.id}</span>

            {session.model && (
              <>
                <span>Model</span>
                <span className="text-foreground">{session.model}</span>
              </>
            )}

            {session.cwd && (
              <>
                <span>Working dir</span>
                <span className="font-mono text-foreground">{session.cwd}</span>
              </>
            )}

            {session.gitBranch && (
              <>
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  Branch
                </span>
                <span className="text-foreground">{session.gitBranch}</span>
              </>
            )}

            {session.version && (
              <>
                <span>Version</span>
                <span className="font-mono text-foreground">{session.version}</span>
              </>
            )}

            {session.fileSize > 0 && (
              <>
                <span>Log size</span>
                <span className="text-foreground">{formatFileSize(session.fileSize)}</span>
              </>
            )}

            <span>Last activity</span>
            <span className="text-foreground">{new Date(session.lastActivity).toLocaleString()}</span>

            {session.subagentIds.length > 0 && (
              <>
                <span>Subagents</span>
                <span className="text-foreground">{session.subagentIds.length} ({session.subagentIds.map(id => id.slice(0, 8)).join(', ')})</span>
              </>
            )}

            {session.initialPrompt && (
              <>
                <span>Initial prompt</span>
                <span className="text-foreground">{session.initialPrompt}</span>
              </>
            )}

            {session.latestPrompt && session.latestPrompt !== session.initialPrompt && (
              <>
                <span>Latest prompt</span>
                <span className="text-foreground">{session.latestPrompt}</span>
              </>
            )}

            {session.feature && (
              <>
                <span>Feature</span>
                <span className="text-foreground">{session.feature}</span>
              </>
            )}

            {session.tasksId && (
              <>
                <span>Tasks ID</span>
                <span className="font-mono text-foreground">{session.tasksId}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Quick actions for waiting states */}
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

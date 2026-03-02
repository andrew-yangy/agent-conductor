import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Clock, HardDrive, Terminal, MessageSquare, CornerDownRight, User } from 'lucide-react';
import { cn, timeAgo, sessionStatusLabel, terminalLabel } from '@/lib/utils';
import ActivityLine from '@/components/shared/ActivityLine';
import QuickActions from '@/components/shared/QuickActions';
import type { Session, SessionActivity, TeamTask } from '@/stores/types';

interface KanbanCardProps {
  session: Session;
  sessionActivity?: SessionActivity;
  teamInfo?: { teamName: string; memberName: string };
  paneId?: string;
  tasks: TeamTask[];
  parentInfo?: { name: string; agentName?: string };
}

function statusDotColor(status: Session['status']): string {
  switch (status) {
    case 'working': return 'bg-status-green';
    case 'done': return 'bg-status-done';
    case 'waiting-input':
    case 'waiting-approval': return 'bg-status-yellow';
    case 'error': return 'bg-status-red';
    default: return 'bg-status-gray';
  }
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Color for named agent badges */
function agentBadgeColor(name?: string): string {
  switch (name?.toLowerCase()) {
    case 'alex': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    case 'sarah': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    case 'morgan': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'marcus': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    case 'priya': return 'bg-pink-500/15 text-pink-400 border-pink-500/30';
    default: return 'bg-secondary text-muted-foreground border-border';
  }
}

/** Left border accent color for named agents */
function agentBorderColor(name?: string): string {
  switch (name?.toLowerCase()) {
    case 'alex': return 'border-l-blue-500/60';
    case 'sarah': return 'border-l-emerald-500/60';
    case 'morgan': return 'border-l-purple-500/60';
    case 'marcus': return 'border-l-amber-500/60';
    case 'priya': return 'border-l-pink-500/60';
    default: return '';
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

function TaskProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-status-green rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span>{completed}/{total} tasks</span>
      </div>
    </div>
  );
}

export default function KanbanCard({
  session,
  sessionActivity,
  teamInfo,
  paneId,
  tasks,
  parentInfo,
}: KanbanCardProps) {
  const isActive = session.status === 'working';
  const model = shortModel(session.model ?? sessionActivity?.model);
  const cwd = shortCwd(session.cwd);
  const needsAction = session.status === 'waiting-input' || session.status === 'waiting-approval' || session.status === 'error';
  const isSubagent = session.isSubagent && parentInfo;
  const isNamedAgent = !!session.agentName;

  // Title: named agent name takes priority, then team info, then prompt
  const title = session.agentName
    ? session.agentName
    : teamInfo
      ? `${teamInfo.teamName} / ${teamInfo.memberName}`
      : session.initialPrompt ?? session.latestPrompt ?? `${session.project} / ${session.id.slice(0, 8)}`;

  const latestPrompt = session.latestPrompt;
  const hasSecondaryPrompt = latestPrompt && latestPrompt !== title && latestPrompt !== session.initialPrompt;

  // For named agents, show initial prompt as context below the name
  const showPromptContext = isNamedAgent && session.initialPrompt;

  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length;

  const cardContent = (
    <CardContent className="p-3">
      {/* Spawned-by line for subagents */}
      {isSubagent && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1.5">
          <CornerDownRight className="h-3 w-3 shrink-0" />
          <span>
            spawned by{' '}
            {parentInfo.agentName ? (
              <span className={cn('font-semibold', parentInfo.agentName && 'text-foreground/70')}>
                {parentInfo.name}
              </span>
            ) : (
              <span className="truncate">{parentInfo.name}</span>
            )}
          </span>
        </div>
      )}

      {/* Row 1: Status dot + title */}
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'h-2.5 w-2.5 rounded-full shrink-0 mt-1',
            statusDotColor(session.status),
            isActive && 'animate-pulse'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {isNamedAgent && <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className={cn(
                'text-sm font-medium line-clamp-2 flex-1',
                isNamedAgent && 'font-semibold'
              )}>
                {title}
              </span>
              {session.agentRole && (
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 shrink-0', agentBadgeColor(session.agentName))}
                >
                  {session.agentRole}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {session.terminalApp && (
                <div className="flex items-center gap-0.5">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {terminalLabel(session.terminalApp)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Status badge + model badge */}
      <div className="flex items-center gap-1.5 mt-1.5 ml-[18px]">
        <Badge
          variant="outline"
          className={cn(
            'text-[10px] px-1.5 py-0',
            session.status === 'error' && 'text-status-red border-status-red/30',
            (session.status === 'waiting-input' || session.status === 'waiting-approval') && 'text-status-yellow border-status-yellow/30',
            session.status === 'working' && 'text-status-green border-status-green/30',
            session.status === 'done' && 'text-status-done border-status-done/30'
          )}
        >
          {sessionStatusLabel(session.status)}
        </Badge>
        {model && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {model}
          </Badge>
        )}
      </div>

      {/* Row 3: Activity line (prominent when active) */}
      {sessionActivity?.active && (
        <div className="ml-[18px] mt-1">
          <ActivityLine activity={sessionActivity} />
        </div>
      )}

      {/* Row 4: Initial prompt context for named agents */}
      {showPromptContext && (
        <div className="mt-1.5 ml-[18px] flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="italic line-clamp-2">{session.initialPrompt}</span>
        </div>
      )}

      {/* Row 5: Latest prompt (if different from title and initial) */}
      {hasSecondaryPrompt && (
        <div className="mt-1.5 ml-[18px] flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="italic line-clamp-2">{latestPrompt}</span>
        </div>
      )}

      {/* Row 6: Meta -- slug, project, branch, cwd, time, size */}
      <div className="flex items-center gap-x-2 gap-y-1 mt-2 ml-[18px] text-xs text-muted-foreground flex-wrap overflow-hidden">
        {session.slug && (
          <span className="font-mono text-[10px] truncate max-w-[140px]">{session.slug}</span>
        )}
        <span className="truncate max-w-[120px]">{session.project}</span>
        {session.gitBranch && session.gitBranch !== 'main' && (
          <span className="flex items-center gap-0.5 truncate max-w-[100px]">
            <GitBranch className="h-3 w-3 shrink-0" />
            <span className="truncate">{session.gitBranch}</span>
          </span>
        )}
        {cwd && <span className="truncate max-w-[100px]">{cwd}</span>}
        <span className="flex items-center gap-0.5 shrink-0">
          <Clock className="h-3 w-3" />
          {timeAgo(session.lastActivity)}
        </span>
        {session.fileSize > 0 && (
          <span className="flex items-center gap-0.5 shrink-0">
            <HardDrive className="h-3 w-3" />
            {formatFileSize(session.fileSize)}
          </span>
        )}
      </div>

      {/* Row 7: Task progress */}
      {totalTasks > 0 && (
        <div className="ml-[18px]">
          <TaskProgressBar completed={completedTasks} total={totalTasks} />
        </div>
      )}

      {/* Row 8: Quick actions */}
      {paneId && needsAction && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <QuickActions paneId={paneId} sessionStatus={session.status} terminalApp={session.terminalApp} />
        </div>
      )}
    </CardContent>
  );

  const cardClassName = cn(
    isNamedAgent && `border-l-2 ${agentBorderColor(session.agentName)}`,
    isSubagent && !isNamedAgent && 'border-l-2 border-l-border/50 ml-3',
    isSubagent && isNamedAgent && 'ml-3',
  );

  if (paneId) {
    return (
      <Card
        className={cn('cursor-pointer hover:bg-muted/50 transition-colors', cardClassName)}
        onClick={() => handleFocus(paneId)}
      >
        {cardContent}
      </Card>
    );
  }

  return <Card className={cardClassName}>{cardContent}</Card>;
}

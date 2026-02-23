import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GitBranch, Clock, Users, ChevronRight, HardDrive, Terminal, MessageSquare } from 'lucide-react';
import { cn, timeAgo, sessionStatusLabel } from '@/lib/utils';
import ActivityLine from '@/components/shared/ActivityLine';
import QuickActions from '@/components/shared/QuickActions';
import type { Session, SessionActivity, TeamTask } from '@/stores/types';

interface KanbanCardProps {
  session: Session;
  sessionActivity?: SessionActivity;
  teamInfo?: { teamName: string; memberName: string };
  paneId?: string;
  tasks: TeamTask[];
  subagents: Session[];
  subagentActivities: Record<string, SessionActivity>;
  sessionTeamMap: Map<string, { teamName: string; memberName: string }>;
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

function subName(
  sub: Session,
  sessionTeamMap: Map<string, { teamName: string; memberName: string }>
): string {
  const teamInfo = sessionTeamMap.get(sub.id);
  if (teamInfo) return teamInfo.memberName;
  if (sub.initialPrompt) {
    return sub.initialPrompt.length > 40
      ? sub.initialPrompt.slice(0, 40) + '...'
      : sub.initialPrompt;
  }
  return sub.agentId?.slice(0, 8) ?? sub.id.slice(0, 8);
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
  subagents,
  subagentActivities,
  sessionTeamMap,
}: KanbanCardProps) {
  const [subExpanded, setSubExpanded] = useState(() =>
    subagents.some((s) => s.status === 'working')
  );
  const isActive = session.status === 'working';
  const model = shortModel(session.model ?? sessionActivity?.model);
  const cwd = shortCwd(session.cwd);
  const needsAction = session.status === 'waiting-input' || session.status === 'waiting-approval' || session.status === 'error';

  const title = teamInfo
    ? `${teamInfo.teamName} / ${teamInfo.memberName}`
    : session.initialPrompt ?? session.latestPrompt ?? `${session.project} / ${session.id.slice(0, 8)}`;

  const latestPrompt = session.latestPrompt;
  const hasSecondaryPrompt = latestPrompt && latestPrompt !== title;

  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const totalTasks = tasks.length;

  const activeSubCount = subagents.filter(
    (s) => s.status === 'working'
  ).length;

  const cardContent = (
    <CardContent className="p-3">
      {/* Row 1: Status dot + title (allow 2 lines) */}
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
            <span className="text-sm font-medium line-clamp-2 flex-1">{title}</span>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {paneId && (
                <div className="flex items-center gap-0.5">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {paneId.startsWith('iterm:') ? 'iTerm' : 'tmux'}
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

      {/* Row 4: Latest prompt (if different from title) */}
      {hasSecondaryPrompt && (
        <div className="mt-1.5 ml-[18px] flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="italic line-clamp-2">{latestPrompt}</span>
        </div>
      )}

      {/* Row 5: Meta — slug, project, branch, cwd, time, size */}
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

      {/* Row 6: Task progress */}
      {totalTasks > 0 && (
        <div className="ml-[18px]">
          <TaskProgressBar completed={completedTasks} total={totalTasks} />
        </div>
      )}

      {/* Row 7: Subagents (collapsible) */}
      {subagents.length > 0 && (
        <div className="mt-2">
          <Collapsible open={subExpanded} onOpenChange={setSubExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1.5 text-xs w-full hover:bg-muted/30 rounded transition-colors">
              <ChevronRight
                className={cn(
                  'h-3 w-3 shrink-0 transition-transform',
                  subExpanded && 'rotate-90'
                )}
              />
              <Users className="h-3 w-3 shrink-0" />
              <span>{subagents.length} agents</span>
              {activeSubCount > 0 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {activeSubCount} active
                </Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 pr-2 pb-1 space-y-1.5 overflow-hidden">
              {subagents.map((sub) => {
                const subActivity = subagentActivities[sub.id];
                const subIsActive = sub.status === 'working';
                const subModel = shortModel(sub.model ?? subActivity?.model);
                return (
                  <div key={sub.id} className="rounded bg-secondary/30 px-2 py-1.5 overflow-hidden">
                    {/* Row 1: status dot + name + badges */}
                    <div className="flex items-center gap-1.5 text-xs min-w-0">
                      <div
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0',
                          statusDotColor(sub.status),
                          subIsActive && 'animate-pulse'
                        )}
                      />
                      <span className="font-medium truncate min-w-0 flex-1">
                        {subName(sub, sessionTeamMap)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] px-1 py-0 shrink-0',
                          sub.status === 'error' && 'text-status-red border-status-red/30',
                          (sub.status === 'waiting-input' || sub.status === 'waiting-approval') && 'text-status-yellow border-status-yellow/30',
                          sub.status === 'working' && 'text-status-green border-status-green/30',
                          sub.status === 'done' && 'text-status-done border-status-done/30'
                        )}
                      >
                        {sessionStatusLabel(sub.status)}
                      </Badge>
                      {subModel && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
                          {subModel}
                        </Badge>
                      )}
                      <span className="text-muted-foreground shrink-0">
                        {timeAgo(sub.lastActivity)}
                      </span>
                    </div>

                    {/* Row 2: Activity line or initial prompt */}
                    {subActivity?.active ? (
                      <div className="mt-1 ml-[14px] overflow-hidden">
                        <ActivityLine activity={subActivity} />
                      </div>
                    ) : sub.initialPrompt ? (
                      <div className="mt-0.5 ml-[14px] text-[11px] text-muted-foreground truncate min-w-0">
                        {sub.initialPrompt}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {/* Row 8: Quick actions */}
      {paneId && needsAction && (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
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

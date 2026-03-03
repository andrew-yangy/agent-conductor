import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboard-store';
import { timeAgo } from '@/lib/utils';
import {
  Clock,
  Zap,
  AlertCircle,
  Ban,
  ArrowRight,
  CircleDot,
  ListChecks,
} from 'lucide-react';

export default function OrientationBanner() {
  const sessions = useDashboardStore((s) => s.sessions);
  const directiveState = useDashboardStore((s) => s.directiveState);
  const workState = useDashboardStore((s) => s.workState);
  const navigate = useNavigate();

  const {
    lastActive,
    activeWork,
    attentionCount,
    blockedCount,
    inProgressFeatures,
    activeGoalCount,
    totalPendingBacklog,
  } = useMemo(() => {
    // Last active: most recent session activity
    const parentSessions = sessions.filter(s => !s.isSubagent);
    const sorted = [...parentSessions].sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
    const lastActive = sorted[0]?.lastActivity ?? '';

    // Active work: from directive state or most recent active session
    let activeWork = '';
    if (directiveState?.status === 'in_progress') {
      const currentInit = directiveState.initiatives.find(
        i => i.status === 'in_progress'
      );
      activeWork = currentInit?.title ?? directiveState.directiveName;
    } else {
      const workingSession = sorted.find(s => s.status === 'working');
      if (workingSession) {
        activeWork = workingSession.feature ?? workingSession.slug ?? workingSession.project ?? '';
      }
    }

    // Attention count: sessions needing input/approval/errored
    const attentionCount = sessions.filter(
      s => s.status === 'waiting-input' || s.status === 'waiting-approval' || s.status === 'error'
    ).length;

    // Work state metrics
    let blockedCount = 0;
    let inProgressFeatures: Array<{ title: string; goalId: string; taskCount: number; completedTaskCount: number }> = [];
    let activeGoalCount = 0;
    let totalPendingBacklog = 0;

    if (workState?.features) {
      const features = workState.features.features ?? [];
      blockedCount += features.filter(f => f.status === 'blocked').length;
      inProgressFeatures = features
        .filter(f => f.status === 'in_progress' || f.status === 'blocked')
        .map(f => ({
          title: f.title,
          goalId: f.goalId,
          taskCount: f.taskCount ?? 0,
          completedTaskCount: f.completedTaskCount ?? 0,
        }));
    }
    if (workState?.backlogs) {
      const items = workState.backlogs.items ?? [];
      blockedCount += items.filter(b => b.status === 'blocked').length;
      totalPendingBacklog = items.filter(b => !b.status || b.status === 'pending' || b.status === 'not_started').length;
    }
    if (workState?.goals) {
      activeGoalCount = (workState.goals.goals ?? []).filter(g => g.status === 'in_progress').length;
    }

    return { lastActive, activeWork, attentionCount, blockedCount, inProgressFeatures, activeGoalCount, totalPendingBacklog };
  }, [sessions, directiveState, workState]);

  const hasWorkState = inProgressFeatures.length > 0 || blockedCount > 0 || activeGoalCount > 0;

  // Don't show banner if there's nothing to show
  if (!lastActive && !activeWork && attentionCount === 0 && !hasWorkState) {
    return null;
  }

  return (
    <Card className="bg-card/80 border-border/60">
      <CardContent className="p-3">
        <div className="flex items-center gap-4 flex-wrap text-xs">
          {/* Blocked items — highest urgency first */}
          {blockedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Ban className="h-3.5 w-3.5 text-status-red shrink-0" />
              <Badge variant="outline" className="bg-status-red/15 text-status-red border-status-red/30 text-[10px] px-1.5 py-0">
                {blockedCount} blocked
              </Badge>
            </div>
          )}

          {/* Attention needed */}
          {attentionCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-status-yellow shrink-0" />
              <Badge variant="outline" className="bg-status-yellow/15 text-status-yellow border-status-yellow/30 text-[10px] px-1.5 py-0">
                {attentionCount} waiting for input
              </Badge>
            </div>
          )}

          {/* Active work — directive or session */}
          {activeWork && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-status-yellow shrink-0" />
              <span>Active: <span className="text-foreground truncate max-w-[200px] inline-block align-bottom">{activeWork}</span></span>
            </div>
          )}

          {/* In-progress features from workState */}
          {inProgressFeatures.length > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <CircleDot className="h-3.5 w-3.5 text-status-blue shrink-0" />
              <span>
                <span className="text-foreground">{inProgressFeatures.length}</span> feature{inProgressFeatures.length !== 1 ? 's' : ''} in progress
              </span>
            </div>
          )}

          {/* Active goals count */}
          {activeGoalCount > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5 shrink-0" />
              <span>
                <span className="text-foreground">{activeGoalCount}</span> active goal{activeGoalCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Last active — lowest urgency */}
          {lastActive && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>Last active: <span className="text-foreground">{timeAgo(lastActive)}</span></span>
            </div>
          )}
        </div>

        {/* In-progress features detail row */}
        {inProgressFeatures.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40 flex items-center gap-3 flex-wrap text-xs">
            {inProgressFeatures.slice(0, 4).map((f) => (
              <button
                key={`${f.goalId}-${f.title}`}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                onClick={() => navigate(`/projects?expand=${f.goalId}`)}
              >
                <ArrowRight className="h-3 w-3 text-status-blue shrink-0" />
                <span className="truncate max-w-[180px]">{f.title}</span>
                {f.taskCount > 0 && (
                  <span className="text-[10px] text-muted-foreground/70">
                    {f.completedTaskCount}/{f.taskCount}
                  </span>
                )}
              </button>
            ))}
            {inProgressFeatures.length > 4 && (
              <span className="text-muted-foreground/60 text-[10px]">
                +{inProgressFeatures.length - 4} more
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

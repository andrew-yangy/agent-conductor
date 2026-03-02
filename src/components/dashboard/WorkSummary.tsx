import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboard-store';
import {
  Target,
  Layers,
  ListChecks,
  ArrowRight,
  CircleDot,
} from 'lucide-react';
import type { BacklogRecord, FeatureRecord, GoalRecord } from '@/stores/types';

export default function WorkSummary() {
  const workState = useDashboardStore((s) => s.workState);
  const navigate = useNavigate();

  const summary = useMemo(() => {
    if (!workState?.goals) return null;

    const goals = workState.goals.goals ?? [];
    const features = workState.features?.features ?? [];
    const backlogs = workState.backlogs?.items ?? [];

    const activeGoals = goals.filter((g: GoalRecord) => g.status === 'in-progress');
    const inProgressFeatures = features.filter((f: FeatureRecord) => f.status === 'in-progress');
    const pendingFeatures = features.filter((f: FeatureRecord) => f.status === 'pending');
    const doneFeatures = features.filter((f: FeatureRecord) => f.status === 'done');
    const totalBacklog = backlogs.length;
    const actionableBacklog = backlogs.filter(b => b.status === 'pending' || b.status === 'in-progress' || b.status === 'blocked').length;

    // Top goals by active feature count
    const goalFeatureCount: Record<string, number> = {};
    for (const f of [...inProgressFeatures, ...pendingFeatures]) {
      goalFeatureCount[f.goalId] = (goalFeatureCount[f.goalId] ?? 0) + 1;
    }
    const topGoals = activeGoals
      .map((g: GoalRecord) => ({
        ...g,
        activeCount: goalFeatureCount[g.id] ?? 0,
        backlogCount: backlogs.filter(b => b.goalId === g.id).length,
      }))
      .sort((a, b) => b.activeCount - a.activeCount)
      .slice(0, 5);

    return {
      activeGoals: activeGoals.length,
      totalGoals: goals.length,
      inProgress: inProgressFeatures.length,
      pending: pendingFeatures.length,
      done: doneFeatures.length,
      backlog: totalBacklog,
      actionableBacklog,
      topGoals,
    };
  }, [workState]);

  if (!summary) return null;

  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        Work Overview
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Summary stats */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center gap-2 text-left hover:bg-secondary/50 rounded p-1 -m-1 transition-colors cursor-pointer" onClick={() => navigate('/projects')}>
                <Target className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-lg font-bold">{summary.activeGoals}</p>
                  <p className="text-[10px] text-muted-foreground">Active Goals</p>
                </div>
              </button>
              <button className="flex items-center gap-2 text-left hover:bg-secondary/50 rounded p-1 -m-1 transition-colors cursor-pointer" onClick={() => navigate('/projects')}>
                <CircleDot className="h-4 w-4 text-status-yellow" />
                <div>
                  <p className="text-lg font-bold">{summary.inProgress + summary.pending}</p>
                  <p className="text-[10px] text-muted-foreground">Open Features</p>
                </div>
              </button>
              <button className="flex items-center gap-2 text-left hover:bg-secondary/50 rounded p-1 -m-1 transition-colors cursor-pointer" onClick={() => navigate('/projects')}>
                <Layers className="h-4 w-4 text-status-green" />
                <div>
                  <p className="text-lg font-bold">{summary.done}</p>
                  <p className="text-[10px] text-muted-foreground">Completed</p>
                </div>
              </button>
              <button className="flex items-center gap-2 text-left hover:bg-secondary/50 rounded p-1 -m-1 transition-colors cursor-pointer" onClick={() => navigate('/projects')}>
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{summary.actionableBacklog}<span className="text-sm font-normal text-muted-foreground">/{summary.backlog}</span></p>
                  <p className="text-[10px] text-muted-foreground">Backlog Active</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Top active goals */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              {summary.topGoals.map((goal) => (
                <button
                  key={goal.id}
                  className="flex items-center gap-2 w-full text-left hover:bg-secondary/50 rounded px-2 py-1 -mx-2 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects?expand=${goal.id}`)}
                >
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs truncate flex-1">{goal.title}</span>
                  {goal.activeCount > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-status-yellow/10 text-status-yellow border-status-yellow/30">
                      {goal.activeCount} active
                    </Badge>
                  )}
                  {goal.backlogCount > 0 && (
                    <span className="text-[9px] text-muted-foreground">
                      {goal.backlogCount} backlog
                    </span>
                  )}
                </button>
              ))}
              {summary.topGoals.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No active goals</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

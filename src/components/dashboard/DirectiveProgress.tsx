import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDashboardStore } from '@/stores/dashboard-store';
import type { DirectiveInitiative } from '@/stores/types';
import { cn } from '@/lib/utils';
import { Crosshair, CheckCircle2, Circle, Loader2, SkipForward, XCircle } from 'lucide-react';

function phaseColor(phase: string): string {
  switch (phase) {
    case 'audit': return 'bg-status-blue/15 text-status-blue border-status-blue/30';
    case 'design': return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
    case 'build': return 'bg-status-green/15 text-status-green border-status-green/30';
    case 'review': return 'bg-status-yellow/15 text-status-yellow border-status-yellow/30';
    default: return 'bg-secondary text-secondary-foreground border-border';
  }
}

function InitiativeIcon({ status }: { status: DirectiveInitiative['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-3.5 w-3.5 text-status-green shrink-0" />;
    case 'in_progress':
      return <Loader2 className="h-3.5 w-3.5 text-status-yellow shrink-0 animate-spin" />;
    case 'failed':
      return <XCircle className="h-3.5 w-3.5 text-status-red shrink-0" />;
    case 'skipped':
      return <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

export default function DirectiveProgress() {
  const directiveState = useDashboardStore((s) => s.directiveState);

  if (!directiveState) return null;

  const { directiveName, status, totalInitiatives, currentInitiative, currentPhase, initiatives } = directiveState;
  const completedCount = initiatives.filter((i) => i.status === 'completed').length;
  const progressPercent = totalInitiatives > 0 ? Math.round((completedCount / totalInitiatives) * 100) : 0;

  const isFinished = status === 'completed' || status === 'failed';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Crosshair className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-semibold truncate">{directiveName}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isFinished && currentPhase && (
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', phaseColor(currentPhase))}>
                {currentPhase}
              </Badge>
            )}
            <Badge
              variant={isFinished ? (status === 'completed' ? 'default' : 'destructive') : 'secondary'}
              className="text-[10px] px-1.5 py-0"
            >
              {status === 'executing'
                ? `${currentInitiative} / ${totalInitiatives}`
                : status}
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-secondary rounded-full mb-3 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              status === 'failed' ? 'bg-status-red' : 'bg-primary'
            )}
            style={{ width: `${isFinished && status === 'completed' ? 100 : progressPercent}%` }}
          />
        </div>

        {/* Initiative list */}
        <div className="space-y-1">
          {initiatives.map((initiative) => (
            <div
              key={initiative.id}
              className={cn(
                'flex items-center gap-2 text-xs py-0.5',
                initiative.status === 'in_progress' ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              <InitiativeIcon status={initiative.status} />
              <span className="truncate">{initiative.title}</span>
              {initiative.status === 'in_progress' && initiative.phase && (
                <Badge variant="outline" className={cn('text-[9px] px-1 py-0 ml-auto shrink-0', phaseColor(initiative.phase))}>
                  {initiative.phase}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

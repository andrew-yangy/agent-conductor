import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TeamTask } from '@/stores/types';

interface TaskProgressProps {
  tasks: TeamTask[];
}

function taskStatusIcon(status: TeamTask['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-status-green" />;
    case 'in_progress':
      return <Loader2 className="h-4 w-4 text-status-yellow animate-spin" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

function taskStatusBadge(status: TeamTask['status']) {
  switch (status) {
    case 'completed':
      return <Badge variant="secondary" className="bg-status-green/15 text-status-green border-0 text-[10px]">Done</Badge>;
    case 'in_progress':
      return <Badge variant="secondary" className="bg-status-yellow/15 text-status-yellow border-0 text-[10px]">In Progress</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">Pending</Badge>;
  }
}

export default function TaskProgress({ tasks }: TaskProgressProps) {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Tasks</CardTitle>
          <span className="text-xs text-muted-foreground">
            {completed}/{total} ({percent}%)
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-secondary mt-2">
          <div
            className="h-1.5 rounded-full bg-status-green transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                'flex items-center justify-between py-1.5 px-2 rounded text-xs',
                task.status === 'completed' && 'opacity-60'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {taskStatusIcon(task.status)}
                <span className="truncate">{task.subject}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {task.owner && (
                  <span className="text-muted-foreground">{task.owner}</span>
                )}
                {taskStatusBadge(task.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

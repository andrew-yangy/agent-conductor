import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboard-store';
import type { Team, TeamTask } from '@/stores/types';

interface TeamCardProps {
  team: Team;
  tasks: TeamTask[];
}

function statusDotColor(member: Team['members'][0]): string {
  if (!member.isActive) return 'bg-status-gray';
  return 'bg-status-green';
}

export default function TeamCard({ team, tasks }: TeamCardProps) {
  const navigate = useNavigate();
  const deleteTeam = useDashboardStore((s) => s.deleteTeam);
  const [deleting, setDeleting] = useState(false);
  const activeCount = team.members.filter((m) => m.isActive).length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    await deleteTeam(team.name);
    setDeleting(false);
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-card/80',
        team.stale && 'opacity-50'
      )}
      onClick={() => navigate(`/teams/${encodeURIComponent(team.name)}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{team.name}</CardTitle>
          <div className="flex items-center gap-2">
            {team.stale && <Badge variant="secondary" className="text-xs">inactive</Badge>}
            {team.stale && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete team "{team.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the team config and task list from ~/.claude/. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleDelete}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        {team.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{team.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {/* Member status dots */}
            <div className="flex items-center gap-1">
              {team.members.map((m) => (
                <div
                  key={m.agentId || m.name}
                  className={cn('h-2 w-2 rounded-full', statusDotColor(m))}
                  title={`${m.name}: ${m.isActive ? 'active' : 'inactive'}`}
                />
              ))}
            </div>
            <span>
              {activeCount}/{team.members.length} active
            </span>
          </div>
          {tasks.length > 0 && (
            <span>{completedTasks}/{tasks.length} tasks</span>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Created {timeAgo(team.createdAt)}
        </div>
      </CardContent>
    </Card>
  );
}

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
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
  const activeCount = team.members.filter((m) => m.isActive).length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

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
          {team.stale && <Badge variant="secondary" className="text-xs">inactive</Badge>}
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

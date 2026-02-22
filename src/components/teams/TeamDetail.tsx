import { useParams } from 'react-router-dom';
import { useDashboardStore } from '@/stores/dashboard-store';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { timeAgo } from '@/lib/utils';
import MemberCard from './MemberCard';
import TaskProgress from './TaskProgress';

export default function TeamDetail() {
  const { name } = useParams<{ name: string }>();
  const decodedName = name ? decodeURIComponent(name) : '';
  const { teams, sessions, tasksByTeam, events, sessionActivities } = useDashboardStore();

  const team = teams.find((t) => t.name === decodedName);
  const tasks = tasksByTeam[decodedName] ?? [];

  // Filter events for this team's sessions
  const teamSessionIds = new Set<string>();
  if (team) {
    if (team.leadSessionId) teamSessionIds.add(team.leadSessionId);
    for (const m of team.members) {
      if (m.agentId) teamSessionIds.add(m.agentId);
    }
  }
  const teamEvents = events.filter((e) => teamSessionIds.has(e.sessionId)).slice(0, 20);

  if (!team) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Team not found</p>
          <p className="text-xs text-muted-foreground mt-1">"{decodedName}" doesn't exist</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{team.name}</h2>
            {team.stale ? (
              <Badge variant="secondary">inactive</Badge>
            ) : (
              <Badge variant="default" className="bg-status-green/20 text-status-green border-0">active</Badge>
            )}
          </div>
          {team.description && (
            <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">Created {timeAgo(team.createdAt)}</p>
        </div>
      </div>

      {/* Members */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Members ({team.members.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {team.members.map((member) => (
            <MemberCard
              key={member.agentId || member.name}
              member={member}
              session={sessions.find((s) => s.id === member.agentId)}
              currentTask={tasks.find((t) => t.owner === member.name && t.status === 'in_progress')}
              sessionActivity={sessionActivities[member.agentId]}
            />
          ))}
        </div>
      </div>

      {/* Task Progress */}
      {tasks.length > 0 && <TaskProgress tasks={tasks} />}

      {/* Team Activity */}
      {teamEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Team Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {teamEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground font-mono">
                      {event.sessionId.slice(0, 8)}
                    </span>
                    <span className="text-xs truncate">{event.message}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {timeAgo(event.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

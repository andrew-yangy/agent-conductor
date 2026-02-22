import StatsBar from './StatsBar';
import AttentionRequired from './AttentionRequired';
import TeamCard from './TeamCard';
import ActiveSessions from './RecentActivity';
import { useDashboardStore } from '@/stores/dashboard-store';

export default function DashboardPage() {
  const { teams, sessions, events, sessionActivities, tasksByTeam } = useDashboardStore();

  const activeTeams = teams.filter((t) => !t.stale);
  const staleTeams = teams.filter((t) => t.stale);

  // Count parent sessions only (not subagents)
  const parentSessions = sessions.filter((s) => !s.isSubagent);
  const activeSessions = parentSessions.filter((s) => s.status === 'working').length;
  const totalSessions = parentSessions.length;

  const attentionSessions = sessions.filter(
    (s) => s.status === 'waiting-input' || s.status === 'waiting-approval' || s.status === 'error'
  );
  const today = new Date().toISOString().slice(0, 10);
  const eventsToday = events.filter((e) => e.timestamp.startsWith(today)).length;

  return (
    <div className="space-y-6">
      <StatsBar
        activeTeams={activeTeams.length}
        activeSessions={activeSessions}
        totalSessions={totalSessions}
        attentionCount={attentionSessions.length}
        eventsToday={eventsToday}
      />

      {attentionSessions.length > 0 && (
        <AttentionRequired sessions={attentionSessions} teams={teams} />
      )}

      {/* Teams Grid */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">
          Teams {teams.length > 0 && `(${teams.length})`}
        </h2>
        {teams.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No active teams</p>
            <p className="text-xs mt-1">Start a team build to see teams here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTeams.map((team) => (
              <TeamCard key={team.name} team={team} tasks={tasksByTeam[team.name] ?? []} />
            ))}
            {staleTeams.map((team) => (
              <TeamCard key={team.name} team={team} tasks={tasksByTeam[team.name] ?? []} />
            ))}
          </div>
        )}
      </div>

      {/* Live Sessions */}
      <ActiveSessions sessions={sessions} sessionActivities={sessionActivities} />
    </div>
  );
}

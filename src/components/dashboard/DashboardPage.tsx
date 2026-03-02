import { useMemo, useEffect, useState } from 'react';
import StatsBar from './StatsBar';
import DirectiveProgress from './DirectiveProgress';
import AttentionRequired from './AttentionRequired';
import OrientationBanner from './OrientationBanner';
import CeoBrief from './CeoBrief';
import WorkSummary from './WorkSummary';
import TeamCard from './TeamCard';
import ActiveSessions from './RecentActivity';
import SchedulerCard from './SchedulerCard';
import { useDashboardStore } from '@/stores/dashboard-store';

export default function DashboardPage() {
  const { teams, sessions, events, sessionActivities, tasksByTeam } = useDashboardStore();
  const workState = useDashboardStore((s) => s.workState);
  const [fetchedWorkState, setFetchedWorkState] = useState(false);

  // Ensure work state is loaded for CEO Brief and attention counts
  useEffect(() => {
    if (workState?.goals || fetchedWorkState) return;
    setFetchedWorkState(true);
    Promise.all([
      fetch('http://localhost:4444/api/state/goals').then(r => r.json()),
      fetch('http://localhost:4444/api/state/features').then(r => r.json()),
      fetch('http://localhost:4444/api/state/backlogs').then(r => r.json()),
      fetch('http://localhost:4444/api/state/conductor').then(r => r.json()),
    ]).then(([goals, features, backlogs, conductor]) => {
      if (goals?.goals) {
        useDashboardStore.getState().setWorkState({ goals, features, backlogs, conductor, index: null });
      }
    }).catch(() => {});
  }, [workState?.goals, fetchedWorkState]);

  const activeTeams = teams.filter((t) => !t.stale);
  const staleTeams = teams.filter((t) => t.stale);

  // Count parent sessions only (not subagents)
  const parentSessions = sessions.filter((s) => !s.isSubagent);
  // Active count includes propagated working status (subagents promoted by parent)
  const activeSessions = parentSessions.filter((s) => s.status === 'working').length;
  const totalSessions = parentSessions.length;

  // Attention includes direct waiting/error sessions + parents with subagent attention
  const attentionSessions = sessions.filter(
    (s) => s.status === 'waiting-input' || s.status === 'waiting-approval' || s.status === 'error' ||
      (!s.isSubagent && s.subagentAttention)
  );

  // Count goals with issues and blocked features for the attention stat
  const goals = workState?.goals?.goals ?? [];
  const features = workState?.features?.features ?? [];
  const backlogs = workState?.backlogs?.items ?? [];

  const goalsWithIssues = goals.filter(
    (g) => (g.issues?.length ?? 0) > 0
  ).length;
  const blockedFeatures = features.filter(
    (f) => f.status === 'blocked'
  ).length;
  // Goals marked in-progress but with no features or backlogs (orphan goals)
  const orphanGoals = goals.filter(
    (g) => g.status === 'in-progress' &&
      features.filter(f => f.goalId === g.id).length === 0 &&
      backlogs.filter(b => b.goalId === g.id).length === 0 &&
      (g.issues?.length ?? 0) === 0 // avoid double-counting goals already in goalsWithIssues
  ).length;
  const totalAttention = attentionSessions.length + goalsWithIssues + blockedFeatures + orphanGoals;

  const sessionPaneMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessions) {
      if (session.paneId) map.set(session.id, session.paneId);
    }
    for (const team of teams) {
      for (const member of team.members) {
        if (member.agentId && member.tmuxPaneId) map.set(member.agentId, member.tmuxPaneId);
      }
    }
    return map;
  }, [sessions, teams]);
  const today = new Date().toISOString().slice(0, 10);
  const eventsToday = events.filter((e) => e.timestamp.startsWith(today)).length;

  return (
    <div className="space-y-6">
      <OrientationBanner />

      <CeoBrief />

      <StatsBar
        activeTeams={activeTeams.length}
        activeSessions={activeSessions}
        totalSessions={totalSessions}
        attentionCount={totalAttention}
        eventsToday={eventsToday}
      />

      <DirectiveProgress />

      <SchedulerCard />

      <WorkSummary />

      {attentionSessions.length > 0 && (
        <AttentionRequired sessions={attentionSessions} teams={teams} sessionPaneMap={sessionPaneMap} />
      )}

      {/* Teams Grid — only show when teams exist */}
      {teams.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Teams ({teams.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTeams.map((team) => (
              <TeamCard key={team.name} team={team} tasks={tasksByTeam[team.name] ?? []} />
            ))}
            {staleTeams.map((team) => (
              <TeamCard key={team.name} team={team} tasks={tasksByTeam[team.name] ?? []} />
            ))}
          </div>
        </div>
      )}

      {/* Live Sessions */}
      <ActiveSessions sessions={sessions} sessionActivities={sessionActivities} />
    </div>
  );
}

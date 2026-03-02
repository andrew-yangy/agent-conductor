import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Users, ChevronRight, ChevronDown } from 'lucide-react';
import { cn, timeAgo, statusBgColor } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboard-store';
import {
  AGENT_CONFIGS,
  CEO_CONFIG,
  TEAM_CONFIGS,
  type AgentConfig,
  type TeamConfig,
} from './agent-config';
import type { Session, SessionActivity } from '@/stores/types';

/** Derive agent status from their sessions + parent session propagation */
function deriveAgentStatus(
  sessions: Session[],
  activities: Record<string, SessionActivity>,
  allSessions: Session[],
  agentId: string
): 'working' | 'waiting' | 'idle' | 'offline' {
  if (sessions.length === 0) {
    // Check if this agent is listed as an active subagent in any working parent
    const parentWorking = allSessions.some(
      s => !s.isSubagent && s.status === 'working' &&
        s.activeSubagentNames?.some(n => n.toLowerCase() === agentId)
    );
    if (parentWorking) return 'working';
    return 'offline';
  }

  const hasWorking = sessions.some(s => s.status === 'working');
  if (hasWorking) return 'working';

  const hasWaiting = sessions.some(
    s => s.status === 'waiting-input' || s.status === 'waiting-approval'
  );
  if (hasWaiting) return 'waiting';

  const hasActive = sessions.some(s => {
    const activity = activities[s.id];
    return activity?.active;
  });
  if (hasActive) return 'working';

  // Check parent session propagation: if a parent session is working and
  // lists this agent's name in activeSubagentNames, treat as working
  const parentPropagated = allSessions.some(
    s => !s.isSubagent && s.status === 'working' &&
      s.activeSubagentNames?.some(n => n.toLowerCase() === agentId)
  );
  if (parentPropagated) return 'working';

  return 'idle';
}

function statusLabel(status: string): string {
  switch (status) {
    case 'working': return 'Working';
    case 'waiting': return 'Needs Input';
    case 'idle': return 'Idle';
    case 'offline': return 'No sessions';
    default: return status;
  }
}

function statusDotColor(status: string): string {
  switch (status) {
    case 'working': return 'bg-status-green';
    case 'waiting': return 'bg-status-yellow';
    case 'idle': return 'bg-status-gray';
    case 'offline': return 'bg-muted-foreground/30';
    default: return 'bg-status-gray';
  }
}

interface AgentSummary {
  config: AgentConfig;
  status: 'working' | 'waiting' | 'idle' | 'offline';
  sessionCount: number;
  activeSessions: number;
  latestActivity: string | null;
  currentWork: string | null;
  engineerCount: number;
}

function buildAgentSummary(
  config: AgentConfig,
  sessions: Session[],
  sessionActivities: Record<string, SessionActivity>,
  allSessions: Session[]
): AgentSummary {
  const agentSessions = sessions.filter(
    s => s.agentName?.toLowerCase() === config.id
  );

  const status = deriveAgentStatus(agentSessions, sessionActivities, allSessions, config.id);
  const activeSessions = agentSessions.filter(s => s.status === 'working').length;

  const latestActivity = agentSessions.length > 0
    ? agentSessions.reduce((latest, s) => {
        if (!latest || s.lastActivity > latest) return s.lastActivity;
        return latest;
      }, '')
    : null;

  let currentWork: string | null = null;
  const workingSession = agentSessions.find(s => s.status === 'working');
  if (workingSession) {
    currentWork = workingSession.latestPrompt ?? workingSession.initialPrompt ?? null;
    if (currentWork && currentWork.length > 100) {
      currentWork = currentWork.slice(0, 100) + '...';
    }
  }

  const engineerCount = allSessions.filter(
    s => s.isSubagent && agentSessions.some(as => as.subagentIds.includes(s.id))
  ).length;

  return {
    config,
    status,
    sessionCount: agentSessions.length,
    activeSessions,
    latestActivity,
    currentWork,
    engineerCount,
  };
}

interface TeamSummary {
  team: TeamConfig;
  members: AgentSummary[];
  workingCount: number;
  totalMembers: number;
}

export default function OrgPage() {
  const sessions = useDashboardStore(s => s.sessions);
  const sessionActivities = useDashboardStore(s => s.sessionActivities);

  // Build summaries for all agents
  const agentSummaryMap = useMemo((): Record<string, AgentSummary> => {
    const map: Record<string, AgentSummary> = {};
    for (const config of AGENT_CONFIGS) {
      map[config.id] = buildAgentSummary(config, sessions, sessionActivities, sessions);
    }
    return map;
  }, [sessions, sessionActivities]);

  // Build team summaries
  const teamSummaries = useMemo((): TeamSummary[] => {
    return TEAM_CONFIGS.map(team => {
      const members = team.memberAgentIds
        .map(id => agentSummaryMap[id])
        .filter((s): s is AgentSummary => s !== undefined);

      const workingCount = members.filter(m => m.status === 'working').length;

      return {
        team,
        members,
        workingCount,
        totalMembers: members.length,
      };
    });
  }, [agentSummaryMap]);

  // CEO stats
  const namedAgentIds = new Set(AGENT_CONFIGS.map(a => a.id));
  const ceoSessions = sessions.filter(
    s => !s.isSubagent && (!s.agentName || !namedAgentIds.has(s.agentName.toLowerCase()))
  );
  const ceoWorking = ceoSessions.filter(s => s.status === 'working').length;

  // Overall counts
  const totalWorking = Object.values(agentSummaryMap).filter(a => a.status === 'working').length;
  const totalEngineers = Object.values(agentSummaryMap).reduce((sum, a) => sum + a.engineerCount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground">
            {AGENT_CONFIGS.length} team members across {TEAM_CONFIGS.length} teams
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            {totalWorking} working
          </Badge>
          {totalEngineers > 0 && (
            <Badge variant="outline" className="text-xs">
              {totalEngineers} engineers spawned
            </Badge>
          )}
        </div>
      </div>

      {/* CEO Node */}
      <Card className={cn('border', CEO_CONFIG.borderColor)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold',
                CEO_CONFIG.bgColor
              )}>
                CEO
              </div>
              <div>
                <div className="text-sm font-medium">CEO (You)</div>
                <div className="text-xs text-muted-foreground">
                  {ceoSessions.length} direct sessions
                  {ceoWorking > 0 && ` (${ceoWorking} active)`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{TEAM_CONFIGS.length} teams, {AGENT_CONFIGS.length} agents</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connecting line */}
      <div className="flex justify-center">
        <div className="w-px h-4 bg-border" />
      </div>

      {/* Teams */}
      <div className="space-y-4">
        {teamSummaries.map(ts => (
          <TeamSection key={ts.team.id} teamSummary={ts} />
        ))}
      </div>

      {/* Engineer pool (if any) */}
      {totalEngineers > 0 && (
        <>
          <Separator />
          <EngineerPool sessions={sessions} sessionActivities={sessionActivities} />
        </>
      )}
    </div>
  );
}

function TeamSection({ teamSummary }: { teamSummary: TeamSummary }) {
  const [open, setOpen] = useState(true);
  const { team, members, workingCount, totalMembers } = teamSummary;

  // Find the lead agent summary
  const lead = members.find(m => m.config.id === team.leadAgentId);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn('border', team.borderColor)}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {open
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  }
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-semibold', team.color)}>
                        {team.name}
                      </span>
                      {lead && (
                        <span className="text-xs text-muted-foreground">
                          led by {lead.config.name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {team.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {workingCount > 0 && (
                    <Badge className="bg-status-green/20 text-status-green border-0 text-xs">
                      {workingCount} working
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {totalMembers} member{totalMembers !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {members.map(summary => (
                <AgentCard key={summary.config.id} summary={summary} />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function AgentCard({ summary }: { summary: AgentSummary }) {
  const { config, status, sessionCount, activeSessions, latestActivity, currentWork, engineerCount } = summary;

  return (
    <Link to={`/org/${config.id}`} className="block group">
      <Card className={cn(
        'border transition-colors hover:border-accent',
        config.borderColor,
        status === 'working' && 'ring-1 ring-status-green/20'
      )}>
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold',
                config.bgColor
              )}>
                {config.title}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium">{config.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-xs text-muted-foreground">{config.role}</div>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              'h-2 w-2 rounded-full shrink-0',
              statusDotColor(status),
              status === 'working' && 'animate-pulse'
            )} />
            <span className="text-xs text-muted-foreground">{statusLabel(status)}</span>
            {sessionCount > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {sessionCount} session{sessionCount !== 1 ? 's' : ''}
                {activeSessions > 0 && ` (${activeSessions} active)`}
              </span>
            )}
          </div>

          {/* Current work */}
          {currentWork && (
            <div className="text-xs text-muted-foreground bg-secondary/50 rounded p-2 mb-2 truncate">
              {currentWork}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              {engineerCount > 0 && (
                <span>{engineerCount} engineer{engineerCount !== 1 ? 's' : ''}</span>
              )}
              {config.domains.slice(0, 2).map(d => (
                <Badge key={d} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {d}
                </Badge>
              ))}
            </div>
            {latestActivity && (
              <span>{timeAgo(latestActivity)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EngineerPool({
  sessions,
  sessionActivities,
}: {
  sessions: Session[];
  sessionActivities: Record<string, SessionActivity>;
}) {
  const namedAgentIds = new Set(AGENT_CONFIGS.map(a => a.id));
  const engineers = sessions.filter(
    s => s.isSubagent && (!s.agentName || !namedAgentIds.has(s.agentName.toLowerCase()))
  );

  if (engineers.length === 0) return null;

  const working = engineers.filter(s => s.status === 'working');
  const recent = [...engineers]
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
    .slice(0, 6);

  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground mb-3">
        Engineer Pool ({engineers.length} spawned, {working.length} working)
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {recent.map(eng => {
          const activity = sessionActivities[eng.id];
          return (
            <Card key={eng.id} className="border">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    'h-2 w-2 rounded-full shrink-0',
                    statusBgColor(eng.status),
                    eng.status === 'working' && 'animate-pulse'
                  )} />
                  <span className="text-xs font-mono text-muted-foreground">
                    {eng.agentId?.slice(0, 8) ?? eng.id.slice(0, 8)}
                  </span>
                  {eng.agentName && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {eng.agentName}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {activity?.active
                    ? `${activity.tool ?? 'active'}: ${activity.detail ?? ''}`
                    : eng.initialPrompt?.slice(0, 60) ?? 'No prompt'}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {timeAgo(eng.lastActivity)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

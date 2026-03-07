// ---------------------------------------------------------------------------
// TeamPanel — org hierarchy roster with team groups and session counts
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { Swords, Fish } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboard-store';
import { useAgentRegistryStore } from '@/stores/agent-registry-store';
import QuickActions from '@/components/shared/QuickActions';
import { type AgentStatus } from '../types';
import { useOfficeAgents } from '../useOfficeAgents';
import {
  SectionHeader, StatusChip, PIXEL_CARD, PIXEL_CARD_RAISED,
  ParchmentDivider, PARCHMENT,
} from './panelUtils';

/** Build org hierarchy lookup maps from agent registry data */
function buildOrgMaps(agents: Array<{ id: string; name: string; role: string; isCsuite: boolean; reportsTo: string | null }>) {
  const AGENT_IS_CSUITE: Record<string, boolean> = {};
  const AGENT_REPORTS_TO: Record<string, string> = {};
  const AGENT_FULL_ROLE: Record<string, string> = {};
  const KNOWN_AGENT_IDS = new Set(agents.map((a) => a.id));

  for (const agent of agents) {
    const firstName = agent.name.split(' ')[0];
    AGENT_IS_CSUITE[firstName] = agent.isCsuite;
    if (agent.reportsTo) {
      const manager = agents.find((a) => a.id === agent.reportsTo);
      if (manager) AGENT_REPORTS_TO[firstName] = manager.name.split(' ')[0];
    }
    AGENT_FULL_ROLE[firstName] = agent.role;
  }

  return { AGENT_IS_CSUITE, AGENT_REPORTS_TO, AGENT_FULL_ROLE, KNOWN_AGENT_IDS };
}

const TEAM_COLORS: Record<string, string> = {
  Engineering: '#8B5CF6',
  Product: '#3B82F6',
  Growth: '#F59E0B',
  Operations: '#10B981',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TeamPanelProps {
  agentStatuses: Record<string, AgentStatus>;
  onSelectAgent?: (agentName: string) => void;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentInfo {
  agent: { agentName: string; agentRole: string; color: string; isPlayer: boolean };
  status: AgentStatus;
  taskName: string | undefined;
  toolName: string | undefined;
  toolDetail: string | undefined;
  lastActivity: string | undefined;
  sessionStatus: string | undefined;
  paneId: string | undefined;
  terminalApp: string | undefined;
  gitBranch: string | undefined;
  subagentNames: string[];
}

interface InactiveAgent {
  agent: { agentName: string; agentRole: string; color: string; isPlayer: boolean };
  status: AgentStatus;
  lastFeature?: string;
  lastActivity?: string;
  fullRole?: string;
  sessionCount: number;
  isCsuite: boolean;
}

interface TeamGroup {
  name: string;
  color: string;
  leader: InactiveAgent | null;
  reports: InactiveAgent[];
}

/** Extract a meaningful task description from a session prompt */
function extractTask(prompt: string | undefined): string | undefined {
  if (!prompt) return undefined;
  const afterIntro = prompt.replace(/^You are [^.]+\.\s*/i, '');
  if (afterIntro === prompt || !afterIntro) return undefined;
  const first = afterIntro.split(/[.\n]/)[0]?.trim();
  return first ? (first.length > 80 ? first.slice(0, 77) + '...' : first) : undefined;
}

// ---------------------------------------------------------------------------
// KPI strip — 2-counter (Working / Loafing)
// ---------------------------------------------------------------------------

function TeamKpi({ working, idle }: { working: number; idle: number }) {
  return (
    <div className="flex gap-1.5">
      <div
        className="flex-1 flex items-center gap-1.5 px-2 py-1.5 font-mono"
        style={PIXEL_CARD}
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: '#22C55E', boxShadow: working > 0 ? '0 0 4px #22C55E80' : 'none' }}
        />
        <span className="text-sm font-bold tabular-nums" style={{ color: PARCHMENT.text }}>
          {working}
        </span>
        <span className="text-[9px] uppercase tracking-wider" style={{ color: PARCHMENT.textDim }}>
          Working
        </span>
      </div>
      <div
        className="flex-1 flex items-center gap-1.5 px-2 py-1.5 font-mono"
        style={PIXEL_CARD}
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: '#9CA3AF' }}
        />
        <span className="text-sm font-bold tabular-nums" style={{ color: PARCHMENT.text }}>
          {idle}
        </span>
        <span className="text-[9px] uppercase tracking-wider" style={{ color: PARCHMENT.textDim }}>
          Loafing
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LoafingCard — individual inactive agent card with hierarchy indent
// ---------------------------------------------------------------------------

function LoafingCard({
  info,
  isReport,
  onSelectAgent,
}: {
  info: InactiveAgent;
  isReport: boolean;
  onSelectAgent?: (name: string) => void;
}) {
  return (
    <button
      type="button"
      className="w-full text-left p-0 transition-all cursor-pointer"
      style={{
        ...PIXEL_CARD,
        position: 'relative' as const,
        overflow: 'hidden',
        marginLeft: isReport ? '12px' : '0',
        width: isReport ? 'calc(100% - 12px)' : '100%',
      }}
      onClick={() => onSelectAgent?.(info.agent.agentName)}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = PARCHMENT.cardHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = PARCHMENT.card;
      }}
      aria-label={`View ${info.agent.agentName} details`}
    >
      {/* Left connector for reports */}
      {isReport && (
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{ backgroundColor: info.agent.color, opacity: 0.4 }}
        />
      )}

      <div className={cn('pr-2 py-1.5 space-y-0.5', isReport ? 'pl-2.5' : 'pl-2')}>
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-sm shrink-0"
            style={{ backgroundColor: info.agent.color, opacity: 0.6 }}
          />
          <span
            className="text-[11px] font-semibold font-mono truncate"
            style={{ color: PARCHMENT.text }}
          >
            {info.agent.agentName}
          </span>
          <span
            className="text-[9px] font-mono truncate"
            style={{ color: PARCHMENT.textDim }}
          >
            {info.fullRole ?? info.agent.agentRole}
          </span>
          {info.sessionCount > 0 && (
            <span
              className="text-[9px] font-mono tabular-nums shrink-0 px-1 py-0.5 leading-none"
              style={{
                color: PARCHMENT.textDim,
                backgroundColor: `${PARCHMENT.accent}20`,
                borderRadius: '2px',
              }}
            >
              {info.sessionCount} sess
            </span>
          )}
          {info.lastActivity && (
            <span
              className="text-[9px] font-mono tabular-nums shrink-0 ml-auto"
              style={{ color: PARCHMENT.textDim }}
            >
              {timeAgo(info.lastActivity)}
            </span>
          )}
        </div>

        {info.lastFeature && (
          <div
            className="text-[10px] font-mono truncate pl-3.5"
            style={{ color: PARCHMENT.textDim }}
          >
            Last: {info.lastFeature}
          </div>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Idle empty state
// ---------------------------------------------------------------------------

function IdleEmptyState() {
  return (
    <div className="text-center py-5 font-mono" style={PIXEL_CARD}>
      <Fish
        className="h-6 w-6 mx-auto mb-2"
        style={{ color: PARCHMENT.textDim, opacity: 0.4 }}
        aria-hidden="true"
      />
      <p className="text-xs font-bold" style={{ color: PARCHMENT.text }}>
        Everyone's loafing
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: PARCHMENT.textDim }}>
        No agents are currently working
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamPanel({ agentStatuses, onSelectAgent }: TeamPanelProps) {
  const sessions = useDashboardStore((s) => s.sessions);
  const sessionActivities = useDashboardStore((s) => s.sessionActivities);
  const registry = useAgentRegistryStore((s) => s.registry);
  const OFFICE_AGENTS = useOfficeAgents();

  const orgMaps = useMemo(
    () => buildOrgMaps(registry?.agents ?? []),
    [registry],
  );

  const agentData = useMemo(() => {
    const active: AgentInfo[] = [];
    const inactive: InactiveAgent[] = [];

    for (const a of OFFICE_AGENTS) {
      if (a.isPlayer) continue;
      const st = agentStatuses[a.agentName] ?? 'idle';

      const allAgentSessions = sessions.filter((s) => s.agentName === a.agentName);

      if (st === 'working') {
        const activeSessions = allAgentSessions.filter((s) => s.status !== 'done');
        const sorted = [...activeSessions].sort(
          (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
        );

        let taskName: string | undefined;
        let bestLastActivity: string | undefined;
        let bestSessionStatus: string | undefined;
        let bestPaneId: string | undefined;
        let bestTerminalApp: string | undefined;
        let gitBranch: string | undefined;

        for (const s of sorted) {
          if (!taskName && s.feature) taskName = s.feature;
          if (!taskName) {
            const extracted = extractTask(s.latestPrompt ?? s.initialPrompt);
            if (extracted) taskName = extracted;
          }
          if (!bestLastActivity) bestLastActivity = s.lastActivity;
          if (!bestSessionStatus && s.status === 'working') {
            bestSessionStatus = s.status;
            bestPaneId = s.paneId;
            bestTerminalApp = s.terminalApp;
          }
          if (!gitBranch && s.gitBranch) gitBranch = s.gitBranch;
        }

        let toolName: string | undefined;
        let toolDetail: string | undefined;
        for (const s of sorted) {
          const act = sessionActivities[s.id];
          if (act?.active && act.tool) {
            toolName = act.tool;
            toolDetail = act.detail;
            break;
          }
        }
        if (!toolName) {
          for (const s of sorted) {
            const act = sessionActivities[s.id];
            if (act?.active && act.thinking) {
              toolName = 'thinking';
              break;
            }
          }
        }

        const primary = sorted.find((s) => !s.isSubagent);
        const subagentNames = primary?.activeSubagentNames ?? [];

        active.push({
          agent: a,
          status: st,
          taskName,
          toolName,
          toolDetail,
          lastActivity: bestLastActivity,
          sessionStatus: bestSessionStatus ?? 'working',
          paneId: bestPaneId,
          terminalApp: bestTerminalApp,
          gitBranch,
          subagentNames,
        });
      } else {
        const sorted = [...allAgentSessions].sort(
          (x, y) => new Date(y.lastActivity).getTime() - new Date(x.lastActivity).getTime(),
        );
        const lastSession = sorted[0];

        inactive.push({
          agent: a,
          status: st,
          lastFeature: lastSession?.feature ?? undefined,
          lastActivity: lastSession?.lastActivity ?? undefined,
          fullRole: orgMaps.AGENT_FULL_ROLE[a.agentName],
          sessionCount: allAgentSessions.length,
          isCsuite: orgMaps.AGENT_IS_CSUITE[a.agentName] ?? false,
        });
      }
    }
    return { active, inactive };
  }, [agentStatuses, sessions, sessionActivities, OFFICE_AGENTS, orgMaps]);

  // Build team groups for loafing section
  const teamGroups = useMemo(() => {
    const groups: TeamGroup[] = [];
    const teamOrder = ['Engineering', 'Product', 'Growth', 'Operations'];

    // Gracefully handle registries with no teams array
    const regData = registry as { agents: Array<{ id: string; name: string }>; teams?: Array<{ name: string; leadAgentId: string; memberAgentIds: string[] }> } | null;
    const teams = regData?.teams ?? [];

    for (const team of teams) {
      // Filter memberAgentIds to only include agents that actually exist in the registry
      const validMembers = (team.memberAgentIds ?? []).filter((id) => orgMaps.KNOWN_AGENT_IDS.has(id));
      // Skip teams with zero valid members
      if (validMembers.length === 0) continue;

      // Resolve lead: use designated lead if present, otherwise first valid member
      const leadId = orgMaps.KNOWN_AGENT_IDS.has(team.leadAgentId) ? team.leadAgentId : validMembers[0];
      const leader = regData?.agents.find((a) => a.id === leadId);
      const leaderName = leader?.name.split(' ')[0];

      const leaderInfo = agentData.inactive.find((i) => i.agent.agentName === leaderName) ?? null;
      const reports = agentData.inactive.filter((i) => {
        const reportsTo = orgMaps.AGENT_REPORTS_TO[i.agent.agentName];
        return reportsTo === leaderName && i.agent.agentName !== leaderName;
      });

      // Only include teams that have at least one inactive member
      if (leaderInfo || reports.length > 0) {
        groups.push({
          name: team.name,
          color: TEAM_COLORS[team.name] ?? PARCHMENT.accent,
          leader: leaderInfo,
          reports,
        });
      }
    }

    // Sort by standard team order
    groups.sort((a, b) => {
      const ai = teamOrder.indexOf(a.name);
      const bi = teamOrder.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return groups;
  }, [agentData.inactive, registry, orgMaps]);

  const workingCount = agentData.active.length;
  const idleCount = agentData.inactive.length;

  return (
    <div className="space-y-2">
      <TeamKpi working={workingCount} idle={idleCount} />

      {/* Active agents */}
      {agentData.active.length > 0 && (
        <>
          <ParchmentDivider />
          <div className="space-y-1.5">
            <SectionHeader
              icon={<Swords className="h-3 w-3" />}
              count={agentData.active.length}
              color="#5B8C3E"
            >
              Working
            </SectionHeader>

            {agentData.active.map((info) => (
              <button
                key={info.agent.agentName}
                type="button"
                className="w-full text-left p-0 transition-all cursor-pointer group"
                style={{
                  ...PIXEL_CARD_RAISED,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onClick={() => onSelectAgent?.(info.agent.agentName)}
                aria-label={`View ${info.agent.agentName} details`}
              >
                {/* Colored left accent bar */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{
                    backgroundColor: info.agent.color,
                    boxShadow: `1px 0 0 0 ${info.agent.color}40`,
                  }}
                />

                <div className="pl-3 pr-2 py-2 space-y-1">
                  {/* Row 1: Agent name + session count + status */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-sm shrink-0 animate-pulse',
                      )}
                      style={{
                        backgroundColor: info.agent.color,
                        boxShadow: `0 0 6px ${info.agent.color}80`,
                      }}
                    />
                    <span
                      className="text-xs font-bold font-mono truncate"
                      style={{ color: PARCHMENT.text }}
                    >
                      {info.agent.agentName}
                    </span>
                    <span
                      className="text-[9px] font-mono tabular-nums shrink-0 px-1 py-0.5 leading-none"
                      style={{
                        color: PARCHMENT.textDim,
                        backgroundColor: `${PARCHMENT.accent}20`,
                        borderRadius: '2px',
                      }}
                    >
                      {sessions.filter((s) => s.agentName === info.agent.agentName).length} sess
                    </span>
                    <span className="ml-auto shrink-0 flex items-center gap-1">
                      {info.lastActivity && (
                        <span
                          className="text-[9px] font-mono tabular-nums"
                          style={{ color: PARCHMENT.textDim }}
                        >
                          {timeAgo(info.lastActivity)}
                        </span>
                      )}
                      <StatusChip
                        status="working"
                        animated
                      />
                    </span>
                  </div>

                  {/* Task description */}
                  {info.taskName && (
                    <p
                      className="text-[11px] leading-tight font-mono"
                      style={{ color: PARCHMENT.text }}
                    >
                      {info.taskName}
                    </p>
                  )}

                  {/* Current tool activity */}
                  {info.toolName && (
                    <div
                      className="flex items-center gap-1 text-[10px] font-mono"
                      style={{ color: '#5B8C3E' }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse"
                        style={{ backgroundColor: '#5B8C3E' }}
                      />
                      <span className="truncate">
                        {info.toolName === 'thinking' ? 'Thinking...' : (
                          <>
                            <span className="font-semibold">{info.toolName}</span>
                            {info.toolDetail && (
                              <span style={{ color: PARCHMENT.textDim }}>
                                ({info.toolDetail})
                              </span>
                            )}
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Git branch */}
                  {info.gitBranch && (
                    <div
                      className="text-[9px] font-mono truncate"
                      style={{ color: PARCHMENT.textDim }}
                    >
                      &#x2387; {info.gitBranch}
                    </div>
                  )}

                  {/* Subagent chips */}
                  {info.subagentNames.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {info.subagentNames.slice(0, 4).map((name) => (
                        <span
                          key={name}
                          className="text-[9px] font-mono px-1 py-0.5 rounded-sm"
                          style={{
                            backgroundColor: '#5B8C3E20',
                            color: '#3D6B26',
                            border: '1px solid #5B8C3E30',
                          }}
                        >
                          {name}
                        </span>
                      ))}
                      {info.subagentNames.length > 4 && (
                        <span
                          className="text-[9px] font-mono"
                          style={{ color: PARCHMENT.textDim }}
                        >
                          +{info.subagentNames.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quick actions for waiting sessions */}
                  {info.paneId && info.sessionStatus && info.sessionStatus !== 'working' && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <QuickActions
                        paneId={info.paneId}
                        sessionStatus={info.sessionStatus!}
                        terminalApp={info.terminalApp as any}
                      />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Idle empty state */}
      {agentData.active.length === 0 && (
        <>
          <ParchmentDivider />
          <IdleEmptyState />
        </>
      )}

      {/* Loafing — org hierarchy with team groups */}
      {teamGroups.length > 0 && (
        <>
          <ParchmentDivider ornament />
          <SectionHeader
            icon={<Fish className="h-3 w-3" />}
            count={idleCount}
          >
            Loafing
          </SectionHeader>

          <div className="space-y-2">
            {teamGroups.map((group) => (
              <div key={group.name} className="space-y-1">
                {/* Team label */}
                <div className="flex items-center gap-1.5 px-1 py-0.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span
                    className="text-[9px] font-bold font-mono uppercase tracking-wider"
                    style={{ color: group.color }}
                  >
                    {group.name}
                  </span>
                </div>

                {/* Leader card — full width */}
                {group.leader && (
                  <LoafingCard
                    info={group.leader}
                    isReport={false}
                    onSelectAgent={onSelectAgent}
                  />
                )}

                {/* Report cards — indented with connector */}
                {group.reports.map((report) => (
                  <LoafingCard
                    key={report.agent.agentName}
                    info={report}
                    isReport={true}
                    onSelectAgent={onSelectAgent}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

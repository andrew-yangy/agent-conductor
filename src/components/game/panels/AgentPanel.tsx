// ---------------------------------------------------------------------------
// AgentPanel — detailed game-style agent view with pixel-art cards
// ---------------------------------------------------------------------------

import { useState, useCallback, useMemo } from 'react';
import {
  GitBranch, ExternalLink, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { timeAgo, sessionStatusLabel } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboard-store';
import { API_BASE } from '@/lib/api';
import ActivityLine from '@/components/shared/ActivityLine';
import QuickActions from '@/components/shared/QuickActions';
import SendInput from '@/components/shared/SendInput';
import { type AgentStatus } from '../types';
import { useOfficeAgents } from '../useOfficeAgents';
import {
  statusPriority, shortenModel, StatusChip,
  SectionHeader, PIXEL_CARD, PIXEL_CARD_RAISED,
  ParchmentDivider, PARCHMENT,
} from './panelUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get a meaningful title — extract the task, not the agent preamble */
function sessionTitle(s: { feature?: string; gitBranch?: string; initialPrompt?: string; latestPrompt?: string; slug?: string; id: string }) {
  if (s.feature) return s.feature;
  // Git branch is often more descriptive than the prompt
  if (s.gitBranch && s.gitBranch !== 'main' && s.gitBranch !== 'game') return s.gitBranch;
  // Extract meaningful part from prompts — strip "You are Name, Role." preamble
  const raw = s.initialPrompt || s.latestPrompt;
  if (raw) return cleanPromptTitle(raw);
  if (s.slug) return s.slug;
  return s.id.slice(0, 8);
}

/** Strip agent preamble from prompts to get the actual task description */
function cleanPromptTitle(prompt: string): string {
  let text = prompt;
  // Strip "MODE: " prefix
  text = text.replace(/^MODE:\s*/, '');
  // Strip "You are [Name], [Role]." or "You are [Name], [Role]," — various patterns
  const nameRoleMatch = text.match(/^You are [A-Z][a-z]+ [A-Z][a-z]+[,.]?\s*[A-Z][A-Za-z/ ]*[.,]\s*/);
  if (nameRoleMatch) {
    text = text.slice(nameRoleMatch[0].length);
  }
  // Strip generic "You are" only if next word is a verb-like
  if (!nameRoleMatch) {
    text = text.replace(/^You are (performing|reviewing|decomposing|running|executing|building|creating|writing|doing)\s+/i, '$1 ');
  }
  // Strip "You " if still starting with it and followed by a past tense verb
  text = text.replace(/^You (proposed|completed|finished|started|created|built|reviewed|performed)\s+/i, '$1 ');
  // Capitalize first letter
  if (text.length > 0) text = text[0].toUpperCase() + text.slice(1);
  return text.slice(0, 60);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AgentPanelProps {
  agentName: string;
  agentStatuses: Record<string, AgentStatus>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgentPanel({ agentName, agentStatuses }: AgentPanelProps) {
  const sessions = useDashboardStore((s) => s.sessions);
  const sessionActivities = useDashboardStore((s) => s.sessionActivities);
  const officeAgents = useOfficeAgents();
  const agent = officeAgents.find((a) => a.agentName === agentName);
  const status = agentStatuses[agentName] ?? 'offline';

  const { activeSessions, recentIdle } = useMemo(() => {
    const primary = sessions.filter((s) => s.agentName === agentName && !s.isSubagent);
    const subagent = sessions.filter((s) => s.agentName === agentName && s.isSubagent);
    const isActive = (s: typeof sessions[0]) =>
      s.status === 'working' || s.status === 'waiting-approval' ||
      s.status === 'waiting-input' || s.status === 'error' ||
      s.status === 'paused';

    // Prefer primary sessions; fall back to subagent sessions if no active primaries
    let activePrimary = primary.filter(isActive);
    let active = activePrimary.length > 0
      ? activePrimary
      : subagent.filter(isActive).slice(0, 3); // cap subagent display
    active = active.sort((a, b) => statusPriority(a.status) - statusPriority(b.status));

    // Historical: all non-active sessions with some content, sorted by recency
    const activeIds = new Set(active.map((s) => s.id));
    const historical = [...primary, ...subagent]
      .filter((s) => !activeIds.has(s.id)
        && (s.feature || s.initialPrompt || s.latestPrompt))
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, 8);
    return { activeSessions: active, recentIdle: historical };
  }, [sessions, agentName]);

  const [focusingPane, setFocusingPane] = useState<string | null>(null);
  const handleFocus = useCallback(async (paneId: string) => {
    setFocusingPane(paneId);
    try {
      await fetch(`${API_BASE}/api/actions/focus-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paneId }),
      });
    } catch {
      // silent
    } finally {
      setFocusingPane(null);
    }
  }, []);

  if (!agent) return <p className="text-sm font-mono" style={{ color: PARCHMENT.text }}>Unknown agent</p>;

  return (
    <div className="space-y-3">
      {/* Agent identity card */}
      <div
        className="relative overflow-hidden"
        style={PIXEL_CARD_RAISED}
      >
        {/* Full-width color bar */}
        <div
          className="h-2"
          style={{
            backgroundColor: agent.color,
            boxShadow: `inset 0 -1px 0 0 ${agent.color}80`,
          }}
        />

        <div className="px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            {/* Agent color badge */}
            <span
              className="h-4 w-4 rounded-sm shrink-0"
              style={{
                backgroundColor: agent.color,
                boxShadow: [
                  `0 0 0 1px ${agent.color}`,
                  `inset 1px 1px 0 0 #ffffff40`,
                  `inset -1px -1px 0 0 #00000040`,
                ].join(', '),
              }}
            />
            <span
              className="font-bold text-sm font-mono"
              style={{ color: PARCHMENT.text }}
            >
              {agent.agentName}
            </span>
            <StatusChip status={status === 'working' ? 'working' : status === 'waiting' ? 'waiting-approval' : 'idle'} />
          </div>
          <div
            className="text-xs font-mono"
            style={{ color: PARCHMENT.textDim }}
          >
            {agent.agentRole}
          </div>
        </div>
      </div>

      {/* Active sessions */}
      {activeSessions.length > 0 ? (
        activeSessions.map((sess) => {
          const activity = sessionActivities[sess.id];
          const title = sessionTitle(sess);
          const prompt = sess.latestPrompt ?? sess.initialPrompt;
          const subagents = sessions.filter(
            (s) => s.parentSessionId === sess.id && s.isSubagent,
          );
          const isWaiting = sess.status === 'waiting-approval' || sess.status === 'waiting-input';
          const model = shortenModel(sess.model);

          return (
            <div
              key={sess.id}
              className="relative overflow-hidden"
              style={{
                ...PIXEL_CARD_RAISED,
                borderLeft: `3px solid ${agent.color}`,
              }}
            >
              <div className="px-2 py-2 space-y-1.5">
                {/* Status + model row */}
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <StatusChip
                    status={sess.status}
                    animated={sess.status === 'working'}
                  />
                  <span
                    className="font-semibold truncate"
                    style={{ color: PARCHMENT.text }}
                  >
                    {title}
                  </span>
                  {model && (
                    <span
                      className="text-[9px] px-1 py-0.5 rounded-sm shrink-0 ml-auto"
                      style={{
                        backgroundColor: '#C4A26520',
                        color: PARCHMENT.textDim,
                        border: `1px solid ${PARCHMENT.border}40`,
                      }}
                    >
                      {model}
                    </span>
                  )}
                </div>

                {/* Activity line */}
                {sess.status === 'working' && <ActivityLine activity={activity} />}

                {/* Git branch */}
                {sess.gitBranch && (
                  <div className="flex items-center gap-1 text-[11px] font-mono" style={{ color: PARCHMENT.textDim }}>
                    <GitBranch className="h-3 w-3 shrink-0" />
                    <span className="truncate">{sess.gitBranch}</span>
                  </div>
                )}

                {/* Prompt */}
                {prompt && (
                  <p
                    className="text-[11px] line-clamp-2 leading-tight font-mono"
                    style={{ color: PARCHMENT.textDim }}
                  >
                    {prompt}
                  </p>
                )}

                {/* Subagents */}
                {subagents.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {subagents.slice(0, 4).map((sa) => (
                      <span
                        key={sa.id}
                        className="text-[9px] font-mono px-1 py-0.5 rounded-sm"
                        style={{
                          backgroundColor: '#5B8C3E20',
                          color: '#3D6B26',
                          border: '1px solid #5B8C3E30',
                        }}
                      >
                        {sa.agentName ?? sa.id.slice(0, 6)}
                      </span>
                    ))}
                    {subagents.length > 4 && (
                      <span className="text-[9px] font-mono" style={{ color: PARCHMENT.textDim }}>
                        +{subagents.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Quick actions */}
                {isWaiting && sess.paneId && (
                  <QuickActions
                    paneId={sess.paneId}
                    sessionStatus={sess.status}
                    terminalApp={sess.terminalApp}
                  />
                )}

                {/* Send input */}
                {sess.paneId && <SendInput paneId={sess.paneId} terminalApp={sess.terminalApp} />}

                {/* Focus button */}
                {sess.paneId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] w-full justify-start gap-1.5 font-mono"
                    style={{ color: PARCHMENT.text }}
                    onClick={() => handleFocus(sess.paneId!)}
                    disabled={focusingPane === sess.paneId}
                  >
                    {focusingPane === sess.paneId ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ExternalLink className="h-3 w-3" />
                    )}
                    Focus terminal
                  </Button>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div
          className="text-center py-4 font-mono"
          style={PIXEL_CARD}
        >
          <p className="text-xs" style={{ color: PARCHMENT.textDim }}>No active sessions</p>
        </div>
      )}

      {/* History */}
      {recentIdle.length > 0 && (
        <>
          <ParchmentDivider ornament />
          <div className="space-y-1.5">
            <SectionHeader>History</SectionHeader>
            {recentIdle.map((s) => {
              const title = sessionTitle(s);
              const prompt = s.initialPrompt || s.latestPrompt;
              const statusColor = s.status === 'done' ? '#5B8C3E'
                : s.status === 'error' ? '#B44' : '#9CA3AF';
              return (
                <div
                  key={s.id}
                  className="px-2 py-1.5 font-mono rounded-sm space-y-0.5"
                  style={PIXEL_CARD}
                >
                  {/* Title + time */}
                  <div className="flex items-start gap-1.5 text-xs">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0 mt-1"
                      style={{ backgroundColor: statusColor }}
                    />
                    <span
                      className="truncate font-medium"
                      style={{ color: PARCHMENT.text }}
                    >
                      {title}
                    </span>
                    <span
                      className="ml-auto shrink-0 text-[10px]"
                      style={{ color: PARCHMENT.textDim, opacity: 0.6 }}
                    >
                      {timeAgo(s.lastActivity)}
                    </span>
                  </div>
                  {/* Prompt snippet — only if title came from feature (not prompt itself) */}
                  {prompt && s.feature && (
                    <p
                      className="text-[10px] line-clamp-1 leading-tight pl-3"
                      style={{ color: PARCHMENT.textDim, opacity: 0.7 }}
                    >
                      {prompt.slice(0, 80)}
                    </p>
                  )}
                  {/* Meta row: branch + model + status */}
                  <div className="flex items-center gap-2 pl-3 text-[10px]" style={{ color: PARCHMENT.textDim, opacity: 0.6 }}>
                    {s.gitBranch && (
                      <span className="flex items-center gap-0.5 truncate">
                        <GitBranch className="h-2.5 w-2.5 shrink-0" />
                        {s.gitBranch}
                      </span>
                    )}
                    {s.model && (
                      <span className="shrink-0">{shortenModel(s.model)}</span>
                    )}
                    <span className="shrink-0" style={{ color: statusColor }}>
                      {sessionStatusLabel(s.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

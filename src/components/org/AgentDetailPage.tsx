import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Terminal, ExternalLink } from 'lucide-react';
import { cn, timeAgo, statusBgColor, sessionStatusLabel } from '@/lib/utils';
import { useDashboardStore } from '@/stores/dashboard-store';
import { AGENT_CONFIGS, getAgentConfig } from './agent-config';
import ActivityLine from '@/components/shared/ActivityLine';
import QuickActions from '@/components/shared/QuickActions';
import SendInput from '@/components/shared/SendInput';
import type { Session, SessionActivity, HookEvent } from '@/stores/types';

async function handleFocus(paneId: string) {
  try {
    await fetch('http://localhost:4444/api/actions/focus-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paneId }),
    });
  } catch {
    // silent
  }
}

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const config = agentId ? getAgentConfig(agentId) : undefined;

  const sessions = useDashboardStore(s => s.sessions);
  const sessionActivities = useDashboardStore(s => s.sessionActivities);
  const events = useDashboardStore(s => s.events);

  // All sessions for this agent
  const agentSessions = useMemo(() => {
    if (!config) return [];
    return sessions.filter(
      s => s.agentName?.toLowerCase() === config.id
    );
  }, [sessions, config]);

  // Parent sessions (not subagents) for this agent
  const parentSessions = useMemo(
    () => agentSessions.filter(s => !s.isSubagent),
    [agentSessions]
  );

  // Subagent / engineer sessions spawned BY this agent's sessions
  const engineerSessions = useMemo(() => {
    const agentSessionIds = new Set(agentSessions.map(s => s.id));
    return sessions.filter(
      s => s.isSubagent && s.parentSessionId && agentSessionIds.has(s.parentSessionId)
    );
  }, [sessions, agentSessions]);

  // Events involving this agent's sessions
  const agentEvents = useMemo(() => {
    const ids = new Set(agentSessions.map(s => s.id));
    return events.filter(e => ids.has(e.sessionId)).slice(0, 50);
  }, [events, agentSessions]);

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Agent not found</p>
          <p className="text-xs text-muted-foreground mt-1">
            "{agentId}" is not a recognized agent
          </p>
          <Link to="/org" className="text-xs text-primary mt-2 inline-block">
            Back to Team
          </Link>
        </div>
      </div>
    );
  }

  const workingSessions = agentSessions.filter(s => s.status === 'working');
  const waitingSessions = agentSessions.filter(
    s => s.status === 'waiting-input' || s.status === 'waiting-approval'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/org">
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className={cn(
            'h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold',
            config.bgColor
          )}>
            {config.title}
          </div>
          <div>
            <h1 className="text-lg font-semibold">{config.name}</h1>
            <p className="text-sm text-muted-foreground">{config.role}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {workingSessions.length > 0 && (
            <Badge className="bg-status-green/20 text-status-green border-0 text-xs">
              {workingSessions.length} working
            </Badge>
          )}
          {waitingSessions.length > 0 && (
            <Badge className="bg-status-yellow/20 text-status-yellow border-0 text-xs">
              {waitingSessions.length} waiting
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {agentSessions.length} total sessions
          </Badge>
        </div>
      </div>

      {/* Description */}
      <Card className={cn('border', config.borderColor)}>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground mb-3">{config.description}</p>
          <div className="flex flex-wrap gap-2">
            {config.domains.map(d => (
              <Badge key={d} variant="secondary" className="text-xs">
                {d}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">
            Sessions ({parentSessions.length})
          </TabsTrigger>
          <TabsTrigger value="engineers">
            Engineers ({engineerSessions.length})
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity ({agentEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-4 space-y-3">
          {parentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No sessions found for {config.name}
            </p>
          ) : (
            <SessionList
              sessions={parentSessions}
              sessionActivities={sessionActivities}
              allSessions={sessions}
            />
          )}
        </TabsContent>

        <TabsContent value="engineers" className="mt-4 space-y-3">
          {engineerSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No engineer subagents have been spawned by {config.name}
            </p>
          ) : (
            <SessionList
              sessions={engineerSessions}
              sessionActivities={sessionActivities}
              allSessions={sessions}
            />
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {agentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No recent activity for {config.name}
            </p>
          ) : (
            <EventList events={agentEvents} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SessionList({
  sessions: displaySessions,
  sessionActivities,
  allSessions,
}: {
  sessions: Session[];
  sessionActivities: Record<string, SessionActivity>;
  allSessions: Session[];
}) {
  // Sort by status priority, then recency
  const statusPriority: Record<string, number> = {
    'working': 0, 'waiting-approval': 1, 'waiting-input': 1, 'error': 2,
    'paused': 3, 'done': 4, 'idle': 5,
  };

  const sorted = [...displaySessions].sort((a, b) => {
    const pa = statusPriority[a.status] ?? 6;
    const pb = statusPriority[b.status] ?? 6;
    if (pa !== pb) return pa - pb;
    return b.lastActivity.localeCompare(a.lastActivity);
  });

  return (
    <div className="space-y-2">
      {sorted.map(session => {
        const activity = sessionActivities[session.id];
        const subagents = allSessions.filter(s => s.parentSessionId === session.id && s.isSubagent);
        const terminalApp = session.terminalApp ?? (session.paneId ? 'tmux' as const : undefined);

        return (
          <Card key={session.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'h-2.5 w-2.5 rounded-full shrink-0',
                    statusBgColor(session.status),
                    session.status === 'working' && 'animate-pulse'
                  )} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {session.slug ?? session.id.slice(0, 12)}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {sessionStatusLabel(session.status)}
                      </Badge>
                      {session.model && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {session.model.replace('claude-', '').replace('-4-6', '')}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {session.project} -- {timeAgo(session.lastActivity)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {session.paneId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleFocus(session.paneId!)}
                    >
                      <Terminal className="h-3 w-3 mr-1" />
                      Focus
                    </Button>
                  )}
                </div>
              </div>

              {/* Activity line */}
              <ActivityLine activity={activity} />

              {/* Prompts */}
              {session.latestPrompt && (
                <div className="text-xs text-muted-foreground bg-secondary/50 rounded p-2 mt-2 line-clamp-2">
                  {session.latestPrompt}
                </div>
              )}

              {/* Git branch */}
              {session.gitBranch && (
                <div className="text-xs text-muted-foreground mt-1.5">
                  Branch: <span className="font-mono">{session.gitBranch}</span>
                </div>
              )}

              {/* Subagents */}
              {subagents.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {subagents.length} subagent{subagents.length !== 1 ? 's' : ''}:
                  {subagents.slice(0, 3).map(sub => (
                    <Badge key={sub.id} variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                      {sub.agentName ?? sub.id.slice(0, 8)}
                    </Badge>
                  ))}
                  {subagents.length > 3 && (
                    <span className="ml-1">+{subagents.length - 3} more</span>
                  )}
                </div>
              )}

              {/* Quick actions */}
              {session.paneId && (
                <>
                  <QuickActions
                    paneId={session.paneId}
                    sessionStatus={session.status}
                    terminalApp={terminalApp}
                  />
                  <SendInput paneId={session.paneId} terminalApp={terminalApp} />
                </>
              )}

              {/* Pane ID */}
              {session.paneId && (
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <ExternalLink className="h-3 w-3" />
                  <span className="font-mono">{session.paneId}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function EventList({ events: displayEvents }: { events: HookEvent[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {displayEvents.map(event => (
            <div key={event.id} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground font-mono shrink-0">
                  {event.sessionId.slice(0, 8)}
                </span>
                <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                  {event.type}
                </Badge>
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
  );
}

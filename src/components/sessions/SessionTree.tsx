import { useState } from 'react';
import { ChevronRight, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import SessionCard from './SessionCard';
import type { ProjectGroup, Session, SessionActivity } from '@/stores/types';

interface SessionTreeProps {
  projects: ProjectGroup[];
  allSessions: Session[];
  sessionActivities: Record<string, SessionActivity>;
  sessionTeamMap: Map<string, { teamName: string; memberName: string }>;
  sessionPaneMap: Map<string, string>;
}

function statusPriority(status: Session['status']): number {
  switch (status) {
    case 'error': return 0;
    case 'waiting-input': return 1;
    case 'waiting-approval': return 2;
    case 'working': return 3;
    case 'paused': return 4;
    case 'idle': return 5;
    default: return 6;
  }
}

export default function SessionTree({
  projects,
  allSessions,
  sessionActivities,
  sessionTeamMap,
  sessionPaneMap,
}: SessionTreeProps) {
  // Track which projects are expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand projects with active sessions
    const initial = new Set<string>();
    for (const project of projects) {
      const hasActive = project.sessions.some((s) => s.status === 'working' || s.status === 'waiting-approval' || s.status === 'waiting-input' || s.status === 'done' || s.status === 'error');
      if (hasActive) initial.add(project.dirName);
    }
    return initial;
  });

  const toggleProject = (dirName: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dirName)) {
        next.delete(dirName);
      } else {
        next.add(dirName);
      }
      return next;
    });
  };

  // Sort projects: those with active sessions first, then by name
  const sortedProjects = [...projects].sort((a, b) => {
    const aActive = a.sessions.some((s) => s.status === 'working');
    const bActive = b.sessions.some((s) => s.status === 'working');
    if (aActive !== bActive) return aActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Build subagent lookup: parentSessionId → subagent sessions
  const subagentMap = new Map<string, Session[]>();
  for (const session of allSessions) {
    if (session.isSubagent && session.parentSessionId) {
      const existing = subagentMap.get(session.parentSessionId) ?? [];
      existing.push(session);
      subagentMap.set(session.parentSessionId, existing);
    }
  }

  return (
    <div className="space-y-2">
      {sortedProjects.map((project) => {
        const isOpen = expanded.has(project.dirName);
        const activeCount = project.sessions.filter((s) => s.status === 'working').length;
        const totalCount = project.sessions.length;

        // Sort sessions: active first, then by status priority
        const sortedSessions = [...project.sessions].sort((a, b) =>
          statusPriority(a.status) - statusPriority(b.status)
        );

        return (
          <Collapsible
            key={project.dirName}
            open={isOpen}
            onOpenChange={() => toggleProject(project.dirName)}
          >
            <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-muted/50 transition-colors text-left">
              <ChevronRight
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                  isOpen && 'rotate-90'
                )}
              />
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm font-medium truncate">{project.name}</span>
              <div className="flex items-center gap-1.5 ml-auto shrink-0">
                {activeCount > 0 && (
                  <Badge variant="default" className="text-[10px] px-1.5 py-0">
                    {activeCount} active
                  </Badge>
                )}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {totalCount}
                </Badge>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="ml-6 mt-1 space-y-2">
                {sortedSessions.map((session) => {
                  const subagents = subagentMap.get(session.id) ?? [];
                  const sortedSubagents = [...subagents].sort((a, b) =>
                    statusPriority(a.status) - statusPriority(b.status)
                  );

                  return (
                    <div key={session.id}>
                      <SessionCard
                        session={session}
                        teamInfo={sessionTeamMap.get(session.id)}
                        paneId={sessionPaneMap.get(session.id)}
                        sessionActivity={sessionActivities[session.id]}
                      />
                      {sortedSubagents.length > 0 && (
                        <div className="ml-6 mt-1 border-l border-border pl-2 space-y-0.5">
                          {sortedSubagents.map((sub) => (
                            <SessionCard
                              key={sub.id}
                              session={sub}
                              sessionActivity={sessionActivities[sub.id]}
                              compact
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

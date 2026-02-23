import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { PromptEntry } from '@/stores/types';
import { useDashboardStore } from '@/stores/dashboard-store';
import { cn } from '@/lib/utils';

interface PromptHistoryProps {
  entries: PromptEntry[];
}

function projectName(projectPath: string): string {
  const parts = projectPath.split('/');
  return parts[parts.length - 1] || projectPath;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_COLORS: Record<string, string> = {
  working: 'bg-status-green',
  'waiting-approval': 'bg-yellow-500',
  'waiting-input': 'bg-yellow-500',
  done: 'bg-status-done',
  paused: 'bg-orange-400',
  idle: 'bg-zinc-500',
  error: 'bg-status-red',
};

export default function PromptHistory({ entries }: PromptHistoryProps) {
  const [search, setSearch] = useState('');
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessions = useDashboardStore((s) => s.sessions);

  // Build session lookup by ID
  const sessionMap = useMemo(() => {
    const map = new Map<string, { slug?: string; status: string }>();
    for (const s of sessions) {
      map.set(s.id, { slug: s.slug, status: s.status });
    }
    return map;
  }, [sessions]);

  const projects = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      const name = projectName(e.project);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (activeProject) {
      result = result.filter((e) => projectName(e.project) === activeProject);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) => e.display.toLowerCase().includes(q));
    }
    return result;
  }, [entries, search, activeProject]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 80,
    overscan: 15,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filtered.length} of {entries.length}
        </span>
      </div>

      {/* Project filter badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge
          variant={activeProject === null ? 'default' : 'outline'}
          className="cursor-pointer text-xs"
          onClick={() => setActiveProject(null)}
        >
          All
        </Badge>
        {projects.map(({ name, count }) => (
          <Badge
            key={name}
            variant={activeProject === name ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setActiveProject(activeProject === name ? null : name)}
          >
            {name} ({count})
          </Badge>
        ))}
      </div>

      {/* Virtual scrolled list */}
      <div ref={scrollRef} className="h-[calc(100vh-320px)] overflow-auto rounded-md border border-border">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vRow) => {
            const entry = filtered[vRow.index];
            const session = sessionMap.get(entry.sessionId);
            return (
              <div
                key={vRow.key}
                ref={virtualizer.measureElement}
                data-index={vRow.index}
                className="absolute left-0 right-0 border-b border-border/50"
                style={{ transform: `translateY(${vRow.start}px)` }}
              >
                <Card className="border-0 rounded-none shadow-none">
                  <CardContent className="px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed line-clamp-2">{entry.display}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {session ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_COLORS[session.status] ?? 'bg-muted-foreground')} />
                                <span className="text-[10px] text-muted-foreground">{session.status}</span>
                              </div>
                              {session.slug && (
                                <span className="text-[10px] text-muted-foreground/70 truncate max-w-48">
                                  {session.slug}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">
                              {entry.sessionId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {projectName(entry.project)}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

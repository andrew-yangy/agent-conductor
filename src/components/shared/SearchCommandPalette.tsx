import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '@/stores/dashboard-store';
import {
  Target,
  Layers,
  ListChecks,
  FileText,
  MessageSquare,
  Search as SearchIcon,
  BookOpen,
  ArrowRight,
  Zap,
} from 'lucide-react';
import type { WorkItem, SearchResult, FeatureRecord, GoalRecord } from '@/stores/types';

// ---------------------------------------------------------------------------
// Type icon helper
// ---------------------------------------------------------------------------

function typeIcon(type: string) {
  switch (type) {
    case 'goal':
      return <Target className="h-4 w-4 text-primary shrink-0" />;
    case 'feature':
      return <Layers className="h-4 w-4 text-status-yellow shrink-0" />;
    case 'backlog-item':
      return <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />;
    case 'report':
      return <FileText className="h-4 w-4 text-status-green shrink-0" />;
    case 'discussion':
      return <MessageSquare className="h-4 w-4 text-status-blue shrink-0" />;
    case 'research':
      return <BookOpen className="h-4 w-4 text-primary shrink-0" />;
    case 'directive':
      return <SearchIcon className="h-4 w-4 text-status-yellow shrink-0" />;
    default:
      return <Layers className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function statusBadge(status: string) {
  const colorMap: Record<string, string> = {
    'in_progress': 'bg-status-yellow/15 text-status-yellow border-status-yellow/30',
    'completed': 'bg-status-green/15 text-status-green border-status-green/30',
    'blocked': 'bg-status-red/15 text-status-red border-status-red/30',
    'pending': 'bg-secondary text-muted-foreground border-border',
    'deferred': 'bg-secondary text-muted-foreground border-border',
    'abandoned': 'bg-secondary text-muted-foreground border-border',
  };
  return (
    <Badge
      variant="outline"
      className={`text-[9px] px-1 py-0 shrink-0 ${colorMap[status] ?? colorMap['pending']}`}
    >
      {status}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Group items by type
// ---------------------------------------------------------------------------

function groupByType(items: WorkItem[]) {
  const groups: Record<string, WorkItem[]> = {};
  for (const item of items) {
    const key = item.type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

const GROUP_ORDER = ['goal', 'feature', 'backlog-item', 'directive', 'report', 'discussion', 'research'];
const GROUP_LABELS: Record<string, string> = {
  'goal': 'Goals',
  'feature': 'Features',
  'backlog-item': 'Backlog Items',
  'directive': 'Directives',
  'report': 'Reports',
  'discussion': 'Discussions',
  'research': 'Research',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SearchCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkItem[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const workState = useDashboardStore((s) => s.workState);

  // Cleanup debounce timer and abort inflight fetch on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  // Build goalId → display name map
  const goalNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const goal of workState?.goals?.goals ?? []) {
      map[goal.id] = goal.title;
    }
    return map;
  }, [workState?.goals]);

  // Get active features for default state
  const activeFeatures = useMemo(() => {
    return (workState?.features?.features ?? []).filter(
      (f: FeatureRecord) => f.status === 'in_progress' || f.status === 'pending'
    ).slice(0, 5);
  }, [workState?.features]);

  // Cmd+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search with abort on stale requests
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`http://localhost:4444/api/state/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then(res => res.json())
        .then((data: SearchResult) => {
          setResults(data.results ?? []);
          setSearching(false);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          setResults([]);
          setSearching(false);
        });
    }, 300);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    search(value);
  }

  function handleSelect(item: WorkItem) {
    setOpen(false);
    setQuery('');
    setResults([]);

    // Deep-link: navigate to the right page AND highlight the specific item
    if (item.type === 'report' || item.type === 'discussion' || item.type === 'research') {
      navigate(`/artifacts?tab=${item.type === 'report' ? 'reports' : item.type === 'discussion' ? 'discussions' : 'research'}&highlight=${item.id}`);
    } else if (item.type === 'backlog-item') {
      navigate(`/projects?expand=${item.goalId}&tab=backlog&highlight=${item.id}`);
    } else if (item.type === 'feature') {
      navigate(`/projects?expand=${item.goalId}&highlight=${item.id}`);
    } else if (item.type === 'goal') {
      navigate(`/projects?expand=${item.id}`);
    } else if (item.type === 'directive') {
      // Directives are shown in artifacts as conductor items
      navigate(`/artifacts?tab=reports&highlight=${item.id}`);
    } else {
      navigate('/projects');
    }
  }

  function goalDisplayName(goalId: string): string {
    return goalNameMap[goalId] ?? goalId.replace(/-/g, ' ');
  }

  // Feature-specific detail line
  function featureDetail(item: WorkItem) {
    if (item.type !== 'feature') return null;
    const f = item as FeatureRecord;
    if (f.taskCount === 0) return null;
    const pct = Math.round((f.completedTaskCount / f.taskCount) * 100);
    return (
      <span className="text-[10px] text-muted-foreground ml-1">
        {f.completedTaskCount}/{f.taskCount} tasks ({pct}%)
      </span>
    );
  }

  const grouped = groupByType(results);
  const showDefault = query.length < 2 && !searching;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search goals, features, backlog..."
        value={query}
        onValueChange={handleQueryChange}
      />
      <CommandList>
        {/* Default state — show active work and quick nav */}
        {showDefault && (
          <>
            {activeFeatures.length > 0 && (
              <CommandGroup heading="Active Work">
                {activeFeatures.map((f: FeatureRecord) => (
                  <CommandItem
                    key={`active-${f.id}`}
                    value={`${f.title} ${f.id}`}
                    onSelect={() => handleSelect(f as unknown as WorkItem)}
                    className="gap-3"
                  >
                    <Zap className="h-4 w-4 text-status-yellow shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{f.title}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {goalDisplayName(f.goalId)} · {f.completedTaskCount}/{f.taskCount} tasks
                      </div>
                    </div>
                    {statusBadge(f.status)}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading="Quick Navigation">
              <CommandItem onSelect={() => { setOpen(false); navigate('/projects'); }} className="gap-3">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">Projects</span>
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); navigate('/artifacts'); }} className="gap-3">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">Artifacts</span>
              </CommandItem>
              <CommandItem onSelect={() => { setOpen(false); navigate('/'); }} className="gap-3">
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm">Dashboard</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {query.length >= 2 && !searching && results.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {searching && results.length === 0 && (
          <CommandEmpty>Searching...</CommandEmpty>
        )}

        {GROUP_ORDER.map(type => {
          const items = grouped[type];
          if (!items || items.length === 0) return null;

          return (
            <div key={type}>
              <CommandGroup heading={GROUP_LABELS[type] ?? type}>
                {items.map(item => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`${item.title} ${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="gap-3"
                  >
                    {typeIcon(item.type)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {item.title}
                        {featureDetail(item)}
                      </div>
                      {item.goalId && item.type !== 'goal' && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {goalDisplayName(item.goalId)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {statusBadge(item.status)}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
